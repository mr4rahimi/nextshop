/**
 * از کالا به محصول — docs/plans/inventory-items.md فاز ۵ (بخش ۵).
 *
 * - مدلِ بی‌محصول ← یک محصول پیش‌نویس با یک تنوع برای هر کالا (`saveVariants`).
 * - کالای تازه‌ی مدلی که محصول دارد ← تنوع تازه‌ی همان محصول.
 * - کالای بی‌مدل ← پیشنهاد مدل از عنوان («تیشرت ساده آبی L») یا محصول ساده.
 *
 * ⚠️ تصمیم ۱۲ و تله‌ی ۰الف: محور کالا (`AccAxis`) فقط **اینجا**، هنگام ساخت
 *    محصول و با تأیید کاربر، به ویژگی فروشگاه (`Attribute`) نگاشت می‌شود — با نام؛
 *    ویژگی یا مقدار نبود ساخته می‌شود و پیش‌نمایش آن را پیش از ثبت نشان می‌دهد.
 * ⚠️ تله‌ی ۰پ: `plan*` هیچ چیزی نمی‌نویسد؛ نوشتن فقط در توابع ثبت.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { optionKeyOf, variantsEnabled } from "@/lib/variants";
import { addAttributeValue, saveVariants, type VariantInput } from "@/lib/variants-admin";
import { applyOnlinePrices } from "./online-price";
import { AccError } from "../errors";
import { ensureAxisValues } from "./catalog";
import { attrKeyOf } from "./items";

type Db = Prisma.TransactionClient | typeof prisma;
type Tx = Prisma.TransactionClient;

/** مقایسه‌ی نام: ی/ك عربی، نیم‌فاصله و فاصله‌ی اضافه و حروف بزرگ نادیده */
export const normName = (s: string) =>
  s
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‏‎]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const isColorAxis = (name: string) => ["رنگ", "رنگ بندی", "color", "colour"].includes(normName(name));

/** نمونه‌رنگ پیش‌فرض برای مقدار تازه‌ی رنگ در فروشگاه — بقیه بی‌نمونه (چیپ متنی) */
const COLOR_HEX: Record<string, string> = {
  مشکی: "#111111", سیاه: "#111111", سفید: "#ffffff", آبی: "#2563eb", "سرمه ای": "#1e2a5a", قرمز: "#dc2626",
  سبز: "#16a34a", زرد: "#facc15", نارنجی: "#f97316", صورتی: "#f472b6", بنفش: "#7c3aed", طوسی: "#9ca3af",
  خاکستری: "#9ca3af", "طوسی تیره": "#4b5563", "قهوه ای": "#7c4a21", کرم: "#f5e6c8", بژ: "#d6c3a3", زرشکی: "#7f1d1d",
  یشمی: "#2f6f5e", طلایی: "#d4af37", "نقره ای": "#c0c0c0", "فیروزه ای": "#14b8a6", "آبی روشن": "#7dd3fc", "سبز ارتشی": "#4b5320",
};
const hexOf = (value: string) => COLOR_HEX[normName(value)] ?? null;

/** مقدارهای رایج برای حدس رنگ/سایز از عنوان کالا، کنار مقدارهای خود محور */
const COMMON: Record<"color" | "size", string[]> = {
  color: Object.keys(COLOR_HEX),
  size: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL", "5XL", "فری سایز", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
};

// ── وضعیت اتصال ──────────────────────────────────────────────────────

export interface ItemLink {
  productId: string;
  product: string;
  /** «آبی / L» — کالای تنوع؛ null = کالای خود محصول (هم‌شناسه) */
  variant: string | null;
}

/** کالا به کدام محصول/تنوع سایت وصل است */
export async function itemLinks(ids: string[], db: Db = prisma): Promise<Map<string, ItemLink>> {
  const uniq = [...new Set(ids)];
  const out = new Map<string, ItemLink>();
  if (!uniq.length) return out;
  const [products, variants] = await Promise.all([
    db.product.findMany({ where: { id: { in: uniq } }, select: { id: true, title: true } }),
    db.productVariant.findMany({ where: { accItemId: { in: uniq } }, select: { accItemId: true, title: true, productId: true, product: { select: { title: true } } } }),
  ]);
  for (const p of products) out.set(p.id, { productId: p.id, product: p.title, variant: null });
  for (const v of variants) out.set(v.accItemId!, { productId: v.productId, product: v.product.title, variant: v.title });
  return out;
}

