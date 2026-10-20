/**
 * دکمه‌های پیشنهادی خودکار چت — docs/plans/storefront-chat.md فاز ۲
 *
 * به‌جای منوی دستی (`chatSettings.flow`) که مدیر باید می‌چید، از صفحه‌ی فعلی و داده‌ی
 * فروشگاه ساخته می‌شوند. هر دکمه همان متنی است که به‌عنوان پیام مشتری فرستاده می‌شود.
 * منوی دستی فقط وقتی دیده می‌شود که مدیر `buttonsMode = "custom"` را انتخاب کرده باشد.
 */
import { prisma } from "@/lib/prisma";
import { allCategories } from "./search";

const MAX = 4;

let topCache: { titles: string[]; ts: number } | null = null;

/** دسته‌های سطح اول با بیشترین محصول فعال (شمارش با همه‌ی زیردسته‌ها) */
async function topCategories(n: number): Promise<string[]> {
  if (topCache && Date.now() - topCache.ts < 10 * 60_000) return topCache.titles.slice(0, n);
  const [rows, counts] = await Promise.all([
    allCategories(),
    prisma.product.groupBy({ by: ["categoryId"], where: { isActive: true }, _count: { _all: true } }),
  ]);
  const own = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  const total = (id: string): number => (own.get(id) ?? 0) + rows.filter((c) => c.parentId === id).reduce((s, c) => s + total(c.id), 0);
  const titles = rows
    .filter((c) => !c.parentId)
    .map((c) => ({ title: c.title, n: total(c.id) }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((c) => c.title);
  topCache = { titles, ts: Date.now() };
  return titles.slice(0, n);
}

export async function chatSuggestions(pagePath: string | null): Promise<string[]> {
  const path = (pagePath ?? "/").split(/[?#]/)[0];

  const product = path.match(/^\/products\/([^/]+)\/?$/);
  if (product) {
    const p = await prisma.product.findFirst({
      where: { slug: decodeURIComponent(product[1]), isActive: true },
      select: { price: true, salePrice: true, warranty: true, _count: { select: { relatedProducts: true } } },
    });
    if (p) {
      const priced = Number(p.salePrice ?? p.price) > 0;
      return [
        priced ? "این کالا موجوده؟ کی به دستم می‌رسه؟" : "قیمت روز این کالا چنده؟",
        "مشخصات مهم این کالا رو بگو",
        p._count.relatedProducts > 0 ? "لوازم مکمل یا مصرفی این کالا چیه؟" : "مدل مشابه یا جایگزین هم دارید؟",
        p.warranty?.trim() ? "گارانتی این کالا چطوره؟" : "شرایط ارسال و مرجوعی چیه؟",
      ].slice(0, MAX);
    }
  }

  const category = path.match(/^\/categories\/([^/]+)\/?$/);
  if (category) {
    const c = (await allCategories()).find((x) => x.slug === decodeURIComponent(category[1]));
    if (c) {
      return [`کمکم کن یه ${c.title} مناسب انتخاب کنم`, `ارزان‌ترین ${c.title} موجود`, `پرفروش‌ترین ${c.title}`, "هزینه و زمان ارسال چقدره؟"];
    }
  }

  if (/^\/cart\/?$/.test(path)) {
    return ["کد تخفیف فعال دارید؟", "هزینه و زمان ارسال چقدره؟", "چه روش‌های پرداختی دارید؟"];
  }

  const cats = await topCategories(2);
  return [...cats.map((t) => `دنبال ${t} هستم`), "پیگیری سفارش", "هزینه و زمان ارسال چقدره؟"].slice(0, MAX);
}
