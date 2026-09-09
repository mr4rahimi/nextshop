/**
 * ساخت انواع کارِ پیش‌فرض کارتابل
 *
 *   pnpm tsx scripts/seed-task-types.ts
 *
 * فهرست از بخش ۴ سند می‌آید — همان کاغذی که کارکنان مهام‌پرینت نوشتند،
 * مرتب‌شده در هشت دامنه.
 *
 * اسکریپت idempotent است: نوعِ موجود بازنویسی نمی‌شود تا ویرایش‌های مدیر
 * (وزن، نتیجه‌ها، SLA) از بین نرود. فقط نوع‌های نبوده ساخته می‌شوند.
 *
 * ⚠️ نوع کار هرگز حذف نمی‌شود؛ فقط `isActive = false` می‌گیرد.
 *
 * مستندات: docs/features/staff-worklist.md بخش ۴
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import type { StaffDomain, StaffChannel, StaffTaskSource, Prisma } from "@prisma/client";

interface Outcome {
  value: string;
  label: string;
  /** نتیجه‌ی موفق — مبنای نمودار «نرخ تبدیل» */
  isSuccess?: boolean;
}

interface TypeSeed {
  slug: string;
  title: string;
  domain: StaffDomain;
  channel?: StaffChannel;
  source?: StaffTaskSource;
  systemKey?: string;
  icon?: string;
  outcomes?: Outcome[];
  needsCustomer?: boolean;
  needsAmount?: boolean;
  needsLink?: boolean;
  needsCarrier?: boolean;
  slaMinutes?: number;
}

