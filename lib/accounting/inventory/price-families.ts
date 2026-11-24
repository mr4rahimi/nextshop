/**
 * «تغییر سریع» قیمت فروشگاه — با یک کد همه‌ی رنگ و سایزهای همان مدل.
 *
 * در پوشاک قیمت همه‌ی تنوع‌های یک مدل یکی است؛ پس جست‌وجو (کد کالا، بارکد، کد مدل،
 * کد نرم‌افزار قبلی یا نام) به «خانواده» می‌رسد: همه‌ی کالاهای فعال مدل + کالای تجمیعی
 * خریدی که مدل از آن تفکیک شد (`specs.sourceItemId`، شاید هنوز مانده داشته باشد).
 * کالای بی‌مدل خانواده‌ی تک‌کالایی است.
 *
 * کلید خانواده: `m:<modelId>` یا `i:<itemId>` — بعد از اعمال قیمت، همان کلیدها دوباره
 * خوانده می‌شوند تا قیمت تازه دیده شود. ⚠️ فقط خواندن؛ نوشتن با `applyPriceRows`.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exactItem, itemSearchWhere, normalizeItemCode } from "./items";
import { baseTitleOf } from "./relabel";
import { storePrices } from "./price-log";

type Db = Prisma.TransactionClient | typeof prisma;

const MAX_FAMILIES = 12;
const MAX_PER_FAMILY = 300;

export interface FamilyItem {
  id: string;
  code: string;
  title: string;
  /** «مشکی · L» — خالی برای کالای بی‌ویژگی */
  attrs: string;
  price: bigint;
  stock: number;
  /** کالای تجمیعی خرید (پیش از تفکیک) */
  source: boolean;
}

export interface PriceFamily {
  key: string;
  title: string;
  code: string | null;
  /** کد دقیق زده‌شده به همین خانواده رسید */
  exact: boolean;
  items: FamilyItem[];
}

const sourceOf = (specs: unknown): string | null => {
  const s = specs && typeof specs === "object" ? (specs as { sourceItemId?: unknown }).sourceItemId : null;
  return typeof s === "string" ? s : null;
};

/** کلید خانواده‌ی هر کالا — مدل خودش، یا مدلی که از این کالای تجمیعی ساخته شد */
async function familyKeys(db: Db, items: { id: string; modelId: string | null }[]): Promise<string[]> {
  const loose = items.filter((i) => !i.modelId).map((i) => i.id);
  const bySource = new Map<string, string>();
  if (loose.length) {
    const models = await db.accItemModel.findMany({
      where: { OR: loose.map((id) => ({ specs: { path: ["sourceItemId"], equals: id } })) },
      select: { id: true, specs: true },
    });
    for (const m of models) {
      const s = sourceOf(m.specs);
      if (s) bySource.set(s, m.id);
    }
  }
  return items.map((i) => (i.modelId ? `m:${i.modelId}` : bySource.has(i.id) ? `m:${bySource.get(i.id)}` : `i:${i.id}`));
}

/** خانواده‌های یک جست‌وجو؛ دقیق‌ها اول */
export async function searchFamilies(db: Db, q: string): Promise<PriceFamily[]> {
  const term = q.trim();
  if (!term) return [];
  const code = normalizeItemCode(term);
  const exactKeys: string[] = [];

  if (code) {
    const one = await exactItem(term, db);
    if (one) {
      const it = await db.accItem.findUnique({ where: { id: one }, select: { id: true, modelId: true } });
      if (it) exactKeys.push(...(await familyKeys(db, [it])));
    }
    const model = await db.accItemModel.findUnique({ where: { code }, select: { id: true } });
    if (model) exactKeys.push(`m:${model.id}`);
    const legacy = await db.accLegacyItem.findUnique({ where: { code }, select: { modelId: true } });
    if (legacy) exactKeys.push(`m:${legacy.modelId}`);
  }

  const [hits, models] = await Promise.all([
    db.accItem.findMany({ where: { AND: [{ isActive: true }, await itemSearchWhere(term, db)] }, select: { id: true, modelId: true }, orderBy: { code: "asc" }, take: 60 }),
    db.accItemModel.findMany({ where: { title: { contains: term, mode: "insensitive" } }, select: { id: true }, take: MAX_FAMILIES }),
  ]);
  const keys = [...new Set([...exactKeys, ...models.map((m) => `m:${m.id}`), ...(await familyKeys(db, hits))])].slice(0, MAX_FAMILIES);
  const fams = await loadFamilies(db, keys);
  const exact = new Set(exactKeys);
  return fams.filter((f) => f.items.length).map((f) => ({ ...f, exact: exact.has(f.key) }));
}

/** خانواده‌ها با کلید — ترتیب کلیدها حفظ می‌شود */
export async function loadFamilies(db: Db, keys: string[]): Promise<PriceFamily[]> {
  const modelIds = keys.filter((k) => k.startsWith("m:")).map((k) => k.slice(2));
  const loneIds = keys.filter((k) => k.startsWith("i:")).map((k) => k.slice(2));
  const models = modelIds.length
    ? await db.accItemModel.findMany({ where: { id: { in: modelIds } }, select: { id: true, title: true, code: true, specs: true } })
    : [];
  const sources = models.map((m) => sourceOf(m.specs)).filter((s): s is string => !!s);

  const items = await db.accItem.findMany({
    where: {
      isActive: true,
      OR: [
        ...(modelIds.length ? [{ modelId: { in: modelIds } }] : []),
        ...(loneIds.length || sources.length ? [{ id: { in: [...loneIds, ...sources] } }] : []),
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      modelId: true,
      attrs: { select: { axis: { select: { sortOrder: true } }, value: { select: { value: true } } } },
    },
    orderBy: { code: "asc" },
  });
  if (!items.length) return [];

  const ids = items.map((i) => i.id);
  const [prices, stocks] = await Promise.all([
    storePrices(db, ids),
    db.accStock.groupBy({ by: ["productId"], where: { productId: { in: ids } }, _sum: { qty: true } }),
  ]);
  const qty = new Map(stocks.map((s) => [s.productId, s._sum.qty ?? 0]));
  const row = (i: (typeof items)[number], source: boolean): FamilyItem => ({
    id: i.id,
    code: i.code,
    title: i.title,
    attrs: [...i.attrs]
      .sort((a, b) => a.axis.sortOrder - b.axis.sortOrder)
      .map((a) => a.value.value)
      .join(" · "),
    price: prices.get(i.id)?.price ?? 0n,
    stock: Math.max(0, qty.get(i.id) ?? 0),
    source,
  });

  const byId = new Map(items.map((i) => [i.id, i]));
  const out: PriceFamily[] = [];
  for (const key of keys) {
    const id = key.slice(2);
    if (key.startsWith("m:")) {
      const m = models.find((x) => x.id === id);
      if (!m) continue;
      const src = sourceOf(m.specs);
      const members = items.filter((i) => i.modelId === id && i.id !== src).map((i) => row(i, false));
      const s = src ? byId.get(src) : undefined;
      // کالای تجمیعی خرید فقط وقتی هنوز مانده دارد یا تنها عضو است
      if (s && s.modelId !== id) {
        const r = row(s, true);
        if (r.stock > 0 || !members.length) members.unshift(r);
      }
      out.push({ key, title: baseTitleOf(m), code: m.code, exact: false, items: members.slice(0, MAX_PER_FAMILY) });
    } else {
      const i = byId.get(id);
      if (i) out.push({ key, title: i.title, code: i.code, exact: false, items: [row(i, false)] });
    }
  }
  return out;
}
