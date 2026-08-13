import type { NextConfig } from "next";

// Cache-Control values
const NO_STORE   = "no-store";
const PRIVATE    = "private, no-store";
const LONG       = "public, s-maxage=3600, stale-while-revalidate=86400";   // 1h fresh, 24h stale
const CATALOG    = "public, s-maxage=300,  stale-while-revalidate=600";     // 5m fresh, 10m stale
const PRODUCTS   = "public, s-maxage=60,   stale-while-revalidate=120";     // 1m fresh, 2m stale

function h(value: string) {
  return [{ key: "Cache-Control", value }];
}

/**
 * هدرهای امنیتی مشترک همه‌ی دیپلوی‌ها.
 *
 * عمداً `Content-Security-Policy` اینجا نیست: Next اسکریپت‌های inline تزریق
 * می‌کند (اسکریپت ضد-flash تم، هیدریشن، و JSON-LD با dangerouslySetInnerHTML)
 * و یک CSP نادرست همزمان چند سایت production را می‌شکند. اگر CSP خواستید،
 * اول با `Content-Security-Policy-Report-Only` روی یک سایت تست کنید.
 *
 * `Strict-Transport-Security` روی HTTP لوکال توسط مرورگر نادیده گرفته می‌شود،
 * پس در توسعه بی‌اثر و بی‌خطر است. عمداً بدون `includeSubDomains` و `preload`
 * است تا اگر ساب‌دامنه‌ای هنوز HTTPS ندارد از کار نیفتد.
 *
 * `max-age` پلکانی بالا آمد: اول ۵ دقیقه تا وضعیت گواهی‌ها روشن شود، حالا یک
 * سال. زمینه‌اش این بود که گواهی همه‌ی دامنه‌ها را CDN صادر می‌کرد و روی سرور
 * گواهی معتبر و خودتمدیدشونده نبود. اگر گواهی زیر HSTS منقضی شود مرورگر
 * **هارد-فیل** می‌کند و کاربر حتی نمی‌تواند رد شود.
 *
 * حالا bartar-janebi.com و mymonta.ir روی سرور گواهی Let's Encrypt با تمدید
 * خودکار (webroot + certbot.timer) دارند.
 *
 * ⚠️ mahamprint.com هنوز `authenticator = manual` است و **خودکار تمدید
 * نمی‌شود** (انقضا ۲۰۲۶-۱۰-۳۱). چون CDN آن دامنه درخواست HTTP را در لبه
 * ریدایرکت می‌کند، HTTP-01 تا وقتی ابر روشن است کار نمی‌کند. بعد از خاموش
 * کردن ابر، این را اجرا کنید تا آن هم خودکار شود:
 *
 *   certbot certonly --webroot -w /var/www/letsencrypt \
 *     --cert-name mahamprint.com -d mahamprint.com -d www.mahamprint.com \
 *     --force-renewal --non-interactive --agree-tos
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control",    value: "on" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // `X-Powered-By: Next.js` نسخه‌ی فریم‌ورک را لو می‌دهد و هیچ فایده‌ای ندارد.
  poweredByHeader: false,

  images: {
    // Sharp requires x86-64-v2 CPU (SSE4.2) which the production server lacks.
    // unoptimized:true makes next/image render direct <img> tags, bypassing
    // the /_next/image endpoint and never loading sharp at runtime.
    unoptimized: true,
    // ⚠️ این الگوها فقط تا وقتی بی‌خطرند که `unoptimized: true` باشد، چون
    // مسیر /_next/image اصلاً استفاده نمی‌شود. اگر روزی unoptimized را
    // برداشتید، «هر هاستی» به یک سطح حمله‌ی SSRF تبدیل می‌شود — آن موقع
    // حتماً به دامنه‌های مشخص محدودش کنید.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http",  hostname: "**" },
    ],
    // dangerouslyAllowSVG حذف شد: فقط روی بهینه‌ساز اثر داشت که بای‌پس شده،
    // پس صرفاً یک ریسک خفته بود. SVGها همچنان به‌صورت <img> رندر می‌شوند.
  },

  async headers() {
    return [
      // ── هدرهای امنیتی روی همه‌ی مسیرها ─────────────────────────────────
      { source: "/:path*", headers: SECURITY_HEADERS },

      // ── Private — never cache ──────────────────────────────────────────
      { source: "/api/auth/:path*",           headers: h(PRIVATE)  },
      { source: "/api/cart/:path*",           headers: h(PRIVATE)  },
      { source: "/api/checkout/:path*",       headers: h(PRIVATE)  },
      { source: "/api/user/:path*",           headers: h(PRIVATE)  },
      { source: "/api/orders/:path*",         headers: h(PRIVATE)  },
      { source: "/api/chat/:path*",           headers: h(PRIVATE)  },
      { source: "/api/store/my-chat/:path*",  headers: h(PRIVATE)  },

      // ── Admin — no cache ───────────────────────────────────────────────
      { source: "/api/admin/:path*",          headers: h(NO_STORE) },
      { source: "/api/ping",                  headers: h(NO_STORE) },
      { source: "/api/debug-db",              headers: h(NO_STORE) },

      // ── Store config (changes only when admin edits) ───────────────────
      { source: "/api/store/header-menu",     headers: h(LONG) },
      { source: "/api/store/footer",          headers: h(LONG) },
      { source: "/api/store/theme",           headers: h(LONG) },
      { source: "/api/store/chat-config",     headers: h(LONG) },
      { source: "/api/store/site-settings",   headers: h(LONG) },
      { source: "/api/store/store-settings",  headers: h(LONG) },
      { source: "/api/store/shipping",        headers: h(LONG) },
      { source: "/api/store/hero-slides",     headers: h(LONG) },
      { source: "/api/store/stories",         headers: h(LONG) },
      { source: "/api/store/widgets",         headers: h(LONG) },
      { source: "/api/store/latest-articles", headers: h(LONG) },
      { source: "/api/mag/:path*",            headers: h(LONG) },

      // ── Catalog (changes when products/categories added) ───────────────
      { source: "/api/store/categories-list",         headers: h(CATALOG) },
      { source: "/api/store/categories/:path*",        headers: h(CATALOG) },
      { source: "/api/categories/:path*",              headers: h(CATALOG) },
      { source: "/api/store/brands/:path*",            headers: h(CATALOG) },
      { source: "/api/store/search-meta",              headers: h(CATALOG) },
      { source: "/api/store/products-meta",            headers: h(CATALOG) },
      { source: "/api/store/amazing-products",         headers: h(CATALOG) },

      // ── Product data (price/stock can change) ──────────────────────────
      { source: "/api/products",                       headers: h(PRODUCTS) },
      { source: "/api/products/:path*",                headers: h(PRODUCTS) },
      { source: "/api/store/newest-products",          headers: h(PRODUCTS) },
      { source: "/api/store/products-by-category",     headers: h(PRODUCTS) },
      { source: "/api/store/products-by-brand",        headers: h(PRODUCTS) },
      { source: "/api/store/category-products",        headers: h(PRODUCTS) },
    ];
  },
};

export default nextConfig;
