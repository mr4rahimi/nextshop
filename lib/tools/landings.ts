/**
 * لندینگ‌ساز `/l/<slug>` — پیش‌نویس، انتشار، صفحه‌ی عمومی و فرم درخواست تماس.
 *
 * - `draftBlocks`/`theme` و `publishedBlocks`/`publishedTheme` جدا هستند.
 *   ویرایش فقط پیش‌نویس را عوض می‌کند؛ «انتشار» هر دو را کپی می‌کند.
 * - عنوان، نامک و سئو مستقیم ذخیره می‌شوند (جزء پیش‌نویس نیستند).
 * - نامک تا اولین انتشار قابل تغییر است و بعد قفل؛ پس از حذف هم آزاد نمی‌شود.
 *
 * مستندات: docs/features/tools.md بخش ۳
 */

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { slugify } from "@/lib/slug";
import type { Prisma, ToolLanding } from "@prisma/client";
import { SLUG_RE, ToolError, cleanSlug, randomToken } from "./common";
import {
  RESERVED_LANDING_SLUGS, defaultBlocks, parseBlocksLenient, sanitizeBlocks, sanitizeTheme, stableStringify,
  validateForPublish, type Block, type LandingTheme,
} from "./landing-blocks";
import { reviewPlatformLinks } from "./reviews";
import { isBotRequest } from "./visitor";

export const LANDING_PREFIX = "/l/";

export function landingUrl(slug: string): string {
  return `${SITE_URL.replace(/\/+$/, "")}${LANDING_PREFIX}${slug}`;
}

function hasUnpublished(l: ToolLanding): boolean {
  if (l.status !== "PUBLISHED") return false;
  return (
    stableStringify(l.draftBlocks) !== stableStringify(l.publishedBlocks) ||
    stableStringify(l.theme) !== stableStringify(l.publishedTheme)
  );
}

export function serializeLanding(l: ToolLanding) {
  return {
    id: l.id,
    slug: l.slug,
    url: landingUrl(l.slug),
    title: l.title,
    status: l.status,
    slugLocked: !!l.publishedAt,
    blocks: sanitizeBlocks(l.draftBlocks),
    theme: sanitizeTheme(l.theme),
    metaTitle: l.metaTitle ?? "",
    metaDescription: l.metaDescription ?? "",
    ogImage: l.ogImage ?? "",
    noindex: l.noindex,
    viewCount: l.viewCount,
    lastViewedAt: l.lastViewedAt?.toISOString() ?? null,
    publishedAt: l.publishedAt?.toISOString() ?? null,
    hasUnpublished: hasUnpublished(l),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export type LandingDto = ReturnType<typeof serializeLanding>;

async function checkSlug(slug: string, exceptId?: string) {
  if (!SLUG_RE.test(slug)) throw new ToolError("نامک فقط حروف کوچک لاتین، عدد و خط تیره (حداکثر ۴۰)");
  if (RESERVED_LANDING_SLUGS.has(slug)) throw new ToolError("این نامک رزرو است");
  // حذف‌شده‌ها هم حساب‌اند — ممکن است لینکش چاپ یا پخش شده باشد
  const hit = await prisma.toolLanding.findUnique({ where: { slug }, select: { id: true } });
  if (hit && hit.id !== exceptId) throw new ToolError("این نامک قبلاً استفاده شده است (حتی اگر حذف شده باشد)");
}

export async function listLandings() {
  const rows = await prisma.toolLanding.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 200 });
  return rows.map((l) => {
    const d = serializeLanding(l);
    return { ...d, blocks: undefined, blockCount: d.blocks.length };
  });
}

export async function getLanding(id: string) {
  const l = await prisma.toolLanding.findFirst({ where: { id, deletedAt: null } });
  if (!l) throw new ToolError("لندینگ پیدا نشد", 404);
  return serializeLanding(l);
}

export async function createLanding(input: { title?: unknown; slug?: unknown }, createdById: string | null) {
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 120) : "";
  if (!title) throw new ToolError("عنوان را وارد کنید");

  let slug = cleanSlug(input.slug) || slugify(title, 40);
  if (!slug || !SLUG_RE.test(slug)) slug = randomToken(6);
  if (!cleanSlug(input.slug)) {
    // نامک خودکار: اگر گرفته بود، پسوند کوتاه
    const taken = await prisma.toolLanding.findUnique({ where: { slug }, select: { id: true } });
    if (taken || RESERVED_LANDING_SLUGS.has(slug)) slug = `${slug.slice(0, 33)}-${randomToken(4)}`;
  }
  await checkSlug(slug);

  // پیش‌فرض‌ها از تنظیمات فروشگاه — نام، لوگو و تلفن را ادمین دوباره تایپ نکند
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { storeName: true, storeLogo: true, sitePhone: true, socialInstagram: true, socialTelegram: true, socialWhatsapp: true },
  });
  const blocks = defaultBlocks({ name: s?.storeName ?? "", logo: s?.storeLogo ?? "", phone: s?.sitePhone ?? "" });
  for (const b of blocks) {
    if (b.type === "social") {
      if (s?.socialInstagram) b.links.instagram = s.socialInstagram;
      if (s?.socialTelegram) b.links.telegram = s.socialTelegram;
      if (s?.socialWhatsapp) b.links.whatsapp = s.socialWhatsapp;
    }
  }

  const l = await prisma.toolLanding.create({
    data: {
      slug,
      title,
      theme: { ...sanitizeTheme(null) },
      draftBlocks: blocks as unknown as Prisma.InputJsonValue,
      metaTitle: title,
      createdById,
    },
  });
  return serializeLanding(l);
}