/** کالاهای فعالِ فروش آنلاین که نه محصول هم‌شناسه دارند نه به تنوعی وصل‌اند */
export async function unlinkedItemIds(db: Db = prisma, modelId?: string | null): Promise<string[]> {
  const rows = modelId
    ? await db.$queryRaw<{ id: string }[]>`SELECT i.id FROM "AccItem" i WHERE i."isActive" AND i."sellOnline" AND i."modelId" = ${modelId}
        AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = i.id)
        AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."accItemId" = i.id)`
    : await db.$queryRaw<{ id: string }[]>`SELECT i.id FROM "AccItem" i WHERE i."isActive" AND i."sellOnline"
        AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = i.id)
        AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."accItemId" = i.id)`;
  return rows.map((r) => r.id);
}

/** موجودی قابل فروش (جمع انبارهای sellable) — در حالت بی‌حسابداری صفر */
async function sellableQty(db: Db, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const sellable = (await db.accWarehouse.findMany({ where: { sellable: true }, select: { id: true } })).map((w) => w.id);
  const rows = await db.accStock.groupBy({ by: ["productId"], where: { productId: { in: ids }, warehouseId: { in: sellable } }, _sum: { qty: true } });
  return new Map(rows.map((r) => [r.productId, r._sum.qty ?? 0]));
}

async function isInternal(db: Db) {
  return (await db.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } }))?.mode === "INTERNAL";
}

// ── پیشنهادها ────────────────────────────────────────────────────────

export interface SugAttr {
  axisId: string;
  axis: string;
  valueId: string;
  value: string;
}
export interface SugItem {
  id: string;
  code: string;
  title: string;
  qty: number;
  salePrice: bigint | null;
  attrs: SugAttr[];
}
export interface ModelGuess {
  title: string;
  /** مدل هم‌نامی که هست — کالاها به همان می‌روند */
  modelId: string | null;
  items: { id: string; code: string; title: string; attrs: { axisId: string; axis: string; value: string }[] }[];
}

const LOOSE_MAX = 500;

export async function loadSuggestions(db: Db = prisma) {
  const ids = await unlinkedItemIds(db);
  const [items, qty, axes, enabled, internal] = await Promise.all([
    db.accItem.findMany({
      where: { id: { in: ids } },
      include: { attrs: { include: { axis: true, value: true } } },
      orderBy: { title: "asc" },
    }),
    sellableQty(db, ids),
    db.accAxis.findMany({ orderBy: { sortOrder: "asc" }, include: { values: true } }),
    variantsEnabled(db),
    isInternal(db),
  ]);
  const axisOrder = new Map(axes.map((a, i) => [a.id, i]));
  const toSug = (i: (typeof items)[number]): SugItem => ({
    id: i.id,
    code: i.code,
    title: i.title,
    qty: qty.get(i.id) ?? 0,
    salePrice: i.salePrice,
    attrs: i.attrs
      .map((a) => ({ axisId: a.axisId, axis: a.axis.name, valueId: a.valueId, value: a.value.value }))
      .sort((a, b) => (axisOrder.get(a.axisId) ?? 0) - (axisOrder.get(b.axisId) ?? 0)),
  });

  const byModel = new Map<string, SugItem[]>();
  const loose: SugItem[] = [];
  for (const i of items) {
    if (i.modelId) byModel.set(i.modelId, [...(byModel.get(i.modelId) ?? []), toSug(i)]);
    else loose.push(toSug(i));
  }
  const models = await db.accItemModel.findMany({ where: { id: { in: [...byModel.keys()] } } });
  const productIds = models.map((m) => m.productId).filter((x): x is string => !!x);
  const products = productIds.length ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true } }) : [];
  const productOf = new Map(products.map((p) => [p.id, p.title]));

  const rows = models
    .map((m) => {
      const its = byModel.get(m.id)!;
      const product = m.productId && productOf.has(m.productId) ? { id: m.productId, title: productOf.get(m.productId)! } : null;
      return { id: m.id, title: m.title, product, items: its, qty: its.reduce((t, i) => t + Math.max(0, i.qty), 0) };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "fa"));

  const guesses = await guessModels(db, loose, axes);
  const guessed = new Set(guesses.flatMap((g) => g.items.map((i) => i.id)));

  return {
    /** کالای تازه‌ی مدلی که محصول دارد — «افزودن به محصول» */
    additions: rows.filter((r) => r.product),
    /** مدل بی‌محصول — «ساخت محصول» */
    models: rows.filter((r) => !r.product),
    guesses,
    loose: loose.filter((i) => !guessed.has(i.id)).slice(0, LOOSE_MAX),
    looseTotal: loose.length - guessed.size,
    enabled,
    internal,
  };
}

