import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { updateTreasury, type TreasuryInput } from "@/lib/accounting/treasury";
import { balanceOf, statement } from "@/lib/accounting/ledger/balances";
import { accErrorResponse } from "@/lib/accounting/errors";
import { rangeFrom, readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?from&to — گردش یک صندوق یا حساب بانکی */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const item = await prisma.accTreasury.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  const [st, total] = await Promise.all([
    statement(prisma, { treasuryId: id }, rangeFrom(new URL(req.url))),
    balanceOf(prisma, { treasuryId: id }),
  ]);
  return NextResponse.json(serialize({ item, balance: total.balance, statement: st, can: { manage: can(guard.access, "ACC_SETTINGS") } }));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const body = await readJson<TreasuryInput>(req);
    const item = await prisma.$transaction((tx) => updateTreasury(tx, id, body));
    return NextResponse.json(serialize({ ok: true, item }));
  } catch (e) {
    return accErrorResponse(e, "[acc-treasury]");
  }
}
