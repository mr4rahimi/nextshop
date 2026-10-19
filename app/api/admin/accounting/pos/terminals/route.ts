import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { posGuard } from "@/lib/accounting/pos/api";
import { saveTerminal, treasuryBook, type TerminalInput } from "@/lib/accounting/pos/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — صندوق‌ها با شیفت باز هر کدام؛ برای مدیر: انبارها، صندوق‌ها و بانک‌ها (فرم) */
export async function GET() {
  const g = await posGuard();
  if (!g.ok) return g.res;
  const terminals = await prisma.accPosTerminal.findMany({
    where: g.manage ? {} : { isActive: true },
    orderBy: { code: "asc" },
    include: { shifts: { where: { status: "OPEN" }, select: { id: true, number: true, openedAt: true, openedByName: true } } },
  });
  const [warehouses, treasuries, sellers] = await Promise.all([
    prisma.accWarehouse.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true } }),
    prisma.accTreasury.findMany({ where: { isActive: true, kind: { in: ["CASH", "BANK", "POS"] } }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, name: true, kind: true } }),
    prisma.accPosSeller.findMany({ orderBy: { code: "asc" } }),
  ]);
  const books = g.manage ? await Promise.all(terminals.map((t) => treasuryBook(prisma, t.cashTreasuryId))) : [];
  return NextResponse.json(
    serialize({
      terminals: terminals.map((t, i) => ({ ...t, openShift: t.shifts[0] ?? null, shifts: undefined, cashBook: books[i] ?? null })),
      warehouses,
      treasuries,
      sellers,
      can: { manage: g.manage },
    }),
  );
}

export async function POST(req: Request) {
  const g = await posGuard(["ACC_POS_MANAGE"]);
  if (!g.ok) return g.res;
  try {
    const body = await readJson<TerminalInput>(req);
    const t = await prisma.$transaction((tx) => saveTerminal(tx, null, body));
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: t.id, entityTitle: t.name, summary: `صندوق فروشگاه «${t.name}» تعریف شد` });
    return NextResponse.json(serialize({ ok: true, terminal: t }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-terminal]");
  }
}
