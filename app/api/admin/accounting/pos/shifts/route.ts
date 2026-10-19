import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { posGuard } from "@/lib/accounting/pos/api";
import { openShift } from "@/lib/accounting/pos/shifts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?terminalId — شیفت‌ها (تازه‌ترین اول) با مغایرت هر کدام */
export async function GET(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  const terminalId = new URL(req.url).searchParams.get("terminalId");
  const shifts = await prisma.accPosShift.findMany({
    where: terminalId ? { terminalId } : {},
    orderBy: { openedAt: "desc" },
    take: 100,
    include: { terminal: { select: { name: true } }, _count: { select: { tickets: true } } },
  });
  const sums = await prisma.accPosTicket.groupBy({ by: ["shiftId"], where: { shiftId: { in: shifts.map((s) => s.id) } }, _sum: { saleTotal: true, returnTotal: true } });
  const byShift = new Map(sums.map((s) => [s.shiftId, (s._sum.saleTotal ?? 0n) - (s._sum.returnTotal ?? 0n)]));
  return NextResponse.json(serialize({ shifts: shifts.map((s) => ({ ...s, net: byShift.get(s.id) ?? 0n })) }));
}

/** POST — باز کردن صندوق با پول خرد شمرده‌شده */
export async function POST(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const b = await readJson<{ terminalId?: string; openingFloat?: unknown }>(req);
    const shift = await prisma.$transaction((tx) => openShift(tx, b.terminalId ?? "", toAmount(b.openingFloat, "پول خرد"), actorOf(g.access)));
    const t = await prisma.accPosTerminal.findUnique({ where: { id: shift.terminalId }, select: { name: true } });
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: shift.id, entityTitle: `شیفت ${shift.number}`, summary: `${t?.name ?? "صندوق"} باز شد — شیفت ${faNum(shift.number)}، پول خرد ${formatAmount(shift.openingFloat)} تومان` });
    return NextResponse.json(serialize({ ok: true, shift }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-shift]");
  }
}
