/**
 * پیکربندی ناوبری پنل مدیریت — تنها منبع حقیقت برای سایدبار و نوار مسیر.
 *
 * قبلاً همه‌ی این‌ها داخل `app/admin/layout.tsx` بود و آن فایل هم پیکربندی بود
 * هم کامپوننت. برای افزودن یک آیتم منو فقط همین فایل عوض می‌شود.
 *
 * مستندات: docs/features/admin-sidebar.md
 */

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
 * `name` یا کلیدی از `ICONS` است یا مستقیماً یک ایموجی. چند آیتم منو ایموجی
 * دارند (مثل «🔐 مدیریت ادمین‌ها»)؛ قبلاً این‌ها به `ICONS` نمی‌خوردند و
 * یک `<path>` خالی رندر می‌شد، یعنی جای آیکن خالی می‌ماند.
 */
export function Icon({ name, className = "w-4 h-4" }: { name?: string; className?: string }) {
  const path = name ? ICONS[name as keyof typeof ICONS] : undefined;

  if (!path) {
    return (
      <span className={`${className} inline-flex items-center justify-center leading-none`} aria-hidden>
        {name || "•"}
      </span>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={path} />
    </svg>
  );
}

export const ICONS = {
  dashboard:  "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  products:   "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  categories: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  brands:     "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  specs:      "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  orders:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  users:      "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  blog:       "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13",
  settings:   "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  shipping:   "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0",
  widgets:    "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
  media:      "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  menu:       "M4 6h16M4 12h16M4 18h7",
  footer:     "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  chevron:    "M19 9l-7 7-7-7",
  external:   "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  logout:     "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  wallet: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  chat: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z",
  appearance: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
  "chat-settings": "M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  changelog:    "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0-8c-1.11 0-2.08.402-2.599 1M12 16v1m0-1c1.11 0 2.08-.402 2.599-1M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  "chat-history": "M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  integration:  "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  plug:         "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  mapping:      "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4",
  price:        "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a1 1 0 001-1V6a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z",
  queue:        "M4 6h16M4 10h16M4 14h16M4 18h16",
  reports:      "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  logs:         "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  worklist:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
};

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
    // زیرمنوهای مدیریتی باقی‌مانده (گزارش تیم و امتیاز) در فاز ۶ اضافه
    // می‌شوند؛ مستندات: docs/features/staff-worklist.md
    label: "کارتابل",
    items: [
      {
        href: "/admin/worklist", label: "کارتابل", icon: "worklist",
        children: [
          { href: "/admin/worklist", label: "کارهای من" },
          { href: "/admin/worklist/calls", label: "تماس‌ها" },
          { href: "/admin/worklist/tasks", label: "همه‌ی کارها" },
          { href: "/admin/worklist/attendance", label: "حضور" },
          { href: "/admin/worklist/settings", label: "تنظیمات کارتابل" },
          { href: "/admin/worklist/roles", label: "نقش‌ها و دسترسی‌ها" },
        ],
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
            href: "/admin/guaranty", label: "گارانتی", icon: "shipping",
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
    label: "یکپارچه‌سازی",
    items: [
      {
        href: "/admin/integration", label: "یکپارچه‌سازی", icon: "integration",
        children: [
          { href: "/admin/integration",                       label: "داشبورد" },
          { href: "/admin/integration/connections",           label: "اتصالات" },
          { href: "/admin/integration/mapping",               label: "نگاشت محصولات" },
          { href: "/admin/integration/orders",                label: "سفارش‌های بازارگاه" },
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
        href: "/admin/club/members", label: "باشگاه مشتریان", icon: "users",
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
        href: "/admin/sms", label: "پنل پیامک", icon: "chat",
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
        href: "/admin/seo/redirects", label: "سئو", icon: "🔎",
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
};
