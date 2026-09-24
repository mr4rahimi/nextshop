import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { readOpening, saveOpening } from "@/lib/accounting/setup";
import { currentYear } from "@/lib/accounting/ledger/fiscal-year";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function yearOf(id: string | null) {
  const y = id ? await prisma.accFiscalYear.findUnique({ where: { id } }) : await currentYear();
  if (!y) throw new AccError("سال مالی تعریف نشده است", 404);
  return y;
}

/** GET ?yearId — مانده‌های اول دوره (از روی سند افتتاحیه) */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const year = await yearOf(new URL(req.url).searchParams.get("yearId"));
    const data = await readOpening(prisma, year.id);
    const partyIds = data.parties.map((p) => p.partyId);
    const parties = await prisma.accParty.findMany({ where: { id: { in: partyIds } }, select: { id: true, code: true, name: true, mobile: true } });
    return NextResponse.json(serialize({ year, ...data, partyInfo: parties, can: { manage: can(guard.access, "ACC_SETTINGS") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-opening]");
  }
}

/** PUT { yearId, treasuries: [{treasuryId, amount}], parties: [{partyId, amount}] } */
export async function PUT(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ yearId?: string; treasuries?: { treasuryId: string; amount: unknown }[]; parties?: { partyId: string; amount: unknown }[] }>(req);
    const year = await yearOf(b.yearId ?? null);
    const v = await saveOpening(
      year.id,
      {
        treasuries: (b.treasuries ?? []).map((t) => ({ treasuryId: String(t.treasuryId), amount: toAmount(t.amount) })),
        parties: (b.parties ?? []).map((p) => ({ partyId: String(p.partyId), amount: toAmount(p.amount) })),
      },
      actorOf(guard.access),
    );
    return NextResponse.json(serialize({ ok: true, voucher: v ? { id: v.id, number: v.number } : null }));
  } catch (e) {
    return accErrorResponse(e, "[acc-opening]");
  }
}
