/**
 * درون‌ریزی فروشگاه «میکسین» از خروجی `mixin-crawl.py` — docs/guide/import-mixin.md
 *
 *   npx tsx scripts/import/mixin.ts <export-dir> --name <site> [--brand-from-title] [--skip-empty-categories] [--dry-run]
 *
 * - عکس‌ها WebP (ضلع بلند حداکثر ۱۶۰۰) در `public/uploads/import/<site>/` ذخیره می‌شوند.
 * - توضیح HTML میکسین به متن ساده با بولت تبدیل می‌شود (فیلدهای توضیح محصول متن‌اند):
 *   «توضیحات» → بررسی اجمالی، «نقد و بررسی» → بررسی تخصصی، فهرست‌ها → ویژگی‌ها.
 * - توضیح متایی که یادداشت سئو در آن چسبانده شده («نامک … کلمه کلیدی اصلی … توضیحات متا:»)
 *   تجزیه می‌شود: عنوان، کلمات کلیدی، توضیح متا و نامک لاتین (اسلاگ).
 * - «(۱۲ ماه ضمانت)» از نام به فیلد گارانتی می‌رود؛ «-برندX» به «برند X» درست می‌شود.
 * - `--brand-from-title`: برندی که نامش در عنوان محصول آمده بر برند ثبت‌شده مقدم است.
 * - برای هر محصول، دسته، برند، برگه و مقاله ریدایرکت ۳۰۱ از نشانی قدیمی ساخته می‌شود.
 * - فقط روی دیتابیس بی‌محصول اجرا می‌شود.
 */
import "../../lib/load-env";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { slugify } from "../../lib/slug";

// ── ورودی ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const flag = (f: string) => args.includes(f);
const opt = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const NAME = opt("--name");
const DRY = flag("--dry-run");
if (!dir || !NAME || !/^[a-z0-9-]+$/.test(NAME)) {
  console.error("استفاده: npx tsx scripts/import/mixin.ts <export-dir> --name <site> [--brand-from-title] [--skip-empty-categories] [--dry-run]");
  process.exit(1);
}

interface MxImage { image_url: string; default?: boolean; image_alt?: string; local?: { file: string | null } | null }
interface MxRef { id: number; name: string }
interface MxProduct {
  _id: number; _url: string; name: string; english_name?: string | null; slug?: string;
  description?: string | null; analysis?: string | null; seo_title?: string | null; seo_description?: string | null;
  main_category?: MxRef | null; brand?: MxRef | null; price: number; compare_at_price?: number | null;
  stock_type?: string; max_available?: number | null; guarantee?: string | null; images: MxImage[];
  variants?: unknown[]; tags?: unknown[];
}
interface MxCategory { id: number; name: string; url: string; parentId: number | null; menuOrder?: number | null; imageLocal?: { file: string | null } | null; title?: string | null; metaDescription?: string | null }
interface MxBrand { _id: number; name: string; logo?: { file: string | null } | null; metaDescription?: string | null }
interface MxPage { _id: number; _url: string; title: string | null; metaDescription?: string | null; contentHtml?: string | null; htmlFile: string; ogImage?: { file: string | null } | null }
interface MxExport { source: string; products: MxProduct[]; categories: MxCategory[]; brands: MxBrand[]; pages: MxPage[]; blog: MxPage[] }

const data: MxExport = JSON.parse(readFileSync(path.join(dir, "export.json"), "utf8"));
const host = new URL(data.source).host;

// ── متن ──────────────────────────────────────────────────────────────────

const ENT: Record<string, string> = { nbsp: " ", zwnj: "‌", zwj: "‍", amp: "&", quot: '"', lt: "<", gt: ">", apos: "'", laquo: "«", raquo: "»", ndash: "–", mdash: "—", hellip: "…", rlm: "", lrm: "" };
function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const squash = (s: string) => s.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** HTML → متن ساده؛ `li` با «• »، بلوک‌ها با خط تازه */
function htmlToText(html: string): string {
  return squash(decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|table|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  ).replace(/•\s*\n+\s*/g, "• "));
}

