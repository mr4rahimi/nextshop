import type { Metadata } from "next";

export const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

// ── Helpers ────────────────────────────────────────────────────────────────────
export function canonicalUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }

// ── Base Metadata ──────────────────────────────────────────────────────────────
export function buildBaseMetadata(opts: {
  title: string;
  description?: string;
  keywords?: string;
  image?: string | null;
  path: string;
  noIndex?: boolean;
  ogType?: "website" | "article";
}): Metadata {
  const url = canonicalUrl(opts.path);
  return {
    title:       opts.title,
    description: opts.description,
    keywords:    opts.keywords,
    alternates:  { canonical: url },
    robots:      opts.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title:       opts.title,
      description: opts.description,
      url,
      locale:      "fa_IR",
      type:        opts.ogType ?? "website",
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

// ── JSON-LD Builders ───────────────────────────────────────────────────────────

export function buildOrganizationSchema(opts: {
  name: string;
  url: string;
  logo?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  socialInstagram?: string | null;
  socialTelegram?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name:        opts.name,
    url:         opts.url,
    logo:        opts.logo ? { "@type": "ImageObject", url: opts.logo } : undefined,
    description: opts.description ?? undefined,
    email:       opts.email    ?? undefined,
    telephone:   opts.phone    ?? undefined,
    address:     opts.address  ? { "@type": "PostalAddress", streetAddress: opts.address } : undefined,
    sameAs: [opts.socialInstagram, opts.socialTelegram].filter(Boolean),
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
  brand?: string | null;
  price: string | number | bigint;
  salePrice?: string | number | bigint | null;
  currency?: string;
  inStock: boolean;
  url: string;
  ratingValue?: number;
  ratingCount?: number;
  category?: string | null;
}) {
  const price     = Number(opts.price);
  const salePrice = opts.salePrice ? Number(opts.salePrice) : null;
  const offerPrice = salePrice && salePrice < price ? salePrice : price;

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name:        opts.name,
    description: opts.description ?? undefined,
    image:       opts.images?.length ? opts.images : (opts.image ? [opts.image] : undefined),
    sku:         opts.sku ?? undefined,
    brand:       opts.brand ? { "@type": "Brand", name: opts.brand } : undefined,
    category:    opts.category ?? undefined,
    url:         opts.url,
    offers: {
      "@type":         "Offer",
      url:             opts.url,
      priceCurrency:   opts.currency ?? "IRR",
      price:           offerPrice,
      priceValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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
          currency: opts.currency ?? "IRR",
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
      
      { "@type": "UnitPriceSpecification", price: salePrice, priceCurrency: opts.currency ?? "IRR", priceType: "https://schema.org/SalePrice" },
      { "@type": "UnitPriceSpecification", price,            priceCurrency: opts.currency ?? "IRR", priceType: "https://schema.org/ListPrice" },
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
  phone?: string | null;
  address?: string | null;
  email?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name:      opts.name,
    url:       opts.url,
    logo:      opts.logo ?? undefined,
    telephone: opts.phone   ?? undefined,
    email:     opts.email   ?? undefined,
    address:   opts.address ? { "@type": "PostalAddress", streetAddress: opts.address, addressCountry: "IR" } : undefined,
  };
}
