import { prisma } from "../lib/prisma";
import * as mysql from "mysql2/promise";

const BASE_URL = "https://mahamprint.com";

function cleanSlug(s: string): string {
  if (!s) return `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const r = s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]/g, "");
  return r || `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
}

function fixImg(url: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (u.startsWith("http")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function parseJArr(v: string | null): any[] {
  if (!v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

function stripHtml(h: string | null): string {
  return (h || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  const db = await mysql.createConnection({
    host: "127.0.0.1", port: 3307,
    user: "root", password: "root",
    database: "mahamprint",
  });
  console.log("✅ MySQL متصل شد");

  const [cats] = await db.query<any[]>("SELECT * FROM categories ORDER BY id");
  const [brands] = await db.query<any[]>("SELECT * FROM brands ORDER BY id");
  const [products] = await db.query<any[]>("SELECT * FROM products ORDER BY id");
  const [catables] = await db.query<any[]>("SELECT * FROM catables");
  const [brandables] = await db.query<any[]>("SELECT * FROM brandables");
  const [news] = await db.query<any[]>("SELECT * FROM news ORDER BY id");

  console.log(`categories: ${cats.length}, brands: ${brands.length}, products: ${products.length}`);
  console.log(`catables: ${catables.length}, brandables: ${brandables.length}, news: ${news.length}`);

  // ── دسته‌بندی‌ها ─────────────────────────────────────────────────────────
  console.log("\n📂 migrate دسته‌بندی‌ها...");
  const catIdMap: Record<number, string> = {};
  let catCount = 0;

  for (const cat of cats) {
    if (!cat.slug || cat.name === "ریشه" || cat.slug === "ریشه") continue;
    const slug = cleanSlug(cat.slug);
    try {
      const c = await prisma.category.upsert({
        where: { slug },
        create: {
          title: cat.name, slug,
          description: cat.bodySeo ? stripHtml(cat.bodySeo).slice(0, 500) : null,
          imageUrl: fixImg(cat.image),
          seoTitle: cat.nameSeo || cat.name,
          seoDescription: cat.bodySeo ? stripHtml(cat.bodySeo).slice(0, 160) : null,
          seoKeywords: cat.keyword || null,
          isActive: true, sortOrder: cat.id || 0,
        },
        update: {},
      });
      catIdMap[cat.id] = c.id;
      catCount++;
    } catch (e: any) { console.warn(`  ⚠️ ${cat.name}: ${e.message.slice(0,80)}`); }
  }
  console.log(`  ✅ ${catCount} دسته`);

  // ── برندها ───────────────────────────────────────────────────────────────
  console.log("\n🏷️  migrate برندها...");
  const brandIdMap: Record<number, string> = {};
  let brandCount = 0;

  for (const brand of brands) {
    if (!brand.name) continue;
    const slug = cleanSlug(brand.slug || brand.name);
    try {
      const b = await prisma.brand.upsert({
        where: { slug },
        create: {
          title: brand.name, slug,
          description: brand.bodySeo ? stripHtml(brand.bodySeo).slice(0, 500) : null,
          logoUrl: fixImg(brand.image),
          seoTitle: brand.nameSeo || brand.name,
          seoDescription: brand.bodySeo ? stripHtml(brand.bodySeo).slice(0, 160) : null,
          seoKeywords: brand.keyword || null,
          isActive: true,
        },
        update: {},
      });
      brandIdMap[brand.id] = b.id;
      brandCount++;
    } catch (e: any) { console.warn(`  ⚠️ ${brand.name}: ${e.message.slice(0,80)}`); }
  }
  console.log(`  ✅ ${brandCount} برند`);

  // ── مپ رابطه‌ها ──────────────────────────────────────────────────────────
  const productCatMap: Record<number, number> = {};
  for (const r of catables)
    if (r.catables_type?.includes("Product")) productCatMap[r.catables_id] = r.category_id;

  const productBrandMap: Record<number, number> = {};
  for (const r of brandables)
    if (r.brandables_type?.includes("Product")) productBrandMap[r.brandables_id] = r.brand_id;

  const defaultCat = await prisma.category.findFirst({ where: { isActive: true } });
  if (!defaultCat) { console.error("❌ هیچ دسته‌ای پیدا نشد"); return; }

  // ── محصولات ──────────────────────────────────────────────────────────────
  console.log("\n📦 migrate محصولات...");
  let productCount = 0, skipCount = 0;

  for (const p of products) {
    if (!p.title) { skipCount++; continue; }
    const slug = cleanSlug(p.slug || p.titleEn || p.title);
    const categoryId = (productCatMap[p.id] && catIdMap[productCatMap[p.id]]) || defaultCat.id;
    const brandId = (productBrandMap[p.id] && brandIdMap[productBrandMap[p.id]]) || null;

    let features: string[] = [];
    try {
      features = parseJArr(p.ability)
        .map((s: any) => (s.name || s.title || "").toString())
        .filter(Boolean);
    } catch {}

    const priceNum = Math.abs(parseInt(p.price) || 0);
    const salePriceNum = parseInt(p.offPrice) || 0;
    const price = BigInt(priceNum);
    const salePrice = salePriceNum > 0 && salePriceNum < priceNum ? BigInt(salePriceNum) : null;

    let mainImage: string | null = null;
    try {
      const imgStr = String(p.image || "");
      if (imgStr.startsWith("[")) {
        const imgs = parseJArr(p.image);
        if (imgs.length > 0) mainImage = fixImg(String(imgs[0]));
      } else mainImage = fixImg(imgStr);
    } catch {}

    try {
      await prisma.product.upsert({
        where: { slug },
        create: {
          title: p.title, slug, categoryId, brandId,
          shortDescription: p.short ? stripHtml(p.short).slice(0, 500) : null,
          mainImage, price, salePrice, features,
          isActive: p.status === 1,
          seoTitle: p.titleSeo || p.title,
          seoDescription: p.bodySeo ? stripHtml(p.bodySeo).slice(0, 160) : null,
          seoKeywords: p.keywordSeo || null,
          expertTitle: p.title,
          expertDescription: p.body ? stripHtml(p.body).slice(0, 3000) : null,
          stock: parseInt(p.count) || 0,
          trackStock: true, lowStockThreshold: 3,
        },
        update: {},
      });
      productCount++;
      if (productCount % 200 === 0) console.log(`  ... ${productCount}`);
    } catch (e: any) {
      if (!e.message.includes("Unique")) console.warn(`  ⚠️ ${p.title}: ${e.message.slice(0,80)}`);
      skipCount++;
    }
  }
  console.log(`  ✅ ${productCount} محصول (${skipCount} رد شد)`);

  // ── مشخصات فنی ──────────────────────────────────────────────────────────────
console.log("\n⚙️  migrate مشخصات فنی...");
const [productsWithSpecs] = await db.query<any[]>(
  "SELECT id, slug, specifications FROM products WHERE specifications IS NOT NULL AND specifications != '[]' AND specifications != ''"
);

// یه SpecGroup پیش‌فرض برای همه
let defaultGroup = await prisma.specGroup.findFirst({ where: { title: "مشخصات فنی" } });
if (!defaultGroup) {
  defaultGroup = await prisma.specGroup.create({ data: { title: "مشخصات فنی" } });
}

let specCount = 0;
const specItemCache: Record<string, string> = {}; // title -> id

for (const p of productsWithSpecs) {
  try {
    const specs = JSON.parse(p.specifications);
    if (!Array.isArray(specs) || specs.length === 0) continue;

    const slug = cleanSlug(p.slug || String(p.id));
    const product = await prisma.product.findUnique({ where: { slug } });
    if (!product) continue;

    // حذف specs قدیمی
    await prisma.productSpecValue.deleteMany({ where: { productId: product.id } });

    for (const spec of specs) {
      const title = String(spec.title || "").trim();
      const value = String(spec.body || "").trim();
      if (!title || !value) continue;

      // پیدا کردن یا ساختن SpecItem
      const cacheKey = title;
      if (!specItemCache[cacheKey]) {
        const existing = await prisma.specItem.findFirst({
          where: { title, groupId: defaultGroup!.id },
        });
        if (existing) {
          specItemCache[cacheKey] = existing.id;
        } else {
          const created = await prisma.specItem.create({
            data: { title, groupId: defaultGroup!.id },
          });
          specItemCache[cacheKey] = created.id;
        }
      }

      await prisma.productSpecValue.upsert({
        where: { productId_specItemId: { productId: product.id, specItemId: specItemCache[cacheKey] } },
        create: { productId: product.id, specItemId: specItemCache[cacheKey], value },
        update: { value },
      });
      specCount++;
    }
  } catch (e: any) {
    console.warn(`  ⚠️ specs محصول ${p.id}: ${e.message.slice(0, 60)}`);
  }
}
console.log(`  ✅ ${specCount} مشخصه فنی`);

  // ── مقالات ───────────────────────────────────────────────────────────────
  console.log("\n📰 migrate مقالات...");
  const existing = await prisma.blogCategory.findFirst({ where: { slug: "articles" } });
  const blogCatId = existing?.id
    || (await prisma.blogCategory.create({ data: { title: "مقالات", slug: "articles" } })).id;

  let articleCount = 0;
  for (const a of news) {
    if (!a.title) continue;
    const slug = cleanSlug(a.slug || a.title);
    try {
      await prisma.blogPost.upsert({
        where: { slug },
        create: {
          title: a.title, slug,
          excerpt: a.bodySeo ? stripHtml(a.bodySeo).slice(0, 300) : null,
          content: a.body || "",
          coverImage: fixImg(a.image),
          status: "PUBLISHED", categoryId: blogCatId,
          seoTitle: a.titleSeo || a.title,
          seoDescription: a.bodySeo ? stripHtml(a.bodySeo).slice(0, 160) : null,
          seoKeywords: a.keyword || null,
          publishedAt: a.created_at ? new Date(a.created_at) : new Date(),
        },
        update: {},
      });
      articleCount++;
    } catch (e: any) {
      if (!e.message.includes("Unique")) console.warn(`  ⚠️ ${a.title}: ${e.message.slice(0,80)}`);
    }
  }
  console.log(`  ✅ ${articleCount} مقاله`);

  await db.end();
  console.log("\n🎉 Migration کامل شد!");
}

main()
  .catch(e => { console.error("❌", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
