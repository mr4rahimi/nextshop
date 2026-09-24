import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { updateParty, type PartyInput } from "@/lib/accounting/parties";
import { balanceOf, statement } from "@/lib/accounting/ledger/balances";
import { accErrorResponse } from "@/lib/accounting/errors";
import { rangeFrom, readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?from&to — پرونده و صورت‌حساب شخص */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_PARTY_MANAGE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const party = await prisma.accParty.findUnique({ where: { id } });
  if (!party) return NextResponse.json({ error: "شخص پیدا نشد" }, { status: 404 });

  const [st, total] = await Promise.all([
    statement(prisma, { partyId: id }, rangeFrom(new URL(req.url))),
    balanceOf(prisma, { partyId: id }),
  ]);
  const links = {
    user: party.userId
      ? await prisma.user.findUnique({ where: { id: party.userId }, select: { id: true, phone: true, firstName: true, lastName: true } })
      : null,
    supplier: party.supplierId
      ? await prisma.staffSupplier.findUnique({ where: { id: party.supplierId }, select: { id: true, name: true } })
      : null,
  };
  return NextResponse.json(
    serialize({ party, balance: total.balance, statement: st, links, can: { manage: can(guard.access, "ACC_PARTY_MANAGE") } }),
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_PARTY_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const body = await readJson<PartyInput>(req);
    const party = await prisma.$transaction((tx) => updateParty(tx, id, body));
    return NextResponse.json(serialize({ ok: true, party }));
  } catch (e) {
    return accErrorResponse(e, "[acc-party]");
  }
}
