/**
 * امکانات فروختنی و مسیرهای پنل هر کدام — docs/plans/licensing.md
 *
 * لایسنس گردانوس فهرست کلیدهای همین فایل را می‌آورد؛ اینکه هر بسته کدام کلیدها
 * را دارد در پنل گردانوس (`gardanos-panel`) تعریف می‌شود، نه اینجا. این فایل فقط
 * می‌گوید «هر امکان کدام مسیرها را می‌بندد».
 *
 * قاعده‌ها:
 * - مسیری که به هیچ امکانی نخورد **هسته** است و هرگز با لایسنس بسته نمی‌شود.
 * - طولانی‌ترین پیشوند برنده است؛ `feature: null` یعنی «این زیرمسیر هسته است»
 *   (مثل کد تخفیف زیر باشگاه).
 * - مرز مجوز کارمند جداست (`lib/admin-sections.ts`)؛ اینجا فقط بسته.
 *
 * ⚠️ این فایل Prisma ایمپورت نمی‌کند؛ سایدبار در مرورگر هم از آن استفاده می‌کند.
 * ⚠️ کلید تازه = ردیف در `features.json` پنل گردانوس (`npx tsx scripts/plan/features-json.ts`).
 */

export type FeatureKey =
  | "club"
  | "marketing"
  | "ai"
  | "integration"
  | "accounting"
  | "variants"
  | "worklist"
  | "business-tools"
  | "team"
  | "seo-tasks"
  | "activity-reports"
  | "hesaban";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  /** شرح کوتاه برای صفحه‌ی «بسته‌ی من» و پنل گردانوس */
  description: string;
}

export const FEATURES: FeatureDef[] = [
  { key: "club", label: "باشگاه مشتریان و ربات بله", description: "امتیاز، سطح، کمپین پیامکی، معرفی دوست و ربات بله" },
  { key: "marketing", label: "ابزارهای کمپین و آمار", description: "لینک کوتاه، کیوآر، لندینگ‌ساز، پاپ‌آپ، سبد رهاشده، آمار بازدید و فروش" },
  { key: "ai", label: "هوش مصنوعی", description: "دستیار چت سایت، متن و تصویر محصول" },
  { key: "integration", label: "نگاشت بازارگاه‌ها", description: "باسلام، اسنپ‌شاپ، تپسی‌شاپ، ترب و همگام‌سازی موجودی و قیمت" },
  { key: "accounting", label: "حسابداری و انبار", description: "سند، انبار، فاکتور، چک، صندوق و گزارش‌ها" },
  { key: "variants", label: "تنوع رنگ و سایز", description: "قیمت و موجودی هر رنگ و سایز در فروشگاه" },
  { key: "worklist", label: "کارتابل", description: "کار، تماس، معامله، خرید اعتباری و تأمین‌کننده" },
  { key: "business-tools", label: "ابزارهای مدیریت کسب‌وکار", description: "ماشین‌حساب قیمت، نقطه‌ی سربه‌سر، اقساط، تورم، سرمایه‌ی انبار و …" },
  { key: "team", label: "مدیریت تیم", description: "حضور کارکنان، سود و پورسانت، تسویه، امتیاز عملکرد و گزارش تیم" },
  { key: "seo-tasks", label: "کار سئو و محتوا", description: "کار سئو، گردش کار محتوا و کمپین لینک‌سازی" },
  { key: "activity-reports", label: "گزارش عملکرد ادمین", description: "ثبت همه‌ی تغییرات پنل با نمایش قبل و بعد" },
  { key: "hesaban", label: "اتصال حسابان وب", description: "ارسال سفارش و همگام‌سازی با حسابان" },
];

export const FEATURE_KEYS = FEATURES.map((f) => f.key);

export const FEATURE_LABELS = Object.fromEntries(FEATURES.map((f) => [f.key, f.label])) as Record<FeatureKey, string>;

