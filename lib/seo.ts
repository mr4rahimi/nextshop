import type { Metadata } from "next";

export const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

// ── Helpers ────────────────────────────────────────────────────────────────────
export function canonicalUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * اسلاگ‌ها ممکن است فارسی باشند (مثل `شیرالات-دوم`). در JSON-LD مقدار `item`
 * باید URL معتبر باشد، پس قبل از ساخت آدرس percent-encode می‌شوند.
 * اگر اسلاگ از قبل encode شده باشد دوباره encode نمی‌شود.
 */
export function encodeSlug(slug: string) {
  try {
    return encodeURIComponent(decodeURIComponent(slug));
  } catch {
    return encodeURIComponent(slug);
  }
}

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }

/**
 * قیمت‌ها در دیتابیس و رابط کاربری به **تومان** ذخیره و نمایش داده می‌شوند،
 * ولی تومان کد ISO 4217 ندارد و Schema.org فقط کد ISO می‌پذیرد.
 * پس برای JSON-LD به ریال (IRR) تبدیل می‌کنیم: ۱ تومان = ۱۰ ریال.
 * بدون این تبدیل، قیمت اعلام‌شده به گوگل ۱۰ برابر کمتر از قیمت واقعی است
 * که در Merchant Center به‌عنوان price mismatch شناخته می‌شود.
 */
export const SCHEMA_CURRENCY = "IRR";
const TOMAN_TO_IRR = 10;
export function tomanToIrr(n: number) { return Math.round(n * TOMAN_TO_IRR); }

/**
 * پایان سال میلادی بعدی. برخلاف `now + 7 روز`، در طول یک سال ثابت می‌ماند
 * و باعث نمی‌شود خروجی JSON-LD در هر ریکوئست عوض شود.
 */
function defaultPriceValidUntil() {
  return `${new Date().getUTCFullYear() + 1}-12-31`;
}

// ── Base Metadata ──────────────────────────────────────────────────────────────
export function buildBaseMetadata(opts: {
  title: string;
  description?: string;
  keywords?: string;
  image?: string | null;
  path: string;
  noIndex?: boolean;
  /** برای صفحات فیلتری: noindex ولی follow (پیش‌فرض false) */
  followWhenNoIndex?: boolean;
  /** اگر داده شود، به‌جای path برای canonical استفاده می‌شود */
  canonicalPath?: string;
  /** `product` مقدار معتبر og است ولی در تایپ‌های Next نیست (پایین cast می‌شود) */
  ogType?: "website" | "article" | "product";
  siteName?: string;
}): Metadata {
  const url      = canonicalUrl(opts.path);
  const canon    = canonicalUrl(opts.canonicalPath ?? opts.path);
  const siteName = opts.siteName ?? process.env.NEXT_PUBLIC_STORE_NAME;
  return {
    title:       opts.title,
    description: opts.description,
    keywords:    opts.keywords,
    alternates:  { canonical: canon },
    robots:      opts.noIndex
      ? { index: false, follow: opts.followWhenNoIndex ?? false }
      : { index: true, follow: true },
    openGraph: {
      title:       opts.title,
      description: opts.description,
      url,
      siteName,
      locale:      "fa_IR",
      // Next در زمان اجرا هر og:type غیر از مقادیر شناخته‌شدهٔ خودش را رد می‌کند
      // («Invalid OpenGraph type»)، و تزریق از راه `other` هم `name=` تولید
      // می‌کند نه `property=`. پس برای product اینجا چیزی ست نمی‌شود و خودِ
      // صفحه تگ را با JSX می‌سازد (React آن را به head منتقل می‌کند).
      ...(opts.ogType === "product" ? {} : { type: opts.ogType ?? "website" }),
      images:      opts.image ? [{ url: opts.image, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card:        "summary_large_image",
      title:       opts.title,
      description: opts.description,
      images:      opts.image ? [opts.image] : [],
    },
  };
}

/**
 * دامنه‌های خارجی یکتای مجموعه‌ای از آدرس تصاویر — برای `<link rel="preconnect">`.
 *
 * تصاویر محصولات روی دامنه‌ی دیگری میزبانی می‌شوند و مرورگر تا وقتی خود تگ
 * `<img>` را نبیند DNS و TLS آن دامنه را شروع نمی‌کند. در صفحات لیستی که ده‌ها
 * کارت محصول دارند این تأخیر روی LCP می‌نشیند. preconnect اتصال را زودتر
 * گرم می‌کند.
 *
 * سقف دارد چون هر preconnect خودش هزینه دارد؛ بیش از دو تا ضدبهره می‌شود.
 */
export function externalImageOrigins(
  urls: (string | null | undefined)[],
  limit = 2
): string[] {
  const origins = new Set<string>();
  for (const u of urls) {
    if (!u || !/^https?:\/\//i.test(u)) continue;
    try {
      const { origin } = new URL(u);
      if (origin && origin !== SITE_URL) origins.add(origin);
    } catch {
      // آدرس خراب — نادیده
    }
    if (origins.size >= limit) break;
  }
  return [...origins];
}

/**
 * متادیتای صفحات خصوصی (سبد خرید، تسویه، پنل کاربر، ورود).
 *
 * این صفحات در robots.txt **بلاک نشده‌اند** و نباید بشوند: از هدر به همه‌جا
 * لینک دارند و اگر خزیدنشان را ببندیم گوگل تگ noindex را نمی‌بیند و ممکن است
 * URL خالی را ایندکس کند. اجازه‌ی خزیدن + noindex حذف قطعی را تضمین می‌کند.
 *
 * `follow` روشن می‌ماند تا لینک‌های داخلی همچنان دنبال شوند.
 */
export function noIndexMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: true },
  };
}

