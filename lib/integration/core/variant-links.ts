/**
 * تنوع‌های محصولِ ساخته‌شده روی بازارگاه — docs/integrations/create-products.md
 *
 * واحد نگاشت در هاب «محصول» است (یک لینک به ازای هر محصول و پلتفرم). محصول
 * تنوع‌دار روی باسلام هم یک محصول است با چند variation؛ پس نقشه‌ی
 * «تنوع سایت → تنوع بازارگاه» در `meta.variants` همان لینک نگه داشته می‌شود و
 * موجودی و قیمت هر تنوع مستقیم از جدول تنوع‌های سایت خوانده می‌شود، نه از
 * `IntegMapping.stock` (که برای محصول تنوع‌دار یک عدد کلی و بی‌معناست).
 *
 * ⚠️ این ماژول فقط به prisma وابسته است تا آداپتورها بتوانند importش کنند
 *    (adapter-registry → adapter → این فایل؛ برعکسش حلقه می‌سازد).
 */

import { prisma } from "@/lib/prisma";

// ── تنظیمات ساخت محصول (روی config اتصال) ─────────────────────────────

export interface CreateSettings {
  /** دسته‌ی سایت → شناسه‌ی دسته‌ی بازارگاه */
  categoryMap:        Record<string, number>;
  preparationDays:    number;
  /** وزن خالص کالا، گرم */
  weight:             number;
  /** وزن با بسته‌بندی، گرم */
  packageWeight:      number;
  /** افزایش قیمت نسبت به قیمت سایت (کارمزد بازارگاه) */
  priceAdjustPercent: number;
  /** گرد کردن قیمت به بالا، تومان (۰ = بدون گرد کردن) */
  roundTo:            number;
  /** موجودی محصولی که «کنترل موجودی» ندارد */
  untrackedStock:     number;
  /** true = منتشرشده؛ false = منتشرنشده (پیش‌فرض) */
  publish:            boolean;
  /** ارسال خودکار موجودی و قیمت تنوع‌ها هر «بازه خودکار» اتصال */
  autoSyncVariants:   boolean;
}

export const DEFAULT_CREATE_SETTINGS: CreateSettings = {
  categoryMap:        {},
  preparationDays:    2,
  weight:             300,
  packageWeight:      400,
  priceAdjustPercent: 0,
  roundTo:            0,
  untrackedStock:     10,
  publish:            false,
  autoSyncVariants:   true,
};

function num(v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function normalizeCreateSettings(raw: unknown): CreateSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_CREATE_SETTINGS;
  const map: Record<string, number> = {};
  if (r.categoryMap && typeof r.categoryMap === "object") {
    for (const [k, v] of Object.entries(r.categoryMap as Record<string, unknown>)) {
      const id = num(v, 0, 0);
      if (k && id > 0) map[k] = Math.floor(id);
    }
  }
  return {
    categoryMap:        map,
    preparationDays:    Math.floor(num(r.preparationDays, d.preparationDays, 1, 60)),
    weight:             Math.floor(num(r.weight, d.weight, 1, 1_000_000)),
    packageWeight:      Math.floor(num(r.packageWeight, d.packageWeight, 1, 1_000_000)),
    priceAdjustPercent: num(r.priceAdjustPercent, d.priceAdjustPercent, -50, 200),
    roundTo:            Math.floor(num(r.roundTo, d.roundTo, 0, 1_000_000)),
    untrackedStock:     Math.floor(num(r.untrackedStock, d.untrackedStock, 0, 100_000)),
    publish:            typeof r.publish === "boolean" ? r.publish : d.publish,
    autoSyncVariants:   typeof r.autoSyncVariants === "boolean" ? r.autoSyncVariants : d.autoSyncVariants,
  };
}

export async function getCreateSettings(platformCode: string): Promise<CreateSettings> {
  const conn = await prisma.integConnection.findFirst({ where: { platformCode }, select: { config: true } });
  return normalizeCreateSettings((conn?.config as Record<string, unknown> | null)?.create);
}

export async function saveCreateSettings(platformCode: string, patch: Partial<CreateSettings>): Promise<CreateSettings> {
  const conn = await prisma.integConnection.findFirst({ where: { platformCode }, select: { id: true, config: true } });
  if (!conn) throw new Error("اتصال این بازارگاه هنوز ساخته نشده است");
  const config = (conn.config && typeof conn.config === "object" ? conn.config : {}) as Record<string, unknown>;
  const next = normalizeCreateSettings({ ...normalizeCreateSettings(config.create), ...patch });
  await prisma.integConnection.update({ where: { id: conn.id }, data: { config: { ...config, create: next } as object } });
  return next;
}

/** قیمت سایت (تومان) → قیمت بازارگاه (تومان): افزایش درصدی و گرد کردن به بالا */
export function marketPrice(shopPrice: bigint | number, s: Pick<CreateSettings, "priceAdjustPercent" | "roundTo">): number {
  const base = Number(shopPrice);
  const adjusted = base * (1 + s.priceAdjustPercent / 100);
  return s.roundTo > 0 ? Math.ceil(adjusted / s.roundTo) * s.roundTo : Math.round(adjusted);
}

/** قیمت مؤثر سایت: فروش ویژه اگر معتبر است، وگرنه قیمت */
export function shopEffective(price: bigint, salePrice: bigint | null): bigint {
  return salePrice !== null && salePrice > 0n && salePrice < price ? salePrice : price;
}

// ── نقشه‌ی تنوع روی لینک نگاشت ──────────────────────────────────────

