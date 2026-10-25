import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { createAdjust } from "@/lib/accounting/inventory/adjust";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson, requireDay } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?direction=IN|OUT&reasonId — ورود و خروج‌های دستی (webhesab-parity.md بخش ۷) */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const direction = url.searchParams.get("direction");
  const reasonId = url.searchParams.get("reasonId");
  const items = await prisma.accStockAdjust.findMany({
    where: { ...(direction === "IN" || direction === "OUT" ? { direction } : {}), ...(reasonId ? { reasonId } : {}) },
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: 300,
    include: { reason: { select: { id: true, name: true } }, lines: { select: { qty: true } } },
  });
  const warehouses = await prisma.accWarehouse.findMany({ select: { id: true, name: true, isActive: true, isDefault: true }, orderBy: [{ isDefault: "desc" }, { code: "asc" }] });
  return NextResponse.json(
    serialize({
      items: items.map(({ lines, ...d }) => ({ ...d, lineCount: lines.length, units: lines.reduce((s, l) => s + l.qty, 0) })),
      warehouses,
      can: { manage: can(guard.access, "ACC_INVENTORY") },
    }),
  );
}

/** POST { date, direction, reasonId, warehouseId, partyId?, note?, lines: [{productId, qty, note?}] } */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ date?: string; direction?: string; reasonId?: string; warehouseId?: string; partyId?: string | null; note?: string; lines?: { productId: string; qty: unknown; note?: string }[] }>(req);
    if (b.direction !== "IN" && b.direction !== "OUT") throw new AccError("ورود یا خروج را انتخاب کنید");
    if (!b.warehouseId) throw new AccError("انبار را انتخاب کنید");
    const doc = await prisma.$transaction(
      (tx) =>
        createAdjust(
          tx,
          {
            date: requireDay(b.date),
            direction: b.direction as "IN" | "OUT",
            reasonId: String(b.reasonId ?? ""),
            warehouseId: b.warehouseId!,
            partyId: b.partyId || null,
            note: b.note,
            lines: (b.lines ?? []).map((l) => ({ productId: String(l.productId), qty: Number(l.qty), note: l.note })),
          },
          actorOf(guard.access),
        ),
      { timeout: 120_000 },
    );
    return NextResponse.json(serialize({ ok: true, id: doc.id }));
  } catch (e) {
    return accErrorResponse(e, "[acc-adjust]");
  }
}
