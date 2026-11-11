/**
 * ساخت خودکار محصول سایت روی بازارگاه و نگاشت آن — docs/integrations/create-products.md
 *
 * مسیر: صفحه‌ی «ساخت محصول در بازارگاه» → یک job از نوع CREATE_PRODUCT برای هر
 * محصول (maxAttempts=1: تکرار خودکار یعنی خطر ساختن محصول تکراری روی بازارگاه)
 * → `runCreateProduct` پیش‌نویس را از سایت می‌سازد، آداپتور عکس‌ها را آپلود و
 * محصول را با تنوع‌هایش می‌سازد → نگاشت و نقشه‌ی تنوع‌ها ثبت می‌شود.
 */

import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import type { DraftImage, DraftVariant, ProductDraft } from "@/lib/integration/types";
import { writeLog } from "./log";
import { enqueue } from "./queue";
import { getCreateSettings, marketPrice, shopEffective, type CreateSettings } from "./variant-links";

/** سقف توضیحات باسلام */
export const DESCRIPTION_MAX = 5000;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

// ── متن ──────────────────────────────────────────────────────────────

/** HTML ویرایشگر → متن ساده با حفظ پاراگراف‌ها */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&zwnj;/g, "‌")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** توضیح کوتاه؛ اگر خالی بود متن کامل (بررسی تخصصی)، بعد توضیحات خلاصه — حداکثر ۵۰۰۰ نویسه */
export function pickDescription(p: { shortDescription: string | null; expertDescription: string | null; summaryDescription: string | null }): string {
  const text = [p.shortDescription, p.expertDescription, p.summaryDescription]
    .map((t) => htmlToText(t ?? ""))
    .find((t) => t.length > 0) ?? "";
  if (text.length <= DESCRIPTION_MAX) return text;
  const cut = text.slice(0, DESCRIPTION_MAX - 1);
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return (lastBreak > DESCRIPTION_MAX * 0.8 ? cut.slice(0, lastBreak) : cut).trim() + "…";
}

// ── عکس ──────────────────────────────────────────────────────────────

async function loadImage(url: string): Promise<DraftImage | null> {
  const clean = url.split("?")[0];
  const ext = path.extname(clean).slice(1).toLowerCase();
  try {
    if (clean.startsWith("/")) {
      // عکس خود سایت از دیسک — به CDN و دامنه وابسته نباشیم
      const root = path.join(process.cwd(), "public");
      const file = path.normalize(path.join(root, decodeURIComponent(clean)));
      if (!file.startsWith(root + path.sep)) return null;
      const type = IMAGE_TYPES[ext];
      if (!type) return null;
      const buffer = await readFile(file);
      if (buffer.length > MAX_IMAGE_BYTES) return null;
      return { name: path.basename(file), type, buffer };
    }
    if (/^https?:\/\//.test(clean)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      const type = (res.headers.get("content-type") || "").split(";")[0].trim();
      if (!res.ok || !Object.values(IMAGE_TYPES).includes(type)) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_IMAGE_BYTES) return null;
      return { name: path.basename(clean) || `photo.${type.split("/")[1]}`, type, buffer };
    }
  } catch {
    /* عکس خراب یا ناموجود — رد می‌شود */
  }
  return null;
}

// ── پیش‌نویس ─────────────────────────────────────────────────────────

export class DraftError extends Error {}

