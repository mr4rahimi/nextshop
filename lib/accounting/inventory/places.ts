/**
 * مکان قرارگیری کالا در هر انبار — docs/plans/webhesab-parity.md بخش ۱۱.
 *
 * `AccItemPlace` یک ردیف برای هر (کالا، انبار): منطقه، ردیف، قفسه، طبقه. همه‌ی فیلدها
 * خالی ← ردیف پاک می‌شود. مکان فقط راهنماست؛ به موجودی و سند کاری ندارد.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "../ledger/post";
import { AccError } from "../errors";
import { exactItem, itemSearchWhere, normalizeItemCode } from "./items";
import { comparePlace, isEmptyPlace, normPart, PLACE_FIELDS, type PlaceParts } from "./place-text";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const MAX_ROWS = 3000;

export type PlaceInput = Partial<Record<(typeof PLACE_FIELDS)[number], unknown>>;

export function cleanPlace(p: PlaceInput): PlaceParts {
  return { zone: normPart(p.zone), aisle: normPart(p.aisle), shelf: normPart(p.shelf), level: normPart(p.level) };
}

async function assertWarehouse(db: Db, id: string) {
  if (!id || !(await db.accWarehouse.findUnique({ where: { id }, select: { id: true } }))) throw new AccError("انبار را انتخاب کنید");
}

/**
 * نوشتن مکان چند کالا در یک انبار.
 * `replace`: هر چهار فیلد همان است که آمده (خالی = پاک). `merge`: فقط فیلدهای پرشده عوض می‌شوند (تعیین گروهی).
 */