/** پیشوند مسیر ← امکان؛ `null` یعنی هسته */
const PATHS: [string, FeatureKey | null][] = [
  // باشگاه — کد تخفیف هسته است (همه‌ی بسته‌ها کد تخفیف دارند)
  ["/admin/club", "club"],
  ["/api/admin/club", "club"],
  ["/admin/club/coupons", null],
  ["/api/admin/club/coupons", null],
  ["/admin/integration/bale-bot", "club"],
  ["/api/integration/bale-bot", "club"],

  // ابزارها: کمپین و آمار در «رشد»، ابزارهای محاسبه در «حرفه‌ای»
  ["/admin/tools", "marketing"],
  ["/api/admin/tools", "marketing"],
  ["/admin/worklist/analytics", "marketing"],
  ["/api/admin/worklist/analytics", "marketing"],
  ...(
    [
      "ad-roi", "break-even", "compare", "discount", "employee-cost", "free-shipping",
      "inflation", "installment", "ltv", "price-calc", "reorder", "stock-capital",
    ].map((t) => [`/admin/tools/${t}`, "business-tools"] as [string, FeatureKey])
  ),

  // هوش مصنوعی
  ["/api/admin/ai-text", "ai"],
  ["/api/admin/ai-image", "ai"],
  ["/admin/ai-settings", "ai"],
  ["/api/admin/ai-settings", "ai"],

  // نگاشت و حسابان
  ["/admin/integration", "integration"],
  ["/api/integration", "integration"],
  ["/api/integration/hesaban", "hesaban"],
  // کارگر و وب‌هوک‌ها احراز جدا دارند و نباید با لایسنس قطع شوند
  ["/api/integration/worker", null],
  ["/api/integration/webhooks", null],

  ["/admin/accounting", "accounting"],
  ["/api/admin/accounting", "accounting"],

  // کارتابل — نقش‌ها، سفارش تلفنی و ضربان/صندوق پیام هسته‌اند
  ["/admin/worklist", "worklist"],
  ["/api/admin/worklist", "worklist"],
  ["/admin/worklist/roles", null],
  ["/api/admin/worklist/roles", null],
  ["/admin/worklist/phone-order", null],
  ["/api/admin/worklist/heartbeat", null],
  ["/api/admin/worklist/inbox", null],
  ["/api/admin/worklist/staff", null],

  // مدیریت تیم
  ...(
    ["attendance", "payouts", "score", "reports"].map((p) => [`/admin/worklist/${p}`, "team"] as [string, FeatureKey])
  ),
  ...(
    ["attendance", "commission", "payouts", "score"].map((p) => [`/api/admin/worklist/${p}`, "team"] as [string, FeatureKey])
  ),

  // سئو و محتوا
  ...(
    ["seo", "content", "links"].flatMap((p) => [
      [`/admin/worklist/${p}`, "seo-tasks"],
      [`/api/admin/worklist/${p}`, "seo-tasks"],
    ] as [string, FeatureKey][])
  ),

  ["/admin/reports", "activity-reports"],
  ["/api/admin/reports/activity", "activity-reports"],
  ["/api/admin/reports/timeline", "activity-reports"],
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** امکانِ یک مسیر؛ `null` یعنی هسته (همیشه باز) */
export function featureForPath(pathname: string): FeatureKey | null {
  let best: FeatureKey | null = null;
  let bestLen = -1;
  for (const [prefix, feature] of PATHS) {
    if (matches(pathname, prefix) && prefix.length > bestLen) {
      best = feature;
      bestLen = prefix.length;
    }
  }
  return best;
}

/**
 * امکان‌هایی که پنل الان باز دارد — شکل سبکِ وضعیت لایسنس برای مرورگر و proxy.
 * `"*"` یعنی همه (بدون لایسنس یا بسته‌ی نامحدود).
 */
export type PanelFeatures = "*" | FeatureKey[];

export function pathAllowedByPlan(pathname: string, features: PanelFeatures): boolean {
  if (features === "*") return true;
  const f = featureForPath(pathname);
  return f === null || features.includes(f);
}
