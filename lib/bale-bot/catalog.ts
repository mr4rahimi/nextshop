import { prisma } from "@/lib/prisma";
import { SITE_URL, encodeSlug } from "@/lib/seo";
import { previewPricesForMappings } from "@/lib/integration/core/price-preview";
import {
  CATALOG_PLATFORMS,
  type BaleCatalogConfig,
  type CatalogPlatform,
} from "./config";

/**
 * داده‌ی کاتالوگ ربات بله — فقط خواندنی
 *
 * منبع، نگاشت‌های یکپارچه‌سازی است نه جدول جدا: هر نگاشت فعالی که لینک
 * «shop» به محصول فعال و موجود دارد در ربات دیده می‌شود، زیر دسته‌ی همان
 * محصول فروشگاه. قیمت هر بازارگاه همان قیمتی است که آخرین «دریافت محصولات»
 * از خود بازارگاه آورده (با تخفیف خود پلتفرم)؛ اگر هنوز دریافت نشده، قیمت
 * محاسبه‌شده با قوانین قیمت جایگزین می‌شود.
 *
 * ⚠️ این ماژول هیچ چیزی نمی‌نویسد و با هیچ آداپتوری تماس نمی‌گیرد — هر کلیک
 *    مشتری در ربات نباید به یک درخواست به بازارگاه تبدیل شود.
 */

export interface CardEntry {
  platform: CatalogPlatform;
  label: string;
  /** شناسه‌ی لینک نگاشت — برای ثبت لینک دستی در پنل */
  linkId: string;
  /** قیمت مؤثر (تومان) — همان چیزی که مشتری می‌پردازد */
  price: number | null;
  /** قیمت پیش از تخفیف؛ null یعنی تخفیفی نیست */
  originalPrice: number | null;
  /** قیمت از قوانین قیمت آمده، نه از خود بازارگاه */
  estimated: boolean;
  available: boolean;
  url: string | null;
  /** لینک دستی ثبت‌شده در پنل (اگر باشد، بر الگو مقدم است) */
  manualUrl: string | null;
  /** «از X» — محصول تنوع با قیمت‌های مختلف دارد */
  fromPrice: boolean;
  cheapest: boolean;
}

export interface ProductCard {
  mappingId: string;
  productId: string;
  categoryId: string;
  title: string;
  imageUrl: string | null;
  entries: CardEntry[];
}

/** محصولی که فروشگاه «قابل خرید» می‌داند — همان قاعده‌ی سبد خرید */
const AVAILABLE = {
  isActive: true,
  OR: [{ trackStock: false }, { stock: { gt: 0 } }],
};

/** محصول فروشگاه ← نگاشت، فقط برای نگاشت‌ها و لینک‌های فعال */
async function shopIndex(): Promise<Map<string, string>> {
  const links = await prisma.integMappingLink.findMany({
    where: { platformCode: "shop", isActive: true, mapping: { isActive: true } },
    select: { externalId: true, mappingId: true },
  });
  return new Map(links.map((l) => [l.externalId, l.mappingId]));
}

export interface CategoryRow {
  id: string;
  title: string;
  count: number;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const idx = await shopIndex();
  if (!idx.size) return [];

  const groups = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { id: { in: [...idx.keys()] }, ...AVAILABLE },
    _count: { _all: true },
  });
  if (!groups.length) return [];

  const cats = await prisma.category.findMany({
    where: { id: { in: groups.map((g) => g.categoryId) } },
    select: { id: true, title: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  const counts = new Map(groups.map((g) => [g.categoryId, g._count._all]));

  return cats.map((c) => ({ id: c.id, title: c.title, count: counts.get(c.id) ?? 0 }));
}

export interface ProductRow {
  mappingId: string;
  title: string;
}

export async function listCategoryProducts(categoryId: string): Promise<{
  title: string | null;
  products: ProductRow[];
}> {
  const idx = await shopIndex();
  const [cat, products] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId }, select: { title: true } }),
    idx.size
      ? prisma.product.findMany({
          where: { id: { in: [...idx.keys()] }, categoryId, ...AVAILABLE },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    title: cat?.title ?? null,
    products: products.map((p) => ({ mappingId: idx.get(p.id)!, title: p.title })),
  };
}

/** یکسان‌سازی حروف عربی و فاصله‌ها — «كيف» و «کیف» یکی‌اند */
export function normalizeQuery(q: string): string {
  return q
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌\s]+/g, " ")
    .trim();
}

