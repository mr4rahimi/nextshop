/**
 * داده‌ی محصول برای چت فروشگاه — docs/plans/storefront-chat.md بخش ۳
 *
 * ⚠️ همه‌ی خروجی‌ها عمومی‌اند (همان چیزی که صفحه‌ی محصول نشان می‌دهد): بهای تمام‌شده،
 *    موجودی دقیق انبار و محصول غیرفعال هرگز بیرون نمی‌روند. موجودی فقط «موجود / چند عدد
 *    مانده / ناموجود» است، مثل کارت سایت.
 *
 * جستجو: هر کلیدواژه جدا روی شکل فشرده‌ی عنوان، کد مدل، برند و دسته (رجوع text.ts).
 * اول همه‌ی کلیدواژه‌ها باید بخورند؛ اگر هیچ محصولی نیامد، نزدیک‌ترین‌ها با علامت
 * `approximate` برمی‌گردند تا مدل بگوید «دقیقاً این نیست، این‌ها نزدیک‌اند».
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CONDITION_LABELS } from "@/lib/product-condition";
import { normalizeFaq } from "@/lib/faq";
import { variantsEnabled, effectivePrice } from "@/lib/variants";
import { compact, priceLabel, searchTokens, tokenForms } from "./text";

// ─── دسته‌ها ─────────────────────────────────────────────────────────────────

type CatRow = { id: string; slug: string; title: string; parentId: string | null };
let catCache: { rows: CatRow[]; ts: number } | null = null;

export async function allCategories(): Promise<CatRow[]> {
  if (catCache && Date.now() - catCache.ts < 5 * 60_000) return catCache.rows;
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, title: true, parentId: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  catCache = { rows, ts: Date.now() };
  return rows;
}

/** نامک یا نام دسته ← خودش و همه‌ی نوادگانش (محصولات معمولاً در زیردسته‌اند) */
export async function resolveCategory(input: string): Promise<{ cat: CatRow; ids: string[] } | null> {
  const rows = await allCategories();
  const key = compact(input);
  const cat =
    rows.find((c) => c.slug === input.trim()) ??
    rows.find((c) => compact(c.title) === key) ??
    rows.find((c) => key.length >= 3 && compact(c.title).includes(key));
  if (!cat) return null;
  const ids = [cat.id];
  for (let i = 0; i < ids.length; i++) {
    for (const c of rows) if (c.parentId === ids[i]) ids.push(c.id);
  }
  return { cat, ids };
}

/** درخت دسته با تعداد محصول فعال — برای «چه چیزهایی دارید؟» */
export async function categoryTree() {
  const [rows, counts] = await Promise.all([
    allCategories(),
    prisma.product.groupBy({ by: ["categoryId"], where: { isActive: true }, _count: { _all: true } }),
  ]);
  const own = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  const total = (id: string): number =>
    (own.get(id) ?? 0) + rows.filter((c) => c.parentId === id).reduce((s, c) => s + total(c.id), 0);
  const node = (c: CatRow, depth: number): Record<string, unknown> | null => {
    const n = total(c.id);
    if (!n) return null;
    const children = depth < 2 ? rows.filter((x) => x.parentId === c.id).map((x) => node(x, depth + 1)).filter(Boolean) : [];
    return { title: c.title, slug: c.slug, url: `/categories/${c.slug}`, products: n, ...(children.length ? { children } : {}) };
  };
  return rows.filter((c) => !c.parentId).map((c) => node(c, 0)).filter(Boolean);
}

// ─── کارت محصول ──────────────────────────────────────────────────────────────

export type ProductCard = {
  slug: string;
  title: string;
  url: string;
  image: string | null;
  brand: string | null;
  category: string;
  /** تومان؛ صفر = استعلامی */
  price: number;
  /** قیمت پیش از تخفیف وقتی تخفیف دارد */
  oldPrice: number | null;
  priceText: string;
  priceFrom: boolean;
  availability: "available" | "low" | "out";
  availabilityText: string;
  condition: string | null;
  warranty: string | null;
};

