import { NextResponse } from "next/server";
import type { AccMoneyMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { saveInvoice } from "@/lib/accounting/invoices/service";
import { createMoneyDoc } from "@/lib/accounting/cash/docs";
import { walkInParty } from "@/lib/accounting/parties";
import { balancesBy } from "@/lib/accounting/ledger/balances";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — پیش‌فرض‌های فروش سریع: صندوق‌ها و بانک‌ها، انبار پیش‌فرض، مالیات */
export async function GET() {
  const guard = await requirePermission("ACC_SALES");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [settings, warehouses, treasuries, bal] = await Promise.all([
    prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, vatEnabled: true, vatRateBp: true, pricesIncludeVat: true } }),
    prisma.accWarehouse.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true, isDefault: true } }),
    prisma.accTreasury.findMany({ where: { isActive: true, kind: { in: ["CASH", "BANK", "POS"] } }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, name: true, kind: true } }),
    balancesBy(prisma, "treasuryId"),
  ]);
  return NextResponse.json(
    serialize({
      mode: settings?.mode ?? "NONE",
      vatEnabled: !!settings?.vatEnabled,
      vatRateBp: settings?.vatRateBp ?? 0,
      pricesIncludeVat: !!settings?.pricesIncludeVat,
      warehouses,
      treasuries: treasuries.map((t) => ({ ...t, balance: bal.get(t.id)?.balance ?? 0n })),
      today: dayValue(todayKey()),
      can: { pay: can(guard.access, "ACC_TREASURY") },
    }),
  );
}

interface Body {
  partyId?: string | null;
  warehouseId?: string | null;
  invoiceDiscount?: unknown;
  note?: string | null;
  overrideCredit?: boolean;
  lines?: { productId?: string | null; title?: string; qty?: unknown; unitPrice?: unknown; discount?: unknown; vatRateBp?: unknown }[];
  payments?: { method?: string; treasuryId?: string | null; amount?: unknown }[];
}

const METHODS: AccMoneyMethod[] = ["CASH", "POS", "CARD_TRANSFER", "GIFT_CARD"];

/**
 * POST — فروش سریع حضوری (فاز ۱۰): فاکتور فروش صادرشده + دریافت تخصیص‌یافته به
 * همان فاکتور، در یک تراکنش. بی‌شخص ← «مشتری حضوری» (و آن‌وقت نسیه ممنوع).
 */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_SALES");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<Body>(req);
    const actor = actorOf(guard.access);
    const lines = (b.lines ?? []).map((l, i) => {
      const qty = Number(l.qty);
      if (!Number.isInteger(qty) || qty <= 0) throw new AccError(`ردیف ${faNum(i + 1)}: تعداد نامعتبر است`);
      return {
        productId: l.productId || null,
        title: l.title ?? null,
        qty,
        unitPrice: toAmount(l.unitPrice, `فی ردیف ${faNum(i + 1)}`),
        discount: toAmount(l.discount, "تخفیف"),
        vatRateBp: Number(l.vatRateBp) || 0,
      };
    });
    if (!lines.length) throw new AccError("سبد خالی است");
    const payments = (b.payments ?? []).map((p, i) => {
      const method = p.method as AccMoneyMethod;
      if (!METHODS.includes(method)) throw new AccError(`دریافت ${faNum(i + 1)}: روش نامعتبر است`);
      return { method, treasuryId: p.treasuryId || null, amount: toAmount(p.amount) };
    }).filter((p) => p.amount > 0n);
    if (payments.length && !can(guard.access, "ACC_TREASURY")) throw new AccError("ثبت دریافت دسترسی «دریافت و پرداخت» می‌خواهد", 403);

    const out = await prisma.$transaction(
      async (tx) => {
        const party = b.partyId ? await tx.accParty.findUnique({ where: { id: b.partyId } }) : await walkInParty(tx);
        if (!party) throw new AccError("مشتری پیدا نشد");
        const inv = await saveInvoice(
          tx,
          null,
          {
            type: "SALES",
            date: todayKey(),
            partyId: party.id,
            warehouseId: b.warehouseId || null,
            invoiceDiscount: toAmount(b.invoiceDiscount, "تخفیف"),
            note: b.note?.trim() || "فروش حضوری",
            pricesIncludeVat: true,
            lines,
          },
          { issue: true, allowOverCredit: !!b.overrideCredit },
          actor,
        );
        const paid = payments.reduce((s, p) => s + p.amount, 0n);
        if (paid > inv.total) throw new AccError(`دریافتی (${formatAmount(paid)}) از جمع فاکتور (${formatAmount(inv.total)}) بیشتر است؛ باقی را پس بدهید و مبلغ را درست کنید`);
        if (paid < inv.total && party.platformCode === "walk-in") {
          throw new AccError(`${formatAmount(inv.total - paid)} تومان دریافت نشده؛ برای فروش نسیه مشتری را انتخاب کنید`);
        }
        let receiptId: string | null = null;
        if (payments.length) {
          const doc = await createMoneyDoc(
            tx,
            { kind: "RECEIPT", date: todayKey(), partyId: party.id, description: `فروش حضوری — فاکتور ${faNum(inv.number ?? 0)}`, items: payments, allocations: [{ invoiceId: inv.id, amount: paid }] },
            actor,
          );
          receiptId = doc.id;
        }
        return { inv, paid, receiptId, partyName: party.name };
      },
      { timeout: 60_000 },
    );
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: out.inv.id,
      entityTitle: `فاکتور فروش ${out.inv.number}`,
      summary: `فروش حضوری ${faNum(out.inv.number ?? 0)} — ${out.partyName} — ${formatAmount(out.inv.total)} تومان (دریافت ${formatAmount(out.paid)})`,
    });
    return NextResponse.json(serialize({ ok: true, id: out.inv.id, number: out.inv.number, total: out.inv.total, receiptId: out.receiptId }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos]");
  }
}
