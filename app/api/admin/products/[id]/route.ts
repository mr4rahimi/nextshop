import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";
import { submitToIndexNow, productUrl } from "@/lib/indexnow";
import { logActivityAsync, diffFields, summarizeChanges } from "@/lib/activity";

// ─── GET /api/admin/products/[id] ────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      specs: { include: { specItem: true } },
      category: true,
      brand: true,
    },
  });

  if (!product) {
    return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });
  }

  return NextResponse.json(serialize(product));
}

// ─── PUT /api/admin/products/[id] ────────────────────────────────────────────
/**
 * بروزرسانی محصول.
 *
 * دو قاعده‌ی مهم که قبلاً رعایت نمی‌شد و باعث از دست رفتن خاموش داده می‌شد:
 *
 * ۱. **همه‌چیز داخل یک تراکنش است.** قبلاً `deleteMany` روی تصاویر و مشخصات
 *    فنی جدا از `update` اجرا می‌شد؛ اگر `update` می‌ترکید (مثلاً slug تکراری)،
 *    گالری و مشخصات برای همیشه رفته بودند و فقط یک خطای ۵۰۰ دیده می‌شد.
 *
 * ۲. **فقط فیلدهایی که در بدنه آمده‌اند نوشته می‌شوند.** قبلاً الگوی
 *    `body.features || []` باعث می‌شد یک PUT ناقص (مثل ویرایش گروهی وضعیت که
 *    فقط `{isActive}` می‌فرستاد) قیمت، موجودی، ویژگی‌ها و شناسه‌ها را صفر کند.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // وضعیت قبل — برای ثبت «قبل ← بعد» در گزارش عملکرد
  const before = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" }, select: { url: true } }, specs: { select: { id: true } } },
  });

  /** فقط اگر کلید در بدنه آمده باشد مقدار را برمی‌گرداند، وگرنه undefined (Prisma رد می‌کند) */
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const pick = <T,>(key: string, map: (v: any) => T): T | undefined =>
    has(key) ? map(body[key]) : undefined;

  const str  = (key: string) => pick(key, (v) => (v === "" ? null : v ?? null));
  const arr  = (key: string) => pick(key, (v) => (Array.isArray(v) ? v : []));
  const int  = (key: string, fallback: number) =>
    pick(key, (v) => (v === "" || v == null ? fallback : parseInt(String(v)) || fallback));

  /** نشانی تصویر باید رشته‌ی ناتهی باشد؛ null/undefined در آرایه یعنی آپلود شکست خورده */
  const imageUrls: string[] | undefined = has("images")
    ? (Array.isArray(body.images) ? body.images : []).filter(
        (u: unknown): u is string => typeof u === "string" && u.trim() !== "",
      )
    : undefined;

  if (has("images") && Array.isArray(body.images) && imageUrls!.length !== body.images.length) {
    return NextResponse.json(
      { error: "بعضی تصاویر گالری نشانی معتبر ندارند (احتمالاً آپلودشان کامل نشده). محصول ذخیره نشد." },
      { status: 400 },
    );
  }

  const specRows: { specItemId: string; value: string }[] | undefined = has("specs")
    ? (Array.isArray(body.specs) ? body.specs : [])
        .filter((sp: any) => sp?.specItemId)
        .map((sp: any) => ({ specItemId: sp.specItemId, value: sp.value ?? "" }))
    : undefined;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // جایگزینی کامل فقط وقتی معنا دارد که خود کلید در بدنه آمده باشد
      if (imageUrls) await tx.productImage.deleteMany({ where: { productId: id } });
      if (specRows)  await tx.productSpecValue.deleteMany({ where: { productId: id } });

      return tx.product.update({
        where: { id },
        data: {
          title:      pick("title", String),
          slug:       pick("slug", String),
          categoryId: pick("categoryId", String),
          brandId:    pick("brandId", (v) => v || null),

          shortDescription:  str("shortDescription"),
          expertTitle:       str("expertTitle"),
          expertDescription: str("expertDescription"),
          expertImage:       str("expertImage"),

          summaryTitle:       str("summaryTitle"),
          summaryDescription: str("summaryDescription"),
          summaryImage:       str("summaryImage"),
          summaryFeatures:    arr("summaryFeatures"),

          videoUrl:        str("videoUrl"),
          relatedSettings: pick("relatedSettings", (v) => v || {}),
          mainImage:       str("mainImage"),

          features: arr("features"),
          colors:   arr("colors"),

          price:     pick("price", (v) => BigInt(v || 0)),
          salePrice: pick("salePrice", (v) => (v ? BigInt(v) : null)),

          warranty:      str("warranty"),
          downloadTitle: str("downloadTitle"),
          downloadUrl:   str("downloadUrl"),

          stock:             int("stock", 0),
          trackStock:        pick("trackStock", (v) => v ?? false),
          lowStockThreshold: int("lowStockThreshold", 3),
          faq:               arr("faq"),

          isActive: pick("isActive", (v) => v ?? true),

          seoTitle:       str("seoTitle"),
          seoDescription: str("seoDescription"),
          seoKeywords:    str("seoKeywords"),
          seoSchema:      str("seoSchema"),

          // شناسه‌های محصول برای Product schema / Merchant Center
          sku:    str("sku"),
          gtin13: str("gtin13"),
          mpn:    str("mpn"),

          ...(imageUrls && {
            images: { create: imageUrls.map((url, index) => ({ url, sortOrder: index })) },
          }),
          ...(specRows && { specs: { create: specRows } }),
        },
        include: {
          images: true,
          specs: { include: { specItem: true } },
        },
      });
    });

    // اعلام به IndexNow (Bing/Yandex). عمداً await نمی‌شود تا پاسخ ادمین معطل نماند.
    void submitToIndexNow([productUrl(updated.slug)]);

    if (before) {
      const changes = diffFields(
        { ...before, images: before.images.map((i) => i.url), specsCount: before.specs.length },
        {
          ...body,
          ...(imageUrls ? { images: imageUrls } : {}),
          ...(specRows ? { specsCount: specRows.length } : {}),
          price: has("price") ? BigInt(body.price || 0) : undefined,
          salePrice: has("salePrice") ? (body.salePrice ? BigInt(body.salePrice) : null) : undefined,
          stock: has("stock") ? (parseInt(String(body.stock)) || 0) : undefined,
        },
      );
      if (changes.length > 0) {
        logActivityAsync({
          action: "UPDATE",
          entity: "PRODUCT",
          entityId: updated.id,
          entityTitle: updated.title,
          summary: summarizeChanges(changes),
          changes,
        });
      }
    }

    return NextResponse.json(serialize(updated));
  } catch (e: any) {
    console.error("[products PUT] بروزرسانی شکست خورد:", id, e?.code, e?.message);
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "این نشانی (slug) قبلاً برای محصول دیگری ثبت شده است. نشانی را تغییر دهید." },
        { status: 409 },
      );
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "محصول یافت نشد." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "ذخیره‌ی محصول انجام نشد و هیچ تغییری اعمال نشد." },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/admin/products/[id] ─────────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // slug قبل از حذف خوانده می‌شود تا بتوانیم حذف را هم اعلام کنیم
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { slug: true, title: true, mainImage: true },
  });
  try {
    await prisma.product.delete({ where: { id } });
  } catch (e: any) {
    // محصولی که در سفارشی استفاده شده حذف نمی‌شود (P2003) — پیام واضح بده
    if (e?.code === "P2003") {
      return NextResponse.json({
        error: "این محصول در سفارش‌های ثبت‌شده استفاده شده و قابل حذف نیست. " +
               "به‌جای حذف، آن را غیرفعال کنید تا از سایت برداشته شود.",
      }, { status: 409 });
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "محصول یافت نشد." }, { status: 404 });
    }
    console.error("[products DELETE] حذف شکست خورد:", id, e?.code, e?.message);
    return NextResponse.json({ error: "حذف محصول انجام نشد." }, { status: 500 });
  }

  if (existing) {
    void submitToIndexNow([productUrl(existing.slug)]);
    logActivityAsync({
      action: "DELETE",
      entity: "PRODUCT",
      entityId: id,
      entityTitle: existing.title,
      summary: `محصول «${existing.title}» حذف شد`,
      changes: [
        { field: "mainImage", label: "تصویر اصلی", kind: "image", before: existing.mainImage, after: null },
      ],
    });
  }
  return NextResponse.json({ success: true });
}