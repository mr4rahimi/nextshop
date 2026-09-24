/**
 * بخش‌های پنل مدیریت و مجوز هر کدام — تنها منبع حقیقت برای proxy و سایدبار.
 *
 * تا فاز ۹ هر حسابی با نقش ADMIN هر صفحه و API پنل را باز می‌کرد، چون
 * `proxy.ts` فقط نقش را چک می‌کرد. با آمدن قیمت خرید و حاشیه‌ی سود این شکاف
 * یعنی هر کارمند حاشیه‌ی سود کل مجموعه را می‌بیند (بخش ۲۳ مستندات کارتابل).
 *
 * قاعده: هر مسیر زیر `/admin` و `/api/admin` به یک بخش می‌خورد. بخش یا
 * `permissions` دارد (هر یک کافی است) یا `null` یعنی «فقط کارمند بودن کافی
 * است و خودِ مسیر مجوز دقیق‌تر را چک می‌کند» — مثل کارتابل.
 *
 * ⚠️ ادمینِ بدون نقش کارتابل همچنان همه‌جا را می‌بیند (تله‌ی ۱۰).
 * ⚠️ این فایل Prisma ایمپورت نمی‌کند؛ سایدبار در مرورگر هم از آن استفاده می‌کند.
 * ⚠️ مسیر تازه‌ای که اینجا نخورد، **بسته** است مگر کاربر بی‌نقش باشد — پیش‌فرض امن.
 */

export interface AdminSection {
  key: string;
  label: string;
  /** یکی از این‌ها کافی است؛ `null` یعنی خودِ مسیر مجوز را چک می‌کند */
  permissions: string[] | null;
  /** پیشوند مسیر صفحه‌ها و APIها */
  prefixes: string[];
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    // کارتابل، باشگاه‌ی «مشتریان من» و مسیرهای عمومیِ هر کارمند.
    // هر مسیر این گروه با requirePermission خودش مجوز دقیق را چک می‌کند.
    key: "self",
    label: "کارتابل و مسیرهای شخصی",
    permissions: null,
    prefixes: [
      "/admin/worklist",
      "/api/admin/worklist",
      "/admin/club/members",
      "/api/admin/club/members",
      "/api/admin/club/categories",
      "/api/admin/auth",
      "/api/admin/me",
      "/admin/changelog",
    ],
  },
  {
    key: "dashboard",
    label: "داشبورد",
    permissions: ["PANEL_REPORTS", "PANEL_ORDERS"],
    prefixes: ["/api/admin/dashboard"],
  },
  {
    key: "reports",
    label: "گزارش عملکرد",
    permissions: ["PANEL_REPORTS"],
    prefixes: ["/admin/reports", "/api/admin/reports"],
  },
  {
    key: "catalog",
    label: "محصولات و کاتالوگ",
    permissions: ["PANEL_CATALOG"],
    prefixes: [
      "/admin/products", "/api/admin/products",
      "/admin/categories", "/api/admin/categories",
      "/admin/brands", "/api/admin/brands",
      "/admin/spec-groups", "/api/admin/spec-groups",
      "/admin/attribute-groups", "/api/admin/attribute-groups",
      "/api/admin/attributes", "/api/admin/attribute-values",
      "/admin/landing-pages", "/api/admin/landing-pages",
    ],
  },
  {
    // گارانتی کارِ پشتیبانی است، نه ویرایش کاتالوگ
    key: "guaranty",
    label: "گارانتی",
    permissions: ["PANEL_ORDERS", "PANEL_CATALOG"],
    prefixes: ["/admin/guaranty", "/api/admin/guaranty", "/api/admin/guaranty-requests"],
  },
  {
    // جستجوی محصول را فرم سفارش تلفنی هم لازم دارد
    key: "product-search",
    label: "جستجوی محصول",
    permissions: ["PANEL_CATALOG", "ORDER_CREATE"],
    prefixes: ["/api/admin/products-search"],
  },
  {
    key: "phone-order",
    label: "ثبت سفارش تلفنی",
    permissions: ["ORDER_CREATE", "PANEL_ORDERS"],
    prefixes: ["/api/admin/orders/create"],
  },
  {
    key: "orders",
    label: "سفارش‌ها و ارسال",
    permissions: ["PANEL_ORDERS"],
    prefixes: [
      "/admin/orders", "/api/admin/orders",
      "/admin/shipping", "/api/admin/shipping",
      "/admin/callback-requests", "/api/admin/callback-requests",
      "/admin/wallet", "/api/admin/wallet",
    ],
  },
  {
    key: "content",
    label: "محتوا و ظاهر سایت",
    permissions: ["PANEL_CONTENT"],
    prefixes: [
      "/admin/blog", "/api/admin/blog",
      "/admin/pages", "/api/admin/pages",
      "/admin/comments", "/api/admin/reviews",
      "/admin/hero-slides", "/api/admin/hero-slides",
      "/admin/stories", "/api/admin/stories",
      "/admin/widgets", "/api/admin/widgets",
      "/admin/menu", "/api/admin/menu",
      "/admin/footer", "/api/admin/footer",
      "/admin/seo", "/api/admin/redirects", "/api/admin/not-found-log",
      "/admin/appearance", "/api/admin/theme",
    ],
  },
  {
    // رسانه و آپلود را محصول، مقاله و بنر همه لازم دارند
    key: "media",
    label: "رسانه و آپلود",
    permissions: ["PANEL_CATALOG", "PANEL_CONTENT"],
    prefixes: ["/admin/media", "/api/admin/media", "/api/admin/upload"],
  },
  {
    key: "users",
    label: "کاربران و ادمین‌ها",
    permissions: ["PANEL_USERS"],
    prefixes: ["/admin/users", "/api/admin/users", "/admin/admins", "/api/admin/admins"],
  },
  {
    key: "club",
    label: "باشگاه، پیامک و کمپین",
    permissions: ["PANEL_CLUB"],
    prefixes: ["/admin/club", "/api/admin/club", "/admin/sms", "/api/admin/sms"],
  },
  {
    key: "integration",
    label: "یکپارچه‌سازی و بازارگاه‌ها",
    permissions: ["PANEL_INTEGRATION"],
    prefixes: ["/admin/integration", "/api/integration"],
  },
  {
    // docs/plans/accounting.md بخش ۱۴ — هر route مجوز دقیق را خودش چک می‌کند
    key: "accounting",
    label: "حسابداری",
    permissions: ["ACC_VIEW", "ACC_PARTY_MANAGE", "ACC_VOUCHER", "ACC_SETTINGS"],
    prefixes: ["/admin/accounting", "/api/admin/accounting"],
  },
  {
    key: "settings",
    label: "تنظیمات فروشگاه و گفتگو",
    permissions: ["PANEL_SETTINGS"],
    prefixes: [
      "/admin/site-settings", "/api/admin/site-settings", "/api/admin/store-settings",
      "/admin/chat-settings", "/api/admin/chat-settings",
      "/admin/chat-history", "/api/admin/chat-history",
    ],
  },
];

