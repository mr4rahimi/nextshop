import { NextResponse } from "next/server";
import type { AccMoneyMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { createMoneyDoc, type MoneyItemInput } from "@/lib/accounting/cash/docs";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, rangeFrom, readJson, requireDay } from "@/lib/accounting/api";
import { parseDay } from "@/lib/accounting/dates";
import { faNum, formatAmount, toLatinDigits } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS: AccMoneyMethod[] = ["CASH", "CARD_TRANSFER", "BANK_TRANSFER", "CHEQUE"];

/**
 * GET ?q&accountId&from&to&status&unpaid=1 — فهرست هزینه‌ها + جمع هر سرفصل در همان
 * بازه (فقط معتبرها). `unpaid=1`: هزینه‌هایی که بخشی‌شان نسیه مانده.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_EXPENSE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const { from, to } = rangeFrom(url);
  const where: Prisma.AccMoneyDocWhereInput = { kind: "EXPENSE" };
  if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const status = url.searchParams.get("status");
  if (status === "VOID" || status === "POSTED") where.status = status;
  if (url.searchParams.get("unpaid") === "1") where.payable = { gt: 0n };
  const accountId = url.searchParams.get("accountId");
  if (accountId) where.lines = { some: { accountId } };
  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const lat = toLatinDigits(q);
    where.OR = [
      { party: { name: { contains: q, mode: "insensitive" } } },
      { description: { contains: q, mode: "insensitive" } },
      { lines: { some: { description: { contains: q, mode: "insensitive" } } } },
      ...(/^\d{1,9}$/.test(lat) ? [{ number: Number(lat) }] : []),
    ];
  }

  const [items, agg, byAccount] = await Promise.all([
    prisma.accMoneyDoc.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 150,
      include: {
        party: { select: { id: true, name: true } },
        lines: { orderBy: { seq: "asc" }, select: { accountId: true, amount: true, description: true } },
        items: { select: { method: true } },
      },
    }),
    prisma.accMoneyDoc.aggregate({ where: { ...where, status: "POSTED" }, _sum: { total: true, payable: true }, _count: true }),
    // جمع هر سرفصل — بی‌فیلتر سرفصل تا تفکیک کامل بماند
    prisma.accMoneyLine.groupBy({
      by: ["accountId"],
      where: { moneyDoc: { ...where, lines: undefined, status: "POSTED" } },
      _sum: { amount: true },
    }),
  ]);
  const accIds = [...new Set([...items.flatMap((i) => i.lines.map((l) => l.accountId)), ...byAccount.map((b) => b.accountId)])];
  const accounts = Object.fromEntries(
    (await prisma.accAccount.findMany({ where: { id: { in: accIds } }, select: { id: true, code: true, name: true } })).map((a) => [a.id, a]),
  );
  const breakdown = byAccount
    .map((b) => ({ accountId: b.accountId, name: accounts[b.accountId]?.name ?? "—", amount: b._sum.amount ?? 0n }))
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));

  return NextResponse.json(
    serialize({
      items,
      accounts,
      breakdown,
      summary: { count: agg._count, total: agg._sum.total ?? 0n, payable: agg._sum.payable ?? 0n },
      can: { write: can(guard.access, "ACC_EXPENSE") },
    }),
  );
}

interface Body {
  date?: string;
  partyId?: string | null;
  description?: string;
  vatAmount?: unknown;
  lines?: { accountId?: string; amount?: unknown; description?: string | null }[];
  items?: {
    method?: string;
    treasuryId?: string | null;
    amount?: unknown;
    trackingCode?: string | null;
    cheque?: { serialNo?: string; sayadId?: string; dueDate?: string; issueDate?: string; chequeBookId?: string; note?: string } | null;
  }[];
}

/** POST — هزینه‌ی تازه: ردیف‌های «بابت چه» + روش‌های پرداخت؛ کسریِ پرداخت = نسیه */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_EXPENSE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<Body>(req);
    const items: MoneyItemInput[] = (b.items ?? []).map((it, i) => {
      const method = it.method as AccMoneyMethod;
      if (!METHODS.includes(method)) throw new AccError(`پرداخت ${faNum(i + 1)}: روش را انتخاب کنید`);
      const c = it.cheque;
      return {
        method,
        treasuryId: it.treasuryId || null,
        amount: toAmount(it.amount),
        trackingCode: it.trackingCode ?? null,
        cheque:
          method === "CHEQUE"
            ? {
                serialNo: String(c?.serialNo ?? ""),
                sayadId: c?.sayadId || null,
                dueDate: requireDay(c?.dueDate, "سررسید چک"),
                issueDate: parseDay(c?.issueDate),
                chequeBookId: c?.chequeBookId || null,
                note: c?.note || null,
              }
            : null,
      };
    });
    const lines = (b.lines ?? []).map((l) => ({ accountId: String(l.accountId ?? ""), amount: toAmount(l.amount), description: l.description ?? null }));
    const doc = await prisma.$transaction(
      (tx) =>
        createMoneyDoc(
          tx,
          { kind: "EXPENSE", date: requireDay(b.date), partyId: b.partyId || null, description: b.description, lines, vatAmount: toAmount(b.vatAmount, "مالیات"), items },
          actorOf(guard.access),
        ),
      { timeout: 60_000 },
    );
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: doc.id,
      entityTitle: `هزینه ${doc.number}`,
      summary: `هزینه ${faNum(doc.number)} — ${formatAmount(doc.total)} تومان${doc.payable > 0n ? ` (${formatAmount(doc.payable)} نسیه)` : ""}`,
    });
    return NextResponse.json(serialize({ ok: true, id: doc.id, number: doc.number }));
  } catch (e) {
    return accErrorResponse(e, "[acc-expense]");
  }
}
