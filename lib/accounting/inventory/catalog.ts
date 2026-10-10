/**
 * گروه کالا، محور ویژگی (رنگ، سایز) و مدل — docs/plans/inventory-items.md فاز ۲.
 *
 * ⚠️ محور و مقدارهایش عمداً جدا از `Attribute` فروشگاه‌اند (تصمیم ۱۲): هر
 *    مقداری که اینجا ساخته شود هیچ‌جای سایت (فیلتر دسته) دیده نمی‌شود.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";

type Db = Prisma.TransactionClient | typeof prisma;
type Tx = Prisma.TransactionClient;

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

// ── گروه ──────────────────────────────────────────────────────────────

export interface GroupRow {
  id: string;
  parentId: string | null;
  name: string;
  /** «پوشاک ← پیراهن» */
  path: string;
  items: number;
}

export async function listGroups(db: Db = prisma): Promise<GroupRow[]> {
  const [groups, counts] = await Promise.all([
    db.accItemGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.accItem.groupBy({ by: ["groupId"], where: { groupId: { not: null } }, _count: { _all: true } }),
  ]);
  const byId = new Map(groups.map((g) => [g.id, g]));
  const n = new Map(counts.map((c) => [c.groupId!, c._count._all]));
  const pathOf = (id: string, seen = new Set<string>()): string => {
    const g = byId.get(id)!;
    if (!g.parentId || seen.has(g.parentId) || !byId.has(g.parentId)) return g.name;
    seen.add(id);
    return `${pathOf(g.parentId, seen)} ← ${g.name}`;
  };
  return groups
    .map((g) => ({ id: g.id, parentId: g.parentId, name: g.name, path: pathOf(g.id), items: n.get(g.id) ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path, "fa"));
}

async function assertNameFree(db: Db, parentId: string | null, name: string, selfId: string | null) {
  const dup = await db.accItemGroup.findFirst({ where: { parentId, name, ...(selfId ? { id: { not: selfId } } : {}) }, select: { id: true } });
  if (dup) throw new AccError(`گروه «${name}» همین‌جا هست`, 409);
}

export async function saveGroup(db: Tx, id: string | null, input: { name?: unknown; parentId?: unknown }) {
  const name = clean(input.name);
  if (!name) throw new AccError("نام گروه را بنویسید");
  const parentId = input.parentId ? String(input.parentId) : null;
  if (parentId) {
    if (parentId === id) throw new AccError("گروه نمی‌تواند زیرمجموعه‌ی خودش باشد");
    // پدر نباید از نوادگان همین گروه باشد
    let cur: string | null = parentId;
    for (let i = 0; cur && i < 50; i++) {
      if (cur === id) throw new AccError("گروه نمی‌تواند زیرمجموعه‌ی زیرگروه خودش باشد");
      const p: { parentId: string | null } | null = await db.accItemGroup.findUnique({ where: { id: cur }, select: { parentId: true } });
      if (!p) throw new AccError("گروه پدر پیدا نشد");
      cur = p.parentId;
    }
  }
  await assertNameFree(db, parentId, name, id);
  return id ? db.accItemGroup.update({ where: { id }, data: { name, parentId } }) : db.accItemGroup.create({ data: { name, parentId } });
}

export async function deleteGroup(db: Tx, id: string) {
  const [items, children, models] = await Promise.all([
    db.accItem.count({ where: { groupId: id } }),
    db.accItemGroup.count({ where: { parentId: id } }),
    db.accItemModel.count({ where: { groupId: id } }),
  ]);
  if (items || children || models) throw new AccError("گروهی که کالا، مدل یا زیرگروه دارد حذف نمی‌شود", 409);
  await db.accItemGroup.delete({ where: { id } });
}

/** گروه با نام (ورود گروهی) — «پوشاک/پیراهن» یا «پوشاک ← پیراهن» زنجیره می‌سازد */
export async function groupByPath(db: Tx, path: string, cache: Map<string, string>): Promise<string | null> {
  const parts = path.split(/\s*(?:←|\/|>)\s*/).map(clean).filter(Boolean);
  if (!parts.length) return null;
  let parentId: string | null = null;
  let key = "";
  for (const name of parts) {
    key += `/${name}`;
    const hit = cache.get(key);
    if (hit) {
      parentId = hit;
      continue;
    }
    const found: { id: string } | null = await db.accItemGroup.findFirst({ where: { parentId, name }, select: { id: true } });
    const g: { id: string } = found ?? (await db.accItemGroup.create({ data: { name, parentId }, select: { id: true } }));
    cache.set(key, g.id);
    parentId = g.id;
  }
  return parentId;
}

// ── محور ویژگی ───────────────────────────────────────────────────────

export async function listAxes(db: Db = prisma) {
  return db.accAxis.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { values: { orderBy: [{ sortOrder: "asc" }, { value: "asc" }] } } });
}

export async function createAxis(db: Tx, name: unknown) {
  const n = clean(name);
  if (!n) throw new AccError("نام ویژگی را بنویسید");
  if (await db.accAxis.findUnique({ where: { name: n } })) throw new AccError(`ویژگی «${n}» هست`, 409);
  const last = await db.accAxis.aggregate({ _max: { sortOrder: true } });
  return db.accAxis.create({ data: { name: n, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
}

/** مقدارها با نام — نبود، ساخته می‌شود؛ ترتیب ورود حفظ می‌شود */
export async function ensureAxisValues(db: Tx, axisId: string, names: string[]) {
  const axis = await db.accAxis.findUnique({ where: { id: axisId }, include: { values: true } });
  if (!axis) throw new AccError("ویژگی پیدا نشد");
  const out: { id: string; value: string }[] = [];
  let order = axis.values.reduce((m, v) => Math.max(m, v.sortOrder), 0);
  for (const raw of names) {
    const value = clean(raw);
    if (!value || out.some((o) => o.value === value)) continue;
    const hit = axis.values.find((v) => v.value === value) ?? (await db.accAxisValue.create({ data: { axisId, value, sortOrder: ++order } }));
    out.push({ id: hit.id, value: hit.value });
  }
  return { axis, values: out };
}

// ── مدل ──────────────────────────────────────────────────────────────

export async function searchModels(q: string | null, db: Db = prisma) {
  const term = clean(q);
  return db.accItemModel.findMany({
    where: term ? { title: { contains: term, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { _count: { select: { items: true } } },
  });
}
