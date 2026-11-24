/**
 * بخش‌های یکپارچه‌سازی — فهرست واحد برای قاب، خانه، تنظیمات و پیشخوان.
 *
 * این فایل هیچ وابستگی سمت سرور ندارد تا در کامپوننت‌های مرورگر هم خوانده شود.
 * بخش «هسته» (`core`) خاموش‌شدنی نیست؛ بقیه را کسب‌وکار در
 * «یکپارچه‌سازی ← تنظیمات» خاموش می‌کند (`IntegSettings.hiddenSections`).
 *
 * مستندات: docs/integrations/settings-and-guide.md
 */

export type IntegSectionKey =
  | "home" | "orders" | "messages" | "listing" | "mapping" | "inventory"
  | "pricing" | "priceRules" | "discounts" | "connections" | "baleBot"
  | "queue" | "logs" | "settings" | "guide";

export type IntegGroup = "daily" | "products" | "price" | "setup";

export interface IntegSection {
  key: IntegSectionKey;
  href: string;
  label: string;
  /** یک جمله برای کارت تنظیمات */
  desc: string;
  group: IntegGroup;
  /** خاموش‌شدنی نیست */
  core?: boolean;
  /** فقط وقتی بازارگاهی فعال است معنا دارد */
  needsMarketplace?: boolean;
}

export const INTEG_GROUPS: { key: IntegGroup; label: string; hint: string }[] = [
  { key: "daily", label: "کار روزانه", hint: "سفارش‌ها، پیام‌ها و قرار دادن محصول" },
  { key: "products", label: "محصول و موجودی", hint: "نگاشت محصولات و موجودی مشترک" },
  { key: "price", label: "قیمت و تخفیف", hint: "قیمت خرید، قانون قیمت و تخفیف هر بازارگاه" },
  { key: "setup", label: "اتصال و تنظیمات", hint: "اتصال سرویس‌ها، تنظیمات و ابزار فنی" },
];

export const INTEG_SECTIONS: IntegSection[] = [
  { key: "home", href: "/admin/integration", label: "داشبورد", desc: "وضعیت کانال‌ها و کارهای مانده", group: "setup", core: true },
  { key: "orders", href: "/admin/integration/orders", label: "سفارش بازارگاه", desc: "سفارش‌های رسیده از بازارگاه‌ها و فاکتورشان", group: "daily", core: true, needsMarketplace: true },
  { key: "messages", href: "/admin/integration/messages", label: "پیام بازارگاه", desc: "گفت‌وگو با مشتریان باسلام؛ خاموش‌کردن، دریافت پیام‌ها را هم متوقف می‌کند", group: "daily", needsMarketplace: true },
  { key: "listing", href: "/admin/integration/product-suggestions", label: "قرار دادن محصول", desc: "کدام محصول سایت هنوز در کدام بازارگاه نیست — ساخت خودکار یا راهنمای دستی", group: "daily", core: true, needsMarketplace: true },
  { key: "mapping", href: "/admin/integration/mapping", label: "نگاشت محصولات", desc: "وصل‌کردن هر محصول سایت به همان محصول در بازارگاه و حسابداری", group: "products", core: true },
  { key: "inventory", href: "/admin/integration/inventory", label: "موجودی", desc: "موجودی مشترک محصولات نگاشت‌شده و ارسال آن به بازارگاه‌ها", group: "products", core: true },
  { key: "pricing", href: "/admin/integration/pricing", label: "قیمت خرید", desc: "قیمت خرید هر محصول — پایه‌ی محاسبه‌ی قیمت بازارگاه", group: "price" },
  { key: "priceRules", href: "/admin/integration/price-rules", label: "قوانین قیمت", desc: "کارمزد، ارسال و سود هر بازارگاه برای ساختن قیمت فروش", group: "price" },
  { key: "discounts", href: "/admin/integration/discounts", label: "تخفیف بازارگاه", desc: "تخفیف زمان‌دار جدا برای هر بازارگاه", group: "price", needsMarketplace: true },
  { key: "connections", href: "/admin/integration/connections", label: "اتصالات", desc: "کلید و توکن هر سرویس و آزمایش اتصال", group: "setup", core: true },
  { key: "baleBot", href: "/admin/integration/bale-bot", label: "ربات بله", desc: "کاتالوگ محصولات در پیام‌رسان بله", group: "setup" },
  { key: "queue", href: "/admin/integration/queue", label: "صف عملیات", desc: "کارهای در انتظار و ناموفق — برای پیگیری فنی", group: "setup" },
  { key: "logs", href: "/admin/integration/logs", label: "گزارش عملیات", desc: "ریز هر ارسال و دریافت — برای پیگیری فنی", group: "setup" },
  { key: "settings", href: "/admin/integration/settings", label: "تنظیمات", desc: "سرویس‌های فعال و بخش‌های نمایش‌داده‌شده", group: "setup", core: true },
  { key: "guide", href: "/admin/integration/guide", label: "راهنمای نگاشت", desc: "نگاشت در هر نوع حسابداری، قدم‌به‌قدم", group: "setup", core: true },
];

