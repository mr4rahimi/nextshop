/**
 * پیکربندی ناوبری پنل مدیریت — تنها منبع حقیقت برای سایدبار و نوار مسیر.
 *
 * قبلاً همه‌ی این‌ها داخل `app/admin/layout.tsx` بود و آن فایل هم پیکربندی بود
 * هم کامپوننت. برای افزودن یک آیتم منو فقط همین فایل عوض می‌شود.
 *
 * مستندات: docs/features/admin-sidebar.md
 */

import {
  ArrowDownUp, Blocks, BookOpen, BriefcaseBusiness, Calculator, ChartColumn, ChevronDown, ClipboardList,
  Crown, ExternalLink, FolderOpen, Image, LayoutDashboard, LayoutGrid, ListOrdered, LogOut, Menu,
  MessageCircle, MessageSquare, MessageSquareText, MessagesSquare, Package, Palette, PanelBottom, Plug,
  Rocket, ScrollText, SearchCheck, Settings, ShieldCheck, ShoppingCart, Tag, Truck, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import { WORKLIST_APPS } from "./apps";

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
} satisfies Record<string, LucideIcon>;

export const MENU_GROUPS: NavGroup[] = [
  {
    label: "اصلی",
    items: [
      { href: "/admin", label: "داشبورد", icon: "dashboard", exact: true },
      { href: "/admin/reports", label: "گزارش عملکرد", icon: "reports" },
    ],
  },
  {
    // کارتابل — مدیریت کار و عملکرد کارکنان.
    // مستندات: docs/features/staff-worklist.md
    label: "کارتابل",
    items: [
      {
        href: "/admin/worklist", label: "کارتابل", icon: "worklist",
        // از همان فهرست کاشی‌های کارتابل — بخش تازه فقط در apps.ts اضافه می‌شود
        children: WORKLIST_APPS.map((a) => ({ href: a.href, label: a.label })),
      },
    ],
  },
  {
    label: "فروشگاه",
    items: [
      {
        href: "/admin/products", label: "محصولات", icon: "products",
        children: [
          { href: "/admin/products", label: "لیست محصولات" },
          { href: "/admin/products/create", label: "محصول جدید" },
          { href: "/admin/categories", label: "دسته‌بندی‌ها" },
          { href: "/admin/brands", label: "برندها" },
          { href: "/admin/spec-groups", label: "گروه مشخصات" },
          { href: "/admin/attribute-groups", label: "گروه ویژگی ها" },
          { href: "/admin/landing-pages", label: "صفحات فرود سئو" },
          { href: "/admin/products/bulk-price", label: "ویرایش گروهی قیمت", icon: "🏷️" },
          { href: "/admin/products/bulk-stock", label: "ویرایش گروهی موجودی", icon: "📦" },

        ],
        
      },
      {
            href: "/admin/guaranty", label: "گارانتی", icon: "guaranty",
            children: [
              { href: "/admin/guaranty", label: "لیست گارانتی‌ها" },
              { href: "/admin/guaranty/requests", label: "درخواست‌های گارانتی" },
            ],
          },
      { href: "/admin/orders", label: "سفارشات", icon: "orders" },
      { href: "/admin/wallet", label: "کیف پول", icon: "wallet" },
      { href: "/admin/users", label: "کاربران", icon: "users" },
      { href: "/admin/shipping", label: "ارسال و پرداخت", icon: "shipping" },
      
    ],
  },
  {
    label: "محتوا",
    items: [
      { href: "/admin/media", label: "کتابخانه رسانه", icon: "media" },
      {
        href: "/admin/comments", label: "نظرات", icon: "chat",
        children: [
          { href: "/admin/comments", label: "نظرات فروشگاه" },
          { href: "/admin/comments?tab=blog", label: "نظرات مقالات" },
        ],
      },
      {
        href: "/admin/blog", label: "مجله / بلاگ", icon: "blog",
        children: [
          { href: "/admin/blog", label: "مطالب" },
          { href: "/admin/blog/create", label: "مطلب جدید" },
          { href: "/admin/blog/categories", label: "دسته‌بندی‌ها" },
          { href: "/admin/comments?tab=blog", label: "نظرات" },
        ],
      },
      {
        href: "/admin/widgets", label: "صفحه اصلی", icon: "widgets",
        children: [
          { href: "/admin/widgets", label: "ویجت‌ها" },
          { href: "/admin/hero-slides", label: "اسلایدر Hero" },
          { href: "/admin/stories", label: "استوری‌ها" },
        ],
      },
    ],
  },
  {
    // حسابداری — docs/plans/accounting.md
    label: "حسابداری",
    items: [
      {
        href: "/admin/accounting", label: "حسابداری", icon: "accounting",
        children: [
          { href: "/admin/accounting",        label: "خانه‌ی حسابداری" },
          { href: "/admin/accounting/sales",     label: "فروش" },
          { href: "/admin/accounting/purchases", label: "خرید" },
          { href: "/admin/accounting/money",     label: "دریافت و پرداخت" },
          { href: "/admin/accounting/cheques",   label: "چک‌ها" },
          { href: "/admin/accounting/expenses",  label: "هزینه‌ها" },
          { href: "/admin/accounting/reports",   label: "گزارش‌ها" },
          { href: "/admin/accounting/events", label: "رویدادهای مالی" },
        ],
      },
    ],
  },
  {
    label: "یکپارچه‌سازی",
    items: [
      {
        href: "/admin/integration", label: "یکپارچه‌سازی", icon: "integration",
        children: [
          { href: "/admin/integration",                       label: "داشبورد" },
          { href: "/admin/integration/connections",           label: "اتصالات" },
          { href: "/admin/integration/mapping",               label: "نگاشت محصولات" },
          { href: "/admin/integration/orders",                label: "سفارش‌های بازارگاه" },
          { href: "/admin/integration/messages",              label: "پیام‌های بازارگاه" },
          { href: "/admin/integration/product-suggestions",   label: "پیشنهادات اضافه کردن محصول" },
          { href: "/admin/integration/price-rules",           label: "قوانین قیمت" },
          { href: "/admin/integration/pricing",               label: "مدیریت قیمت خرید" },
          { href: "/admin/integration/discounts",             label: "تخفیف بازارگاه‌ها" },
          { href: "/admin/integration/inventory",             label: "مدیریت موجودی" },
          { href: "/admin/integration/queue",                 label: "صف عملیات" },
          { href: "/admin/integration/logs",                  label: "گزارش لاگ‌ها" },
        ],
      },
    ],
  },

  {
    label: "باشگاه مشتریان",
    items: [
      {
        href: "/admin/club/members", label: "باشگاه مشتریان", icon: "club",
        children: [
          { href: "/admin/club/members",     label: "اعضا" },
          { href: "/admin/club/tiers",       label: "سطوح عضویت" },
          { href: "/admin/club/coupons",     label: "کدهای تخفیف" },
          { href: "/admin/club/qr",          label: "QR عضویت" },
          { href: "/admin/club/bale",        label: "ربات بله" },
          { href: "/admin/club/templates",   label: "قالب‌های پیامک" },   // فاز ۲
          { href: "/admin/club/campaigns",   label: "کمپین‌ها" },          // فاز ۲
          { href: "/admin/club/sms-log",     label: "گزارش ارسال" },       // فاز ۲
          { href: "/admin/club/settings",    label: "تنظیمات باشگاه" },  
          { href: "/seller/register",    label: " ورود به شماره گیر", target: "new_blank" },  
        ],
      },
    ],
  },
  {
    label: "پیامک",
    items: [
      {
        href: "/admin/sms", label: "پنل پیامک", icon: "sms",
        children: [
          { href: "/admin/sms",              label: "داشبورد" },
          { href: "/admin/sms/send",         label: "ارسال پیامک" },
          { href: "/admin/sms/patterns",     label: "پترن‌ها" },
          { href: "/admin/sms/phonebook",    label: "دفترچه تلفن" },
          { href: "/admin/sms/reports",      label: "گزارش ارسال" },
          { href: "/admin/sms/inbox",        label: "پیام‌های دریافتی" },
          { href: "/admin/sms/wallet",       label: "خرید اعتبار" },
          { href: "/admin/sms/advanced",     label: "امکانات ویژه" },
        ],
      },
    ],
  },
  {
    label: "سئو",
    items: [
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
    label: "تنظیمات",
    items: [
      {
        href: "/admin/site-settings", label: "سایت", icon: "settings",
        children: [
          { href: "/admin/site-settings", label: "تنظیمات عمومی" },
          { href: "/admin/pages", label: "برگه‌ها" },
          { href: "/admin/menu", label: "منوی هدر" },
          { href: "/admin/footer", label: "فوتر" },
          { href: "/admin/appearance", label: "ظاهر سایت", icon: "appearance" },
          { href: "/admin/admins", label: "مدیریت ادمین‌ها", icon: "🔐" },
          { href: "/admin/chat-settings", label: "تنظیمات چت", icon: "💬" },
          { href: "/admin/chat-history", label: "تاریخچه چت", icon: "💬" },
          { href: "/admin/callback-requests", label: "درخواست‌های تماس", icon: "💬" },
          { href: "/admin/changelog", label: "نسخه برنامه", icon: "🚀" }
        ],
      },
    ],
  },
  
];

/** برچسب‌های فارسی نوار مسیر. کلید نیامده، خودِ قطعه‌ی مسیر نشان داده می‌شود. */
export const BREADCRUMB_LABELS: Record<string, string> = {
  admin: "داشبورد", products: "محصولات", categories: "دسته‌بندی‌ها",
  brands: "برندها", orders: "سفارشات", users: "کاربران",
  "spec-groups": "مشخصات", blog: "بلاگ", widgets: "ویجت‌ها",
  stories: "استوری‌ها", "hero-slides": "اسلایدر", shipping: "ارسال",
  "site-settings": "تنظیمات", footer: "فوتر", menu: "منو",
  reports: "گزارش عملکرد", create: "جدید", comments: "نظرات",
  media: "کتابخانه رسانه", guaranty: "گارانتی", requests: "درخواست‌ها",
  wallet: "کیف پول", appearance: "ظاهر سایت", "chat-settings": "تنظیمات چت",
  changelog: "نسخه برنامه", "chat-history": "تاریخچه چت",
  "callback-requests": "درخواست‌های تماس", integration: "یکپارچه‌سازی",
  connections: "اتصالات", mapping: "نگاشت محصولات",
  "product-suggestions": "پیشنهادات محصول", "price-rules": "قوانین قیمت",
  queue: "صف عملیات", logs: "لاگ‌ها", worklist: "کارتابل",
  content: "کارهای محتوا", links: "لینک‌سازی",
  calls: "تماس‌ها", tasks: "همه‌ی کارها", attendance: "حضور",
  settings: "تنظیمات", roles: "نقش‌ها و دسترسی‌ها", club: "باشگاه مشتریان",
  members: "اعضا", tiers: "سطوح عضویت", coupons: "کدهای تخفیف",
  templates: "قالب‌های پیامک", campaigns: "کمپین‌ها", "sms-log": "گزارش ارسال",
  sms: "پیامک", send: "ارسال پیامک", patterns: "پترن‌ها",
  phonebook: "دفترچه تلفن", inbox: "پیام‌های دریافتی", advanced: "امکانات ویژه",
  seo: "سئو", redirects: "ریدایرکت‌ها", "not-found": "گزارش ۴۰۴",
  "landing-pages": "صفحات فرود", pages: "برگه‌ها", admins: "مدیریت ادمین‌ها",
  "attribute-groups": "گروه ویژگی‌ها", "bulk-price": "ویرایش گروهی قیمت",
  "bulk-stock": "ویرایش گروهی موجودی", "bulk-edit": "ویرایش گروهی",
  login: "ورود",
  // حسابداری — docs/plans/accounting.md
  accounting: "حسابداری", parties: "اشخاص", treasury: "صندوق و بانک",
  vouchers: "اسناد", accounts: "سرفصل حساب‌ها", opening: "اول دوره",
  events: "رویدادهای مالی", setup: "راه‌اندازی", new: "تازه",
  sales: "فروش", purchases: "خرید", money: "دریافت و پرداخت", cheques: "چک‌ها", expenses: "هزینه‌ها", pl: "سود و زیان", balance: "ترازنامه", trial: "تراز آزمایشی", aging: "سنی بدهی", profit: "سود کالا و کانال", vat: "ارزش افزوده", invoices: "فاکتورها", edit: "ویرایش", print: "چاپ",
  inventory: "کالا و انبار", warehouses: "انبارها", transfers: "حواله‌ها", counts: "انبارگردانی",
  // کلید «پدر/بخش» بر کلید تک‌بخشی مقدم است — همان نام بخش در جای دیگر معنای دیگری دارد
  "accounting/reports": "گزارش‌ها", "reports/treasury": "گردش صندوق و بانک",
  "reports/inventory": "ارزش موجودی کالا", "reports/expenses": "گزارش هزینه‌ها",
};