const CARD_SELECT = {
  slug: true, title: true, mainImage: true, price: true, salePrice: true, priceFrom: true, hasVariants: true,
  stock: true, trackStock: true, lowStockThreshold: true, warranty: true, condition: true,
  brand: { select: { title: true } },
  category: { select: { title: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

function availability(stock: number, trackStock: boolean, low: number): Pick<ProductCard, "availability" | "availabilityText"> {
  if (!trackStock) return { availability: "available", availabilityText: "موجود" };
  if (stock <= 0) return { availability: "out", availabilityText: "ناموجود" };
  if (stock <= Math.max(1, low)) return { availability: "low", availabilityText: `فقط ${stock.toLocaleString("fa-IR")} عدد مانده` };
  return { availability: "available", availabilityText: "موجود" };
}

function toCard(p: CardRow): ProductCard {
  const fromVariants = p.hasVariants && p.priceFrom !== null;
  const final = fromVariants ? p.priceFrom! : (p.salePrice ?? p.price);
  const discounted = !fromVariants && p.salePrice !== null && p.salePrice < p.price && p.salePrice > BigInt(0);
  const price = Number(final);
  return {
    slug: p.slug,
    title: p.title,
    url: `/products/${p.slug}`,
    image: p.images[0]?.url ?? p.mainImage ?? null,
    brand: p.brand?.title ?? null,
    category: p.category.title,
    price,
    oldPrice: discounted ? Number(p.price) : null,
    priceText: price > 0 ? `${fromVariants ? "از " : ""}${priceLabel(price)}` : priceLabel(0),
    priceFrom: fromVariants,
    ...availability(p.stock, p.trackStock, p.lowStockThreshold),
    condition: p.condition === "NEW" ? null : CONDITION_LABELS[p.condition],
    warranty: p.warranty?.trim() || null,
  };
}

export async function cardsBySlugs(slugs: string[]): Promise<ProductCard[]> {
  if (!slugs.length) return [];
  const rows = await prisma.product.findMany({ where: { slug: { in: slugs }, isActive: true }, select: CARD_SELECT });
  const bySlug = new Map(rows.map((r) => [r.slug, toCard(r)]));
  return slugs.map((s) => bySlug.get(s)).filter((c): c is ProductCard => !!c);
}

/**
 * کارت نمایشی ویجت + دادهٔ دکمهٔ «افزودن به سبد» (همان شکل `CartProduct` سایت).
 * `cart` خالی است وقتی کالا آنلاین فروختنی نیست: تنوع‌دار (باید رنگ/سایز انتخاب شود)،
 * قیمت استعلامی یا ناموجود. به مدل نمی‌رود — فقط به مرورگر.
 */
export type WidgetCard = ProductCard & {
  cart: { id: string; title: string; slug: string; price: string; salePrice: string | null; mainImage: string | null; images: { url: string }[] } | null;
};

export async function widgetCards(slugs: string[]): Promise<WidgetCard[]> {
  if (!slugs.length) return [];
  const rows = await prisma.product.findMany({ where: { slug: { in: slugs }, isActive: true }, select: { id: true, ...CARD_SELECT } });
  const bySlug = new Map(
    rows.map((r) => {
      const card = toCard(r);
      const sellable = !r.hasVariants && card.price > 0 && card.availability !== "out";
      return [
        r.slug,
        {
          ...card,
          cart: sellable
            ? { id: r.id, title: r.title, slug: r.slug, price: String(r.price), salePrice: r.salePrice !== null ? String(r.salePrice) : null, mainImage: r.mainImage, images: r.images }
            : null,
        },
      ] as const;
    }),
  );
  return slugs.map((s) => bySlug.get(s)).filter((c): c is WidgetCard => !!c);
}

// ─── جستجو ───────────────────────────────────────────────────────────────────

/**
 * همان `compact()` در SQL. فقط فاصله و نشانه‌ها حذف می‌شوند (نه هر غیرحرفی) چون
 * `[:alnum:]` روی سرور با locale «C» حروف فارسی را هم پاک می‌کند.
 */
function compactSql(column: string): string {
  return `regexp_replace(translate(lower(${column}), 'يىكةأإآ۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', 'ییکهااا01234567890123456789'), '[[:space:]‌‍ _.,،؛;:/\\\\()\\[\\]{}+*×#!?؟"''«»|&%@^~=<>-]+', '', 'g')`;
}

export type SearchInput = {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest";
  limit?: number;
};

export type SearchResult = {
  total: number;
  approximate: boolean;
  category: string | null;
  products: (ProductCard & { notFound?: string[] })[];
  note?: string;
};

export async function searchProducts(input: SearchInput): Promise<SearchResult> {
  const limit = Math.min(8, Math.max(1, Math.round(input.limit ?? 6)));
  const tokens = searchTokens(input.query ?? "");
  const brandKey = input.brand ? compact(input.brand) : "";

  let categoryIds: string[] | null = null;
  let categoryTitle: string | null = null;
  if (input.category?.trim()) {
    const resolved = await resolveCategory(input.category);
    if (resolved) {
      categoryIds = resolved.ids;
      categoryTitle = resolved.cat.title;
    } else {
      // دسته‌ای که مدل حدس زده وجود ندارد: به کلیدواژه تبدیل می‌شود، نه «هیچ محصولی نیست»
      for (const t of searchTokens(input.category)) if (!tokens.includes(t)) tokens.push(t);
    }
  }
  if (!tokens.length && !categoryIds && !brandKey) {
    return { total: 0, approximate: false, category: null, products: [], note: "کلیدواژه یا دسته لازم است" };
  }

  const effective = `CASE WHEN p."hasVariants" AND p."priceFrom" IS NOT NULL THEN p."priceFrom" ELSE COALESCE(p."salePrice", p.price) END`;
  const where: Prisma.Sql[] = [Prisma.sql`p."isActive" = true`];
  if (categoryIds) where.push(Prisma.sql`p."categoryId" IN (${Prisma.join(categoryIds)})`);
  if (brandKey) where.push(Prisma.sql`${Prisma.raw(compactSql(`coalesce(b.title,'') || coalesce(b.slug,'')`))} LIKE ${`%${brandKey}%`}`);
  if (input.inStockOnly) where.push(Prisma.sql`(p."trackStock" = false OR p.stock > 0)`);
  const priced = input.minPrice || input.maxPrice || input.sort === "price_asc" || input.sort === "price_desc";
  if (priced) where.push(Prisma.raw(`${effective} > 0`));
  if (input.minPrice) where.push(Prisma.sql`${Prisma.raw(effective)} >= ${BigInt(Math.round(input.minPrice))}`);
  if (input.maxPrice) where.push(Prisma.sql`${Prisma.raw(effective)} <= ${BigInt(Math.round(input.maxPrice))}`);

  // امتیاز هر کلیدواژه: عنوان و کد مدل ۳، برند ۲، دسته و کلیدواژه‌ی سئو و توضیح کوتاه ۱
  const has = (col: string, tok: string) =>
    Prisma.join(
      tokenForms(tok).map((parts) => Prisma.sql`(${Prisma.join(parts.map((part) => Prisma.sql`${Prisma.raw(col)} LIKE ${`%${part}%`}`), " AND ")})`),
      " OR ",
    );
  const hit = (tok: string) =>
    Prisma.sql`CASE WHEN ${has("t", tok)} OR ${has("k", tok)} THEN 3 WHEN ${has("b", tok)} THEN 2 WHEN ${has("c", tok)} OR ${has("d", tok)} OR ${has("s", tok)} THEN 1 ELSE 0 END`;
  const score = tokens.length ? Prisma.join(tokens.map(hit), " + ") : Prisma.sql`0`;
  const matched = tokens.length
    ? Prisma.join(tokens.map((tok) => Prisma.sql`(CASE WHEN (${hit(tok)}) > 0 THEN 1 ELSE 0 END)`), " + ")
    : Prisma.sql`0`;
  // «قوی» = هر کلیدواژه در عنوان، کد یا برند خورده؛ کارتریجی که فقط در توضیحش «پرینتر» دارد
  // در «ارزان‌ترین پرینتر» پیش از خود پرینترها نمی‌آید
  const strong = tokens.length
    ? Prisma.join(tokens.map((tok) => Prisma.sql`(${has("t", tok)} OR ${has("k", tok)} OR ${has("b", tok)})`), " AND ")
    : Prisma.sql`true`;

  const order =
    input.sort === "price_asc" ? Prisma.sql`eff ASC` :
    input.sort === "price_desc" ? Prisma.sql`eff DESC` :
    input.sort === "newest" ? Prisma.sql`"createdAt" DESC` :
    Prisma.sql`score DESC, "ratingCount" DESC`;

  const hitsArr = tokens.length
    ? Prisma.sql`ARRAY[${Prisma.join(tokens.map((tok) => Prisma.sql`(${hit(tok)}) > 0`))}]::boolean[]`
    : Prisma.sql`ARRAY[]::boolean[]`;

  const run = (minMatched: number) => prisma.$queryRaw<{ id: string; total: bigint; hits: boolean[] }[]>`
    WITH base AS (
      SELECT p.id, p."createdAt", p."ratingCount", (${Prisma.raw(effective)}) AS eff,
             (p."trackStock" = false OR p.stock > 0) AS available,
             ${Prisma.raw(compactSql("p.title"))} AS t,
             ${Prisma.raw(compactSql(`coalesce(p.sku,'') || ' ' || coalesce(p.mpn,'') || ' ' || coalesce(p.gtin13,'')`))} AS k,
             ${Prisma.raw(compactSql(`coalesce(b.title,'')`))} AS b,
             ${Prisma.raw(compactSql(`c.title || ' ' || coalesce(p."seoKeywords",'')`))} AS c,
             ${Prisma.raw(compactSql(`left(coalesce(p."shortDescription",''), 400)`))} AS d,
             ${Prisma.raw(compactSql(`coalesce(sp.txt,'')`))} AS s
      FROM "Product" p
      JOIN "Category" c ON c.id = p."categoryId"
      LEFT JOIN "Brand" b ON b.id = p."brandId"
      LEFT JOIN LATERAL (
        SELECT left(string_agg(si.title || ' ' || v.value, ' '), 1500) AS txt
        FROM "ProductSpecValue" v JOIN "SpecItem" si ON si.id = v."specItemId"
        WHERE v."productId" = p.id
      ) sp ON true
      WHERE ${Prisma.join(where, " AND ")}
    ), scored AS (
      SELECT id, "createdAt", "ratingCount", eff, available, (${score}) AS score, (${matched}) AS matched, (${strong}) AS strong, ${hitsArr} AS hits FROM base
    )
    SELECT id, hits, COUNT(*) OVER () AS total FROM scored
    WHERE matched >= ${minMatched}
    ORDER BY matched DESC, strong DESC, available DESC, (eff > 0) DESC, ${order}
    LIMIT ${limit}`;

  let approximate = false;
  let rows = await run(tokens.length);
  if (!rows.length && tokens.length > 1) {
    // همه‌ی کلیدواژه‌ها با هم نخوردند — نزدیک‌ترین‌ها (بیشترین کلیدواژه‌ی مشترک)
    rows = await run(Math.max(1, Math.ceil(tokens.length / 2)));
    approximate = rows.length > 0;
  }

  const cards = await prisma.product.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: { id: true, ...CARD_SELECT } });
  const byId = new Map(cards.map((c) => [c.id, toCard(c)]));
  return {
    total: Number(rows[0]?.total ?? 0),
    approximate,
    category: categoryTitle,
    ...(approximate && {
      note: "هیچ کالایی همه‌ی واژه‌ها را نداشت. notFound هر کالا یعنی آن ویژگی یا واژه در عنوان، مشخصات و توضیح آن کالا نیست؛ پس نگو آن را دارد.",
    }),
    products: rows.flatMap((r) => {
      const card = byId.get(r.id);
      if (!card) return [];
      const missing = tokens.filter((_t, i) => r.hits?.[i] === false);
      return [approximate && missing.length ? { ...card, notFound: missing } : card];
    }),
  };
}

// ─── جزئیات و مقایسه ─────────────────────────────────────────────────────────

function featureTexts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => (typeof f === "string" ? f : f && typeof f === "object" && "text" in f ? String((f as { text: unknown }).text) : ""))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function productDetail(slug: string) {
  const p = await prisma.product.findFirst({
    where: { slug: slug.trim().replace(/^\/?products\//, ""), isActive: true },
    select: {
      ...CARD_SELECT, id: true, shortDescription: true, features: true, faq: true, ratingAvg: true, ratingCount: true,
      downloadTitle: true, downloadUrl: true,
      specs: { select: { value: true, specItem: { select: { title: true, sortOrder: true, group: { select: { title: true } } } } } },
      relatedProducts: { orderBy: { sortOrder: "asc" }, take: 6, select: { related: { select: { slug: true, isActive: true } } } },
    },
  });
  if (!p) return { found: false as const, note: "محصولی با این نامک نیست؛ اول search_products را صدا بزن" };

  const variants = (await variantsEnabled())
    ? await prisma.productVariant.findMany({
        where: { productId: p.id, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { title: true, price: true, salePrice: true, stock: true },
      })
    : [];

  const specs = [...p.specs]
    .sort((a, b) => a.specItem.group.title.localeCompare(b.specItem.group.title, "fa") || a.specItem.sortOrder - b.specItem.sortOrder)
    .map((s) => ({ group: s.specItem.group.title, name: s.specItem.title, value: s.value }));

  return {
    found: true as const,
    ...toCard(p),
    description: p.shortDescription?.trim().slice(0, 800) || null,
    features: featureTexts(p.features),
    specs: specs.slice(0, 60),
    variants: variants.map((v) => {
      const e = effectivePrice(p, v);
      const price = Number(e.salePrice ?? e.price);
      return {
        title: v.title,
        priceText: priceLabel(price),
        availabilityText: !p.trackStock ? "موجود" : v.stock > 0 ? (v.stock <= 3 ? `فقط ${v.stock.toLocaleString("fa-IR")} عدد مانده` : "موجود") : "ناموجود",
      };
    }),
    faq: normalizeFaq(p.faq).slice(0, 10),
    rating: p.ratingCount > 0 ? { average: Math.round(p.ratingAvg * 10) / 10, count: p.ratingCount } : null,
    download: p.downloadUrl ? { title: p.downloadTitle || "دانلود", url: p.downloadUrl } : null,
    related: await cardsBySlugs(p.relatedProducts.filter((r) => r.related.isActive).map((r) => r.related.slug)).then((cs) =>
      cs.map((c) => ({ slug: c.slug, title: c.title, priceText: c.priceText, availabilityText: c.availabilityText })),
    ),
  };
}

export async function compareProducts(slugs: string[]) {
  type Detail = Exclude<Awaited<ReturnType<typeof productDetail>>, { found: false }>;
  const list = (await Promise.all(slugs.slice(0, 4).map((s) => productDetail(s)))).filter((d): d is Detail => d.found);
  if (list.length < 2) return { note: "برای مقایسه دست‌کم دو نامک معتبر لازم است" };
  const names = [...new Set(list.flatMap((d) => d.specs.map((s) => s.name)))];
  return {
    products: list.map((d) => ({ slug: d.slug, title: d.title, priceText: d.priceText, availabilityText: d.availabilityText, warranty: d.warranty })),
    specs: names.slice(0, 40).map((name) => ({
      name,
      values: list.map((d) => d.specs.find((s) => s.name === name)?.value ?? "—"),
    })),
  };
}