export async function setPlaces(tx: Tx, warehouseId: string, rows: { itemId: string; place: PlaceInput }[], mode: "replace" | "merge", actor: Actor) {
  await assertWarehouse(tx, warehouseId);
  const ids = [...new Set(rows.map((r) => r.itemId))];
  const known = new Set((await tx.accItem.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((i) => i.id));
  const cur = new Map((await tx.accItemPlace.findMany({ where: { warehouseId, itemId: { in: ids } } })).map((p) => [p.itemId, p]));
  let saved = 0;
  let cleared = 0;
  for (const r of rows) {
    if (!known.has(r.itemId)) continue;
    const given = cleanPlace(r.place);
    const old = cur.get(r.itemId);
    const next: PlaceParts =
      mode === "replace"
        ? given
        : {
            zone: given.zone ?? old?.zone ?? null,
            aisle: given.aisle ?? old?.aisle ?? null,
            shelf: given.shelf ?? old?.shelf ?? null,
            level: given.level ?? old?.level ?? null,
          };
    if (old && PLACE_FIELDS.every((f) => (old[f] ?? null) === next[f])) continue;
    if (isEmptyPlace(next)) {
      if (old) {
        await tx.accItemPlace.delete({ where: { itemId_warehouseId: { itemId: r.itemId, warehouseId } } });
        cleared++;
      }
      continue;
    }
    await tx.accItemPlace.upsert({
      where: { itemId_warehouseId: { itemId: r.itemId, warehouseId } },
      create: { itemId: r.itemId, warehouseId, ...next, updatedByName: actor.name },
      update: { ...next, updatedByName: actor.name },
    });
    saved++;
  }
  return { saved, cleared };
}

export interface PlaceFilter {
  warehouseId: string;
  q?: string | null;
  groupId?: string | null;
  zone?: string | null;
  /** بخشی از ردیف/قفسه/طبقه («A-03» یا «03») */
  spot?: string | null;
  only?: "all" | "placed" | "unplaced";
  /** فقط کالاهای موجود در همین انبار (پیش‌فرض) — وگرنه همه‌ی کالاهای فعال */
  inStock?: boolean;
}

/** فیلتر فهرست از query (`?w=&q=&groupId=&zone=&spot=&only=&all=1`) */
export function filterOf(sp: URLSearchParams): PlaceFilter {
  const only = sp.get("only");
  return {
    warehouseId: sp.get("w") ?? "",
    q: sp.get("q"),
    groupId: sp.get("groupId"),
    zone: sp.get("zone"),
    spot: sp.get("spot"),
    only: only === "placed" || only === "unplaced" ? only : "all",
    inStock: sp.get("all") !== "1",
  };
}

async function groupWithChildren(db: Db, groupId: string): Promise<string[]> {
  const all = await db.accItemGroup.findMany({ select: { id: true, parentId: true } });
  const out = new Set([groupId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const g of all) if (g.parentId && out.has(g.parentId) && !out.has(g.id)) (out.add(g.id), (grew = true));
  }
  return [...out];
}

export interface PlaceRow extends PlaceParts {
  itemId: string;
  code: string;
  title: string;
  qty: number;
  updatedByName: string | null;
}

/** فهرست مکان کالاها در یک انبار + خلاصه (موجودها: با مکان / بی‌مکان) */
export async function listPlaces(db: Db, f: PlaceFilter) {
  await assertWarehouse(db, f.warehouseId);
  const inStock = f.inStock !== false;
  const and: Prisma.AccItemWhereInput[] = [];
  if (inStock) {
    const stocked = await db.accStock.findMany({ where: { warehouseId: f.warehouseId, qty: { gt: 0 } }, select: { productId: true } });
    and.push({ id: { in: stocked.map((s) => s.productId) } });
  } else and.push({ OR: [{ isActive: true }, { places: { some: { warehouseId: f.warehouseId } } }] });
  if (f.q?.trim()) and.push(await itemSearchWhere(f.q, db));
  if (f.groupId) and.push({ groupId: { in: await groupWithChildren(db, f.groupId) } });
  const zone = normPart(f.zone);
  const spot = normPart(f.spot);
  if (f.only === "unplaced") and.push({ places: { none: { warehouseId: f.warehouseId } } });
  if (f.only === "placed" || zone || spot)
    and.push({
      places: {
        some: {
          warehouseId: f.warehouseId,
          ...(zone ? { zone } : {}),
          ...(spot ? { OR: [{ aisle: { contains: spot } }, { shelf: { contains: spot } }, { level: { contains: spot } }] } : {}),
        },
      },
    });

  const items = await db.accItem.findMany({
    where: { AND: and },
    select: { id: true, code: true, title: true, places: { where: { warehouseId: f.warehouseId } } },
    take: MAX_ROWS + 1,
  });
  const capped = items.length > MAX_ROWS;
  const ids = items.slice(0, MAX_ROWS).map((i) => i.id);
  const stock = new Map((await db.accStock.findMany({ where: { warehouseId: f.warehouseId, productId: { in: ids } } })).map((s) => [s.productId, s.qty]));
  const rows: PlaceRow[] = items.slice(0, MAX_ROWS).map((i) => {
    const p = i.places[0];
    return {
      itemId: i.id,
      code: i.code,
      title: i.title,
      qty: stock.get(i.id) ?? 0,
      zone: p?.zone ?? null,
      aisle: p?.aisle ?? null,
      shelf: p?.shelf ?? null,
      level: p?.level ?? null,
      updatedByName: p?.updatedByName ?? null,
    };
  });
  rows.sort((a, b) => comparePlace(a, b) || a.code.localeCompare(b.code, "fa", { numeric: true }));

  // خلاصه‌ی کل انبار، مستقل از فیلتر
  const [stockedIds, placedIds, zones] = await Promise.all([
    db.accStock.findMany({ where: { warehouseId: f.warehouseId, qty: { gt: 0 } }, select: { productId: true } }),
    db.accItemPlace.findMany({ where: { warehouseId: f.warehouseId }, select: { itemId: true } }),
    placeZones(db, f.warehouseId),
  ]);
  const placed = new Set(placedIds.map((p) => p.itemId));
  const stockedPlaced = stockedIds.filter((s) => placed.has(s.productId)).length;
  return {
    rows,
    capped,
    zones,
    summary: { stocked: stockedIds.length, stockedPlaced, stockedUnplaced: stockedIds.length - stockedPlaced, placed: placed.size },
  };
}

/** منطقه‌های به‌کاررفته در یک انبار (پیشنهاد فرم) */
export async function placeZones(db: Db, warehouseId: string) {
  const z = await db.accItemPlace.groupBy({ by: ["zone"], where: { warehouseId, zone: { not: null } }, _count: { _all: true } });
  return z.map((x) => ({ zone: x.zone!, items: x._count._all })).sort((a, b) => a.zone.localeCompare(b.zone, "fa", { numeric: true }));
}

/** اسکن بارکد ← مکان همان کالا در این انبار (کد قبلیِ چندتنوعی پذیرفته نیست) */
export async function scanToPlace(tx: Tx, warehouseId: string, code: string, place: PlaceInput, actor: Actor) {
  const p = cleanPlace(place);
  if (isEmptyPlace(p)) throw new AccError("اول مکان (منطقه، ردیف، قفسه یا طبقه) را بنویسید");
  const norm = normalizeItemCode(code);
  if (!norm) throw new AccError("کد خالی است");
  const legacy = await tx.accLegacyItem.findUnique({ where: { code: norm }, select: { itemId: true } });
  const itemId = legacy ? legacy.itemId : await exactItem(norm, tx);
  if (legacy && !legacy.itemId) throw new AccError(`«${code}» کد قبلی چند رنگ/سایز است — بارکد خود کالا را بزنید`, 409);
  if (!itemId) throw new AccError(`کالایی با کد «${code}» پیدا نشد`, 404);
  const [item, old] = await Promise.all([
    tx.accItem.findUnique({ where: { id: itemId }, select: { id: true, code: true, title: true } }),
    tx.accItemPlace.findUnique({ where: { itemId_warehouseId: { itemId, warehouseId } } }),
  ]);
  await setPlaces(tx, warehouseId, [{ itemId, place: p }], "replace", actor);
  const stock = await tx.accStock.findUnique({ where: { productId_warehouseId: { productId: itemId, warehouseId } }, select: { qty: true } });
  return { item: item!, qty: stock?.qty ?? 0, before: old ? { zone: old.zone, aisle: old.aisle, shelf: old.shelf, level: old.level } : null, place: p };
}

/** ردیف‌های اکسل (کد، منطقه، ردیف، قفسه، طبقه) ← کالا؛ کد قبلی مدل ← همه‌ی تنوع‌های فعالش */
export async function planPlaceSheet(db: Db, rows: ({ code: string; line: number } & PlaceInput)[]) {
  const out: { itemId: string; code: string; title: string; line: number; place: PlaceParts }[] = [];
  const unknown: string[] = [];
  const cache = new Map<string, string[]>();
  const seen = new Map<string, number>();
  for (const r of rows.slice(0, 20_000)) {
    const code = normalizeItemCode(r.code);
    if (!code) continue;
    if (!cache.has(code)) {
      const one = await exactItem(code, db);
      let ids: string[] = one ? [one] : [];
      if (!one) {
        const legacy = await db.accLegacyItem.findUnique({ where: { code }, select: { itemId: true, modelId: true } });
        const modelId = legacy ? (legacy.itemId ? null : legacy.modelId) : (await db.accItemModel.findUnique({ where: { code }, select: { id: true } }))?.id;
        if (legacy?.itemId) ids = [legacy.itemId];
        else if (modelId) ids = (await db.accItem.findMany({ where: { modelId, isActive: true }, select: { id: true } })).map((i) => i.id);
      }
      cache.set(code, ids);
    }
    const ids = cache.get(code)!;
    if (!ids.length) unknown.push(r.code);
    for (const id of ids) {
      // تکراری ← آخری
      if (seen.has(id)) out.splice(seen.get(id)!, 1, { ...out[seen.get(id)!], line: r.line, place: cleanPlace(r) });
      else {
        seen.set(id, out.length);
        out.push({ itemId: id, code: "", title: "", line: r.line, place: cleanPlace(r) });
      }
    }
  }
  const items = new Map((await db.accItem.findMany({ where: { id: { in: out.map((o) => o.itemId) } }, select: { id: true, code: true, title: true } })).map((i) => [i.id, i]));
  for (const o of out) Object.assign(o, { code: items.get(o.itemId)?.code ?? "", title: items.get(o.itemId)?.title ?? "" });
  return { rows: out, unknown: [...new Set(unknown)] };
}

/** مکان چند کالا در یک انبار (برگه‌ی انبارگردانی) */
export async function placesOf(db: Db, warehouseId: string, itemIds: string[]): Promise<Map<string, PlaceParts>> {
  const rows = await db.accItemPlace.findMany({ where: { warehouseId, itemId: { in: itemIds } } });
  return new Map(rows.map((p) => [p.itemId, { zone: p.zone, aisle: p.aisle, shelf: p.shelf, level: p.level }]));
}

/** مکان یک کالا در همه‌ی انبارها (کاردکس) */
export async function itemPlaces(db: Db, itemId: string) {
  return db.accItemPlace.findMany({ where: { itemId }, select: { warehouseId: true, zone: true, aisle: true, shelf: true, level: true } });
}
