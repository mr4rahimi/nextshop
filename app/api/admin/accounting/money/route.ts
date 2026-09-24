import { NextResponse } from "next/server";
import type { AccMoneyKind, AccMoneyMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { createMoneyDoc, MONEY_KIND_LABELS, type MoneyItemInput } from "@/lib/accounting/cash/docs";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, rangeFrom, readJson, requireDay } from "@/lib/accounting/api";
import { parseDay } from "@/lib/accounting/dates";
import { faNum, formatAmount, toLatinDigits } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: AccMoneyKind[] = ["RECEIPT", "PAYMENT", "TRANSFER"];
const METHODS: AccMoneyMethod[] = ["CASH", "CARD_TRANSFER", "BANK_TRANSFER", "POS", "GATEWAY", "CHEQUE"];

/** GET ?kind&q&partyId&from&to&status — فهرست دریافت/پرداخت/انتقال */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_TREASURY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as AccMoneyKind | null;
  const { from, to } = rangeFrom(url);
  const where: Prisma.AccMoneyDocWhereInput = {};
  if (kind && KINDS.includes(kind)) where.kind = kind;
  const status = url.searchParams.get("status");
  if (status === "VOID" || status === "POSTED") where.status = status;
  const partyId = url.searchParams.get("partyId");
  if (partyId) where.partyId = partyId;
  if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const lat = toLatinDigits(q);
    where.OR = [
      { party: { name: { contains: q, mode: "insensitive" } } },
      { description: { contains: q, mode: "insensitive" } },
      ...(/^\d{1,9}$/.test(lat) ? [{ number: Number(lat) }] : []),
    ];
  }
  const [items, agg] = await Promise.all([
    prisma.accMoneyDoc.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 150,
      include: { party: { select: { id: true, name: true } }, items: { select: { method: true, treasuryId: true, toTreasuryId: true } }, _count: { select: { allocations: true } } },
    }),
    prisma.accMoneyDoc.aggregate({ where: { ...where, status: "POSTED" }, _sum: { total: true }, _count: true }),
  ]);
  const tIds = [...new Set(items.flatMap((i) => i.items.flatMap((x) => [x.treasuryId, x.toTreasuryId])).filter((x): x is string => !!x))];
  const treasuries = Object.fromEntries((await prisma.accTreasury.findMany({ where: { id: { in: tIds } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  return NextResponse.json(
    serialize({ items, treasuries, summary: { count: agg._count, total: agg._sum.total ?? 0n }, can: { write: can(guard.access, "ACC_TREASURY") } }),
  );
}

interface ItemBody {
  method?: string;
  treasuryId?: string | null;
  toTreasuryId?: string | null;
  amount?: unknown;
  fee?: unknown;
  trackingCode?: string | null;
  endorseChequeId?: string | null;
  cheque?: { serialNo?: string; sayadId?: string; bankName?: string; branch?: string; ownerName?: string; dueDate?: string; issueDate?: string; chequeBookId?: string; note?: string } | null;
}

/** POST — دریافت/پرداخت/انتقال تازه */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ kind?: string; date?: string; partyId?: string; description?: string; items?: ItemBody[]; allocations?: { invoiceId: string; amount: unknown }[] | "auto" }>(req);
    const kind = b.kind as AccMoneyKind;
    if (!KINDS.includes(kind)) throw new AccError("نوع نامعتبر است");
    const items: MoneyItemInput[] = (b.items ?? []).map((it, i) => {
      const method = (kind === "TRANSFER" ? "BANK_TRANSFER" : it.method) as AccMoneyMethod;
      if (!METHODS.includes(method)) throw new AccError(`ردیف ${faNum(i + 1)}: روش را انتخاب کنید`);
      const c = it.cheque;
      return {
        method,
        treasuryId: it.treasuryId || null,
        toTreasuryId: it.toTreasuryId || null,
        amount: toAmount(it.amount),
        fee: toAmount(it.fee, "کارمزد"),
        trackingCode: it.trackingCode ?? null,
        endorseChequeId: it.endorseChequeId || null,
        cheque: c && !it.endorseChequeId
          ? {
              serialNo: String(c.serialNo ?? ""),
              sayadId: c.sayadId || null,
              bankName: c.bankName || null,
              branch: c.branch || null,
              ownerName: c.ownerName || null,
              dueDate: requireDay(c.dueDate, "سررسید چک"),
              issueDate: parseDay(c.issueDate),
              chequeBookId: c.chequeBookId || null,
              note: c.note || null,
            }
          : null,
      };
    });
    const allocations = b.allocations === "auto" ? "auto" : (b.allocations ?? []).map((a) => ({ invoiceId: String(a.invoiceId), amount: toAmount(a.amount, "مبلغ تخصیص") }));
    const doc = await prisma.$transaction(
      (tx) => createMoneyDoc(tx, { kind, date: requireDay(b.date), partyId: b.partyId || null, description: b.description, items, allocations }, actorOf(guard.access)),
      { timeout: 60_000 },
    );
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: doc.id,
      entityTitle: `${MONEY_KIND_LABELS[kind]} ${doc.number}`,
      summary: `${MONEY_KIND_LABELS[kind]} ${faNum(doc.number)} — ${formatAmount(doc.total)} تومان`,
    });
    return NextResponse.json(serialize({ ok: true, id: doc.id, number: doc.number }));
  } catch (e) {
    return accErrorResponse(e, "[acc-money]");
  }
}