export async function buildDraft(productId: string, settings: CreateSettings): Promise<ProductDraft> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, include: { options: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      variantAxes: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p) throw new DraftError("محصول در سایت پیدا نشد");

  const categoryId = settings.categoryMap[p.categoryId];
  if (!categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: p.categoryId }, select: { title: true } });
    throw new DraftError(`دسته‌ی «${cat?.title ?? p.categoryId}» به دسته‌ای در بازارگاه نگاشت نشده — در بخش «نگاشت دسته‌ها» انتخابش کنید`);
  }

  // عکس اصلی، بعد عکس‌های عمومی، بعد عکس رنگ‌ها — بی‌تکرار
  const urls = [
    p.mainImage,
    ...p.images.filter((i) => !i.attributeValueId).map((i) => i.url),
    ...p.images.filter((i) => i.attributeValueId).map((i) => i.url),
  ].filter((u): u is string => !!u?.trim());
  const images: DraftImage[] = [];
  for (const u of [...new Set(urls)]) {
    if (images.length >= MAX_IMAGES) break;
    const img = await loadImage(u);
    if (img) images.push(img);
  }
  if (!images.length) throw new DraftError("محصول عکس قابل‌استفاده (jpg، png یا webp) ندارد");

  // تنوع‌ها با نام محور (رنگ، سایز…) و مقدار هر تنوع
  let variants: DraftVariant[] = [];
  if (p.variants.length) {
    const attrIds = [...new Set([...p.variantAxes.map((a) => a.attributeId), ...p.variants.flatMap((v) => v.options.map((o) => o.attributeId))])];
    const valueIds = [...new Set(p.variants.flatMap((v) => v.options.map((o) => o.attributeValueId)))];
    const [attrs, values] = await Promise.all([
      prisma.attribute.findMany({ where: { id: { in: attrIds } }, select: { id: true, title: true } }),
      prisma.attributeValue.findMany({ where: { id: { in: valueIds } }, select: { id: true, value: true } }),
    ]);
    const attrTitle = new Map(attrs.map((a) => [a.id, a.title.trim()]));
    const valueText = new Map(values.map((v) => [v.id, v.value.trim()]));
    const order = new Map(p.variantAxes.map((a, i) => [a.attributeId, i]));

    variants = p.variants.map((v) => {
      const props = [...v.options]
        .sort((a, b) => (order.get(a.attributeId) ?? 99) - (order.get(b.attributeId) ?? 99))
        .map((o) => ({ property: attrTitle.get(o.attributeId) ?? "", value: valueText.get(o.attributeValueId) ?? "" }));
      if (!props.length || props.some((x) => !x.property || !x.value)) {
        throw new DraftError(`تنوع «${v.title}» مقدار یا نام محور ندارد — تنوع‌های محصول را در سایت کامل کنید`);
      }
      const priceSrc = v.price !== null ? shopEffective(v.price, v.salePrice) : shopEffective(p.price, p.salePrice);
      return {
        shopVariantId: v.id,
        sku:           v.sku?.trim() || undefined,
        price:         marketPrice(priceSrc, settings),
        stock:         Math.max(0, v.stock),
        properties:    props,
      };
    });
    const keys = new Set(variants.map((v) => v.properties.map((x) => `${x.property}=${x.value}`).join("|")));
    if (keys.size !== variants.length) throw new DraftError("دو تنوع این محصول ترکیب مقدار یکسان دارند");
  }

  const basePrice = variants.length
    ? Math.min(...variants.map((v) => v.price))
    : marketPrice(shopEffective(p.price, p.salePrice), settings);
  if (!(basePrice > 0)) throw new DraftError("قیمت محصول صفر است");

  const stock = variants.length
    ? variants.reduce((t, v) => t + v.stock, 0)
    : p.trackStock ? Math.max(0, p.stock) : settings.untrackedStock;

  return {
    shopProductId:   p.id,
    title:           p.title.trim(),
    description:     pickDescription(p),
    images,
    price:           basePrice,
    stock,
    sku:             p.sku?.trim() || undefined,
    variants,
    categoryId,
    preparationDays: settings.preparationDays,
    weight:          settings.weight,
    packageWeight:   Math.max(settings.packageWeight, settings.weight),
    publish:         settings.publish,
  };
}

// ── job ──────────────────────────────────────────────────────────────

