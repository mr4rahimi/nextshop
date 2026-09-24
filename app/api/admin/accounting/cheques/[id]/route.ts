import { NextResponse } from "next/server";
import type { AccChequeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { allowedMoves, chequeStatusLabel, moveCheque, undoLastMove } from "@/lib/accounting/cash/cheques";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_CHEQUE", "ACC_TREASURY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const c = await prisma.accCheque.findUnique({
    where: { id },
    include: { party: { select: { id: true, name: true, mobile: true } }, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!c) return NextResponse.json({ error: "چک پیدا نشد" }, { status: 404 });
  const partyIds = [c.holderPartyId, ...c.events.map((e) => e.partyId)].filter((x): x is string => !!x);
  const tIds = [c.treasuryId, ...c.events.map((e) => e.treasuryId)].filter((x): x is string => !!x);
  const [parties, treasuries, banks, voucherNums, money] = await Promise.all([
    prisma.accParty.findMany({ where: { id: { in: partyIds } }, select: { id: true, name: true } }),
    prisma.accTreasury.findMany({ where: { id: { in: tIds } }, select: { id: true, name: true } }),
    prisma.accTreasury.findMany({ where: { kind: "BANK", isActive: true }, select: { id: true, name: true } }),
    can(guard.access, "ACC_VOUCHER")
      ? prisma.accVoucher.findMany({ where: { id: { in: c.events.map((e) => e.voucherId).filter((x): x is string => !!x) } }, select: { id: true, number: true } })
      : Promise.resolve([]),
    c.moneyDocId ? prisma.accMoneyDoc.findUnique({ where: { id: c.moneyDocId }, select: { id: true, kind: true, number: true } }) : null,
  ]);
  const last = c.events[c.events.length - 1];
  return NextResponse.json(
    serialize({
      cheque: c,
      names: { ...Object.fromEntries(parties.map((p) => [p.id, p.name])), ...Object.fromEntries(treasuries.map((t) => [t.id, t.name])) },
      banks,
      vouchers: Object.fromEntries(voucherNums.map((v) => [v.id, v.number])),
      money,
      moves: allowedMoves(c).map((r) => ({ to: r.to, label: r.label, needsBank: !!r.needsBank })).filter((m) => m.to !== "ENDORSED"),
      canUndo: !!last?.from && !last.moneyDocId,
      can: { manage: can(guard.access, "ACC_CHEQUE") },
    }),
  );
}

/** POST { action: "move", to, date, treasuryId?, note? } | { action: "undo" } | { action: "sayad", registered } */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission("ACC_CHEQUE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; to?: string; date?: string; treasuryId?: string; note?: string; registered?: boolean }>(req);
    const actor = actorOf(guard.access);
    if (b.action === "move") {
      const c = await prisma.$transaction((tx) => moveCheque(tx, id, b.to as AccChequeStatus, { date: requireDay(b.date), treasuryId: b.treasuryId, note: b.note }, actor), { timeout: 60_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: `چک ${c.serialNo}`, summary: `چک ${faNum(c.serialNo)} ← ${chequeStatusLabel(c.direction, c.status)}` });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "undo") {
      const c = await prisma.$transaction((tx) => undoLastMove(tx, id, actor), { timeout: 60_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: `چک ${c.serialNo}`, summary: `برگرداندن آخرین گذار چک ${faNum(c.serialNo)} ← ${chequeStatusLabel(c.direction, c.status)}` });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "sayad") {
      await prisma.accCheque.update({ where: { id }, data: { sayadRegistered: !!b.registered } });
      return NextResponse.json({ ok: true });
    }
    throw new AccError("اقدام نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-cheque]");
  }
}