/** مسیرهایی که کلِ پنل برای ورود لازم دارد — هرگز بسته نمی‌شوند */
const ALWAYS_OPEN = new Set(["/admin", "/admin/login", "/api/admin/auth/login"]);

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * بخشِ یک مسیر. طولانی‌ترین پیشوند برنده است تا `/api/admin/orders/create`
 * به «سفارش تلفنی» بخورد نه «سفارش‌ها»، و `/admin/club/members` به «شخصی».
 */
export function sectionFor(pathname: string): AdminSection | null {
  let best: AdminSection | null = null;
  let bestLen = -1;
  for (const s of ADMIN_SECTIONS) {
    for (const p of s.prefixes) {
      if (matches(pathname, p) && p.length > bestLen) {
        best = s;
        bestLen = p.length;
      }
    }
  }
  return best;
}

export interface GateAccess {
  isUnrestricted: boolean;
  permissions: string[];
}

/** آیا این دسترسی اجازه‌ی باز کردن این مسیر را دارد */
export function canOpenPath(pathname: string, access: GateAccess): boolean {
  if (access.isUnrestricted || ALWAYS_OPEN.has(pathname)) return true;
  const section = sectionFor(pathname);
  // مسیری که در هیچ بخشی نیست: بسته — مسیر تازه باید آگاهانه اینجا ثبت شود
  if (!section) return false;
  if (section.permissions === null) return true;
  return section.permissions.some((p) => access.permissions.includes(p));
}
