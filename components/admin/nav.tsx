/**
 * پیکربندی ناوبری پنل مدیریت — تنها منبع حقیقت برای سایدبار و نوار مسیر.
 *
 * قبلاً همه‌ی این‌ها داخل `app/admin/layout.tsx` بود و آن فایل هم پیکربندی بود
 * هم کامپوننت. برای افزودن یک آیتم منو فقط همین فایل عوض می‌شود.
 *
 * مستندات: docs/features/admin-sidebar.md
 */

import {
  ArrowDownUp, Blocks, Warehouse, BookOpen, BriefcaseBusiness, Calculator, ChartColumn, ChevronDown, ClipboardList,
  Crown, ExternalLink, FolderOpen, Image, LayoutDashboard, LayoutGrid, ListOrdered, LogOut, Menu,
  MessageCircle, MessageSquare, MessageSquareText, MessagesSquare, Package, Palette, PanelBottom, Plug,
  Rocket, ScrollText, SearchCheck, Settings, ShieldCheck, ShoppingCart, Tag, Truck, Users, Wallet, Wrench,
  type LucideIcon,
} from "lucide-react";
import { TOOLS_APPS, WORKLIST_APPS } from "./apps";

/** یک زیرمنو. `target` فقط برای لینک‌های بیرونی مثل شماره‌گیر است. */
export interface NavChild {
  href: string;
  label: string;
  /** کلید `ICONS` یا یک ایموجی */
  icon?: string;
  target?: string;
}

