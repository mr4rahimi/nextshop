import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { canSee, permOf } from "@/lib/accounting/invoices/query";
import { INVOICE_TYPE_LABELS } from "@/lib/accounting/invoices/calc";
import { invoiceOpenAmounts } from "@/lib/accounting/cash/allocation";
import { nextChequeSerial } from "@/lib/accounting/cash/cheques";
import { createPlan, planOfInvoice, reschedulePlan, voidPlan, type PlanChequeInput } from "@/lib/accounting/installments";
import type { FeeMode } from "@/lib/accounting/installments-calc";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";
import { dayValue, parseDay, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET — برنامه‌ی اقساط فاکتور (اگر هست) + داده‌ی فرم ساخت */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const inv = await prisma.accInvoice.findUnique({
      where: { id },
      select: { id: true, type: true, number: true, date: true, status: true, total: true, partyId: true, partyName: true, partyPhone: true, partyAddress: true },
    });
    if (!inv || !canSee(guard.access, inv.type)) throw new AccError("فاکتور پیدا نشد", 404);
    const [open, plan, banks, party] = await Promise.all([
      invoiceOpenAmounts(prisma, [inv.id]),
      planOfInvoice(prisma, inv.id),
      inv.type === "PURCHASE" ? prisma.accTreasury.findMany({ where: { kind: "BANK", isActive: true }, select: { id: true, name: true, bankName: true } }) : Promise.resolve([]),
      prisma.accParty.findUnique({ where: { id: inv.partyId }, select: { name: true, mobile: true, nationalId: true, address: true } }),
    ]);
    const nextSerial: Record<string, { serial: string; bookId: string } | null> = {};
    for (const b of banks) nextSerial[b.id] = await nextChequeSerial(prisma, b.id);
    const acc = await prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { sellerName: true, sellerPhone: true, sellerAddress: true } });
    return NextResponse.json(
      serialize({
        invoice: inv,
        party,
        seller: acc,
        settlement: open.get(inv.id),
        plan,
        banks: banks.map((b) => ({ ...b, nextSerial: nextSerial[b.id] })),
        today: dayValue(todayKey()),
        can: { write: can(guard.access, permOf(inv.type)), pay: can(guard.access, "ACC_TREASURY") },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-installments]");
  }
}

interface Body {
  action?: "create" | "reschedule" | "void";
  downPayment?: unknown;
  feeMode?: FeeMode;
  feeRatePercent?: unknown;
  feeAmount?: unknown;
  intervalMonths?: unknown;
  date?: string;
  note?: string;
  items?: { dueDate: string; amount: unknown }[];
  cheques?: (PlanChequeInput | null)[];
  reason?: string;
}

/** POST { action: "create" | "reschedule" | "void", … } */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission(["ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const inv = await prisma.accInvoice.findUnique({ where: { id }, select: { id: true, type: true, number: true, partyName: true } });
    if (!inv) throw new AccError("فاکتور پیدا نشد", 404);
    if (!can(guard.access, permOf(inv.type))) throw new AccError("به این فاکتور دسترسی ندارید", 403);
    const b = await readJson<Body>(req);
    const actor = actorOf(guard.access);
    const items = (b.items ?? []).map((it, i) => ({ dueDate: requireDay(it.dueDate, `سررسید قسط ${faNum(i + 1)}`), amount: toAmount(it.amount, `مبلغ قسط ${faNum(i + 1)}`) }));
    const title = `${INVOICE_TYPE_LABELS[inv.type]} ${faNum(inv.number ?? 0)}`;

    if (b.action === "create") {
      const cheques = (b.cheques ?? []).filter((c) => c && c.serialNo?.trim());
      if (cheques.length && !can(guard.access, "ACC_TREASURY")) throw new AccError("ثبت چک اقساط دسترسی دریافت و پرداخت می‌خواهد", 403);
      const rate = Number(String(b.feeRatePercent ?? "0").replace(/[٫,]/g, "."));
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new AccError("درصد کارمزد نامعتبر است");
      const plan = await prisma.$transaction(
        (tx) =>
          createPlan(
            tx,
            id,
            {
              downPayment: toAmount(b.downPayment, "پیش‌پرداخت"),
              feeMode: (["NONE", "MONTHLY", "TOTAL", "FIXED"] as const).includes(b.feeMode as FeeMode) ? (b.feeMode as FeeMode) : "NONE",
              feeRateBp: Math.round(rate * 100),
              feeAmount: toAmount(b.feeAmount, "کارمزد"),
              intervalMonths: Number(b.intervalMonths) || 1,
              items,
              cheques: b.cheques ?? null,
              date: parseDay(b.date),
              note: b.note ?? null,
            },
            actor,
          ),
        { timeout: 60_000 },
      );
      await logActivity({
        action: "CREATE",
        entity: "OTHER",
        entityId: plan.id,
        entityTitle: `اقساط ${title}`,
        summary: `برنامه‌ی ${faNum(plan.count)} قسط برای ${title} — ${inv.partyName}؛ مبلغ قسطی ${formatAmount(plan.principal)}${plan.feeAmount > 0n ? ` + کارمزد ${formatAmount(plan.feeAmount)}` : ""}`,
      });
      return NextResponse.json(serialize({ ok: true, planId: plan.id }));
    }

    const plan = await prisma.accInstallmentPlan.findUnique({ where: { invoiceId: id }, select: { id: true } });
    if (!plan) throw new AccError("این فاکتور برنامه‌ی اقساط ندارد", 404);
    if (b.action === "reschedule") {
      await prisma.$transaction((tx) => reschedulePlan(tx, plan.id, items, actor));
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: plan.id, entityTitle: `اقساط ${title}`, summary: `زمان‌بندی تازه‌ی اقساط ${title} — ${faNum(items.length)} قسط` });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "void") {
      await prisma.$transaction((tx) => voidPlan(tx, plan.id, String(b.reason ?? ""), actor));
      await logActivity({ action: "DELETE", entity: "OTHER", entityId: plan.id, entityTitle: `اقساط ${title}`, summary: `ابطال برنامه‌ی اقساط ${title}: ${b.reason}` });
      return NextResponse.json({ ok: true });
    }
    throw new AccError("اقدام نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-installments]");
  }
}