/**
 * کالاهای بی‌مدلی که عنوانشان فقط در رنگ/سایز پایانی فرق دارد — «تیشرت ساده آبی L»،
 * «تیشرت ساده مشکی M» ← مدل «تیشرت ساده». مقدارها از خود محور، از ویژگی هم‌نام
 * فروشگاه و از چند مقدار رایج. فقط پیشنهاد است؛ ساخت مدل با کلیک کاربر.
 */
async function guessModels(db: Db, loose: SugItem[], axes: { id: string; name: string; values: { value: string }[] }[]): Promise<ModelGuess[]> {
  const bare = loose.filter((i) => !i.attrs.length);
  if (bare.length < 2 || !axes.length) return [];
  const attributes = await db.attribute.findMany({ select: { title: true, values: { select: { value: true } } } });
  const pool = new Map<string, { axisId: string; axis: string; value: string }[]>();
  const add = (axisId: string, axis: string, value: string) => {
    const k = normName(value);
    if (!k) return;
    const cur = pool.get(k) ?? [];
    if (!cur.some((c) => c.axisId === axisId)) pool.set(k, [...cur, { axisId, axis, value: clean(value) }]);
  };
  for (const a of axes) {
    for (const v of a.values) add(a.id, a.name, v.value);
    for (const at of attributes) if (normName(at.title) === normName(a.name)) for (const v of at.values) add(a.id, a.name, v.value);
    const kind = isColorAxis(a.name) ? "color" : ["سایز", "size", "اندازه"].includes(normName(a.name)) ? "size" : null;
    if (kind) for (const v of COMMON[kind]) add(a.id, a.name, v);
  }

  const groups = new Map<string, { title: string; items: ModelGuess["items"]; combos: Set<string> }>();
  for (const it of bare) {
    const tokens = clean(it.title).split(" ");
    const attrs: { axisId: string; axis: string; value: string }[] = [];
    while (tokens.length > 1) {
      let hit: { axisId: string; axis: string; value: string } | undefined;
      let take = 0;
      // اول دو کلمه‌ی آخر («سرمه ای»، «فری سایز»)، بعد یکی
      for (const n of [2, 1]) {
        if (tokens.length <= n) continue;
        const cand = pool.get(normName(tokens.slice(-n).join(" ")))?.find((c) => !attrs.some((a) => a.axisId === c.axisId));
        if (cand) {
          hit = cand;
          take = n;
          break;
        }
      }
      if (!hit) break;
      attrs.unshift(hit);
      tokens.splice(-take, take);
    }
    if (!attrs.length) continue;
    const base = tokens.join(" ");
    const key = `${normName(base)}|${attrs.map((a) => a.axisId).sort().join(",")}`;
    const combo = attrs.map((a) => `${a.axisId}=${normName(a.value)}`).sort().join("|");
    const g = groups.get(key) ?? { title: base, items: [], combos: new Set<string>() };
    if (g.combos.has(combo)) continue; // ترکیب تکراری — همان یکی اول
    g.combos.add(combo);
    g.items.push({ id: it.id, code: it.code, title: it.title, attrs });
    groups.set(key, g);
  }
  const found = [...groups.values()].filter((g) => g.items.length >= 2);
  if (!found.length) return [];
  const existing = await db.accItemModel.findMany({ where: { title: { in: found.map((g) => g.title) } }, select: { id: true, title: true } });
  return found
    .map((g) => ({ title: g.title, modelId: existing.find((m) => m.title === g.title)?.id ?? null, items: g.items }))
    .sort((a, b) => b.items.length - a.items.length);
}

