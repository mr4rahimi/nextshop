/**
 * راهنمای سایز — بخش سرور (docs/features/size-guide.md). شکل داده در `lib/size-guide.ts`.
 */

import { prisma } from "@/lib/prisma";
import { chartHasData, guessKind, normalizeChart, type SizeChart } from "@/lib/size-guide";

export async function sizeGuideEnabled(): Promise<boolean> {
  const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { sizeGuideEnabled: true } });
  return !!s?.sizeGuideEnabled;
}

const toChart = (row: { kind: string; columns: unknown; rows: unknown; fit: string | null; sizing: string | null; note: string | null }): SizeChart | null => {
  const n = normalizeChart(row);
  return "chart" in n ? n.chart : null;
};

/** جدول صفحه‌ی محصول — فقط با کلید روشن و دست‌کم یک عدد */
export async function loadSizeChart(productId: string): Promise<SizeChart | null> {
  if (!(await sizeGuideEnabled())) return null;
  const row = await prisma.productSizeChart.findUnique({ where: { productId } });
  const chart = row && toChart(row);
  return chart && chartHasData(chart) ? chart : null;
}

/** سایزهای تنوع محصول (محوری که نامش «سایز» است) به ترتیب نمایش */
async function variantSizes(productId: string): Promise<string[]> {
  const axes = await prisma.productVariantAxis.findMany({ where: { productId }, orderBy: { sortOrder: "asc" }, select: { attributeId: true } });
  if (!axes.length) return [];
  const attr = await prisma.attribute.findFirst({ where: { id: { in: axes.map((a) => a.attributeId) }, OR: [{ title: { contains: "سایز" } }, { title: { contains: "size", mode: "insensitive" } }] }, select: { id: true } });
  if (!attr) return [];
  const used = await prisma.productVariantOption.findMany({ where: { attributeId: attr.id, variant: { productId } }, select: { attributeValueId: true } });
  const vals = await prisma.attributeValue.findMany({ where: { id: { in: [...new Set(used.map((u) => u.attributeValueId))] } }, orderBy: { sortOrder: "asc" }, select: { value: true } });
  return vals.map((v) => v.value);
}

/** داده‌ی بخش «راهنمای سایز» فرم محصول */
export async function loadSizeChartAdmin(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, categoryId: true, category: { select: { title: true, parent: { select: { title: true, parent: { select: { title: true } } } } } } },
  });
  if (!product) return null;
  const [row, sizes, settings] = await Promise.all([
    prisma.productSizeChart.findUnique({ where: { productId } }),
    variantSizes(productId),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true } }),
  ]);
  const c = product.category;
  const guess = guessKind([product.title, c?.title, c?.parent?.title, c?.parent?.parent?.title].filter(Boolean).join(" "));
  // محصول بی‌جدول: آخرین جدولِ همین دسته برای «کپی با یک کلیک»
  const suggest = row
    ? null
    : await prisma.productSizeChart.findFirst({
        where: { product: { categoryId: product.categoryId }, productId: { not: productId } },
        orderBy: { updatedAt: "desc" },
        select: { productId: true, product: { select: { title: true } } },
      });
  return {
    enabled: await sizeGuideEnabled(),
    chart: row ? toChart(row) : null,
    guessKind: guess,
    variantSizes: sizes,
    suggest: suggest ? { productId: suggest.productId, title: suggest.product.title } : null,
    productTitle: product.title,
    storeName: settings?.storeName ?? null,
    imageUrl: row?.imageUrl ?? null,
  };
}

/** ذخیره؛ جدول بی‌ردیف حذف می‌شود و عکسش هم از گالری می‌رود — خروجی: نشانی عکسِ برداشته‌شده */
export async function saveSizeChart(productId: string, chart: SizeChart): Promise<string | null> {
  if (!chart.rows.length) {
    const removed = await setSizeChartImage(productId, null);
    await prisma.productSizeChart.deleteMany({ where: { productId } });
    return removed;
  }
  const data = { kind: chart.kind, columns: chart.columns as object[], rows: chart.rows as object[], fit: chart.fit, sizing: chart.sizing, note: chart.note };
  await prisma.productSizeChart.upsert({ where: { productId }, update: data, create: { productId, ...data } });
  return null;
}

/**
 * عکس جدول در گالری (فاز ۲): عکس قبلی از گالری برداشته و تازه آخر گالری گذاشته می‌شود.
 * `null` = فقط برداشتن. خروجی: نشانی عکس قبلی تا فرم محصول هم از فهرستش بردارد.
 * فایل قبلی روی دیسک می‌ماند (ممکن است جای دیگری کپی شده باشد).
 */
export async function setSizeChartImage(productId: string, url: string | null): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.productSizeChart.findUnique({ where: { productId }, select: { imageUrl: true } });
    if (!row) return null;
    const old = row.imageUrl;
    if (old) await tx.productImage.deleteMany({ where: { productId, url: old } });
    if (url) {
      const last = await tx.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } });
      await tx.productImage.create({ data: { productId, url, sortOrder: (last._max.sortOrder ?? -1) + 1, alt: "راهنمای سایز" } });
    }
    await tx.productSizeChart.update({ where: { productId }, data: { imageUrl: url } });
    return old;
  });
}

/** محصولاتی که جدول دارند — برای «کپی از محصول دیگر» */
export async function searchSizeCharts(q: string, exclude?: string) {
  const rows = await prisma.productSizeChart.findMany({
    where: { ...(exclude ? { productId: { not: exclude } } : {}), ...(q.trim() ? { product: { title: { contains: q.trim(), mode: "insensitive" } } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 15,
    select: { productId: true, kind: true, rows: true, product: { select: { title: true } } },
  });
  return rows.map((r) => ({
    productId: r.productId,
    title: r.product.title,
    kind: r.kind,
    sizes: (Array.isArray(r.rows) ? r.rows : []).map((x) => String((x as { size?: string })?.size ?? "")).filter(Boolean),
  }));
}
