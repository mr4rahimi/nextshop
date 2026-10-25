import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { createCount } from "@/lib/accounting/inventory/counts";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_STOCK_COUNT"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [items, groups] = await Promise.all([
    prisma.accStockCount.findMany({
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 200,
      include: { _count: { select: { lines: true } } },
    }),
    prisma.accItemGroup.findMany({ select: { id: true, name: true, parentId: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return NextResponse.json(serialize({ items, groups, can: { manage: can(guard.access, "ACC_INVENTORY") } }));
}

/** POST { date, warehouseId, note?, scope?: "PARTIAL"|"FULL", groupId? } */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ date?: string; warehouseId?: string; note?: string; scope?: string; groupId?: string | null }>(req);
    if (!b.warehouseId) throw new AccError("انبار را انتخاب کنید");
    const c = await prisma.$transaction((tx) =>
      createCount(
        tx,
        { date: requireDay(b.date), warehouseId: b.warehouseId!, note: b.note, scope: b.scope === "FULL" ? "FULL" : "PARTIAL", groupId: b.groupId || null },
        actorOf(guard.access),
      ),
    );
    return NextResponse.json(serialize({ ok: true, id: c.id }));
  } catch (e) {
    return accErrorResponse(e, "[acc-count]");
  }
}
