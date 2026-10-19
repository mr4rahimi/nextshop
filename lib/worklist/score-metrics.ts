/**
 * تعریف معیارهای امتیاز عملکرد — docs/features/staff-worklist.md بخش ۱۵.
 *
 * ⚠️ **تعریف در کد، وزن در دیتابیس.** فرمول، جهت و برچسب هر معیار فقط
 * همین‌جاست؛ مدیر از پنل فقط وزن و فعال/غیرفعال را عوض می‌کند
 * (`StaffScoreMetric`). اگر تعریف هم قابل ویرایش بود، عدد ماه گذشته قابل
 * بازتولید نبود.
 *
 * این فایل Prisma وارد نمی‌کند تا کلاینت هم برچسب‌ها را از همین‌جا بخواند.
 */

export type ScoreGroup = "SALES" | "OPERATIONS" | "CONTENT";

export const SCORE_GROUPS: ScoreGroup[] = ["SALES", "OPERATIONS", "CONTENT"];

export const SCORE_GROUP_LABELS: Record<ScoreGroup, string> = {
  SALES: "فروش",
  OPERATIONS: "عملیات",
  CONTENT: "محتوا و سئو",
};

export const SCORE_GROUP_HINTS: Record<ScoreGroup, string> = {
  SALES: "تماس فروش، سفارش تلفنی، پیگیری مشتری",
  OPERATIONS: "تأمین کالا، ارسال، مالی، پشتیبانی",
  CONTENT: "محتوا، سئو، محصول‌گذاری",
};

export interface MetricDef {
  code: string;
  label: string;
  /** یک خط برای صفحه‌ی تنظیمات و ریز امتیاز — منبع داده را صادقانه بگوید */
  hint: string;
  /** ۱ = بیشتر بهتر، ‎-1 = کمتر بهتر */
  direction: 1 | -1;
  /** `rate` = صورت و مخرج دارد؛ مخرج صفر یعنی «برای این نفر صدق نمی‌کند» */
  kind: "count" | "rate";
  /** بر روزهای حضور تقسیم می‌شود — فقط وقتی حضور همه‌ی گروه موجود باشد */
  perDay?: boolean;
  /** جزء «حجم کار» برای کف واجد شرایط بودن */
  volume?: boolean;
  /** گروه‌هایی که این معیار را دارند و وزن پیش‌فرض هر کدام */
  defaults: Partial<Record<ScoreGroup, number>>;
}

export const SCORE_METRICS: MetricDef[] = [
  // ── مشترک ─────────────────────────────────────────────────────
  {
    code: "TASK_DONE",
    label: "کار بسته‌شده",
    hint: "کارهای کارتابل که در این ماه بسته شده، ضرب در وزن نوع کار",
    direction: 1,
    kind: "count",
    perDay: true,
    volume: true,
    defaults: { SALES: 15, OPERATIONS: 30, CONTENT: 10 },
  },
  {
    code: "TASK_ONTIME",
    label: "بسته‌شدن به‌موقع",
    hint: "از کارهایی که مهلتشان در این ماه بود، چندتا پیش از مهلت بسته شد",
    direction: 1,
    kind: "rate",
    defaults: { SALES: 15, OPERATIONS: 25, CONTENT: 10 },
  },
  {
    code: "TASK_OUTCOME",
    label: "ثبت نتیجه",
    hint: "از کارهای بسته‌شده‌ای که نوعشان نتیجه دارد، چندتا نتیجه خورد",
    direction: 1,
    kind: "rate",
    defaults: { SALES: 10, OPERATIONS: 10, CONTENT: 5 },
  },
  {
    code: "TASK_DOC",
    label: "مستندسازی",
    hint: "کارهای متمایزی که رویشان یادداشت یا ارجاع ثبت کرد — ده یادداشت روی یک کار یکی است",
    direction: 1,
    kind: "count",
    defaults: { SALES: 5, OPERATIONS: 10, CONTENT: 5 },
  },
  {
    code: "SYSTEM_WORK",
    label: "کار خودکار",
    hint: "ثبت محصول، ویرایش قیمت، مقاله و رسانه از دفتر فعالیت، ضرب در وزن همان نوع کار",
    direction: 1,
    kind: "count",
    perDay: true,
    volume: true,
    defaults: { OPERATIONS: 25, CONTENT: 15 },
  },

  // ── فروش ──────────────────────────────────────────────────────
  {
    code: "SALES_DEALS",
    label: "فروش ثبت‌شده",
    hint: "تعداد معامله‌های این ماه به نام او، به‌جز لغوشده — تعداد، نه مبلغ",
    direction: 1,
    kind: "count",
    perDay: true,
    volume: true,
    defaults: { SALES: 25 },
  },
  {
    code: "SALES_CONVERSION",
    label: "تبدیل تماس به سفارش",
    hint: "از مشتری‌های متمایزی که با آن‌ها تماس فروش داشت، چندتا در پنجره‌ی تعیین‌شده سفارش پرداخت‌شده دادند",
    direction: 1,
    kind: "rate",
    defaults: { SALES: 20 },
  },
  {
    code: "SALES_VOID",
    label: "لغو و مرجوعی",
    hint: "سهم معامله‌های لغو یا مرجوع‌شده از کل معامله‌های ماه",
    direction: -1,
    kind: "rate",
    defaults: { SALES: 5 },
  },
  {
    code: "CREDIT_ONTIME",
    label: "وصول به‌موقع اعتباری",
    hint: "از موعدهای اعتباری فروش‌های او که در این ماه سررسید شد، چندتا تا روز موعد واریز شد",
    direction: 1,
    kind: "rate",
    defaults: { SALES: 5 },
  },

  // ── محتوا و سئو ───────────────────────────────────────────────
  {
    code: "CONTENT_DONE",
    label: "محتوای تأییدشده",
    hint: "کارهای محتوایی که نویسنده‌شان بود و در این ماه تأیید نهایی شد",
    direction: 1,
    kind: "count",
    perDay: true,
    volume: true,
    defaults: { CONTENT: 20 },
  },
  {
    code: "SEO_DONE",
    label: "کار سئوی تأییدشده",
    hint: "کارهای سئویی که مسئولشان بود و در این ماه تأیید شد",
    direction: 1,
    kind: "count",
    perDay: true,
    volume: true,
    defaults: { CONTENT: 15 },
  },
  {
    code: "MKT_FIRST_PASS",
    label: "تأیید بدون برگشت",
    hint: "از کارهای محتوا و سئوی تأییدشده‌ی این ماه، چندتا یک بار هم برگشت نخورد",
    direction: 1,
    kind: "rate",
    defaults: { CONTENT: 10 },
  },
  {
    code: "MKT_ONTIME",
    label: "تحویل به‌موقع محتوا و سئو",
    hint: "از کارهای تأییدشده‌ی مهلت‌دار، چندتا پیش از مهلت تحویل داده شد",
    direction: 1,
    kind: "rate",
    defaults: { CONTENT: 10 },
  },
];

const BY_CODE = new Map(SCORE_METRICS.map((m) => [m.code, m]));

export function metricDef(code: string): MetricDef | undefined {
  return BY_CODE.get(code);
}

/** معیارهای یک گروه، به ترتیب تعریف */
export function metricsOf(group: ScoreGroup): MetricDef[] {
  return SCORE_METRICS.filter((m) => m.defaults[group] !== undefined);
}

export function isScoreGroup(v: unknown): v is ScoreGroup {
  return v === "SALES" || v === "OPERATIONS" || v === "CONTENT";
}
