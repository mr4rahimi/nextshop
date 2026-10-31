import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";
import { listGroups } from "@/lib/accounting/inventory/catalog";
import { filterOf, listPlaces, planPlaceSheet, scanToPlace, setPlaces, type PlaceInput } from "@/lib/accounting/inventory/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW = ["ACC_VIEW", "ACC_INVENTORY", "ACC_STOCK_COUNT"] as const;
const EDIT = ["ACC_INVENTORY", "ACC_STOCK_COUNT"] as const;
const PREVIEW_ROWS = 300;

/**
 * مکان قرارگیری کالا — docs/plans/webhesab-parity.md بخش ۱۱.
 * GET ?w=&q=&groupId=&zone=&spot=&only=placed|unplaced&all=1 — انبارها، گروه‌ها، ردیف‌ها و خلاصه
 * POST `{action, warehouseId}`:
 *   `save`   `{rows: [{itemId, zone, aisle, shelf, level}]}` — جایگزینی (خالی = پاک)
 *   `assign` `{itemIds, place}` — فقط فیلدهای پرشده‌ی `place`
 *   `scan`   `{code, place}` — اسکن بارکد به یک مکان
 *   `sheet`  `{rows: [{code, zone, aisle, shelf, level, line}], commit}` — اکسل؛ بی `commit` پیش‌نمایش
 */
export async function GET(req: Request) {
  const guard = await requirePermission([...VIEW]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const warehouses = await prisma.accWarehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { code: "asc" }], select: { id: true, name: true } });
    const f = filterOf(sp);
    if (!f.warehouseId) f.warehouseId = warehouses[0]?.id ?? "";
    const [groups, res] = await Promise.all([listGroups(), f.warehouseId ? listPlaces(prisma, f) : null]);
    return NextResponse.json(
      serialize({
        warehouses,
        warehouseId: f.warehouseId,
        groups: groups.map((g) => ({ id: g.id, path: g.path })),
        ...(res ?? { rows: [], capped: false, zones: [], summary: { stocked: 0, stockedPlaced: 0, stockedUnplaced: 0, placed: 0 } }),
        can: { edit: EDIT.some((p) => can(guard.access, p)) },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-places]");
  }
}

interface Body {
  action?: string;
  warehouseId?: unknown;
  rows?: ({ itemId?: unknown; code?: unknown; line?: unknown } & PlaceInput)[];
  itemIds?: unknown;
  place?: PlaceInput;
  code?: unknown;
  commit?: unknown;
}

export async function POST(req: Request) {
  const guard = await requirePermission([...EDIT]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<Body>(req);
    const actor = actorOf(guard.access);
    const w = String(b.warehouseId ?? "");
    const rows = Array.isArray(b.rows) ? b.rows : [];

    if (b.action === "save") {
      const res = await prisma.$transaction((tx) => setPlaces(tx, w, rows.map((r) => ({ itemId: String(r.itemId ?? ""), place: r })), "replace", actor), { timeout: 60_000 });
      return NextResponse.json({ ok: true, ...res });
    }
    if (b.action === "assign") {
      const ids = Array.isArray(b.itemIds) ? b.itemIds.map(String) : [];
      if (!ids.length) throw new AccError("کالایی انتخاب نشده");
      const res = await prisma.$transaction((tx) => setPlaces(tx, w, ids.map((itemId) => ({ itemId, place: b.place ?? {} })), "merge", actor), { timeout: 60_000 });
      return NextResponse.json({ ok: true, ...res });
    }
    if (b.action === "scan") {
      const res = await prisma.$transaction((tx) => scanToPlace(tx, w, String(b.code ?? ""), b.place ?? {}, actor));
      return NextResponse.json(serialize({ ok: true, ...res }));
    }
    if (b.action === "sheet") {
      const input = rows.map((r, k) => ({ ...r, code: String(r.code ?? ""), line: Number(r.line) || k + 1 }));
      if (b.commit !== true) {
        const plan = await planPlaceSheet(prisma, input);
        return NextResponse.json(serialize({ ok: true, preview: { total: plan.rows.length, rows: plan.rows.slice(0, PREVIEW_ROWS), unknown: plan.unknown } }));
      }
      const res = await prisma.$transaction(
        async (tx) => {
          const plan = await planPlaceSheet(tx, input);
          return setPlaces(tx, w, plan.rows.map((r) => ({ itemId: r.itemId, place: r.place })), "replace", actor);
        },
        { timeout: 120_000 },
      );
      await logActivity({ action: "UPDATE", entity: "OTHER", entityTitle: "مکان کالا", summary: `مکان کالا با اکسل — ${faNum(res.saved)} کالا` });
      return NextResponse.json({ ok: true, ...res });
    }
    throw new AccError("درخواست نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-places]");
  }
}