/** پیش‌نویس — شکل آزاد، نیمه‌کاره هم ذخیره می‌شود */
export async function saveLandingDraft(id: string, input: { blocks?: unknown; theme?: unknown }) {
  const l = await prisma.toolLanding.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!l) throw new ToolError("لندینگ پیدا نشد", 404);
  const data: Prisma.ToolLandingUpdateInput = {};
  if (input.blocks !== undefined) data.draftBlocks = sanitizeBlocks(input.blocks) as unknown as Prisma.InputJsonValue;
  if (input.theme !== undefined) data.theme = { ...sanitizeTheme(input.theme) };
  return serializeLanding(await prisma.toolLanding.update({ where: { id }, data }));
}

export async function updateLandingSettings(
  id: string,
  input: { title?: unknown; slug?: unknown; metaTitle?: unknown; metaDescription?: unknown; ogImage?: unknown; noindex?: unknown },
) {
  const l = await prisma.toolLanding.findFirst({ where: { id, deletedAt: null } });
  if (!l) throw new ToolError("لندینگ پیدا نشد", 404);
  const data: Prisma.ToolLandingUpdateInput = {};
  if (typeof input.title === "string" && input.title.trim()) data.title = input.title.trim().slice(0, 120);
  if (input.slug !== undefined) {
    const slug = cleanSlug(input.slug);
    if (slug !== l.slug) {
      if (l.publishedAt) throw new ToolError("نامک بعد از اولین انتشار قفل است — ممکن است لینکش پخش شده باشد");
      await checkSlug(slug, id);
      data.slug = slug;
    }
  }
  if (input.metaTitle !== undefined) data.metaTitle = typeof input.metaTitle === "string" ? input.metaTitle.trim().slice(0, 120) || null : null;
  if (input.metaDescription !== undefined)
    data.metaDescription = typeof input.metaDescription === "string" ? input.metaDescription.trim().slice(0, 300) || null : null;
  if (input.ogImage !== undefined) {
    const v = typeof input.ogImage === "string" ? input.ogImage.trim() : "";
    if (v && !/^(\/uploads\/|https:\/\/)\S+$/.test(v)) throw new ToolError("آدرس تصویر پیش‌نمایش معتبر نیست");
    data.ogImage = v || null;
  }
  if (input.noindex !== undefined) data.noindex = input.noindex === true;
  return serializeLanding(await prisma.toolLanding.update({ where: { id }, data }));
}

/** انتشار سخت‌گیر — خطاها با شماره‌ی بلوک برمی‌گردند */
export async function publishLanding(id: string) {
  const l = await prisma.toolLanding.findFirst({ where: { id, deletedAt: null } });
  if (!l) throw new ToolError("لندینگ پیدا نشد", 404);
  const blocks = sanitizeBlocks(l.draftBlocks);
  const errors = validateForPublish(blocks, SITE_URL);
  if (errors.length) return { ok: false as const, errors };
  const theme = sanitizeTheme(l.theme);
  const row = await prisma.toolLanding.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedBlocks: blocks as unknown as Prisma.InputJsonValue,
      publishedTheme: { ...theme },
      // نامک در اولین انتشار قفل می‌شود؛ تاریخ اولین انتشار نگه داشته می‌شود
      publishedAt: l.publishedAt ?? new Date(),
    },
  });
  return { ok: true as const, landing: serializeLanding(row) };
}

/** لغو انتشار: پیش‌نویس می‌ماند، صفحه‌ی عمومی ۴۰۴ می‌شود */
export async function unpublishLanding(id: string) {
  const row = await prisma.toolLanding.update({ where: { id }, data: { status: "DRAFT" } });
  return serializeLanding(row);
}

export async function deleteLanding(id: string) {
  await prisma.toolLanding.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date(), status: "DRAFT" } });
}

// ─── صفحه‌ی عمومی ────────────────────────────────────────────────────────

export interface LandingProduct {
  id: string;
  title: string;
  url: string;
  image: string | null;
  price: number;
  salePrice: number | null;
  inStock: boolean;
}

export interface LandingView {
  id: string;
  slug: string;
  title: string;
  blocks: Block[];
  theme: LandingTheme;
  products: Record<string, LandingProduct>;
  reviewPlatforms: { key: string; label: string; url: string }[];
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  noindex: boolean;
}

