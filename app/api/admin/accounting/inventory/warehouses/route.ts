import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { ensureDefaultWarehouse, IN_TRANSIT, saveWarehouse, type WarehouseInput } from "@/lib/accounting/inventory/docs";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_SALES", "ACC_PURCHASE", "ACC_STOCK_RECEIVE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  await prisma.$transaction((tx) => ensureDefaultWarehouse(tx));
  const [items, sums, transit] = await Promise.all([
    prisma.accWarehouse.findMany({ orderBy: [{ isDefault: "desc" }, { code: "asc" }] }),
    prisma.accStock.groupBy({ by: ["warehouseId"], where: { qty: { not: 0 } }, _count: { _all: true }, _sum: { qty: true } }),
    prisma.accTransfer.findMany({ where: IN_TRANSIT, select: { toWarehouseId: true, lines: { select: { qty: true } } } }),
  ]);
  const by = new Map(sums.map((s) => [s.warehouseId, { products: s._count._all, qty: s._sum.qty ?? 0 }]));
  const incoming = new Map<string, number>();
  for (const t of transit) incoming.set(t.toWarehouseId, (incoming.get(t.toWarehouseId) ?? 0) + t.lines.reduce((s, l) => s + l.qty, 0));
  return NextResponse.json(
    serialize({ items: items.map((w) => ({ ...w, ...(by.get(w.id) ?? { products: 0, qty: 0 }), incoming: incoming.get(w.id) ?? 0 })), can: { manage: can(guard.access, "ACC_INVENTORY") } }),
  );
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const body = await readJson<WarehouseInput>(req);
    const w = await prisma.$transaction((tx) => saveWarehouse(tx, null, body));
    return NextResponse.json(serialize({ ok: true, item: w }));
  } catch (e) {
    return accErrorResponse(e, "[acc-warehouse]");
  }
}