/** h2/h3 اول به‌عنوان تیتر، فهرست‌ها جدا، بقیه متن */
function splitDescription(html: string | null | undefined) {
  if (!html?.trim()) return { title: null, text: null, bullets: [] as string[], full: null };
  const h = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  const title = h ? htmlToText(h[1]) || null : null;
  const rest = h ? html.replace(h[0], "") : html;
  const bullets = [...rest.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => htmlToText(m[1])).filter(Boolean);
  const text = htmlToText(rest.replace(/<(ul|ol)[^>]*>[\s\S]*?<\/\1>/gi, "")) || null;
  return { title, text, bullets, full: htmlToText(rest) || null };
}

const FA = "۰۱۲۳۴۵۶۷۸۹";
const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => FA[Number(d)]);
const toEn = (s: string) => s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));
const norm = (s: string) => toEn(s).replace(/[\s‌\-_]+/g, "").replace(/ك/g, "ک").replace(/ي/g, "ی");

/**
 * «X-برندY(12ماه ضمانت)» → «X برند Y» و ماه ضمانت.
 * `brands`: نام درست برندها — هر شکلِ با/بی فاصله‌ی آن در عنوان یکدست می‌شود.
 */
function cleanTitle(raw: string, brands: string[] = []): { title: string; months: number | null } {
  let t = raw.replace(/‌+/g, "‌");
  let months: number | null = null;
  const take = (_: string, n: string) => { months = Number(toEn(n)); return " "; };
  // «(12ماه ضمانت)»، «با12 ماه ضمانت»، «6 ماه گارانتی»، «با ضمانت 12 ماه»
  t = t.replace(/(?:با\s*)?\(?\s*([0-9۰-۹]+)\s*ماه\s*(?:ضمانت|گارانتی)\s*\)?/g, take);
  t = t.replace(/(?:با\s*)?\(?\s*(?:ضمانت|گارانتی)\s*([0-9۰-۹]+)\s*ماه\s*\)?/g, take);
  t = t.replace(/(?:با)?\(\s*\)/g, " ");
  t = t.replace(/\s*-\s*برند\s*/g, " برند ").replace(/برند(?=[^\s])/g, "برند ");
  for (const b of brands) {
    const loose = [...b.replace(/\s+/g, "")].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
    t = t.replace(new RegExp(loose, "g"), b);
  }
  // فاصله میان فارسی و لاتین/عدد: «پژو405» → «پژو 405»، «سمندEF7» → «سمند EF7»
  t = t.replace(/([؀-ۿ])(?=[A-Za-z0-9])/g, "$1 ").replace(/([A-Za-z0-9])(?=[؀-ۿ])/g, "$1 ");
  t = t.replace(/\s*-\s*(?=\S)/g, " - ").replace(/(\S)\(/g, "$1 (").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  t = t.replace(/\s+/g, " ").trim().replace(/\s*-\s*$/, "").replace(/\s+با$/, "").trim();
  return { title: t, months };
}

/** یادداشت سئوی چسبانده‌شده در توضیح متا */
function parseSeo(raw: string | null | undefined, store: string) {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!/نامک|کلمه کلیدی|توضیحات متا/.test(s)) {
    return { seoTitle: null, seoDescription: s.length > 30 ? s.slice(0, 300) : null, keywords: [] as string[], latinSlug: null };
  }
  const head = s.split(/نامک|کلمه کلیدی/)[0].replace(new RegExp(`\\|\\s*${store}\\s*$`), "").replace(/\|\s*$/, "").trim();
  const slugM = s.match(/نامک\s*\(?URL\)?\s*:\s*([a-z0-9-]+)/i);
  const mainKw = s.match(/کلمه کلیدی اصلی\s*:\s*(.*?)\s*(?:کلمات کلیدی|توضیحات متا|$)/)?.[1];
  const extra = s.match(/کلمات کلیدی مکمل\s*:\s*(.*?)\s*(?:توضیحات متا|$)/)?.[1];
  const desc = s.match(/توضیحات متا\s*:\s*(.*)$/)?.[1]?.trim();
  const keywords = [mainKw, ...(extra ?? "").split(/\s+-\s+|^-\s*/)].map((k) => k?.replace(/^-\s*/, "").trim()).filter((k): k is string => !!k);
  return { seoTitle: head || null, seoDescription: desc ? desc.slice(0, 300) : null, keywords, latinSlug: slugM?.[1]?.toLowerCase() ?? null };
}