export async function searchProducts(q: string, take = 10): Promise<ProductRow[]> {
  const query = normalizeQuery(q);
  if (query.length < 2) return [];

  const idx = await shopIndex();
  if (!idx.size) return [];

  // هر کلمه باید در عنوان باشد، به هر ترتیبی
  const words = query.split(" ").filter(Boolean).slice(0, 5);
  const products = await prisma.product.findMany({
    where: {
      id: { in: [...idx.keys()] },
      ...AVAILABLE,
      AND: words.map((w) => ({ title: { contains: w, mode: "insensitive" as const } })),
    },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
    take,
  });

  return products.map((p) => ({ mappingId: idx.get(p.id)!, title: p.title }));
}

// ─── کارت محصول ────────────────────────────────────────────────────

function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * پر کردن الگوی لینک. جای‌گذاری بی‌مقدار یعنی لینک نامعتبر — `null`، نه
 * لینکی با `{hsin}` خام که مشتری را به صفحه‌ی خطا ببرد.
 */
export function fillTemplate(template: string, vars: Record<string, string | null | undefined>) {
  if (!template) return null;
  let missing = false;
  const url = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    if (v == null || v === "") {
      missing = true;
      return "";
    }
    return encodeURIComponent(v);
  });
  return missing ? null : url;
}

function readManualUrl(meta: unknown): string | null {
  const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
  return typeof m.publicUrl === "string" && /^https?:\/\//i.test(m.publicUrl) ? m.publicUrl : null;
}

function readRefs(raw: unknown): Record<string, string> {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const refs = r.refs && typeof r.refs === "object" ? (r.refs as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(refs)) {
    if (typeof v === "string" || typeof v === "number") out[k] = String(v);
  }
  return out;
}

/**
 * ساخت کارت چند محصول با هم.
 *
 * تعداد کوئری‌ها مستقل از تعداد نگاشت‌هاست: نگاشت‌ها، محصولات فروشگاه، و
 * محصولات هر بازارگاه هرکدام یکی؛ پیش‌نمایش قانون قیمت فقط برای آن‌هایی که
 * قیمت دریافت‌شده ندارند.
 */