/** ساخت مدل از پیشنهاد — کالاها زیر مدل با رنگ/سایزشان می‌نشینند (هنوز بی‌محصول) */
export async function applyModelGuess(tx: Tx, input: { title: unknown; items: { id: string; attrs: { axisId: string; value: string }[] }[] }) {
  const title = clean(input.title);
  if (!title) throw new AccError("نام مدل را بنویسید");
  if (!input.items?.length) throw new AccError("کالایی انتخاب نشده");
  const free = new Set(await unlinkedItemIds(tx));
  const items = await tx.accItem.findMany({ where: { id: { in: input.items.map((i) => i.id) } } });
  if (items.length !== input.items.length) throw new AccError("کالا پیدا نشد", 404);
  for (const it of items) {
    if (it.modelId) throw new AccError(`«${it.title}» مدل دارد`, 409);
    if (!free.has(it.id)) throw new AccError(`«${it.title}» به محصول سایت وصل است`, 409);
  }
  const model = (await tx.accItemModel.findUnique({ where: { title } })) ?? (await tx.accItemModel.create({ data: { title, groupId: items[0].groupId } }));
  const taken = new Set((await tx.accItem.findMany({ where: { modelId: model.id }, select: { attrKey: true } })).map((i) => i.attrKey));
  for (const row of input.items) {
    const it = items.find((i) => i.id === row.id)!;
    if (!row.attrs?.length) throw new AccError(`«${it.title}» رنگ یا سایز ندارد`);
    const attrs = [];
    for (const a of row.attrs) attrs.push({ axisId: a.axisId, valueId: (await ensureAxisValues(tx, a.axisId, [a.value])).values[0].id });
    const key = attrKeyOf(attrs);
    if (taken.has(key)) throw new AccError(`ترکیب «${it.title}» در مدل «${title}» دو بار آمده`, 409);
    taken.add(key);
    await tx.accItemAttr.deleteMany({ where: { itemId: it.id } });
    await tx.accItemAttr.createMany({ data: attrs.map((a) => ({ itemId: it.id, ...a })) });
    await tx.accItem.update({ where: { id: it.id }, data: { modelId: model.id, attrKey: key } });
  }
  return model;
}

/** «در فروش آنلاین نیست» — دیگر پیشنهاد نشود */
export async function dismissItems(tx: Tx, ids: string[]) {
  if (!ids.length) throw new AccError("کالایی انتخاب نشده");
  const r = await tx.accItem.updateMany({ where: { id: { in: ids } }, data: { sellOnline: false } });
  return r.count;
}

// ── نگاشت محور کالا به ویژگی فروشگاه ─────────────────────────────────

type StoreAttr = { id: string; title: string; group: { title: string }; values: { id: string; value: string }[] };

async function storeAttributes(db: Db): Promise<StoreAttr[]> {
  return db.attribute.findMany({
    orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, title: true, group: { select: { title: true } }, values: { select: { id: true, value: true } } },
  });
}

export interface AxisPlan {
  axisId: string;
  axis: string;
  /** null = ویژگی تازه با نام محور ساخته می‌شود */
  attributeId: string | null;
  attribute: string;
  candidates: { id: string; title: string; group: string }[];
  /** مقدارهایی که در ویژگی فروشگاه نیست و ساخته می‌شود */
  newValues: string[];
}

/** «new» = ویژگی تازه؛ شناسه = ویژگی موجود؛ خالی = هم‌نام یا تازه */
type AxisMap = Record<string, string>;

function planAxes(axes: { id: string; name: string }[], usedValues: Map<string, Set<string>>, attrs: StoreAttr[], map: AxisMap = {}): AxisPlan[] {
  const out: AxisPlan[] = [];
  for (const ax of axes) {
    const candidates = attrs.filter((a) => normName(a.title) === normName(ax.name));
    const want = map[ax.id];
    let chosen: StoreAttr | null;
    if (want === "new") chosen = null;
    else if (want) {
      chosen = attrs.find((a) => a.id === want) ?? null;
      if (!chosen) throw new AccError(`ویژگی فروشگاه برای «${ax.name}» پیدا نشد`, 404);
    } else chosen = candidates[0] ?? null;
    if (chosen && out.some((o) => o.attributeId === chosen!.id)) throw new AccError(`ویژگی «${chosen.title}» برای دو محور انتخاب شده`);
    const values = [...(usedValues.get(ax.id) ?? [])];
    out.push({
      axisId: ax.id,
      axis: ax.name,
      attributeId: chosen?.id ?? null,
      attribute: chosen?.title ?? ax.name,
      candidates: [...candidates, ...(chosen && !candidates.includes(chosen) ? [chosen] : [])].map((a) => ({ id: a.id, title: a.title, group: a.group.title })),
      newValues: chosen ? values.filter((v) => !chosen!.values.some((x) => normName(x.value) === normName(v))) : values,
    });
  }
  return out;
}