// ── JSON-LD Builders ───────────────────────────────────────────────────────────

export function buildOrganizationSchema(opts: {
  name: string;
  url: string;
  logo?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  socialInstagram?: string | null;
  socialTelegram?: string | null;
  socialWhatsapp?: string | null;
  socialTwitter?: string | null;
}) {
  const waNumber = opts.socialWhatsapp?.replace(/\D/g, "") ?? "";
  const sameAs = [
    opts.socialInstagram,
    opts.socialTelegram,
    waNumber.length > 5 ? `https://wa.me/${waNumber}` : null,
    opts.socialTwitter,
  ].filter((v): v is string => typeof v === "string" && v.startsWith("http"));

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name:        opts.name,
    url:         opts.url,
    logo:        opts.logo ? { "@type": "ImageObject", url: opts.logo } : undefined,
    description: opts.description ?? undefined,
    email:       opts.email    ?? undefined,
    telephone:   opts.phone    ?? undefined,
    address: opts.address ? {
      "@type":          "PostalAddress",
      streetAddress:    opts.address,
      addressLocality:  opts.city       ?? undefined,
      addressRegion:    opts.province   ?? undefined,
      postalCode:       opts.postalCode ?? undefined,
      addressCountry:   "IR",
    } : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

/** WebSite schema + SearchAction */
export function buildWebSiteSchema(opts: { name: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: opts.name,
    url:  opts.url,
    potentialAction: {
      "@type":       "SearchAction",
      target:        { "@type": "EntryPoint", urlTemplate: `${opts.url}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** BreadcrumbList schema */
export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type":    "ListItem",
      position:   i + 1,
      name:       item.name,
      item:       item.url,
    })),
  };
}

/** Product schema */
export function buildProductSchema(opts: {
  name: string;
  description?: string | null;
  image?: string | null;
  images?: string[];
  sku?: string | null;
  gtin13?: string | null;
  mpn?: string | null;
  brand?: string | null;
  /** قیمت به تومان (همان چیزی که در دیتابیس و UI است) */
  price: string | number | bigint;
  /** قیمت تخفیف‌خورده به تومان */
  salePrice?: string | number | bigint | null;
  inStock: boolean;
  url: string;
  ratingValue?: number;
  ratingCount?: number;
  category?: string | null;
  /** ISO 8601 (YYYY-MM-DD). پیش‌فرض: پایان سال میلادی بعدی */
  priceValidUntil?: string;
}) {
  const price     = Number(opts.price);
  const salePrice = opts.salePrice ? Number(opts.salePrice) : null;
  const offerPrice = salePrice && salePrice < price ? salePrice : price;

  // تومان → ریال، چون priceCurrency باید کد ISO 4217 باشد
  const offerPriceIrr = tomanToIrr(offerPrice);

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name:        opts.name,
    description: opts.description ?? undefined,
    image:       opts.images?.length ? opts.images : (opts.image ? [opts.image] : undefined),
    sku:         opts.sku    ?? undefined,
    gtin13:      opts.gtin13 ?? undefined,
    mpn:         opts.mpn    ?? undefined,
    brand:       opts.brand ? { "@type": "Brand", name: opts.brand } : undefined,
    category:    opts.category ?? undefined,
    url:         opts.url,
    offers: {
      "@type":         "Offer",
      url:             opts.url,
      priceCurrency:   SCHEMA_CURRENCY,
      price:           offerPriceIrr,
      // تاریخ ثابت است تا خروجی JSON-LD در هر ریکوئست تغییر نکند
      priceValidUntil: opts.priceValidUntil ?? defaultPriceValidUntil(),
      availability:    opts.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition:   "https://schema.org/NewCondition",
     seller: { "@type": "Organization", name: process.env.STORE_NAME ?? process.env.NEXT_PUBLIC_STORE_NAME ?? "فروشگاه" },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "0",
          currency: SCHEMA_CURRENCY,
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "IR",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime:  { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "IR",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    },
  };

  if (salePrice && salePrice < price) {
    schema.offers.priceSpecification = [
      { "@type": "UnitPriceSpecification", price: tomanToIrr(salePrice), priceCurrency: SCHEMA_CURRENCY, priceType: "https://schema.org/SalePrice" },
      { "@type": "UnitPriceSpecification", price: tomanToIrr(price),     priceCurrency: SCHEMA_CURRENCY, priceType: "https://schema.org/ListPrice" },
    ];
  }

  if (opts.ratingValue && opts.ratingCount && opts.ratingCount > 0) {
    schema.aggregateRating = {
      "@type":       "AggregateRating",
      ratingValue:   opts.ratingValue.toFixed(1),
      reviewCount:   opts.ratingCount,
      bestRating:    "5",
      worstRating:   "1",
    };
  }

  return schema;
}

export function buildArticleSchema(opts: {
  title: string;
  description?: string | null;
  image?: string | null;
  url: string;
  publishedAt?: string | null;
  updatedAt?: string;
  authorName?: string;
  publisherName: string;
  publisherLogo?: string | null;
}) {
  return {
    "@context":      "https://schema.org",
    "@type":         "Article",
    headline:        opts.title,
    description:     opts.description ?? undefined,
    image:           opts.image ? [opts.image] : undefined,
    url:             opts.url,
    datePublished:   opts.publishedAt ?? undefined,
    dateModified:    opts.updatedAt   ?? opts.publishedAt ?? undefined,
    author: {
      "@type": "Organization",
      name:    opts.authorName ?? opts.publisherName,
    },
    publisher: {
      "@type": "Organization",
      name:    opts.publisherName,
      logo:    opts.publisherLogo
        ? { "@type": "ImageObject", url: opts.publisherLogo }
        : undefined,
    },
    inLanguage: "fa",
  };
}

export function buildItemListSchema(opts: {
  name: string;
  url: string;
  items: { name: string; url: string; image?: string | null; position: number }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name:    opts.name,
    url:     opts.url,
    itemListElement: opts.items.map(item => ({
      "@type":    "ListItem",
      position:   item.position,
      name:       item.name,
      url:        item.url,
      image:      item.image ?? undefined,
    })),
  };
}

export function buildFAQSchema(faqs: { question: string; answer: string }[]) {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type":          "Question",
      name:             f.question,
      acceptedAnswer:   { "@type": "Answer", text: f.answer },
    })),
  };
}

export function buildLocalBusinessSchema(opts: {
  name: string;
  url: string;
  logo?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  openingHours?: string | null;
  socialInstagram?: string | null;
  socialTelegram?: string | null;
  socialWhatsapp?: string | null;
  socialTwitter?: string | null;
}) {
  const waNum = opts.socialWhatsapp?.replace(/\D/g, "") ?? "";
  const sameAs = [
    opts.socialInstagram,
    opts.socialTelegram,
    waNum.length > 5 ? `https://wa.me/${waNum}` : null,
    opts.socialTwitter,
  ].filter((v): v is string => typeof v === "string" && v.startsWith("http"));

  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name:        opts.name,
    url:         opts.url,
    logo:        opts.logo ? { "@type": "ImageObject", url: opts.logo } : undefined,
    image:       opts.logo ?? undefined,
    description: opts.description ?? undefined,
    telephone:   opts.phone ?? undefined,
    email:       opts.email ?? undefined,
    address: opts.address ? {
      "@type":         "PostalAddress",
      streetAddress:   opts.address,
      addressLocality: opts.city       ?? undefined,
      addressRegion:   opts.province   ?? undefined,
      postalCode:      opts.postalCode ?? undefined,
      addressCountry:  "IR",
    } : undefined,
    openingHours:  opts.openingHours ?? undefined,
    sameAs:        sameAs.length ? sameAs : undefined,
    hasMap:        opts.address ? `https://maps.google.com/?q=${encodeURIComponent(opts.address + (opts.city ? " " + opts.city : ""))}` : undefined,
  };
}