const TYPES: TypeSeed[] = [
  // ── فروش ──────────────────────────────────────────────────────
  {
    slug: "sales-consult",
    title: "مشاوره جهت فروش",
    domain: "SALES",
    channel: "CALL_IN",
    icon: "💬",
    needsCustomer: true,
    outcomes: [
      { value: "ordered", label: "منجر به سفارش", isSuccess: true },
      { value: "considering", label: "در حال بررسی" },
      { value: "price_high", label: "قیمت بالا بود" },
      { value: "out_of_stock", label: "موجود نبود" },
      { value: "declined", label: "منصرف شد" },
    ],
  },
  {
    slug: "sales-followup",
    title: "پیگیری فروش",
    domain: "SALES",
    channel: "CALL_OUT",
    icon: "📞",
    needsCustomer: true,
    outcomes: [
      { value: "confirmed", label: "سفارش قطعی شد", isSuccess: true },
      { value: "will_call", label: "قرار شد خبر بدهد" },
      { value: "retry", label: "پیگیری مجدد" },
      { value: "no_answer", label: "پاسخ نداد" },
      { value: "closed", label: "بسته شد" },
    ],
  },
  {
    slug: "phone-order",
    title: "ثبت سفارش تلفنی",
    domain: "SALES",
    channel: "CALL_IN",
    source: "SYSTEM",
    systemKey: "ORDER_BY_STAFF",
    icon: "🧾",
    needsCustomer: true,
  },
  {
    slug: "regular-customer-call",
    title: "تماس دوره‌ای با مشتری ثابت",
    domain: "SALES",
    channel: "CALL_OUT",
    source: "RECURRING",
    icon: "🔁",
    needsCustomer: true,
    outcomes: [
      { value: "purchased", label: "خرید کرد", isSuccess: true },
      { value: "interested", label: "علاقه‌مند بود" },
      { value: "not_now", label: "فعلاً نه" },
      { value: "no_answer", label: "پاسخ نداد" },
    ],
  },
  {
    slug: "b2b-outreach",
    title: "بازاریابی همکاران و ارگان‌ها",
    domain: "SALES",
    channel: "CALL_OUT",
    icon: "🤝",
    outcomes: [
      { value: "agreed", label: "قرار همکاری", isSuccess: true },
      { value: "catalog_sent", label: "ارسال کاتالوگ" },
      { value: "retry", label: "پیگیری بعدی" },
      { value: "rejected", label: "رد شد" },
    ],
  },
  {
    slug: "invoice-official",
    title: "صدور فاکتور رسمی",
    domain: "SALES",
    icon: "📑",
    needsCustomer: true,
    outcomes: [
      { value: "issued", label: "صادر شد", isSuccess: true },
      { value: "pending_info", label: "منتظر اطلاعات مشتری" },
      { value: "canceled", label: "منتفی شد" },
    ],
  },

  // ── مالی ──────────────────────────────────────────────────────
  {
    slug: "payment-followup",
    title: "پیگیری پرداخت",
    domain: "FINANCE",
    channel: "CALL_OUT",
    icon: "💰",
    needsCustomer: true,
    needsAmount: true,
    outcomes: [
      { value: "paid", label: "پرداخت شد", isSuccess: true },
      { value: "promised", label: "قول پرداخت داد" },
      { value: "cheque", label: "چک داد" },
      { value: "unpaid", label: "پرداخت نشد" },
    ],
  },

  // ── تأمین و خرید ──────────────────────────────────────────────
  {
    slug: "supplier-quote",
    title: "استعلام قیمت از تأمین‌کننده",
    domain: "PROCUREMENT",
    channel: "CALL_OUT",
    icon: "🔍",
    needsAmount: true,
    outcomes: [
      { value: "quoted", label: "قیمت گرفته شد", isSuccess: true },
      { value: "unavailable", label: "موجود نبود" },
      { value: "retry", label: "پیگیری بعدی" },
    ],
  },
  {
    slug: "supplier-pricelist",
    title: "دریافت لیست قیمت تأمین‌کننده",
    domain: "PROCUREMENT",
    icon: "📋",
    outcomes: [
      { value: "received", label: "دریافت شد", isSuccess: true },
      { value: "unchanged", label: "تغییر نداشت" },
      { value: "not_sent", label: "ارسال نکرد" },
    ],
  },
  {
    slug: "purchase-coordination",
    title: "هماهنگی و ثبت خرید کالا",
    domain: "PROCUREMENT",
    channel: "CALL_OUT",
    icon: "🛒",
    needsAmount: true,
    outcomes: [
      { value: "purchased", label: "خرید شد", isSuccess: true },
      { value: "reserved", label: "رزرو شد" },
      { value: "failed", label: "تأمین نشد" },
    ],
  },

  // ── ارسال و تحویل ─────────────────────────────────────────────
  {
    slug: "shipping-coordination",
    title: "هماهنگی ارسال با مشتری",
    domain: "FULFILLMENT",
    channel: "CALL_OUT",
    icon: "📦",
    needsCustomer: true,
    outcomes: [
      { value: "courier_tehran", label: "پیک تهران" },
      { value: "freight", label: "باربری شهرستان" },
      { value: "post", label: "پست" },
      { value: "pickup", label: "تحویل حضوری" },
      { value: "no_answer", label: "پاسخ نداد" },
    ],
  },
  {
    slug: "dispatch-courier",
    title: "ارسال پیک موتوری تهران",
    domain: "FULFILLMENT",
    icon: "🛵",
    needsCustomer: true,
    slaMinutes: 180, // وعده‌ی سه‌ساعته
    outcomes: [
      { value: "delivered", label: "تحویل شد", isSuccess: true },
      { value: "dispatched", label: "ارسال شد" },
      { value: "delayed", label: "تأخیر خورد" },
      { value: "returned", label: "مرجوع شد" },
    ],
  },
  {
    slug: "dispatch-intercity",
    title: "ارسال شهرستان",
    domain: "FULFILLMENT",
    icon: "🚚",
    needsCustomer: true,
    needsCarrier: true,
    slaMinutes: 1440, // وعده‌ی بیست‌وچهارساعته
    outcomes: [
      { value: "delivered", label: "تحویل شد", isSuccess: true },
      { value: "dispatched", label: "ارسال شد" },
      { value: "delayed", label: "تأخیر خورد" },
      { value: "returned", label: "مرجوع شد" },
    ],
  },
  {
    slug: "tracking-code",
    title: "ثبت بیجک و کد مرسوله",
    domain: "FULFILLMENT",
    source: "SYSTEM",
    systemKey: "ORDER_TRACKING",
    icon: "🏷️",
  },

  // ── کاتالوگ و قیمت ────────────────────────────────────────────
  {
    slug: "site-pricing",
    title: "قیمت‌گذاری روزانه‌ی سایت",
    domain: "CATALOG",
    source: "RECURRING",
    icon: "🏷️",
    outcomes: [
      { value: "done", label: "انجام شد", isSuccess: true },
      { value: "partial", label: "ناقص ماند" },
      { value: "no_change", label: "تغییری لازم نبود" },
    ],
  },
  {
    slug: "marketplace-pricing",
    title: "قیمت‌گذاری پنل‌های بازارگاه",
    domain: "CATALOG",
    icon: "🛍️",
    outcomes: [
      { value: "snapp", label: "اسنپ‌شاپ" },
      { value: "tapsi", label: "تپسی‌شاپ" },
      { value: "digikala", label: "دیجی‌کالا" },
      { value: "pindo", label: "پیندو" },
    ],
  },
  {
    slug: "stock-update",
    title: "بروزرسانی موجودی",
    domain: "CATALOG",
    source: "SYSTEM",
    systemKey: "PRICE_BULK",
    icon: "📊",
  },
  {
    slug: "product-entry",
    title: "محصول‌گذاری در سایت",
    domain: "CATALOG",
    source: "SYSTEM",
    systemKey: "PRODUCT_CREATE",
    icon: "➕",
  },
  {
    slug: "product-update",
    title: "ویرایش محصول",
    domain: "CATALOG",
    source: "SYSTEM",
    systemKey: "PRODUCT_UPDATE",
    icon: "✏️",
  },

  // ── محتوا و بازاریابی ─────────────────────────────────────────
  {
    slug: "article-write",
    title: "مقاله‌نویسی",
    domain: "CONTENT",
    source: "SYSTEM",
    systemKey: "BLOG_WRITE",
    icon: "📝",
  },
  {
    slug: "creative-design",
    title: "ساخت بنر تبلیغاتی و موشن",
    domain: "CONTENT",
    source: "RECURRING",
    icon: "🎨",
    outcomes: [
      { value: "done", label: "ساخته شد", isSuccess: true },
      { value: "in_progress", label: "در دست ساخت" },
      { value: "skipped", label: "امروز لازم نبود" },
    ],
  },
  {
    slug: "social-post",
    title: "انتشار در کانال‌ها و استوری",
    domain: "CONTENT",
    source: "RECURRING",
    icon: "📣",
    needsLink: true,
    outcomes: [
      { value: "published", label: "منتشر شد", isSuccess: true },
      { value: "scheduled", label: "زمان‌بندی شد" },
      { value: "skipped", label: "امروز لازم نبود" },
    ],
  },
  {
    slug: "backlink",
    title: "لینک‌سازی خارجی",
    domain: "CONTENT",
    icon: "🔗",
    needsLink: true, // بدون آدرس، لینک‌سازی قابل بررسی نیست
    outcomes: [
      { value: "published", label: "لینک ثبت شد", isSuccess: true },
      { value: "pending", label: "در انتظار تأیید" },
      { value: "rejected", label: "رد شد" },
    ],
  },
  {
    slug: "seo-task",
    title: "کار سئو طبق برنامه",
    domain: "CONTENT",
    source: "ASSIGNED",
    icon: "🔎",
    outcomes: [
      { value: "done", label: "انجام شد", isSuccess: true },
      { value: "partial", label: "ناقص ماند" },
      { value: "blocked", label: "متوقف شد" },
    ],
  },

  // ── پشتیبانی و گارانتی ────────────────────────────────────────
  {
    slug: "install-support",
    title: "پشتیبانی نصب دستگاه",
    domain: "SUPPORT",
    channel: "CALL_OUT",
    icon: "🔧",
    needsCustomer: true,
    outcomes: [
      { value: "resolved", label: "حل شد", isSuccess: true },
      { value: "onsite_needed", label: "نیاز به مراجعه" },
      { value: "retry", label: "پیگیری بعدی" },
      { value: "no_answer", label: "پاسخ نداد" },
    ],
  },
  {
    slug: "warranty-case",
    title: "رسیدگی به گارانتی",
    domain: "SUPPORT",
    icon: "🛡️",
    needsCustomer: true,
    outcomes: [
      { value: "repaired", label: "تعمیر شد", isSuccess: true },
      { value: "replaced", label: "تعویض شد", isSuccess: true },
      { value: "rejected", label: "مشمول گارانتی نبود" },
      { value: "pending", label: "در جریان" },
    ],
  },
  {
    slug: "support-call",
    title: "پاسخ تماس عمومی",
    domain: "SUPPORT",
    channel: "CALL_IN",
    icon: "☎️",
    outcomes: [
      { value: "answered", label: "پاسخ داده شد", isSuccess: true },
      { value: "referred", label: "ارجاع شد" },
      { value: "callback", label: "قرار شد تماس بگیریم" },
    ],
  },

  // ── داخلی ─────────────────────────────────────────────────────
  {
    slug: "internal-other",
    title: "کار دیگر",
    domain: "INTERNAL",
    icon: "📌",
    outcomes: [
      { value: "done", label: "انجام شد", isSuccess: true },
      { value: "partial", label: "ناقص ماند" },
    ],
  },
];

async function main() {
  let created = 0;
  let kept = 0;

  for (const [index, seed] of TYPES.entries()) {
    const existing = await prisma.staffTaskType.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    });

    if (existing) {
      kept++;
      continue;
    }

    await prisma.staffTaskType.create({
      data: {
        slug: seed.slug,
        title: seed.title,
        domain: seed.domain,
        channel: seed.channel ?? "NONE",
        source: seed.source ?? "MANUAL",
        systemKey: seed.systemKey ?? null,
        icon: seed.icon ?? null,
        // Prisma تایپ آرایه‌ی شیء را مستقیم برای فیلد Json نمی‌پذیرد
        outcomes: (seed.outcomes ?? []) as unknown as Prisma.InputJsonValue,
        needsCustomer: seed.needsCustomer ?? false,
        needsAmount: seed.needsAmount ?? false,
        needsLink: seed.needsLink ?? false,
        needsCarrier: seed.needsCarrier ?? false,
        slaMinutes: seed.slaMinutes ?? null,
        sortOrder: index,
      },
    });
    created++;
    console.log(`+ ${seed.title}  [${seed.domain}]`);
  }

  console.log(`\nساخته‌شده ${created} · از قبل موجود ${kept} · مجموع ${TYPES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