/** ویژگی و مقدارهای فروشگاه برای محورها — نبود ساخته می‌شود؛ خروجی: axisId ← attributeId و (axisId، مقدار) ← valueId */
async function resolveAxes(tx: Tx, plan: AxisPlan[]) {
  const attrOf = new Map<string, string>();
  const valueOf = new Map<string, string>();
  for (const p of plan) {
    let attrId = p.attributeId;
    if (!attrId) {
      const group =
        (await tx.attributeGroup.findFirst({ where: { title: "تنوع محصول" } })) ??
        (await tx.attributeGroup.create({ data: { title: "تنوع محصول", sortOrder: 100 } }));
      const siblings = await tx.attribute.findMany({ where: { groupId: group.id }, select: { slug: true, title: true, id: true } });
      const same = siblings.find((s) => normName(s.title) === normName(p.axis));
      if (same) attrId = same.id;
      else {
        const base = slugify(p.axis) || "variant";
        let slug = base;
        for (let n = 2; siblings.some((s) => s.slug === slug); n++) slug = `${base}-${n}`;
        attrId = (await tx.attribute.create({ data: { groupId: group.id, title: p.axis, slug, sortOrder: siblings.length + 1 } })).id;
      }
    }
    attrOf.set(p.axisId, attrId);
    const at = await tx.attribute.findUnique({ where: { id: attrId }, include: { values: true } });
    for (const v of at!.values) valueOf.set(`${p.axisId}|${normName(v.value)}`, v.id);
  }
  const ensure = async (axisId: string, value: string, color: boolean) => {
    const k = `${axisId}|${normName(value)}`;
    const hit = valueOf.get(k);
    if (hit) return hit;
    const v = await addAttributeValue(tx, attrOf.get(axisId)!, value, color ? hexOf(value) : null);
    valueOf.set(k, v.id);
    return v.id;
  };
  return { attrOf, ensure };
}

// ── ساخت محصول از مدل ────────────────────────────────────────────────

export interface FromModelInput {
  modelId: string;
  title?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  price?: bigint | null;
  axisMap?: AxisMap;
  /** کالاهایی که تنوع نشوند */
  exclude?: string[];
}

/** پرتکرارترین قیمت فروش — قیمت پایه‌ی محصول؛ بقیه قیمت تنوع می‌گیرند */
function basePriceOf(prices: (bigint | null)[]) {
  const n = new Map<string, number>();
  for (const p of prices) if (p !== null && p > 0n) n.set(p.toString(), (n.get(p.toString()) ?? 0) + 1);
  let best: string | null = null;
  for (const [k, c] of n) if (best === null || c > n.get(best)! || (c === n.get(best)! && BigInt(k) < BigInt(best))) best = k;
  return best === null ? null : BigInt(best);
}