// ── عکس ──────────────────────────────────────────────────────────────────

const UPLOAD_REL = `/uploads/import/${NAME}`;
const UPLOAD_DIR = path.join(process.cwd(), "public", UPLOAD_REL);
const imgCache = new Map<string, string | null>();
async function webp(file: string | null | undefined): Promise<string | null> {
  if (!file) return null;
  if (imgCache.has(file)) return imgCache.get(file)!;
  const src = path.join(dir!, "images", file);
  let url: string | null = null;
  if (existsSync(src)) {
    const out = file.replace(/\.[a-z0-9]+$/i, "") + ".webp";
    url = `${UPLOAD_REL}/${out}`;
    if (!DRY) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
      await sharp(src).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(UPLOAD_DIR, out));
    }
  }
  imgCache.set(file, url);
  return url;
}

// ── اسلاگ یکتا ───────────────────────────────────────────────────────────

const used = { product: new Set<string>(), category: new Set<string>(), brand: new Set<string>(), page: new Set<string>(), post: new Set<string>() };
function uniq(kind: keyof typeof used, base: string, fallback: string): string {
  let s = slugify(base) || fallback;
  if (s.length < 2) s = fallback;
  let out = s;
  for (let i = 2; used[kind].has(out); i++) out = `${s}-${i}`;
  used[kind].add(out);
  return out;
}

const redirects: Prisma.RedirectCreateManyInput[] = [];
const redirect = (kind: string, id: number, dest: string) =>
  redirects.push({ source: `^/${kind}/${id}(/.*)?$`, destination: dest, statusCode: 301, matchType: "REGEX", note: `انتقال از ${host}` });

// ── اجرا ──────────────────────────────────────────────────────────────────