export async function buildCards(
  mappingIds: string[],
  cfg: BaleCatalogConfig,
): Promise<ProductCard[]> {
  if (!mappingIds.length) return [];

  const mappings = await prisma.integMapping.findMany({
    where: { id: { in: mappingIds }, isActive: true },
    include: { links: { where: { isActive: true } } },
  });

  const shopIds = mappings.flatMap((m) =>
    m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId),
  );
  const shopProducts = await prisma.product.findMany({
    where: { id: { in: shopIds } },
    select: {
      id: true, title: true, slug: true, categoryId: true, mainImage: true,
      price: true, salePrice: true, priceFrom: true, hasVariants: true,
      stock: true, trackStock: true, isActive: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });
  const shopById = new Map(shopProducts.map((p) => [p.id, p]));

  // محصولات بازارگاه — یک کوئری برای هر پلتفرم
  const marketCodes = CATALOG_PLATFORMS.filter((c) => c !== "shop" && cfg.platforms[c].enabled);
  const ppByKey = new Map<
    string,
    { price: number | null; originalPrice: number | null; stock: number | null; sku: string | null; rawData: unknown }
  >();
  await Promise.all(
    marketCodes.map(async (code) => {
      const ids = mappings.flatMap((m) =>
        m.links.filter((l) => l.platformCode === code).map((l) => l.externalId),
      );
      if (!ids.length) return;
      const rows = await prisma.integPlatformProduct.findMany({
        where: { platformCode: code, platformProductId: { in: ids } },
        select: {
          platformProductId: true, price: true, originalPrice: true,
          stock: true, sku: true, rawData: true,
        },
      });
      for (const r of rows) ppByKey.set(`${code}:${r.platformProductId}`, r);
    }),
  );

  // جایگزین: قیمت قوانین برای لینک‌هایی که قیمت دریافت‌شده ندارند
  const needPreview = mappings
    .filter((m) =>
      m.links.some(
        (l) =>
          marketCodes.includes(l.platformCode as CatalogPlatform) &&
          ppByKey.get(`${l.platformCode}:${l.externalId}`)?.price == null,
      ),
    )
    .map((m) => m.id);
  const previews = needPreview.length
    ? await previewPricesForMappings(needPreview).catch(() => new Map())
    : new Map();

  const cards: ProductCard[] = [];

  for (const id of mappingIds) {
    const m = mappings.find((x) => x.id === id);
    if (!m) continue;
    const shopLink = m.links.find((l) => l.platformCode === "shop");
    const sp = shopLink ? shopById.get(shopLink.externalId) : undefined;
    if (!shopLink || !sp) continue;

    const entries: CardEntry[] = [];

    for (const code of CATALOG_PLATFORMS) {
      const pc = cfg.platforms[code];
      if (!pc.enabled) continue;
      const link = code === "shop" ? shopLink : m.links.find((l) => l.platformCode === code);
      if (!link) continue;

      const manualUrl = readManualUrl(link.meta);

      if (code === "shop") {
        const base = Number(sp.price);
        const sale = sp.salePrice != null ? Number(sp.salePrice) : null;
        const discounted = sale != null && sale > 0 && sale < base;
        const fromPrice = sp.hasVariants && sp.priceFrom != null;
        entries.push({
          platform: code,
          label: pc.label,
          linkId: link.id,
          price: fromPrice ? Number(sp.priceFrom) : discounted ? sale : base > 0 ? base : null,
          originalPrice: !fromPrice && discounted ? base : null,
          estimated: false,
          available: sp.isActive && (!sp.trackStock || sp.stock > 0),
          url: manualUrl ?? `${SITE_URL}/products/${encodeSlug(sp.slug)}`,
          manualUrl,
          fromPrice,
          cheapest: false,
        });
        continue;
      }

      const pp = ppByKey.get(`${code}:${link.externalId}`);
      let price = pp?.price != null ? Math.round(pp.price) : null;
      let originalPrice =
        pp?.originalPrice != null && price != null && pp.originalPrice > price
          ? Math.round(pp.originalPrice)
          : null;
      let estimated = false;

      if (price == null) {
        const pv = previews.get(m.id)?.platforms.find(
          (p: { platformCode: string }) => p.platformCode === code,
        );
        if (pv?.effective != null) {
          price = Math.round(pv.effective);
          originalPrice = pv.price != null && pv.price > pv.effective ? Math.round(pv.price) : null;
          estimated = true;
        }
      }

      const refs = readRefs(pp?.rawData);
      const url =
        manualUrl ??
        fillTemplate(pc.urlTemplate, { id: link.externalId, sku: pp?.sku ?? null, ...refs });

      entries.push({
        platform: code,
        label: pc.label,
        linkId: link.id,
        price,
        originalPrice,
        estimated,
        // موجودی صفر روی بازارگاه یعنی آنجا قابل خرید نیست؛ نامعلوم = موجود
        available: pp?.stock == null || pp.stock > 0,
        url,
        manualUrl,
        fromPrice: false,
        cheapest: false,
      });
    }

    if (cfg.markCheapest) {
      const priced = entries.filter((e) => e.available && e.price != null && !e.fromPrice);
      // نشان «کمترین قیمت» فقط وقتی معنا دارد که دست‌کم دو قیمت قابل مقایسه باشد
      if (priced.length >= 2) {
        const min = Math.min(...priced.map((e) => e.price!));
        const max = Math.max(...priced.map((e) => e.price!));
        if (min < max) for (const e of priced) if (e.price === min) e.cheapest = true;
      }
    }

    cards.push({
      mappingId: m.id,
      productId: sp.id,
      categoryId: sp.categoryId,
      title: sp.title,
      imageUrl: absoluteUrl(sp.mainImage ?? sp.images[0]?.url ?? null),
      entries,
    });
  }

  return cards;
}

export async function getProductCard(
  mappingId: string,
  cfg: BaleCatalogConfig,
): Promise<ProductCard | null> {
  const [card] = await buildCards([mappingId], cfg);
  return card ?? null;
}

/**
 * فهرست پنل: همان محصولاتی که مشتری در ربات می‌بیند، با جستجو و صفحه‌بندی.
 */
export async function listCatalogForAdmin(
  cfg: BaleCatalogConfig,
  opts: { q?: string; page?: number; perPage?: number },
): Promise<{ total: number; cards: ProductCard[] }> {
  const idx = await shopIndex();
  if (!idx.size) return { total: 0, cards: [] };

  const perPage = opts.perPage ?? 20;
  const page = Math.max(1, opts.page ?? 1);
  const words = normalizeQuery(opts.q ?? "").split(" ").filter(Boolean).slice(0, 5);

  const where = {
    id: { in: [...idx.keys()] },
    ...AVAILABLE,
    ...(words.length
      ? { AND: words.map((w) => ({ title: { contains: w, mode: "insensitive" as const } })) }
      : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: { id: true },
      orderBy: { title: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  const cards = await buildCards(
    products.map((p) => idx.get(p.id)!),
    cfg,
  );
  return { total, cards };
}
