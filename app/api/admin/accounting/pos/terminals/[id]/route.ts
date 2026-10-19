import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { posGuard } from "@/lib/accounting/pos/api";
import { saveTerminal, treasuryBook, type TerminalInput } from "@/lib/accounting/pos/setup";
import { shiftSummary } from "@/lib/accounting/pos/shifts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — راه‌اندازی صفحه‌ی صندوق: صندوق، شیفت باز با خلاصه، فروشنده‌ها، تنظیم مالیات */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const terminal = await prisma.accPosTerminal.findUnique({ where: { id } });
    if (!terminal || (!terminal.isActive && !g.manage)) throw new AccError("صندوق پیدا نشد", 404);
    const [open, sellers, settings, treasuries, cashBook, lastShift] = await Promise.all([
      prisma.accPosShift.findFirst({ where: { terminalId: id, status: "OPEN" }, select: { id: true } }),
      prisma.accPosSeller.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
      prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { vatEnabled: true, vatRateBp: true } }),
      prisma.accTreasury.findMany({ where: { id: { in: [terminal.cashTreasuryId, terminal.cardTreasuryId].filter((x): x is string => !!x) } }, select: { id: true, name: true, kind: true } }),
      treasuryBook(prisma, terminal.cashTreasuryId),
      prisma.accPosShift.findFirst({ where: { terminalId: id, status: "CLOSED" }, orderBy: { number: "desc" }, select: { keptFloat: true } }),
    ]);
    const warehouse = await prisma.accWarehouse.findUnique({ where: { id: terminal.warehouseId }, select: { name: true } });
    return NextResponse.json(
      serialize({
        terminal: { ...terminal, warehouseName: warehouse?.name ?? "", cash: treasuries.find((t) => t.id === terminal.cashTreasuryId) ?? null, card: treasuries.find((t) => t.id === terminal.cardTreasuryId) ?? null },
        shift: open ? await shiftSummary(prisma, open.id) : null,
        sellers,
        vat: { enabled: !!settings?.vatEnabled, rateBp: settings?.vatRateBp ?? 0 },
        cashBook,
        lastKeptFloat: lastShift?.keptFloat ?? null,
        cashier: g.access.name,
        can: { manage: g.manage },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-terminal]");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard(["ACC_POS_MANAGE"]);
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const body = await readJson<TerminalInput>(req);
    const t = await prisma.$transaction((tx) => saveTerminal(tx, id, body));
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: t.id, entityTitle: t.name, summary: `صندوق فروشگاه «${t.name}» ویرایش شد` });
    return NextResponse.json(serialize({ ok: true, terminal: t }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-terminal]");
  }
}
