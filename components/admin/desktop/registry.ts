/**
 * فهرست «اپ»های پیشخوان دسکتاپی — هر بخش پنل یک آیکن، در دسته‌ها.
 *
 * آیکن‌ها Fluent Emoji سه‌بعدی (MIT) هستند که محلی در
 * `public/panel-icons/fluent/*.webp` نشسته‌اند؛ هیچ آیکنی از بیرون لود نمی‌شود.
 * آیکن تازه: نامش را با `fx("...")` اینجا بنویسید (نام پوشه در مخزن
 * fluentui-emoji) و `node scripts/desktop-icons.mjs <مسیر مخزن>` را اجرا کنید.
 *
 * فیلتر دسترسی سمت سرور است (`app/admin/page.tsx`)؛ اپی که کاربر مجوزش را
 * ندارد یا در بسته‌اش نیست اصلاً به مرورگر نمی‌رسد.
 *
 * مستندات: docs/features/admin-desktop.md
 */

/** مسیر آیکن محلی از نام Fluent — اسکریپت کپی همین الگو را می‌خواند */
export const fx = (name: string) =>
  `/panel-icons/fluent/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.webp`;

/** شمارنده‌هایی که روی آیکن به شکل نشان قرمز می‌نشینند — `page.tsx` پرشان می‌کند */
export type BadgeKey = "orders" | "comments" | "callbacks" | "guaranty" | "transfers";

export interface DesktopApp {
  href: string;
  label: string;
  icon: string;
  badge?: BadgeKey;
  /** کلمه‌های اضافه برای جستجو */
  keywords?: string;
}

export interface DesktopCategory {
  key: string;
  label: string;
  hint: string;
  icon: string;
  /** رنگ نوار عنوان پنجره — کلید `--dk-*` در desktop.css */
  tone: "blue" | "emerald" | "amber" | "violet" | "rose" | "cyan" | "orange" | "slate" | "indigo" | "teal" | "fuchsia" | "lime";
  apps: DesktopApp[];
}