export interface VariantLinkMeta {
  /** shopVariantId → platformVariantId */
  variants: Record<string, string>;
  /** آخرین مقدار ارسال‌شده‌ی هر تنوع بازارگاه — برای نفرستادن مقدار تکراری */
  pushed?:  Record<string, { stock?: number; price?: number }>;
  createdByPanel?: boolean;
}

export function readVariantMeta(meta: unknown): VariantLinkMeta | null {
  const m = (meta && typeof meta === "object" ? meta : null) as Record<string, unknown> | null;
  const v = m?.variants;
  if (!v || typeof v !== "object" || !Object.keys(v).length) return null;
  return {
    variants: v as Record<string, string>,
    pushed: (m!.pushed && typeof m!.pushed === "object" ? m!.pushed : {}) as VariantLinkMeta["pushed"],
    createdByPanel: m!.createdByPanel === true,
  };
}

export interface VariantTarget {
  linkId:        string;
  mappingId:     string;
  shopProductId: string;
  pushed:        NonNullable<VariantLinkMeta["pushed"]>;
  items: {
    shopVariantId:     string;
    platformVariantId: string;
    stock:             number;
    price:             number;   // تومان، قیمت بازارگاه
  }[];
}

/**
 * لینک‌های تنوع‌دار یک پلتفرم با موجودی و قیمت فعلی هر تنوع از سایت.
 * `externalIds` خالی = همه‌ی لینک‌های تنوع‌دار آن پلتفرم.
 */
export async function loadVariantTargets(platformCode: string, externalIds?: string[]): Promise<Map<string, VariantTarget>> {
  const out = new Map<string, VariantTarget>();
  const links = await prisma.integMappingLink.findMany({
    where: {
      platformCode,
      isActive: true,
      ...(externalIds ? { externalId: { in: externalIds } } : {}),
    },
    select: { id: true, mappingId: true, externalId: true, meta: true },
  });
  const withVariants = links
    .map((l) => ({ ...l, vm: readVariantMeta(l.meta) }))
    .filter((l): l is typeof l & { vm: VariantLinkMeta } => !!l.vm);
  if (!withVariants.length) return out;

  const shopLinks = await prisma.integMappingLink.findMany({
    where: { mappingId: { in: withVariants.map((l) => l.mappingId) }, platformCode: "shop", isActive: true },
    select: { mappingId: true, externalId: true },
  });
  const shopOf = new Map(shopLinks.map((s) => [s.mappingId, s.externalId]));
  const productIds = [...new Set(shopLinks.map((s) => s.externalId))];
  const [products, variants, settings] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, price: true, salePrice: true } }),
    prisma.productVariant.findMany({
      where: { productId: { in: productIds } },
      select: { id: true, productId: true, isActive: true, stock: true, price: true, salePrice: true },
    }),
    getCreateSettings(platformCode),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  for (const l of withVariants) {
    const shopProductId = shopOf.get(l.mappingId);
    const product = shopProductId ? productById.get(shopProductId) : undefined;
    if (!shopProductId || !product) continue;
    const items: VariantTarget["items"] = [];
    for (const [shopVariantId, platformVariantId] of Object.entries(l.vm.variants)) {
      const v = variantById.get(shopVariantId);
      // تنوعِ حذف‌شده یا غیرفعال در سایت روی بازارگاه صفر می‌شود تا فروخته نشود
      const priceSrc = v && v.price !== null ? shopEffective(v.price, v.salePrice) : shopEffective(product.price, product.salePrice);
      items.push({
        shopVariantId,
        platformVariantId,
        stock: v && v.isActive && v.productId === shopProductId ? Math.max(0, v.stock) : 0,
        price: marketPrice(priceSrc, settings),
      });
    }
    out.set(l.externalId, { linkId: l.id, mappingId: l.mappingId, shopProductId, pushed: l.vm.pushed ?? {}, items });
  }
  return out;
}

/** ثبت مقدارهای ارسال‌شده روی meta لینک (ادغام با قبلی) */
export async function recordVariantPush(linkId: string, pushed: Record<string, { stock?: number; price?: number }>): Promise<void> {
  if (!Object.keys(pushed).length) return;
  const link = await prisma.integMappingLink.findUnique({ where: { id: linkId }, select: { meta: true } });
  const meta = (link?.meta && typeof link.meta === "object" ? link.meta : {}) as Record<string, unknown>;
  const prev = (meta.pushed && typeof meta.pushed === "object" ? meta.pushed : {}) as Record<string, { stock?: number; price?: number }>;
  const next = { ...prev };
  for (const [id, val] of Object.entries(pushed)) next[id] = { ...prev[id], ...val };
  await prisma.integMappingLink.update({ where: { id: linkId }, data: { meta: { ...meta, pushed: next } as object } });
}

/** تنوع بازارگاه → تنوع سایت، برای قلم سفارش */
export async function shopVariantFor(platformCode: string, platformProductId: string, platformVariantId?: string | null): Promise<string | null> {
  if (!platformVariantId) return null;
  const link = await prisma.integMappingLink.findUnique({
    where: { platformCode_externalId: { platformCode, externalId: platformProductId } },
    select: { meta: true },
  });
  const vm = readVariantMeta(link?.meta);
  if (!vm) return null;
  for (const [shopId, platId] of Object.entries(vm.variants)) if (String(platId) === String(platformVariantId)) return shopId;
  return null;
}

/** آیا این محصول سایت تنوع (ردیف ProductVariant) دارد؟ — موجودی‌اش جمع تنوع‌هاست و نباید مستقیم نوشته شود */
export async function productHasVariants(productId: string): Promise<boolean> {
  return (await prisma.productVariant.count({ where: { productId } })) > 0;
}