async function main() {
  if (!DRY && (await prisma.product.count())) {
    console.error("دیتابیس محصول دارد — درون‌ریزی فقط روی فروشگاه خالی اجرا می‌شود.");
    process.exit(1);
  }
  const storeName = (data.products[0]?._url && (await guessStoreName())) || "";

  // برندها
  const brandIds = new Map<number, string>();
  const brandByNorm: { key: string; id: number }[] = [];
  for (const b of data.brands) {
    const slug = uniq("brand", b.name, `brand-${b._id}`);
    const logoUrl = await webp(b.logo?.file);
    brandByNorm.push({ key: norm(b.name), id: b._id });
    if (DRY) continue;
    const row = await prisma.brand.create({ data: { title: b.name, slug, logoUrl }, select: { id: true } });
    brandIds.set(b._id, row.id);
    redirect("brand", b._id, `/brands/${slug}`);
  }
  // نام‌های بلند اول، تا «نیک گستر کیش» بر «کیش» بچربد
  brandByNorm.sort((a, b) => b.key.length - a.key.length);

  // دسته‌ها — دسته‌ای که فقط در محصول دیده شده (پنهان در میکسین) هم ساخته می‌شود
  const counts = new Map<number, number>();
  for (const p of data.products) if (p.main_category) counts.set(p.main_category.id, (counts.get(p.main_category.id) ?? 0) + 1);
  const cats = [...data.categories];
  for (const p of data.products) {
    const c = p.main_category;
    if (c && !cats.some((x) => x.id === c.id)) cats.push({ id: c.id, name: c.name, url: `/category/${c.id}/`, parentId: null });
  }
  const keepCat = (c: MxCategory): boolean =>
    !flag("--skip-empty-categories") || (counts.get(c.id) ?? 0) > 0 || cats.some((x) => x.parentId === c.id && keepCat(x));
  const catIds = new Map<number, string>();
  const ordered = [...cats].sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
  for (const [i, c] of ordered.entries()) {
    if (!keepCat(c)) { console.log(`  · دسته‌ی خالی «${c.name}» رد شد`); continue; }
    const slug = uniq("category", c.name, `category-${c.id}`);
    const imageUrl = await webp(c.imageLocal?.file);
    const seoTitle = c.title?.split("|")[0].trim();
    if (DRY) continue;
    const row = await prisma.category.create({
      data: {
        title: c.name, slug, imageUrl, sortOrder: c.menuOrder ?? 100 + i,
        parentId: c.parentId != null ? catIds.get(c.parentId) ?? null : null,
        seoTitle: seoTitle && seoTitle !== "1" && seoTitle !== c.name ? seoTitle : null,
        seoDescription: c.metaDescription && c.metaDescription.length > 30 ? c.metaDescription : null,
      },
      select: { id: true },
    });
    catIds.set(c.id, row.id);
    redirect("category", c.id, `/categories/${slug}`);
  }

  // محصولات
  let n = 0;
  for (const p of data.products) {
    const { title, months } = cleanTitle(p.name, data.brands.map((b) => b.name));
    const seo = parseSeo(p.seo_description, storeName);
    const desc = splitDescription(p.description);
    const exp = splitDescription(p.analysis);
    const g = Number(toEn(p.guarantee ?? ""));
    const warrantyMonths = months ?? (Number.isFinite(g) && g > 0 ? g : null);

    let brandKey = p.brand?.id ?? null;
    if (flag("--brand-from-title")) {
      const hit = brandByNorm.find((b) => b.key.length > 2 && norm(p.name).includes(b.key));
      if (hit) brandKey = hit.id;
    }
    const categoryId = p.main_category ? catIds.get(p.main_category.id) : undefined;
    const imgs = [...p.images].sort((a, b) => Number(!!b.default) - Number(!!a.default));
    const urls = (await Promise.all(imgs.map((i) => webp(i.local?.file)))).filter((u): u is string => !!u);
    const slug = uniq("product", seo.latinSlug ?? title, `product-${p._id}`);
    const firstPara = desc.text?.split("\n").find((l) => l.length > 40) ?? null;
    const limited = p.stock_type !== "unlimited";

    if (DRY) { console.log(`· ${p._id} → ${slug} | ${title} | ${warrantyMonths ?? "-"} ماه | ${urls.length} عکس`); continue; }
    if (!categoryId) { console.warn(`  ⚠️ محصول ${p._id} دسته ندارد — رد شد`); continue; }

    await prisma.product.create({
      data: {
        title, slug, categoryId,
        brandId: brandKey != null ? brandIds.get(brandKey) ?? null : null,
        price: BigInt(Math.round(p.compare_at_price && p.compare_at_price > p.price ? p.compare_at_price : p.price)),
        salePrice: p.compare_at_price && p.compare_at_price > p.price ? BigInt(Math.round(p.price)) : null,
        warranty: warrantyMonths ? `${toFa(warrantyMonths)} ماه ضمانت` : null,
        trackStock: limited,
        stock: limited ? p.max_available ?? 0 : 0,
        isActive: true,
        mainImage: urls[0] ?? null,
        images: { create: urls.map((url, i) => ({ url, alt: title, sortOrder: i })) },
        shortDescription: firstPara ? (firstPara.length > 260 ? firstPara.slice(0, 257) + "…" : firstPara) : null,
        summaryTitle: desc.title,
        summaryDescription: desc.text,
        summaryFeatures: desc.bullets.slice(0, 12),
        summaryImage: urls[1] ?? urls[0] ?? null,
        features: desc.bullets.slice(0, 5),
        expertTitle: exp.title,
        expertDescription: exp.full,
        seoTitle: seo.seoTitle,
        seoDescription: seo.seoDescription,
        seoKeywords: [...seo.keywords, p.english_name].filter(Boolean).join("، ") || null,
      },
    });
    redirect("product", p._id, `/products/${slug}`);
    n++;
  }

  // برگه‌ها و مقاله‌ها — متن خالی/الگوی «.......» برگه‌ی غیرفعال می‌سازد تا بعداً پر شود
  for (const pg of data.pages) {
    const title = (pg.title ?? `برگه ${pg._id}`).split("|")[0].trim();
    const slug = uniq("page", title, `page-${pg._id}`);
    const html = pg.contentHtml?.trim() || null;
    const placeholder = !html || /\.{6,}/.test(html);
    if (DRY) { console.log(`· برگه ${pg._id} → /${slug}${placeholder ? " (خالی، غیرفعال)" : ""}`); continue; }
    await prisma.page.create({ data: { slug, title, contentHtml: html, isActive: !placeholder, seoDescription: pg.metaDescription?.slice(0, 300) || null } });
    redirect("page", pg._id, `/${slug}`);
  }
  let blogCat: { id: string } | null = null;
  for (const post of data.blog) {
    const title = (post.title ?? `مقاله ${post._id}`).split("|")[0].trim();
    const slug = uniq("post", title, `post-${post._id}`);
    const html = post.contentHtml?.trim() || bodyFromHtml(path.join(dir!, post.htmlFile));
    const cover = await webp(post.ogImage?.file);
    if (DRY || !html) continue;
    blogCat ??= await prisma.blogCategory.upsert({ where: { slug: "articles" }, update: {}, create: { title: "مقالات", slug: "articles" }, select: { id: true } });
    await prisma.blogPost.create({
      data: { title, slug, content: html, excerpt: htmlToText(html).slice(0, 200), coverImage: cover, categoryId: blogCat.id, status: "PUBLISHED", publishedAt: new Date(), seoDescription: post.metaDescription?.slice(0, 300) || null },
    });
    redirect("blog", post._id, `/mag/${slug}`);
  }

  if (!DRY) await prisma.redirect.createMany({ data: redirects, skipDuplicates: true });
  console.log(`✅ ${brandIds.size} برند، ${catIds.size} دسته، ${n} محصول، ${data.pages.length} برگه، ${data.blog.length} مقاله، ${redirects.length} ریدایرکت، ${imgCache.size} عکس`);
}

/** نام فروشگاه از «… | نام» در عنوان صفحه‌ها */
async function guessStoreName(): Promise<string> {
  const t = data.pages.find((p) => p.title?.includes("|"))?.title;
  return t ? t.split("|").pop()!.trim() : "";
}

/** متن مقاله وقتی در payload نیست: پاراگراف‌های بعد از h1 تا بخش نظرها */
function bodyFromHtml(file: string): string | null {
  if (!existsSync(file)) return null;
  const h = readFileSync(file, "utf8").replace(/<script[\s\S]*?<\/script>/gi, "");
  const start = h.search(/<h1[\s>]/i);
  if (start < 0) return null;
  const seg = h.slice(start).split(/نظرات|افزودن نظر/)[0];
  const blocks = [...seg.matchAll(/<(p|h2|h3|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => `<${m[1]}>${m[2].replace(/<(?!\/?(?:li|strong|b|em|a)\b)[^>]+>/g, "")}</${m[1]}>`);
  return blocks.length ? blocks.join("\n") : null;
}

main()
  .catch((e) => { console.error("❌", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