export const DESKTOP_CATEGORIES: DesktopCategory[] = [
  {
    key: "sales", label: "فروش و سفارش‌ها", hint: "سفارش، صندوق، ارسال و پس از فروش",
    icon: fx("Shopping bags"), tone: "blue",
    apps: [
      { href: "/admin/orders", label: "سفارش‌ها", icon: fx("Shopping bags"), badge: "orders" },
      { href: "/admin/worklist/phone-order", label: "سفارش تلفنی", icon: fx("Telephone receiver") },
      { href: "/admin/accounting/pos", label: "صندوق فروشگاه", icon: fx("Convenience store"), keywords: "pos" },
      { href: "/admin/accounting/price-check", label: "چک کردن قیمت", icon: fx("Magnifying glass tilted left"), keywords: "کیوسک قیمت بارکد" },
      { href: "/admin/accounting/sales", label: "فاکتور فروش", icon: fx("Receipt") },
      { href: "/admin/accounting/invoices/new", label: "فاکتور تازه", icon: fx("Page facing up") },
      { href: "/admin/shipping", label: "ارسال و پرداخت", icon: fx("Delivery truck") },
      { href: "/admin/wallet", label: "کیف پول مشتری", icon: fx("Purse") },
      { href: "/admin/guaranty", label: "گارانتی", icon: fx("Shield") },
      { href: "/admin/guaranty/requests", label: "درخواست گارانتی", icon: fx("Hammer and wrench"), badge: "guaranty" },
      { href: "/admin/callback-requests", label: "درخواست تماس", icon: fx("Telephone"), badge: "callbacks" },
      { href: "/admin/tools/cart-recovery", label: "سبد رهاشده", icon: fx("Shopping cart") },
    ],
  },
  {
    key: "catalog", label: "محصولات و کاتالوگ", hint: "محصول، دسته، برند و ویرایش گروهی",
    icon: fx("Package"), tone: "amber",
    apps: [
      { href: "/admin/products", label: "محصولات", icon: fx("Package") },
      { href: "/admin/products/create", label: "محصول جدید", icon: fx("Wrapped gift") },
      { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: fx("File folder") },
      { href: "/admin/brands", label: "برندها", icon: fx("Gem stone") },
      { href: "/admin/spec-groups", label: "گروه مشخصات", icon: fx("Clipboard") },
      { href: "/admin/attribute-groups", label: "گروه ویژگی‌ها", icon: fx("Puzzle piece") },
      { href: "/admin/products/bulk-price", label: "قیمت گروهی", icon: fx("Heavy dollar sign") },
      { href: "/admin/products/bulk-stock", label: "موجودی گروهی", icon: fx("Card file box") },
      { href: "/admin/products/bulk-edit", label: "ویرایش گروهی", icon: fx("Pencil") },
      { href: "/admin/products/ai-text", label: "متن با هوش مصنوعی", icon: fx("Sparkles") },
      { href: "/admin/media", label: "کتابخانه رسانه", icon: fx("Framed picture") },
    ],
  },
  {
    key: "inventory", label: "انبار و کالا", hint: "کالا، انبار، حواله، انبارگردانی و برچسب",
    icon: fx("File cabinet"), tone: "orange",
    apps: [
      { href: "/admin/accounting/inventory", label: "کالا و انبار", icon: fx("File cabinet") },
      { href: "/admin/accounting/inventory/quick", label: "ورود سریع کالا", icon: fx("High voltage") },
      { href: "/admin/accounting/inventory/warehouses", label: "انبارها", icon: fx("Department store") },
      { href: "/admin/accounting/inventory/transfers", label: "حواله‌ها", icon: fx("Left-right arrow"), badge: "transfers", keywords: "در راه تأیید دریافت" },
      { href: "/admin/accounting/inventory/adjustments", label: "ورود و خروج دستی", icon: fx("Up-down arrow") },
      { href: "/admin/accounting/inventory/counts", label: "انبارگردانی", icon: fx("Abacus") },
      { href: "/admin/accounting/inventory/places", label: "مکان کالا", icon: fx("World map"), keywords: "قفسه ردیف طبقه منطقه جای کالا چیدمان" },
      { href: "/admin/accounting/inventory/groups", label: "گروه کالا", icon: fx("Card index dividers") },
      { href: "/admin/accounting/inventory/coding", label: "کدگذاری", icon: fx("Input numbers") },
      { href: "/admin/accounting/inventory/relabel", label: "برچسب بارکد", icon: fx("Label") },
      { href: "/admin/accounting/inventory/to-product", label: "ساخت محصول از کالا", icon: fx("Magic wand") },
      { href: "/admin/accounting/inventory/prices", label: "قیمت فروشگاه", icon: fx("Chart increasing"), keywords: "افزایش قیمت گروهی اکسل تاریخچه تغییر قیمت اتیکت" },
      { href: "/admin/accounting/inventory/online-prices", label: "قیمت فروش آنلاین", icon: fx("Globe with meridians") },
      { href: "/admin/accounting/inventory/opening", label: "موجودی اول دوره", icon: fx("Inbox tray") },
      { href: "/admin/tools/reorder", label: "نقطه‌ی سفارش", icon: fx("Hourglass not done") },
      { href: "/admin/tools/stock-capital", label: "سرمایه‌ی انبار", icon: fx("Coin") },
      { href: "/admin/tools/stock-alerts", label: "خبرم کن", icon: fx("Bell") },
    ],
  },
  {
    key: "accounting", label: "حسابداری", hint: "خرید، دریافت و پرداخت، چک، هزینه و اسناد",
    icon: fx("Ledger"), tone: "emerald",
    apps: [
      { href: "/admin/accounting", label: "خانه‌ی حسابداری", icon: fx("Ledger") },
      { href: "/admin/accounting/purchases", label: "خرید", icon: fx("Shopping cart"), keywords: "فاکتور خرید" },
      { href: "/admin/accounting/money", label: "دریافت و پرداخت", icon: fx("Currency exchange") },
      { href: "/admin/accounting/cheques", label: "چک‌ها", icon: fx("Fountain pen") },
      { href: "/admin/accounting/expenses", label: "هزینه‌ها", icon: fx("Money with wings") },
      { href: "/admin/accounting/expenses?kind=INCOME", label: "درآمدها", icon: fx("Money bag") },
      { href: "/admin/accounting/installments", label: "اقساط", icon: fx("Spiral calendar") },
      { href: "/admin/accounting/calendar", label: "تقویم سررسید", icon: fx("Tear-off calendar") },
      { href: "/admin/accounting/parties", label: "اشخاص", icon: fx("Busts in silhouette") },
      { href: "/admin/accounting/treasury", label: "صندوق و بانک", icon: fx("Bank") },
      { href: "/admin/accounting/vouchers", label: "اسناد", icon: fx("Notebook") },
      { href: "/admin/accounting/accounts", label: "سرفصل حساب‌ها", icon: fx("Books") },
      { href: "/admin/accounting/events", label: "رویدادهای مالی", icon: fx("Satellite antenna") },
      { href: "/admin/accounting/import", label: "ورود از اکسل", icon: fx("Green book") },
      { href: "/admin/accounting/settings", label: "تنظیمات حسابداری", icon: fx("Control knobs") },
      { href: "/admin/accounting/settings?tab=years", label: "بستن سال مالی", icon: fx("Locked") },
    ],
  },
  {
    key: "reports", label: "گزارش‌ها", hint: "سود و زیان، تحلیل فروش، تراز و عملکرد",
    icon: fx("Bar chart"), tone: "violet",
    apps: [
      { href: "/admin/reports", label: "گزارش عملکرد ادمین", icon: fx("Bullseye") },
      { href: "/admin/accounting/reports", label: "همه‌ی گزارش‌ها", icon: fx("Bar chart") },
      { href: "/admin/accounting/reports/pl", label: "سود و زیان", icon: fx("Chart increasing") },
      { href: "/admin/accounting/reports/balance", label: "ترازنامه", icon: fx("Balance scale") },
      { href: "/admin/accounting/reports/trial", label: "تراز آزمایشی", icon: fx("Straight ruler") },
      { href: "/admin/accounting/reports/sales", label: "تحلیل فروش کالا", icon: fx("Magnifying glass tilted left") },
      { href: "/admin/accounting/reports/movers", label: "راکد و پرفروش", icon: fx("Fire") },
      { href: "/admin/accounting/reports/profit", label: "سود کالا و کانال", icon: fx("Trophy") },
      { href: "/admin/accounting/reports/trend", label: "روند ماهانه", icon: fx("Chart decreasing") },
      { href: "/admin/accounting/reports/parties", label: "حساب اشخاص", icon: fx("Card index") },
      { href: "/admin/accounting/reports/aging", label: "سنی بدهی", icon: fx("Hourglass done") },
      { href: "/admin/accounting/reports/treasury", label: "گردش صندوق و بانک", icon: fx("Dollar banknote") },
      { href: "/admin/accounting/reports/inventory", label: "ارزش موجودی", icon: fx("Gem stone") },
      { href: "/admin/accounting/reports/expenses", label: "گزارش هزینه‌ها", icon: fx("Receipt") },
      { href: "/admin/accounting/reports/vat", label: "ارزش افزوده", icon: fx("Classical building") },
    ],
  },
  {
    key: "customers", label: "مشتریان و باشگاه", hint: "کاربران، باشگاه، تخفیف، نظرات و گفتگو",
    icon: fx("Crown"), tone: "rose",
    apps: [
      { href: "/admin/users", label: "کاربران", icon: fx("Bust in silhouette") },
      { href: "/admin/club/members", label: "اعضای باشگاه", icon: fx("Crown") },
      { href: "/admin/club/tiers", label: "سطوح عضویت", icon: fx("1st place medal") },
      { href: "/admin/club/coupons", label: "کدهای تخفیف", icon: fx("Ticket") },
      { href: "/admin/club/campaigns", label: "کمپین‌ها", icon: fx("Megaphone") },
      { href: "/admin/club/templates", label: "قالب پیامک", icon: fx("Memo") },
      { href: "/admin/club/qr", label: "QR عضویت", icon: fx("Mobile phone") },
      { href: "/admin/club/bale", label: "ربات بله باشگاه", icon: fx("Robot") },
      { href: "/admin/club/sms-log", label: "گزارش ارسال", icon: fx("Outbox tray") },
      { href: "/admin/club/settings", label: "تنظیمات باشگاه", icon: fx("Ribbon") },
      { href: "/admin/comments", label: "نظرات", icon: fx("Speech balloon"), badge: "comments" },
      { href: "/admin/chat-history", label: "تاریخچه چت", icon: fx("Left speech bubble") },
    ],
  },
  {
    key: "worklist", label: "کارتابل و تیم", hint: "کار، تماس، حضور، پورسانت و نقش‌ها",
    icon: fx("Briefcase"), tone: "indigo",
    apps: [
      { href: "/admin/worklist", label: "کارهای من", icon: fx("Briefcase") },
      { href: "/admin/worklist/calls", label: "تماس‌ها", icon: fx("Mobile phone with arrow") },
      { href: "/admin/club/members?owner=me", label: "مشتریان من", icon: fx("People hugging") },
      { href: "/admin/worklist/orders", label: "سفارش‌های من", icon: fx("Takeout box") },
      { href: "/admin/worklist/credit", label: "موعدهای پرداخت", icon: fx("Alarm clock") },
      { href: "/admin/worklist/tasks", label: "همه‌ی کارها", icon: fx("Check box with check") },
      { href: "/admin/worklist/seo", label: "کارهای سئو", icon: fx("Magnifying glass tilted right") },
      { href: "/admin/worklist/content", label: "کارهای محتوا", icon: fx("Writing hand") },
      { href: "/admin/worklist/links", label: "لینک‌سازی", icon: fx("Link") },
      { href: "/admin/worklist/analytics", label: "آمار بازدید", icon: fx("Eyes") },
      { href: "/admin/worklist/attendance", label: "حضور", icon: fx("Stopwatch") },
      { href: "/admin/worklist/deals", label: "سود معاملات", icon: fx("Handshake") },
      { href: "/admin/worklist/payouts", label: "پورسانت", icon: fx("Money-mouth face") },
      { href: "/admin/worklist/notes", label: "یادداشت‌های من", icon: fx("Spiral notepad") },
      { href: "/admin/worklist/reports", label: "عملکرد تیم", icon: fx("Sports medal") },
      { href: "/admin/worklist/score", label: "امتیاز عملکرد", icon: fx("Glowing star") },
      { href: "/admin/worklist/suppliers", label: "تأمین‌کننده‌ها", icon: fx("Factory") },
      { href: "/admin/worklist/settings", label: "تنظیمات کارتابل", icon: fx("Nut and bolt") },
      { href: "/admin/worklist/roles", label: "نقش‌ها و دسترسی", icon: fx("Key") },
    ],
  },
  {
    key: "marketing", label: "بازاریابی و ابزارها", hint: "لندینگ، کیوآر، لینک کوتاه و ماشین‌حساب‌ها",
    icon: fx("Toolbox"), tone: "fuchsia",
    apps: [
      { href: "/admin/tools", label: "همه‌ی ابزارها", icon: fx("Toolbox") },
      { href: "/admin/tools/landings", label: "لندینگ‌ساز", icon: fx("Rocket") },
      { href: "/admin/tools/qr", label: "کیوآر کد", icon: fx("Camera with flash") },
      { href: "/admin/tools/links", label: "لینک کوتاه", icon: fx("Linked paperclips") },
      { href: "/admin/tools/reviews", label: "درخواست نظر", icon: fx("Star") },
      { href: "/admin/tools/popups", label: "پاپ‌آپ", icon: fx("Party popper") },
      { href: "/admin/tools/text-counter", label: "کاراکترشمار", icon: fx("Input latin letters") },
      { href: "/admin/tools/price-calc", label: "ماشین‌حساب قیمت", icon: fx("Triangular ruler") },
      { href: "/admin/tools/break-even", label: "نقطه‌ی سربه‌سر", icon: fx("Heavy equals sign") },
      { href: "/admin/tools/ad-roi", label: "ROI تبلیغات", icon: fx("Loudspeaker") },
      { href: "/admin/tools/funnel", label: "قیف فروش", icon: fx("Alembic") },
      { href: "/admin/tools/discount", label: "تخفیف و حراج", icon: fx("Japanese bargain button") },
      { href: "/admin/tools/inflation", label: "قیمت با تورم", icon: fx("Thermometer") },
      { href: "/admin/tools/free-shipping", label: "ارسال رایگان", icon: fx("Free button") },
      { href: "/admin/tools/installment", label: "فروش اقساطی", icon: fx("Credit card") },
      { href: "/admin/tools/ltv", label: "ارزش مشتری", icon: fx("Heart with ribbon") },
      { href: "/admin/tools/employee-cost", label: "هزینه‌ی کارمند", icon: fx("Office worker") },
      { href: "/admin/tools/compare", label: "مقایسه‌ی محصولات", icon: fx("Vs button") },
    ],
  },
  {
    key: "sms", label: "پیامک", hint: "ارسال، پترن، دفترچه و اعتبار",
    icon: fx("Envelope with arrow"), tone: "cyan",
    apps: [
      { href: "/admin/sms", label: "پنل پیامک", icon: fx("Envelope with arrow") },
      { href: "/admin/sms/send", label: "ارسال پیامک", icon: fx("Incoming envelope") },
      { href: "/admin/sms/patterns", label: "پترن‌ها", icon: fx("Page with curl") },
      { href: "/admin/sms/phonebook", label: "دفترچه تلفن", icon: fx("Closed book") },
      { href: "/admin/sms/reports", label: "گزارش ارسال", icon: fx("Bookmark tabs") },
      { href: "/admin/sms/inbox", label: "پیام‌های دریافتی", icon: fx("Open mailbox with raised flag") },
      { href: "/admin/sms/wallet", label: "خرید اعتبار", icon: fx("Yen banknote") },
      { href: "/admin/sms/advanced", label: "امکانات ویژه", icon: fx("Dizzy") },
    ],
  },
  {
    key: "integration", label: "یکپارچه‌سازی", hint: "بازارگاه‌ها، نگاشت، قیمت و موجودی",
    icon: fx("Electric plug"), tone: "teal",
    apps: [
      { href: "/admin/integration", label: "داشبورد اتصال", icon: fx("Electric plug") },
      { href: "/admin/integration/connections", label: "اتصالات", icon: fx("Chains") },
      { href: "/admin/integration/mapping", label: "نگاشت محصولات", icon: fx("World map") },
      { href: "/admin/integration/orders", label: "سفارش بازارگاه", icon: fx("Basket") },
      { href: "/admin/integration/messages", label: "پیام بازارگاه", icon: fx("E-mail") },
      { href: "/admin/integration/product-suggestions", label: "پیشنهاد محصول", icon: fx("Light bulb") },
      { href: "/admin/integration/price-rules", label: "قوانین قیمت", icon: fx("Scroll") },
      { href: "/admin/integration/pricing", label: "قیمت خرید", icon: fx("Pound banknote") },
      { href: "/admin/integration/discounts", label: "تخفیف بازارگاه", icon: fx("Japanese discount button") },
      { href: "/admin/integration/inventory", label: "موجودی بازارگاه", icon: fx("Wood") },
      { href: "/admin/integration/bale-bot", label: "ربات بله", icon: fx("Robot") },
      { href: "/admin/integration/queue", label: "صف عملیات", icon: fx("Repeat button") },
      { href: "/admin/integration/logs", label: "لاگ‌ها", icon: fx("Rolled-up newspaper") },
    ],
  },
  {
    key: "content", label: "محتوا و ظاهر سایت", hint: "مجله، برگه، صفحه‌ی اصلی، منو و ظاهر",
    icon: fx("Artist palette"), tone: "lime",
    apps: [
      { href: "/admin/blog", label: "مجله", icon: fx("Newspaper") },
      { href: "/admin/blog/create", label: "مطلب جدید", icon: fx("Black nib") },
      { href: "/admin/blog/categories", label: "دسته‌ی مطالب", icon: fx("Open file folder") },
      { href: "/admin/pages", label: "برگه‌ها", icon: fx("Bookmark") },
      { href: "/admin/widgets", label: "صفحه‌ی اصلی", icon: fx("House with garden") },
      { href: "/admin/hero-slides", label: "اسلایدر", icon: fx("Film frames") },
      { href: "/admin/stories", label: "استوری‌ها", icon: fx("Movie camera") },
      { href: "/admin/menu", label: "منوی هدر", icon: fx("Triangular flag") },
      { href: "/admin/footer", label: "فوتر", icon: fx("Footprints") },
      { href: "/admin/appearance", label: "ظاهر سایت", icon: fx("Artist palette") },
    ],
  },
  {
    key: "seo", label: "سئو", hint: "ریدایرکت، ۴۰۴ و صفحات فرود",
    icon: fx("Telescope"), tone: "slate",
    apps: [
      { href: "/admin/seo/redirects", label: "ریدایرکت‌ها", icon: fx("Right arrow curving left") },
      { href: "/admin/seo/not-found", label: "گزارش ۴۰۴", icon: fx("Warning") },
      { href: "/admin/landing-pages", label: "صفحات فرود", icon: fx("Telescope") },
    ],
  },
  {
    key: "system", label: "تنظیمات و سیستم", hint: "سایت، ادمین‌ها، هوش مصنوعی و بسته",
    icon: fx("Gear"), tone: "slate",
    apps: [
      { href: "/admin/site-settings", label: "تنظیمات سایت", icon: fx("Gear") },
      { href: "/admin/admins", label: "ادمین‌ها", icon: fx("Locked with key") },
      { href: "/admin/ai-settings", label: "هوش مصنوعی", icon: fx("Brain") },
      { href: "/admin/chat-settings", label: "تنظیمات چت", icon: fx("Thought balloon") },
      { href: "/admin/plan", label: "بسته‌ی من", icon: fx("Identification card") },
      { href: "/admin/changelog", label: "نسخه برنامه", icon: fx("Shooting star") },
    ],
  },
];

/** داک پیش‌فرض — تا کاربر خودش سنجاق نکرده (کلید localStorage: admin:dock) */
export const DEFAULT_DOCK = [
  "/admin/orders",
  "/admin/products",
  "/admin/accounting/pos",
  "/admin/worklist/phone-order",
  "/admin/accounting",
  "/admin/accounting/reports",
  "/admin/worklist",
  "/admin/site-settings",
];
