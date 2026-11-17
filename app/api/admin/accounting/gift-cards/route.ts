import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { parseDay } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { forfeitExpired, giftDetail, giftList, issueGiftCards, returnGiftCards } from "@/lib/accounting/gift-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** دیدن: حسابداری، خزانه یا مدیر صندوق. فروش، مرجوع و سوخت: خزانه یا مدیر صندوق — webhesab-parity.md بخش ۲۷ */
const VIEW = ["ACC_VIEW", "ACC_TREASURY", "ACC_POS_MANAGE"];
const MANAGE = ["ACC_TREASURY", "ACC_POS_MANAGE"];

/** GET ?q&status=active|expired|closed|returned&batch&page — فهرست؛ ?number — یک بن با گردش */
export async function GET(req: Request) {
  const guard = await requirePermission(VIEW);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    if (sp.get("number")) return NextResponse.json(serialize(await giftDetail(prisma, sp.get("number")!)));
    const [list, treasuries] = await Promise.all([
      giftList(prisma, { q: sp.get("q"), status: sp.get("status"), batch: sp.get("batch"), page: Number(sp.get("page")) || 1 }),
      prisma.accTreasury.findMany({ where: { isActive: true, kind: { in: ["CASH", "BANK", "POS"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    ]);
    return NextResponse.json(serialize({ ...list, treasuries, can: { manage: MANAGE.some((p) => can(guard.access, p)) } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-gift]");
  }
}

interface Body {
  action?: "issue" | "return" | "forfeit";
  count?: unknown;
  prefix?: string;
  numbers?: unknown;
  amount?: unknown;
  saleDiscount?: unknown;
  minInvoice?: unknown;
  singleUse?: boolean;
  expiresAt?: string | null;
  buyerPartyId?: string | null;
  batch?: string | null;
  note?: string | null;
  pay?: { treasuryId?: string; method?: string } | null;
}

const METHODS = ["CASH", "POS", "BANK_TRANSFER", "CARD_TRANSFER"] as const;

export async function POST(req: Request) {
  const guard = await requirePermission(MANAGE);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<Body>(req);
    const actor = actorOf(guard.access);
    const numbers = Array.isArray(b.numbers) ? b.numbers.map(String) : typeof b.numbers === "string" ? b.numbers.split(/[\s,،;]+/) : [];
    if (b.action === "return") {
      const r = await prisma.$transaction((tx) => returnGiftCards(tx, numbers, b.note?.trim() || null, actor), { timeout: 60_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityTitle: "بن کارت", summary: `${faNum(r.count)} بن کارت مرجوع شد` });
      return NextResponse.json(serialize({ ok: true, ...r }));
    }
    if (b.action === "forfeit") {
      const r = await prisma.$transaction((tx) => forfeitExpired(tx, actor), { timeout: 60_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityTitle: "بن کارت", summary: `سوخت ${faNum(r.count)} بن منقضی، ${formatAmount(r.amount)} تومان` });
      return NextResponse.json(serialize({ ok: true, ...r }));
    }
    if (b.action !== "issue") throw new AccError("عملیات نامعتبر است");
    const method = b.pay?.method && (METHODS as readonly string[]).includes(b.pay.method) ? (b.pay.method as (typeof METHODS)[number]) : "CASH";
    const r = await prisma.$transaction(
      (tx) =>
        issueGiftCards(
          tx,
          {
            count: Number(b.count) || undefined,
            prefix: b.prefix,
            numbers: numbers.filter((n) => n.trim()),
            amount: toAmount(b.amount, "مبلغ بن"),
            saleDiscount: b.saleDiscount ? toAmount(b.saleDiscount, "تخفیف") : 0n,
            minInvoice: b.minInvoice ? toAmount(b.minInvoice, "حداقل خرید") : 0n,
            singleUse: !!b.singleUse,
            expiresAt: parseDay(b.expiresAt ?? null),
            buyerPartyId: b.buyerPartyId || null,
            batch: b.batch ?? null,
            note: b.note?.trim() || null,
            pay: b.pay?.treasuryId ? { treasuryId: b.pay.treasuryId, method } : null,
          },
          actor,
        ),
      { timeout: 120_000 },
    );
    await logActivity({ action: "CREATE", entity: "OTHER", entityTitle: "بن کارت", summary: `فروش ${faNum(r.count)} بن کارت، ${formatAmount(r.total)} تومان` });
    return NextResponse.json(serialize({ ok: true, ...r }));
  } catch (e) {
    return accErrorResponse(e, "[acc-gift]");
  }
}
