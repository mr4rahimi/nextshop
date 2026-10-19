import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { posGuard } from "@/lib/accounting/pos/api";
import { closeShift, shiftSummary } from "@/lib/accounting/pos/shifts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — خلاصه‌ی شیفت (زنده یا بسته) با صندوق‌ها و بانک‌های مقصد انتقال */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const sum = await shiftSummary(prisma, id);
    const targets = await prisma.accTreasury.findMany({
      where: { isActive: true, kind: { in: ["CASH", "BANK"] }, id: { not: sum.shift.terminal.cashTreasuryId } },
      orderBy: [{ kind: "asc" }, { code: "asc" }],
      select: { id: true, name: true, kind: true },
    });
    const names = await prisma.accTreasury.findMany({ where: { id: { in: [sum.shift.terminal.cashTreasuryId, sum.shift.terminal.cardTreasuryId, sum.shift.transferToId].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    return NextResponse.json(serialize({ ...sum, targets, treasuryNames: Object.fromEntries(names.map((n) => [n.id, n.name])), can: { manage: g.manage } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-shift]");
  }
}

/** POST — بستن صندوق */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const b = await readJson<{ countedCash?: unknown; countedCard?: unknown; keepFloat?: unknown; transferToId?: string | null; note?: string | null }>(req);
    const shift = await prisma.$transaction(
      (tx) =>
        closeShift(
          tx,
          id,
          {
            countedCash: toAmount(b.countedCash, "پول شمرده‌شده"),
            countedCard: b.countedCard === null || b.countedCard === undefined || b.countedCard === "" ? null : toAmount(b.countedCard, "جمع کارتخوان"),
            keepFloat: toAmount(b.keepFloat, "پول خرد"),
            transferToId: b.transferToId || null,
            note: b.note ?? null,
          },
          { manage: g.manage },
          actorOf(g.access),
        ),
      { timeout: 60_000 },
    );
    const diff = shift.cashDiff ?? 0n;
    await logActivity({
      action: "UPDATE",
      entity: "OTHER",
      entityId: shift.id,
      entityTitle: `شیفت ${shift.number}`,
      summary: `بستن صندوق — شیفت ${faNum(shift.number)}؛ شمرده ${formatAmount(shift.countedCash ?? 0n)} تومان${diff ? `، ${diff < 0n ? "کسری" : "اضافه"} ${formatAmount(diff < 0n ? -diff : diff)}` : "، بی‌مغایرت"}`,
    });
    return NextResponse.json(serialize({ ok: true, shift }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-shift]");
  }
}