export const HIDEABLE_SECTIONS = INTEG_SECTIONS.filter((s) => !s.core);

/** پیش‌تنظیم‌ها بر اساس نوع کسب‌وکار — فهرست بخش‌های خاموش */
export const INTEG_PROFILES: { key: string; label: string; desc: string; hidden: IntegSectionKey[] }[] = [
  {
    key: "simple",
    label: "ساده",
    desc: "فروشگاه کوچک: سفارش، نگاشت، موجودی و قرار دادن محصول. قیمت بازارگاه همان قیمت سایت.",
    hidden: ["pricing", "priceRules", "discounts", "baleBot", "queue", "logs"],
  },
  {
    key: "standard",
    label: "استاندارد",
    desc: "فروش چندکاناله: به‌علاوه‌ی پیام مشتری، قیمت خرید، قانون قیمت و تخفیف هر بازارگاه.",
    hidden: ["baleBot", "queue", "logs"],
  },
  {
    key: "full",
    label: "کامل",
    desc: "همه‌ی بخش‌ها، با صف عملیات و گزارش فنی برای پیگیری دقیق.",
    hidden: [],
  },
];

export function sectionForPath(pathname: string): IntegSection | null {
  if (pathname.startsWith("/admin/integration/create-products")) return INTEG_SECTIONS.find((s) => s.key === "listing") ?? null;
  if (pathname.startsWith("/admin/integration/connections")) return INTEG_SECTIONS.find((s) => s.key === "connections") ?? null;
  let best: IntegSection | null = null;
  for (const s of INTEG_SECTIONS) {
    const hit = s.key === "home" ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`);
    if (hit && (!best || s.href.length > best.href.length)) best = s;
  }
  return best;
}

/** پنل فروشندگی هر بازارگاه — برای قرار دادن دستی محصول. خالی = فقط از تنظیمات */
export const SELLER_PANELS: Record<string, string> = {
  basalam: "https://vendor.basalam.com",
  digikala: "https://seller.digikala.com",
};

/** جمع‌بندی کار هر بازارگاه برای صفحه‌ی «قرار دادن محصول» */
export const LISTING_METHOD: Record<string, "auto" | "manual"> = {
  basalam: "auto",
};

/** نام فارسی عملیات برای گزارش‌ها و داشبورد */
export const OP_LABELS: Record<string, string> = {
  TEST_CONNECTION: "آزمایش اتصال",
  SYNC_STOCK: "ارسال موجودی",
  SYNC_PRICE: "ارسال قیمت",
  SYNC_ALL_STOCK: "همگام‌سازی موجودی",
  SYNC_ALL_PRICE: "همگام‌سازی قیمت",
  FETCH_PRODUCTS: "دریافت محصولات",
  FETCH_ORDERS: "دریافت سفارش‌ها",
  FETCH_CHATS: "دریافت پیام‌ها",
  SEND_MESSAGE: "ارسال پیام",
  CREATE_PRODUCT: "ساخت محصول",
  CREATE_INVOICE: "ثبت فاکتور",
};

export const STOCK_SOURCE_LABEL: Record<"internal" | "hesaban" | "site", { title: string; short: string }> = {
  internal: { title: "حسابداری داخلی", short: "موجودی از انبارهای فروش حسابداری پنل" },
  hesaban: { title: "حسابان وب", short: "موجودی و قیمت خرید از حسابان وب" },
  site: { title: "خود سایت", short: "موجودی محصولات سایت؛ قیمت خرید دستی" },
};
