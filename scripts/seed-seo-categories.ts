/**
 * دسته‌های کار سئو
 *
 *   pnpm tsx scripts/seed-seo-categories.ts
 *
 * دسته **جدول** است نه enum، تا مدیر بدون مهاجرت دسته‌ی تازه بسازد. ولی
 * دسته‌ی سیدشده یک `key` پایدار دارد که گزارش‌های فاز آنالیز رویش می‌نشینند،
 * پس **حذف نمی‌شود** — فقط `isActive = false`.
 *
 * idempotent است: دسته‌ی موجود بازنویسی نمی‌شود (عنوان و توضیحی که مدیر عوض
 * کرده نباید برگردد)، فقط نبوده‌ها ساخته می‌شوند.
 *
 * ⚠️ سید برخورد کلید را **صریح** گزارش می‌دهد، نه «از قبل بود» — دسته‌ای که
 * بی‌صدا رد شود یک ساعت عیب‌یابی می‌سازد.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵.۳
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";

interface CategorySeed {
  key: string;
  title: string;
  description: string;
}

const CATEGORIES: CategorySeed[] = [
  { key: "SITEMAP", title: "سایت‌مپ و robots.txt", description: "ساخت، اصلاح و ارسال دوباره‌ی سایت‌مپ؛ قواعد robots. در این پروژه: app/sitemap.ts و app/robots.ts" },
  { key: "INDEXING", title: "ایندکس و خطاهای سرچ‌کنسول", description: "صفحه‌های «خزیده‌شده ولی ایندکس‌نشده»، درخواست ایندکس، IndexNow (lib/indexnow.ts)" },
  { key: "INTERNAL_LINKS", title: "لینک‌سازی داخلی", description: "لینک از صفحه‌های پرقدرت به صفحه‌های ضعیف؛ محصولات مرتبط و مقاله‌های مرتبط" },
  { key: "SPEED", title: "سرعت و Core Web Vitals", description: "LCP، INP، CLS — عکس، فونت، اسکریپت‌های سنگین" },
  { key: "REDIRECTS", title: "ریدایرکت و خطای ۴۰۴", description: "زنجیره‌ی ریدایرکت، ۴۰۴ ورودی‌دار، نگاشت مهاجرت. پنل: /admin/seo" },
  { key: "SCHEMA", title: "داده‌ی ساختاریافته (اسکیما)", description: "Product، Article، BreadcrumbList، FAQ — lib/seo.ts" },
  { key: "META", title: "عنوان و متاتگ‌ها", description: "عنوان و توضیحات تکراری، بلند یا خالی" },
  { key: "CANNIBALIZATION", title: "هم‌پوشانی کلمه‌ی کلیدی", description: "چند صفحه برای یک کوئری؛ ادغام یا تفکیک قصد جست‌وجو" },
  { key: "LOCAL", title: "سئوی محلی و گوگل بیزینس", description: "نام و نشانی و تلفن باید همه‌جا حرف‌به‌حرف یکسان باشد" },
  { key: "CONTENT_REFRESH", title: "به‌روزرسانی محتوای قدیمی", description: "مقاله‌ای که کلیکش افتاده و بیش از یک سال دست‌نخورده مانده" },
  { key: "CATEGORY_SEO", title: "سئوی صفحه‌ی دسته", description: "متن، عنوان، متا و فیلترهای صفحه‌ی دسته — پرترافیک‌ترین صفحه‌های یک فروشگاه" },
  { key: "PRODUCT_SEO", title: "سئوی صفحه‌ی محصول", description: "عنوان، متا، مشخصات، تصویر و اسکیمای محصول" },
  { key: "TECHNICAL", title: "سایر کارهای فنی", description: "هرچه در دسته‌های بالا نمی‌گنجد" },
];

async function main() {
  let created = 0;
  let kept = 0;

  for (const [index, seed] of CATEGORIES.entries()) {
    const existing = await prisma.seoTaskCategory.findUnique({
      where: { key: seed.key },
      select: { id: true, title: true },
    });

    if (existing) {
      kept++;
      console.log(`= از قبل بود: ${seed.key} → «${existing.title}»`);
      continue;
    }

    await prisma.seoTaskCategory.create({
      data: {
        key: seed.key,
        title: seed.title,
        description: seed.description,
        sortOrder: index,
      },
    });
    created++;
    console.log(`+ ساخته شد: ${seed.key} → «${seed.title}»`);
  }

  console.log(`\nساخته‌شده ${created} · از قبل موجود ${kept}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
