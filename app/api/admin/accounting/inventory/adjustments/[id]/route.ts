import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { voidAdjust } from "@/lib/accounting/inventory/adjust";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const doc = await prisma.accStockAdjust.findUnique({ where: { id }, include: { reason: true, lines: true } });
  if (!doc) return NextResponse.json({ error: "سند پیدا نشد" }, { status: 404 });
  const costs = can(guard.access, "ACC_COST_VIEW");
  const [items, warehouse, party, account, moves] = await Promise.all([
    prisma.accItem.findMany({ where: { id: { in: doc.lines.map((l) => l.productId) } }, select: { id: true, title: true, code: true, unit: true } }),
    prisma.accWarehouse.findUnique({ where: { id: doc.warehouseId }, select: { id: true, name: true } }),
    doc.partyId ? prisma.accParty.findUnique({ where: { id: doc.partyId }, select: { id: true, name: true } }) : null,
    prisma.accAccount.findUnique({ where: { id: doc.reason.accountId }, select: { id: true, code: true, name: true } }),
    costs ? prisma.accStockMove.findMany({ where: { sourceType: "AccStockAdjust", sourceId: id }, select: { sourceLineId: true, totalCost: true } }) : [],
  ]);
  const im = new Map(items.map((i) => [i.id, i]));
  const cost = new Map(moves.map((m) => [m.sourceLineId, m.totalCost]));
  return NextResponse.json(
    serialize({
      doc: { ...doc, lines: undefined },
      lines: doc.lines.map((l) => ({ ...l, item: im.get(l.productId) ?? null, cost: costs ? (cost.get(l.id) ?? 0n) : null })),
      warehouse,
      party,
      account,
      can: { manage: can(guard.access, "ACC_INVENTORY"), costs },
    }),
  );
}

/** POST { action: "void", reason } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; reason?: string }>(req);
    if (b.action !== "void") throw new AccError("اقدام نامعتبر است");
    await prisma.$transaction((tx) => voidAdjust(tx, id, String(b.reason ?? ""), actorOf(guard.access)), { timeout: 120_000 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-adjust]");
  }
}
