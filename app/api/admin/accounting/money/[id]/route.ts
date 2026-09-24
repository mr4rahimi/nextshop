import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { allocateExisting, MONEY_KIND_LABELS, voidMoneyDoc } from "@/lib/accounting/cash/docs";
import { invoiceOpenAmounts, openInvoicesOf } from "@/lib/accounting/cash/allocation";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_TREASURY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const doc = await prisma.accMoneyDoc.findUnique({
    where: { id },
    include: {
      party: { select: { id: true, code: true, name: true, mobile: true } },
      items: { orderBy: { seq: "asc" } },
      allocations: { include: { invoice: { select: { id: true, type: true, number: true, date: true, total: true } } } },
    },
  });
  if (!doc) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  const tIds = doc.items.flatMap((i) => [i.treasuryId, i.toTreasuryId]).filter((x): x is string => !!x);
  const [treasuries, cheques, voucher, order] = await Promise.all([
    prisma.accTreasury.findMany({ where: { id: { in: tIds } }, select: { id: true, name: true, kind: true } }),
    prisma.accCheque.findMany({ where: { id: { in: doc.items.map((i) => i.chequeId).filter((x): x is string => !!x) } }, select: { id: true, serialNo: true, dueDate: true, status: true, direction: true, bankName: true } }),
    doc.voucherId && can(guard.access, "ACC_VOUCHER") ? prisma.accVoucher.findUnique({ where: { id: doc.voucherId }, select: { id: true, number: true, status: true } }) : null,
    doc.paymentId ? prisma.payment.findUnique({ where: { id: doc.paymentId }, select: { order: { select: { id: true, orderNumber: true } } } }) : null,
  ]);
  // فاکتورهای باز همین شخص برای «تخصیص» بعدی
  const open = doc.partyId && doc.kind !== "TRANSFER" && doc.status === "POSTED" ? await openInvoicesOf(prisma, doc.partyId, doc.kind === "RECEIPT" ? "sales" : "purchase") : [];
  const mine = await invoiceOpenAmounts(prisma, doc.allocations.map((a) => a.invoiceId), doc.id);
  const allocatable = [
    ...doc.allocations.map((a) => ({ ...a.invoice, open: mine.get(a.invoiceId)?.open ?? 0n, allocated: a.amount })),
    ...open.filter((o) => !doc.allocations.some((a) => a.invoiceId === o.id)).map((o) => ({ id: o.id, type: o.type, number: o.number, date: o.date, total: o.total, open: o.open, allocated: 0n })),
  ];
  return NextResponse.json(
    serialize({ doc, treasuries, cheques, voucher, order: order?.order ?? null, allocatable, can: { write: can(guard.access, "ACC_TREASURY") } }),
  );
}

/** POST { action: "void", reason } | { action: "allocate", allocations } */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; reason?: string; allocations?: { invoiceId: string; amount: unknown }[] }>(req);
    if (b.action === "void") {
      const doc = await prisma.$transaction((tx) => voidMoneyDoc(tx, id, String(b.reason ?? ""), actorOf(guard.access)), { timeout: 60_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: `${MONEY_KIND_LABELS[doc.kind]} ${doc.number}`, summary: `ابطال ${MONEY_KIND_LABELS[doc.kind]} ${faNum(doc.number)}: ${b.reason}` });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "allocate") {
      const allocations = (b.allocations ?? []).map((a) => ({ invoiceId: String(a.invoiceId), amount: toAmount(a.amount, "مبلغ تخصیص") }));
      await prisma.$transaction((tx) => allocateExisting(tx, id, allocations), { timeout: 60_000 });
      return NextResponse.json({ ok: true });
    }
    throw new AccError("اقدام نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-money]");
  }
}
