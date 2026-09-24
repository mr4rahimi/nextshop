import { NextResponse } from "next/server";
import type { AccChequeDir, AccChequeStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { todayKey } from "@/lib/accounting/dates";
import { toLatinDigits } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN: Record<AccChequeDir, AccChequeStatus[]> = { RECEIVED: ["IN_HAND", "IN_COLLECTION"], ISSUED: ["ISSUED"] };

/**
 * GET ?dir=RECEIVED|ISSUED&view=open|week|overdue|bounced|closed|all&q — فهرست چک‌ها.
 * `counts` شمارش هر نما برای chip‌ها.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_CHEQUE", "ACC_TREASURY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const dir: AccChequeDir = url.searchParams.get("dir") === "ISSUED" ? "ISSUED" : "RECEIVED";
  const view = url.searchParams.get("view") ?? "open";
  const today = todayKey();
  const week = new Date(today.getTime() + 7 * 86_400_000);

  const views: Record<string, Prisma.AccChequeWhereInput> = {
    open: { status: { in: OPEN[dir] } },
    week: { status: { in: OPEN[dir] }, dueDate: { gte: today, lte: week } },
    overdue: { status: { in: OPEN[dir] }, dueDate: { lt: today } },
    bounced: { status: "BOUNCED" },
    closed: { status: { in: ["CLEARED", "RETURNED", "ENDORSED"] } },
    all: {},
  };
  const where: Prisma.AccChequeWhereInput = { direction: dir, ...(views[view] ?? views.open) };
  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const lat = toLatinDigits(q);
    where.OR = [{ serialNo: { contains: lat } }, { sayadId: { contains: lat } }, { party: { name: { contains: q, mode: "insensitive" } } }, { bankName: { contains: q } }];
  }
  const [items, counts, sum] = await Promise.all([
    prisma.accCheque.findMany({ where, orderBy: [{ dueDate: view === "closed" || view === "all" ? "desc" : "asc" }], take: 200, include: { party: { select: { id: true, name: true } } } }),
    Promise.all(Object.entries(views).map(async ([k, w]) => [k, await prisma.accCheque.count({ where: { direction: dir, ...w } })] as const)),
    prisma.accCheque.aggregate({ where, _sum: { amount: true } }),
  ]);
  const holders = Object.fromEntries(
    (await prisma.accParty.findMany({ where: { id: { in: items.map((i) => i.holderPartyId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
  );
  return NextResponse.json(serialize({ items, holders, counts: Object.fromEntries(counts), total: sum._sum.amount ?? 0n, can: { manage: can(guard.access, "ACC_CHEQUE"), pay: can(guard.access, "ACC_TREASURY") } }));
}
