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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
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