export interface NavItem {
  href: string;
  label: string;
  /** کلید `ICONS` یا یک ایموجی */
  icon?: string;
  /** فقط وقتی مسیر دقیقاً برابر باشد فعال است — برای «/admin» لازم است */
  exact?: boolean;
  children?: NavChild[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * یک آیکن منو.
 *
 * `name` کلیدی از `ICONS` است (آیکن‌های lucide، هم‌خانواده‌ی کاشی‌های
 * کارتابل و حسابداری). اگر کلید نخورد — مثلاً ایموجی قدیمی — همان متن
 * نشان داده می‌شود تا جای آیکن خالی نماند.
 */
export function Icon({ name, className = "w-4 h-4" }: { name?: string; className?: string }) {
  const I = name ? ICONS[name as keyof typeof ICONS] : undefined;

  if (!I) {
    return (
      <span className={`${className} inline-flex items-center justify-center leading-none`} aria-hidden>
        {name || "•"}
      </span>
    );
  }

  return <I className={className} strokeWidth={1.9} aria-hidden />;
}

export const ICONS = {
  dashboard: LayoutDashboard,
  products: Package,
  categories: FolderOpen,
  brands: Tag,
  specs: ClipboardList,
  orders: ShoppingCart,
  users: Users,
  blog: BookOpen,
  settings: Settings,
  shipping: Truck,
  guaranty: ShieldCheck,
  widgets: LayoutGrid,
  media: Image,
  menu: Menu,
  footer: PanelBottom,
  chevron: ChevronDown,
  external: ExternalLink,
  logout: LogOut,
  wallet: Wallet,
  chat: MessageSquare,
  sms: MessageSquareText,
  appearance: Palette,
  "chat-settings": MessageCircle,
  changelog: Rocket,
  "chat-history": MessagesSquare,
  integration: Blocks,
  plug: Plug,
  mapping: ArrowDownUp,
  price: Calculator,
  queue: ListOrdered,
  reports: ChartColumn,
  logs: ScrollText,
  worklist: BriefcaseBusiness,
  accounting: Calculator,
  club: Crown,
  seo: SearchCheck,
  tools: Wrench,
  inventory: Warehouse,
} satisfies Record<string, LucideIcon>;

/**
 * درخت منو — هم‌ترتیب با دسته‌های پیشخوان (`desktop/registry.ts`) تا کاربر هر
 * بخش را در منو و پیشخوان در یک جا پیدا کند. هر بخش بزرگ (حسابداری، انبار،
 * گزارش‌ها، فروش…) زیرمنوی «موارد اصلی» خودش را دارد؛ فهرست کامل همان بخش در
 * پیشخوان و خانه‌ی خود ماژول است.
 *
 * ⚠️ یک مسیر را در دو آیتم نگذارید: ردیف فعال با طولانی‌ترین مسیرِ منطبق در
 * کل منو پیدا می‌شود و مسیر تکراری دو ردیف را هم‌زمان فعال می‌کند.
 */
export const MENU_GROUPS: NavGroup[] = [
  {
    label: "اصلی",
    items: [
      { href: "/admin", label: "پیشخوان", icon: "dashboard", exact: true },
      {
        // کارتابل — docs/features/staff-worklist.md. از همان فهرست کاشی‌ها
        href: "/admin/worklist", label: "کارتابل", icon: "worklist",
        children: WORKLIST_APPS.filter((a) => a.href !== "/admin/worklist/phone-order").map((a) => ({ href: a.href, label: a.label })),
      },
    ],
  },
  {
    label: "فروش",
    items: [
      {
        href: "/admin/orders", label: "فروش و سفارش‌ها", icon: "orders",
        children: [
          { href: "/admin/orders", label: "سفارش‌ها" },
          { href: "/admin/worklist/phone-order", label: "سفارش تلفنی" },
          { href: "/admin/accounting/pos", label: "صندوق فروشگاه" },
          { href: "/admin/accounting/price-check", label: "چک کردن قیمت" },
          { href: "/admin/shipping", label: "ارسال و پرداخت" },
          { href: "/admin/wallet", label: "کیف پول مشتری" },
          { href: "/admin/callback-requests", label: "درخواست‌های تماس" },
          { href: "/admin/tools/cart-recovery", label: "سبد رهاشده" },
        ],
      },
      {
        href: "/admin/guaranty", label: "گارانتی", icon: "guaranty",
        children: [
          { href: "/admin/guaranty", label: "لیست گارانتی‌ها" },
          { href: "/admin/guaranty/requests", label: "درخواست‌های گارانتی" },
        ],
      },
    ],
  },
  {
    label: "کالا",
    items: [
      {
        href: "/admin/products", label: "محصولات", icon: "products",
        children: [
          { href: "/admin/products", label: "لیست محصولات" },
          { href: "/admin/products/create", label: "محصول جدید" },
          { href: "/admin/categories", label: "دسته‌بندی‌ها" },
          { href: "/admin/brands", label: "برندها" },
          { href: "/admin/spec-groups", label: "گروه مشخصات" },
          { href: "/admin/attribute-groups", label: "گروه ویژگی‌ها" },
          { href: "/admin/products/bulk-price", label: "قیمت گروهی" },
          { href: "/admin/products/bulk-stock", label: "موجودی گروهی" },
          { href: "/admin/products/bulk-edit", label: "ویرایش گروهی" },
          { href: "/admin/products/ai-text", label: "متن با هوش مصنوعی" },
        ],
      },
      {
        href: "/admin/accounting/inventory", label: "انبار", icon: "inventory",
        children: [
          { href: "/admin/accounting/inventory", label: "کالا و انبار" },
          { href: "/admin/accounting/inventory/quick", label: "ورود سریع کالا" },
          { href: "/admin/accounting/inventory/warehouses", label: "انبارها" },
          { href: "/admin/accounting/inventory/transfers", label: "حواله‌ها" },
          { href: "/admin/accounting/inventory/adjustments", label: "ورود و خروج دستی" },
          { href: "/admin/accounting/inventory/counts", label: "انبارگردانی" },
          { href: "/admin/accounting/inventory/places", label: "مکان کالا" },
          { href: "/admin/accounting/inventory/serials", label: "شماره سریال" },
          { href: "/admin/accounting/inventory/relabel", label: "برچسب بارکد" },
          { href: "/admin/accounting/inventory/prices", label: "قیمت فروشگاه" },
          { href: "/admin/accounting/inventory/online-prices", label: "قیمت فروش آنلاین" },
          { href: "/admin/tools/reorder", label: "نقطه‌ی سفارش" },
          { href: "/admin/tools/stock-capital", label: "سرمایه‌ی انبار" },
        ],
      },
    ],
  },
  {
    // حسابداری — docs/plans/accounting.md
    label: "مالی",
    items: [
      {
        href: "/admin/accounting", label: "حسابداری", icon: "accounting",
        children: [
          { href: "/admin/accounting", label: "خانه‌ی حسابداری" },
          { href: "/admin/accounting/sales", label: "فروش و فاکتورها" },
          { href: "/admin/accounting/sales/orders", label: "سفارش فروش" },
          { href: "/admin/accounting/purchases", label: "خرید" },
          { href: "/admin/accounting/purchases/orders", label: "سفارش خرید" },
          { href: "/admin/accounting/money", label: "دریافت و پرداخت" },
          { href: "/admin/accounting/cheques", label: "چک‌ها" },
          { href: "/admin/accounting/expenses", label: "هزینه‌ها و درآمدها" },
          { href: "/admin/accounting/installments", label: "اقساط" },
          { href: "/admin/accounting/calendar", label: "تقویم سررسیدها" },
          { href: "/admin/accounting/parties", label: "اشخاص" },
          { href: "/admin/accounting/treasury", label: "صندوق و بانک" },
          { href: "/admin/accounting/loans", label: "وام و تسهیلات" },
          { href: "/admin/accounting/vouchers", label: "اسناد" },
          { href: "/admin/accounting/accounts", label: "سرفصل حساب‌ها" },
          { href: "/admin/accounting/events", label: "رویدادهای مالی" },
          { href: "/admin/accounting/import", label: "ورود از اکسل" },
          { href: "/admin/accounting/settings", label: "تنظیمات حسابداری" },
        ],
      },
      {
        href: "/admin/accounting/reports", label: "گزارش‌ها", icon: "reports",
        children: [
          { href: "/admin/accounting/reports", label: "همه‌ی گزارش‌ها" },
          { href: "/admin/reports", label: "عملکرد ادمین‌ها" },
          { href: "/admin/accounting/reports/pl", label: "سود و زیان" },
          { href: "/admin/accounting/reports/balance", label: "ترازنامه" },
          { href: "/admin/accounting/reports/trial", label: "تراز آزمایشی" },
          { href: "/admin/accounting/reports/sales", label: "تحلیل فروش کالا" },
          { href: "/admin/accounting/reports/purchases", label: "تحلیل خرید کالا" },
          { href: "/admin/accounting/reports/movers", label: "راکد و پرفروش" },
          { href: "/admin/accounting/reports/profit", label: "سود کالا و کانال" },
          { href: "/admin/accounting/reports/trend", label: "روند ماهانه" },
          { href: "/admin/accounting/reports/parties", label: "حساب اشخاص" },
          { href: "/admin/accounting/reports/aging", label: "سنی بدهی" },
          { href: "/admin/accounting/reports/treasury", label: "گردش صندوق و بانک" },
          { href: "/admin/accounting/reports/inventory", label: "ارزش موجودی" },
          { href: "/admin/accounting/reports/vat", label: "ارزش افزوده" },
        ],
      },
    ],
  },
  {
    label: "مشتریان",
    items: [
      { href: "/admin/users", label: "کاربران", icon: "users" },
      {
        href: "/admin/club/members", label: "باشگاه مشتریان", icon: "club",
        children: [
          { href: "/admin/club/members", label: "اعضا" },
          { href: "/admin/club/tiers", label: "سطوح عضویت" },
          { href: "/admin/club/cards", label: "کارت اشتراک" },
          { href: "/admin/club/legacy", label: "انتقال مشتریان" },
          { href: "/admin/club/coupons", label: "کدهای تخفیف" },
          { href: "/admin/club/campaigns", label: "کمپین‌ها" },
          { href: "/admin/club/templates", label: "قالب‌های پیامک" },
          { href: "/admin/club/qr", label: "QR عضویت" },
          { href: "/admin/club/bale", label: "ربات بله" },
          { href: "/admin/club/sms-log", label: "گزارش ارسال" },
          { href: "/admin/club/settings", label: "تنظیمات باشگاه" },
          { href: "/seller/register", label: "ورود به شماره‌گیر", target: "new_blank" },
        ],
      },
      {
        href: "/admin/comments", label: "نظرات و گفتگو", icon: "chat",
        children: [
          { href: "/admin/comments", label: "نظرات فروشگاه" },
          { href: "/admin/comments?tab=blog", label: "نظرات مقالات" },
          { href: "/admin/chat-history", label: "تاریخچه چت" },
        ],
      },
    ],
  },
  {
    label: "رشد و اتصال",
    items: [
      {
        // ابزارها — docs/features/tools.md. زیرمنو از همان فهرست کاشی‌ها
        href: "/admin/tools", label: "ابزارها", icon: "tools",
        children: [
          { href: "/admin/tools", label: "همه‌ی ابزارها" },
          ...TOOLS_APPS.filter((a) => !["/admin/tools/cart-recovery", "/admin/tools/reorder", "/admin/tools/stock-capital"].includes(a.href))
            .map((a) => ({ href: a.href, label: a.label })),
        ],
      },
      {
        href: "/admin/sms", label: "پیامک", icon: "sms",
        children: [
          { href: "/admin/sms", label: "داشبورد پیامک" },
          { href: "/admin/sms/send", label: "ارسال پیامک" },
          { href: "/admin/sms/patterns", label: "پترن‌ها" },
          { href: "/admin/sms/phonebook", label: "دفترچه تلفن" },
          { href: "/admin/sms/reports", label: "گزارش ارسال" },
          { href: "/admin/sms/inbox", label: "پیام‌های دریافتی" },
          { href: "/admin/sms/wallet", label: "خرید اعتبار" },
          { href: "/admin/sms/advanced", label: "امکانات ویژه" },
        ],
      },
      {
        href: "/admin/integration", label: "یکپارچه‌سازی", icon: "integration",
        children: [
          { href: "/admin/integration", label: "داشبورد اتصال" },
          { href: "/admin/integration/connections", label: "اتصالات" },
          { href: "/admin/integration/mapping", label: "نگاشت محصولات" },
          { href: "/admin/integration/orders", label: "سفارش‌های بازارگاه" },
          { href: "/admin/integration/messages", label: "پیام‌های بازارگاه" },
          { href: "/admin/integration/product-suggestions", label: "پیشنهاد محصول" },
          { href: "/admin/integration/price-rules", label: "قوانین قیمت" },
          { href: "/admin/integration/pricing", label: "قیمت خرید" },
          { href: "/admin/integration/discounts", label: "تخفیف بازارگاه‌ها" },
          { href: "/admin/integration/inventory", label: "موجودی بازارگاه" },
          { href: "/admin/integration/bale-bot", label: "ربات بله" },
          { href: "/admin/integration/queue", label: "صف عملیات" },
          { href: "/admin/integration/logs", label: "لاگ‌ها" },
        ],
      },
    ],
  },
  {
    label: "محتوا و سایت",
    items: [
      {
        href: "/admin/blog", label: "مجله", icon: "blog",
        children: [
          { href: "/admin/blog", label: "مطالب" },
          { href: "/admin/blog/create", label: "مطلب جدید" },
          { href: "/admin/blog/categories", label: "دسته‌ی مطالب" },
        ],
      },
      {
        href: "/admin/widgets", label: "صفحه‌ی اصلی", icon: "widgets",
        children: [
          { href: "/admin/widgets", label: "ویجت‌ها" },
          { href: "/admin/hero-slides", label: "اسلایدر" },
          { href: "/admin/stories", label: "استوری‌ها" },
        ],
      },
      {
        href: "/admin/appearance", label: "ظاهر و برگه‌ها", icon: "appearance",
        children: [
          { href: "/admin/appearance", label: "ظاهر سایت" },
          { href: "/admin/menu", label: "منوی هدر" },
          { href: "/admin/footer", label: "فوتر" },
          { href: "/admin/pages", label: "برگه‌ها" },
        ],
      },
      { href: "/admin/media", label: "کتابخانه رسانه", icon: "media" },
      {
        href: "/admin/seo/redirects", label: "سئو", icon: "seo",
        children: [
          { href: "/admin/seo/redirects", label: "ریدایرکت‌ها" },
          { href: "/admin/seo/not-found", label: "گزارش ۴۰۴" },
          { href: "/admin/landing-pages", label: "صفحات فرود" },
        ],
      },
    ],
  },
  {
    label: "سیستم",
    items: [
      {
        href: "/admin/site-settings", label: "تنظیمات", icon: "settings",
        children: [
          { href: "/admin/site-settings", label: "تنظیمات سایت" },
          { href: "/admin/admins", label: "مدیریت ادمین‌ها" },
          { href: "/admin/ai-settings", label: "هوش مصنوعی" },
          { href: "/admin/chat-settings", label: "تنظیمات چت" },
          { href: "/admin/plan", label: "بسته‌ی من" },
          { href: "/admin/changelog", label: "نسخه برنامه" },
        ],
      },
    ],
  },
];

/** برچسب‌های فارسی نوار مسیر. کلید نیامده، خودِ قطعه‌ی مسیر نشان داده می‌شود. */
export const BREADCRUMB_LABELS: Record<string, string> = {
  admin: "پیشخوان", products: "محصولات", categories: "دسته‌بندی‌ها",
  brands: "برندها", orders: "سفارشات", users: "کاربران",
  "spec-groups": "مشخصات", blog: "بلاگ", widgets: "ویجت‌ها",
  stories: "استوری‌ها", "hero-slides": "اسلایدر", shipping: "ارسال",
  "site-settings": "تنظیمات", footer: "فوتر", menu: "منو",
  reports: "گزارش عملکرد", create: "جدید", comments: "نظرات",
  media: "کتابخانه رسانه", guaranty: "گارانتی", requests: "درخواست‌ها",
  wallet: "کیف پول", appearance: "ظاهر سایت", "chat-settings": "تنظیمات چت", "ai-settings": "تنظیمات هوش مصنوعی",
  changelog: "نسخه برنامه", plan: "بسته‌ی من", "chat-history": "تاریخچه چت",
  "callback-requests": "درخواست‌های تماس", integration: "یکپارچه‌سازی",
  connections: "اتصالات", mapping: "نگاشت محصولات",
  "product-suggestions": "پیشنهادات محصول", "price-rules": "قوانین قیمت",
  queue: "صف عملیات", logs: "لاگ‌ها", worklist: "کارتابل",
  content: "کارهای محتوا", links: "لینک‌سازی", analytics: "آمار بازدید",
  calls: "تماس‌ها", tasks: "همه‌ی کارها", attendance: "حضور",
  settings: "تنظیمات", roles: "نقش‌ها و دسترسی‌ها", club: "باشگاه مشتریان",
  members: "اعضا", tiers: "سطوح عضویت", coupons: "کدهای تخفیف",
  templates: "قالب‌های پیامک", campaigns: "کمپین‌ها", "sms-log": "گزارش ارسال",
  sms: "پیامک", send: "ارسال پیامک", patterns: "پترن‌ها",
  phonebook: "دفترچه تلفن", inbox: "پیام‌های دریافتی", advanced: "امکانات ویژه",
  seo: "سئو", redirects: "ریدایرکت‌ها", "not-found": "گزارش ۴۰۴",
  "landing-pages": "صفحات فرود", pages: "برگه‌ها", admins: "مدیریت ادمین‌ها",
  "attribute-groups": "گروه ویژگی‌ها", "bulk-price": "ویرایش گروهی قیمت",
  "bulk-stock": "ویرایش گروهی موجودی", "ai-text": "متن گروهی با هوش مصنوعی", "bulk-edit": "ویرایش گروهی",
  login: "ورود",
  // ابزارها — docs/features/tools.md
  tools: "ابزارها", qr: "کیوآر کد", landings: "لندینگ‌ساز",
  "tools/links": "لینک کوتاه", "tools/reviews": "درخواست ثبت نظر",
  "text-counter": "کاراکترشمار",
  // حسابداری — docs/plans/accounting.md
  accounting: "حسابداری", parties: "اشخاص", treasury: "صندوق و بانک",
  vouchers: "اسناد", accounts: "سرفصل حساب‌ها", opening: "اول دوره",
  events: "رویدادهای مالی", setup: "راه‌اندازی", new: "تازه",
  sales: "فروش", purchases: "خرید", money: "دریافت و پرداخت", cheques: "چک‌ها", expenses: "هزینه‌ها", pl: "سود و زیان", balance: "ترازنامه", trial: "تراز آزمایشی", aging: "سنی بدهی", profit: "سود کالا و کانال", vat: "ارزش افزوده", invoices: "فاکتورها", edit: "ویرایش", print: "چاپ",
  inventory: "کالا و انبار", warehouses: "انبارها", transfers: "حواله‌ها", counts: "انبارگردانی",
  installments: "اقساط", calendar: "تقویم سررسیدها", pos: "صندوق فروشگاه", "pos/quick": "فروش سریع ساده", "pos/shifts": "شیفت‌ها", "pos/register": "صندوق", "price-check": "چک کردن قیمت", income: "درآمد", years: "سال مالی", batch: "صدور گروهی",
  trend: "روند ماهانه", "reports/parties": "حساب اشخاص",
  // کلید «پدر/بخش» بر کلید تک‌بخشی مقدم است — همان نام بخش در جای دیگر معنای دیگری دارد
  "accounting/reports": "گزارش‌ها", "reports/treasury": "گردش صندوق و بانک",
  "reports/inventory": "ارزش موجودی کالا", "reports/expenses": "گزارش هزینه‌ها",
  "purchases/orders": "سفارش خرید", "sales/orders": "سفارش فروش",
};