/** داده‌ی بلوک «محصولات» — فقط محصول فعال؛ قیمت از دیتابیس، نه از ذخیره‌ی لندینگ */
export async function loadLandingProducts(ids: string[]): Promise<Record<string, LandingProduct>> {
  if (ids.length === 0) return {};
  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
    select: {
      id: true, title: true, slug: true, price: true, salePrice: true, stock: true, trackStock: true, mainImage: true,
      images: { take: 1, select: { url: true } },
    },
  });
  const out: Record<string, LandingProduct> = {};
  for (const p of rows) {
    out[p.id] = {
      id: p.id,
      title: p.title,
      url: `/products/${p.slug}`,
      image: p.mainImage ?? p.images[0]?.url ?? null,
      price: Number(p.price),
      salePrice: p.salePrice !== null && p.salePrice > 0n && p.salePrice < p.price ? Number(p.salePrice) : null,
      inStock: !p.trackStock || p.stock > 0,
    };
  }
  return out;
}

export async function buildLandingView(
  l: Pick<ToolLanding, "id" | "slug" | "title" | "metaTitle" | "metaDescription" | "ogImage" | "noindex">,
  rawBlocks: unknown,
  rawTheme: unknown,
): Promise<LandingView> {
  const blocks = parseBlocksLenient(rawBlocks);
  const ids = blocks.flatMap((b) => (b.type === "products" ? b.productIds : []));
  const [products, reviewPlatforms] = await Promise.all([
    loadLandingProducts([...new Set(ids)]),
    blocks.some((b) => b.type === "review") ? reviewPlatformLinks(null) : Promise.resolve([]),
  ]);
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    blocks,
    theme: sanitizeTheme(rawTheme),
    products,
    reviewPlatforms,
    metaTitle: l.metaTitle,
    metaDescription: l.metaDescription,
    ogImage: l.ogImage,
    noindex: l.noindex,
  };
}

export async function getPublishedLanding(rawSlug: string): Promise<LandingView | null> {
  const slug = rawSlug.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return null;
  const l = await prisma.toolLanding.findUnique({ where: { slug } });
  if (!l || l.deletedAt || l.status !== "PUBLISHED" || !l.publishedBlocks) return null;
  return buildLandingView(l, l.publishedBlocks, l.publishedTheme);
}

/** شمارش بی‌سروصدا — خطا جلوی رندر را نمی‌گیرد؛ ربات‌ها شمرده نمی‌شوند */
export async function countLandingView(id: string, req: Request): Promise<void> {
  try {
    if (isBotRequest(req)) return;
    await prisma.toolLanding.update({ where: { id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } });
  } catch (e) {
    console.error("[landing] شمارش بازدید ناموفق:", e);
  }
}

// ─── فرم درخواست تماس ────────────────────────────────────────────────────

const RATE_WINDOW_MS = 60 * 60_000;
const RATE_MAX = 3;
const rate = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rate.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rate.set(key, hits);
    return true;
  }
  hits.push(now);
  rate.set(key, hits);
  if (rate.size > 5000) rate.clear();
  return false;
}

/**
 * درخواست تماس از لندینگ → همان `CallbackRequest` که «درخواست‌های تماس» پنل
 * نشان می‌دهد. سرور فقط وقتی می‌پذیرد که لندینگِ منتشرشده واقعاً بلوک فرم را
 * داشته باشد. سقف ۳ درخواست در ساعت به‌ازای IP.
 */
export async function submitLandingCallback(
  rawSlug: string,
  input: { phone?: unknown; name?: unknown; website?: unknown },
  ctx: { ip: string | null; host: string | null },
) {
  // فیلد تله: انسان نمی‌بیندش، ربات پرش می‌کند
  if (typeof input.website === "string" && input.website.trim()) return;

  const slug = rawSlug.trim().toLowerCase();
  const l = await prisma.toolLanding.findUnique({ where: { slug } });
  if (!l || l.deletedAt || l.status !== "PUBLISHED") throw new ToolError("صفحه پیدا نشد", 404);
  if (!parseBlocksLenient(l.publishedBlocks).some((b) => b.type === "callback")) throw new ToolError("این صفحه فرم تماس ندارد", 400);

  const phone = (typeof input.phone === "string" ? input.phone : "")
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[^\d]/g, "");
  if (!/^09\d{9}$/.test(phone)) throw new ToolError("شماره موبایل معتبر نیست — مثل ۰۹۱۲۱۲۳۴۵۶۷");
  if (rateLimited(ctx.ip ?? "unknown")) throw new ToolError("درخواست‌های زیادی فرستاده‌اید؛ کمی بعد دوباره تلاش کنید", 429);

  const name = typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  await prisma.callbackRequest.create({
    data: {
      phone,
      siteId: ctx.host,
      status: "pending",
      note: `از لندینگ «${l.title}»${name ? ` — نام: ${name}` : ""}`,
    },
  });
}