export async function runCreateProduct(
  jobId: string,
  platformCode: string,
  adapter: BaseAdapter,
  credentials: Record<string, string>,
  payload: { shopProductId?: string },
): Promise<void> {
  const shopProductId = payload.shopProductId;
  if (!shopProductId) throw new Error("CREATE_PRODUCT بدون shopProductId");
  if (!adapter.createProduct) throw new Error(`ساخت محصول برای ${platformCode} پشتیبانی نمی‌شود`);
  const start = Date.now();

  const fail = async (message: string) => {
    await writeLog({
      jobId, platformCode, operationType: "CREATE_PRODUCT", direction: "OUTBOUND",
      entityType: "PRODUCT", entityId: shopProductId, status: "ERROR", errorMessage: message,
      durationMs: Date.now() - start,
    }).catch(() => {});
    // job شکست بخورد ولی لاگ worker تکراری نشود: پیام را با نشانه می‌فرستیم
    throw Object.assign(new Error(message), { logged: true });
  };

  // جلوگیری از ساخت تکراری — شاید از دور قبلی یا نگاشت دستی، لینک دارد
  const shopLink = await prisma.integMappingLink.findUnique({
    where: { platformCode_externalId: { platformCode: "shop", externalId: shopProductId } },
    include: { mapping: { include: { links: { where: { platformCode } } } } },
  });
  if (shopLink?.mapping.links.length) {
    await writeLog({
      jobId, platformCode, operationType: "CREATE_PRODUCT", direction: "OUTBOUND",
      entityType: "PRODUCT", entityId: shopProductId, status: "SUCCESS",
      responseData: { skipped: "این محصول از قبل در این بازارگاه نگاشت دارد", platformProductId: shopLink.mapping.links[0].externalId },
    }).catch(() => {});
    return;
  }

  const settings = await getCreateSettings(platformCode);
  let draft: ProductDraft;
  try {
    draft = await buildDraft(shopProductId, settings);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  if (adapter.requiredCategoryAttributes) {
    const required = await adapter.requiredCategoryAttributes(credentials, draft.categoryId).catch(() => []);
    if (required.length) {
      return fail(`دسته‌ی انتخاب‌شده در بازارگاه ویژگی اجباری دارد (${required.join("، ")}) که از سایت پر نمی‌شود — دسته‌ی دیگری انتخاب کنید یا محصول را دستی بسازید`);
    }
  }

  let created;
  try {
    created = await adapter.createProduct(credentials, draft);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const meta = draft.variants.length
    ? {
        createdByPanel: true,
        variants: created.variants,
        pushed: Object.fromEntries(
          draft.variants
            .filter((v) => created.variants[v.shopVariantId])
            .map((v) => [created.variants[v.shopVariantId], { stock: v.stock, price: v.price }]),
        ),
      }
    : { createdByPanel: true };

  const product = await prisma.product.findUnique({ where: { id: shopProductId }, select: { title: true, stock: true } });
  await prisma.$transaction(async (tx) => {
    const mappingId = shopLink?.mappingId
      ?? (await tx.integMapping.create({ data: { stock: product?.stock ?? draft.stock } })).id;
    if (!shopLink) {
      await tx.integMappingLink.create({
        data: { mappingId, platformCode: "shop", externalId: shopProductId, externalTitle: product?.title ?? draft.title },
      });
    }
    await tx.integMappingLink.create({
      data: { mappingId, platformCode, externalId: created.platformProductId, externalTitle: created.title, meta },
    });
    // کش محصولات پلتفرم: محصول تازه کمپین تخفیف ندارد — ارسال قیمت بعدی لازم نیست منتظر «دریافت محصولات» بماند
    await tx.integPlatformProduct.upsert({
      where: { platformCode_platformProductId: { platformCode, platformProductId: created.platformProductId } },
      update: { title: created.title, stock: draft.stock, price: draft.price, discountPercent: null, originalPrice: null, discountSynced: true, lastFetchedAt: new Date() },
      create: {
        platformCode, platformProductId: created.platformProductId, title: created.title,
        sku: draft.sku ?? null, stock: draft.stock, price: draft.price, discountSynced: true,
      },
    });
  });

  await writeLog({
    jobId, platformCode, operationType: "CREATE_PRODUCT", direction: "OUTBOUND",
    entityType: "PRODUCT", entityId: shopProductId, status: "SUCCESS",
    responseData: {
      platformProductId: created.platformProductId,
      variants: Object.keys(created.variants).length,
      photos: draft.images.length,
      price: draft.price,
      status: created.statusTitle,
    },
    durationMs: Date.now() - start,
  }).catch(() => {});
}

// ── صف ───────────────────────────────────────────────────────────────

/** محصولاتی که باید ساخته شوند → job؛ آن‌هایی که نگاشت یا job در صف دارند رد می‌شوند */
export async function enqueueCreateProducts(platformCode: string, productIds: string[]): Promise<{ queued: number; skipped: number }> {
  const ids = [...new Set(productIds)].slice(0, 500);
  const [linked, pending] = await Promise.all([linkedOnPlatform(platformCode, ids), pendingCreateJobs(platformCode)]);
  let queued = 0;
  let skipped = 0;
  for (const id of ids) {
    if (linked.has(id) || pending.has(id)) { skipped++; continue; }
    await enqueue({ type: "CREATE_PRODUCT", platformCode, payload: { shopProductId: id }, priority: 6, maxAttempts: 1 });
    queued++;
  }
  return { queued, skipped };
}

/** shopProductId → شناسه‌ی محصول روی بازارگاه */
export async function linkedOnPlatform(platformCode: string, productIds?: string[]): Promise<Map<string, { externalId: string; title: string | null; variants: number }>> {
  const shopLinks = await prisma.integMappingLink.findMany({
    where: { platformCode: "shop", ...(productIds ? { externalId: { in: productIds } } : {}) },
    select: { externalId: true, mapping: { select: { links: { where: { platformCode }, select: { externalId: true, externalTitle: true, meta: true } } } } },
  });
  const out = new Map<string, { externalId: string; title: string | null; variants: number }>();
  for (const s of shopLinks) {
    const l = s.mapping.links[0];
    if (!l) continue;
    const v = (l.meta as { variants?: Record<string, string> } | null)?.variants;
    out.set(s.externalId, { externalId: l.externalId, title: l.externalTitle, variants: v ? Object.keys(v).length : 0 });
  }
  return out;
}

/** shopProductId → وضعیت job در صف (PENDING یا PROCESSING) */
export async function pendingCreateJobs(platformCode: string): Promise<Map<string, string>> {
  const jobs = await prisma.integJob.findMany({
    where: { platformCode, type: "CREATE_PRODUCT", status: { in: ["PENDING", "PROCESSING"] } },
    select: { payload: true, status: true },
  });
  const out = new Map<string, string>();
  for (const j of jobs) {
    const id = (j.payload as { shopProductId?: string } | null)?.shopProductId;
    if (id) out.set(id, j.status);
  }
  return out;
}