async function uniqueSlug(db: Db, title: string) {
  const base = slugify(title) || "product";
  let slug = base;
  for (let n = 2; await db.product.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${base}-${n}`;
  return slug;
}

export async function planFromModel(db: Db, input: FromModelInput) {
  const model = await db.accItemModel.findUnique({ where: { id: input.modelId } });
  if (!model) throw new AccError("مدل پیدا نشد", 404);
  if (model.productId && (await db.product.findUnique({ where: { id: model.productId }, select: { id: true } })))
    throw new AccError("از این مدل محصول ساخته شده — کالاهای تازه را به همان محصول اضافه کنید", 409);

  const free = await unlinkedItemIds(db, model.id);
  const exclude = new Set(input.exclude ?? []);
  const all = await db.accItem.findMany({
    where: { id: { in: free } },
    include: { attrs: { include: { value: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!all.length) throw new AccError("کالای بی‌محصولی در این مدل نیست");
  const axes = await db.accAxis.findMany({ where: { id: { in: [...new Set(all.flatMap((i) => i.attrs.map((a) => a.axisId)))] } }, orderBy: { sortOrder: "asc" } });
  if (!axes.length) throw new AccError("کالاهای این مدل رنگ یا سایز ندارند — از «محصول ساده» بسازید یا در کالا ویژگی بگذارید");

  const skipped: { id: string; code: string; title: string; reason: string }[] = [];
  const used = new Map<string, Set<string>>();
  const ready: typeof all = [];
  for (const it of all) {
    if (exclude.has(it.id)) {
      skipped.push({ id: it.id, code: it.code, title: it.title, reason: "کنار گذاشته شد" });
      continue;
    }
    const missing = axes.filter((a) => !it.attrs.some((x) => x.axisId === a.id));
    if (missing.length) {
      skipped.push({ id: it.id, code: it.code, title: it.title, reason: `${missing.map((m) => m.name).join(" و ")} ندارد` });
      continue;
    }
    ready.push(it);
    for (const a of it.attrs) used.set(a.axisId, (used.get(a.axisId) ?? new Set()).add(a.value.value));
  }
  if (!ready.length) throw new AccError("هیچ کالایی برای تنوع نماند");

  const qty = await sellableQty(db, ready.map((i) => i.id));
  const basePrice = input.price !== undefined && input.price !== null ? input.price : basePriceOf(ready.map((i) => i.salePrice));
  const axisPlan = planAxes(axes, used, await storeAttributes(db), input.axisMap);
  const valueOrder = (it: (typeof ready)[number]) => axes.map((a) => it.attrs.find((x) => x.axisId === a.id)!.value);

  const sortKey = (it: (typeof ready)[number]) => valueOrder(it).map((v) => String(v.sortOrder).padStart(6, "0")).join("|");
  const variants = [...ready]
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .map((it) => {
      const vals = valueOrder(it);
      return {
        itemId: it.id,
        code: it.code,
        title: it.title,
        label: vals.map((v) => v.value).join(" / "),
        values: axes.map((a, i) => ({ axisId: a.id, value: vals[i].value })),
        price: it.salePrice !== null && it.salePrice > 0n && it.salePrice !== basePrice ? it.salePrice : null,
        qty: qty.get(it.id) ?? 0,
      };
    });

  return {
    model: { id: model.id, title: model.title, groupId: model.groupId },
    title: clean(input.title) || model.title,
    basePrice,
    axes: axisPlan,
    variants,
    skipped,
  };
}

export async function createFromModel(tx: Tx, input: FromModelInput) {
  const plan = await planFromModel(tx, input);
  if (!input.categoryId) throw new AccError("دسته‌ی محصول را انتخاب کنید");
  if (!(await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) throw new AccError("دسته پیدا نشد", 404);
  if (input.brandId && !(await tx.brand.findUnique({ where: { id: input.brandId }, select: { id: true } }))) throw new AccError("برند پیدا نشد", 404);

  const { attrOf, ensure } = await resolveAxes(tx, plan.axes);
  const colorAxes = new Set(plan.axes.filter((a) => isColorAxis(a.axis) || isColorAxis(a.attribute)).map((a) => a.axisId));
  const variants: VariantInput[] = [];
  for (const v of plan.variants) {
    const options: Record<string, string> = {};
    for (const x of v.values) options[attrOf.get(x.axisId)!] = await ensure(x.axisId, x.value, colorAxes.has(x.axisId));
    variants.push({ options, price: v.price, salePrice: null, stock: Math.max(0, v.qty), sku: v.code, accItemId: v.itemId, isActive: true });
  }

  const product = await tx.product.create({
    data: {
      title: plan.title,
      slug: await uniqueSlug(tx, plan.title),
      categoryId: input.categoryId,
      brandId: input.brandId || null,
      price: plan.basePrice ?? 0n,
      isActive: false,
      trackStock: true,
    },
    select: { id: true, slug: true, title: true },
  });
  // کالای خود محصول را تریگر ساخت؛ محصول تنوع‌دار با کالای تنوع‌ها شمرده می‌شود (طرح، شروع فاز ۵ بند ۳)
  await tx.accItem.updateMany({ where: { id: product.id }, data: { isActive: false, sellOnline: false, groupId: plan.model.groupId } });
  await saveVariants(tx, product.id, {
    axes: plan.axes.map((a) => ({ attributeId: attrOf.get(a.axisId)!, display: colorAxes.has(a.axisId) ? "SWATCH" : "CHIP" })),
    variants,
  });
  await tx.accItemModel.update({ where: { id: plan.model.id }, data: { productId: product.id } });
  // کلید قیمت آنلاین روشن ← قیمت تنوع‌ها از قاعده (docs/plans/inventory-items.md بخش ۱۴)
  if (input.price === undefined || input.price === null) await applyOnlinePrices(tx, plan.variants.map((v) => v.itemId));
  return { product, variants: variants.length, skipped: plan.skipped };
}

// ── افزودن کالای تازه به محصول موجود ─────────────────────────────────

export async function planAddToProduct(db: Db, productId: string, itemIds?: string[]) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      price: true,
      variantAxes: { orderBy: { sortOrder: "asc" }, select: { attributeId: true } },
      variants: { select: { id: true, optionKey: true, accItemId: true, title: true } },
    },
  });
  if (!product) throw new AccError("محصول پیدا نشد", 404);
  if (!product.variantAxes.length) throw new AccError("این محصول تنوع ندارد — تنوع را از ویرایش محصول بسازید");

  let ids = itemIds;
  if (!ids) {
    const models = await db.accItemModel.findMany({ where: { productId }, select: { id: true } });
    ids = (await Promise.all(models.map((m) => unlinkedItemIds(db, m.id)))).flat();
  } else {
    const free = new Set(await unlinkedItemIds(db));
    const bad = ids.find((id) => !free.has(id));
    if (bad) throw new AccError("کالا به محصولی وصل است یا فروش آنلاین ندارد", 409);
  }
  if (!ids.length) throw new AccError("کالای تازه‌ای برای این محصول نیست");

  const attrs = await db.attribute.findMany({ where: { id: { in: product.variantAxes.map((a) => a.attributeId) } }, include: { values: true } });
  const attrById = new Map(attrs.map((a) => [a.id, a]));
  // نگاشت محور کالا ← ویژگی محصول: اول از کالاهای همین محصول که وصل‌اند، بعد با نام
  const axisToAttr = new Map<string, string>();
  const linked = product.variants.filter((v) => v.accItemId);
  if (linked.length) {
    const [opts, itemAttrs] = await Promise.all([
      db.productVariantOption.findMany({ where: { variantId: { in: linked.map((v) => v.id) } } }),
      db.accItemAttr.findMany({ where: { itemId: { in: linked.map((v) => v.accItemId!) } }, include: { value: true, axis: true } }),
    ]);
    for (const v of linked) {
      for (const ia of itemAttrs.filter((x) => x.itemId === v.accItemId)) {
        if (axisToAttr.has(ia.axisId)) continue;
        const o = opts.find((x) => x.variantId === v.id && normName(attrById.get(x.attributeId)?.values.find((y) => y.id === x.attributeValueId)?.value ?? "") === normName(ia.value.value));
        if (o) axisToAttr.set(ia.axisId, o.attributeId);
      }
    }
  }
  const items = await db.accItem.findMany({ where: { id: { in: ids } }, include: { attrs: { include: { axis: true, value: true } } }, orderBy: { createdAt: "asc" } });
  for (const it of items)
    for (const a of it.attrs) if (!axisToAttr.has(a.axisId)) {
      const at = attrs.find((x) => normName(x.title) === normName(a.axis.name) && ![...axisToAttr.values()].includes(x.id));
      if (at) axisToAttr.set(a.axisId, at.id);
    }

  const byKey = new Map(product.variants.map((v) => [v.optionKey, v]));
  const qty = await sellableQty(db, ids);
  const add: { itemId: string; code: string; title: string; label: string; action: "new" | "link"; price: bigint | null; qty: number; options: { attributeId: string; value: string; valueId: string | null }[] }[] = [];
  const skipped: { id: string; code: string; title: string; reason: string }[] = [];
  const newValues = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const it of items) {
    const mapped = it.attrs.map((a) => ({ attributeId: axisToAttr.get(a.axisId), value: a.value.value, axis: a.axis.name }));
    const unmapped = mapped.find((m) => !m.attributeId);
    if (unmapped) {
      skipped.push({ id: it.id, code: it.code, title: it.title, reason: `محصول ویژگی «${unmapped.axis}» ندارد` });
      continue;
    }
    const missing = product.variantAxes.filter((ax) => !mapped.some((m) => m.attributeId === ax.attributeId));
    if (missing.length) {
      skipped.push({ id: it.id, code: it.code, title: it.title, reason: `${missing.map((m) => attrById.get(m.attributeId)?.title).join(" و ")} ندارد` });
      continue;
    }
    const options = product.variantAxes.map((ax) => {
      const m = mapped.find((x) => x.attributeId === ax.attributeId)!;
      const hit = attrById.get(ax.attributeId)!.values.find((v) => normName(v.value) === normName(m.value));
      if (!hit) newValues.set(ax.attributeId, (newValues.get(ax.attributeId) ?? new Set()).add(m.value));
      return { attributeId: ax.attributeId, value: m.value, valueId: hit?.id ?? null };
    });
    const label = options.map((o) => o.value).join(" / ");
    const key = options.every((o) => o.valueId) ? optionKeyOf(options.map((o) => ({ attributeId: o.attributeId, attributeValueId: o.valueId! }))) : `new:${options.map((o) => `${o.attributeId}=${normName(o.value)}`).join("|")}`;
    if (seen.has(key)) {
      skipped.push({ id: it.id, code: it.code, title: it.title, reason: `«${label}» دو بار آمده` });
      continue;
    }
    seen.add(key);
    const cur = byKey.get(key);
    if (cur?.accItemId) {
      skipped.push({ id: it.id, code: it.code, title: it.title, reason: `تنوع «${cur.title}» کالای دیگری دارد` });
      continue;
    }
    add.push({
      itemId: it.id,
      code: it.code,
      title: it.title,
      label,
      action: cur ? "link" : "new",
      price: it.salePrice !== null && it.salePrice > 0n && it.salePrice !== product.price ? it.salePrice : null,
      qty: qty.get(it.id) ?? 0,
      options,
    });
  }
  return {
    product: { id: product.id, title: product.title },
    add,
    skipped,
    newValues: [...newValues].map(([attributeId, vs]) => ({ attribute: attrById.get(attributeId)!.title, values: [...vs] })),
  };
}

export async function addToProduct(tx: Tx, productId: string, itemIds?: string[]) {
  const plan = await planAddToProduct(tx, productId, itemIds);
  if (!plan.add.length) throw new AccError(plan.skipped[0] ? `${plan.skipped[0].title}: ${plan.skipped[0].reason}` : "کالایی برای افزودن نیست");
  const [axes, existing] = await Promise.all([
    tx.productVariantAxis.findMany({ where: { productId }, orderBy: { sortOrder: "asc" } }),
    tx.productVariant.findMany({ where: { productId }, include: { options: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  const attrs = await tx.attribute.findMany({ where: { id: { in: axes.map((a) => a.attributeId) } }, select: { id: true, title: true } });
  const color = new Set(attrs.filter((a) => isColorAxis(a.title)).map((a) => a.id));
  const rows: VariantInput[] = existing.map((v) => ({
    options: Object.fromEntries(v.options.map((o) => [o.attributeId, o.attributeValueId])),
    price: v.price,
    salePrice: v.salePrice,
    stock: v.stock,
    sku: v.sku,
    accItemId: v.accItemId,
    isActive: v.isActive,
  }));
  for (const a of plan.add) {
    const options: Record<string, string> = {};
    for (const o of a.options) options[o.attributeId] = o.valueId ?? (await addAttributeValue(tx, o.attributeId, o.value, color.has(o.attributeId) ? hexOf(o.value) : null)).id;
    const key = optionKeyOf(Object.entries(options).map(([attributeId, attributeValueId]) => ({ attributeId, attributeValueId })));
    const cur = rows.find((r) => optionKeyOf(Object.entries(r.options).map(([attributeId, attributeValueId]) => ({ attributeId, attributeValueId }))) === key);
    if (cur) {
      cur.accItemId = a.itemId;
      cur.sku = cur.sku || a.code;
    } else rows.push({ options, price: a.price, salePrice: null, stock: Math.max(0, a.qty), sku: a.code, accItemId: a.itemId, isActive: true });
  }
  await saveVariants(tx, productId, { axes: axes.map((a) => ({ attributeId: a.attributeId, display: a.display })), variants: rows });
  return { product: plan.product, added: plan.add.length, skipped: plan.skipped };
}

// ── محصول ساده از یک کالا ────────────────────────────────────────────

/**
 * محصول با **همان شناسه‌ی کالا** (تصمیم ۲) — تریگر کالای تازه نمی‌سازد و کاردکس،
 * موجودی سایت و فاکتور سفارش مثل هر محصول قبلی به همین کالا می‌روند.
 */
export async function createSimpleFromItem(tx: Tx, itemId: string, input: { title?: string | null; categoryId?: string | null; brandId?: string | null; price?: bigint | null }) {
  const item = await tx.accItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AccError("کالا پیدا نشد", 404);
  if (!(await unlinkedItemIds(tx)).includes(itemId)) throw new AccError("این کالا به محصول سایت وصل است یا فروش آنلاین ندارد", 409);
  if (!input.categoryId) throw new AccError("دسته‌ی محصول را انتخاب کنید");
  if (!(await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) throw new AccError("دسته پیدا نشد", 404);
  if (input.brandId && !(await tx.brand.findUnique({ where: { id: input.brandId }, select: { id: true } }))) throw new AccError("برند پیدا نشد", 404);
  const title = clean(input.title) || item.title;
  const internal = await isInternal(tx);
  const qty = internal ? Math.max(0, (await sellableQty(tx, [itemId])).get(itemId) ?? 0) : 0;
  const product = await tx.product.create({
    data: {
      id: item.id,
      title,
      slug: await uniqueSlug(tx, title),
      categoryId: input.categoryId,
      brandId: input.brandId || null,
      price: input.price ?? item.salePrice ?? 0n,
      stock: qty,
      trackStock: internal,
      isActive: false,
    },
    select: { id: true, slug: true, title: true },
  });
  if (input.price === undefined || input.price === null) await applyOnlinePrices(tx, [item.id]);
  return { product };
}
