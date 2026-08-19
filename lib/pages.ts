/**
 * برگه‌های ثابت سایت — نوع‌ها، قالب‌ها، نرمال‌سازی بلوک‌ها و ابزار فهرست مطالب.
 *
 * این فایل عمداً بدون `use client` و بدون import از Prisma است تا هم سرور
 * (رندر برگه، sitemap) و هم کلاینت (فرم ادمین) بتوانند از آن استفاده کنند.
 */

export const PAGE_TEMPLATES = [
  "DEFAULT",
  "ABOUT",
  "CONTACT",
  "FAQ",
  "LEGAL",
] as const;

export type PageTemplate = (typeof PAGE_TEMPLATES)[number];

export interface PageContact {
  phone: string;
  mobile: string;
  email: string;
  address: string;
  postalCode: string;
  workHours: string;
  /** لینک نقشه (نشانی src داخل iframe گوگل/نشان) */
  mapEmbed: string;
  socials: { label: string; url: string }[];
}

export interface PageFaqItem { q: string; a: string }
export interface PageStat { value: string; label: string }
export interface PageFeature { icon: string; title: string; text: string }

export interface PageBlocks {
  contact: PageContact;
  faq: PageFaqItem[];
  stats: PageStat[];
  features: PageFeature[];
  /** متن «آخرین بروزرسانی» در قالب LEGAL — دست ادمین است تا تاریخ شمسی دلخواه بنویسد */
  updatedLabel: string;
}

/** توضیح هر قالب برای پنل ادمین — تنها منبع حقیقتِ متن‌های راهنما */
export const TEMPLATE_META: Record<PageTemplate, {
  label: string;
  icon: string;
  desc: string;
  /** کدام ادیتورهای اضافه در فرم ادمین نمایش داده شوند */
  blocks: (keyof PageBlocks)[];
}> = {
  DEFAULT: {
    label: "برگه ساده",
    icon: "📄",
    desc: "عنوان، زیرعنوان و متن. مناسب هر برگه‌ی عمومی.",
    blocks: [],
  },
  ABOUT: {
    label: "درباره ما",
    icon: "🏢",
    desc: "متن معرفی به‌همراه نوار آمار (اعداد کلیدی) و کارت‌های ویژگی.",
    blocks: ["stats", "features"],
  },
  CONTACT: {
    label: "تماس با ما",
    icon: "📞",
    desc: "کارت‌های راه‌های ارتباطی، شبکه‌های اجتماعی و نقشه.",
    blocks: ["contact"],
  },
  FAQ: {
    label: "سوالات متداول",
    icon: "❓",
    desc: "پرسش و پاسخ آکاردئونی + اسکیمای FAQPage برای گوگل.",
    blocks: ["faq"],
  },
  LEGAL: {
    label: "قوانین و مقررات",
    icon: "⚖️",
    desc: "متن بلند حقوقی با فهرست مطالب چسبان و تاریخ آخرین بروزرسانی.",
    blocks: ["updatedLabel"],
  },
};

export const EMPTY_CONTACT: PageContact = {
  phone: "", mobile: "", email: "", address: "",
  postalCode: "", workHours: "", mapEmbed: "", socials: [],
};

const EMPTY_BLOCKS: PageBlocks = {
  contact: EMPTY_CONTACT,
  faq: [],
  stats: [],
  features: [],
  updatedLabel: "",
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function arr<T>(v: unknown, map: (row: Record<string, unknown>) => T, keep: (row: T) => boolean): T[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map(map)
    .filter(keep);
}

/**
 * هر مقداری از دیتابیس یا فرم را به شکل کامل و امن `PageBlocks` درمی‌آورد.
 * ردیف‌های خالی (بدون متن معنادار) حذف می‌شوند تا در سایت جای خالی نسازند.
 */
export function normalizePageBlocks(raw: unknown): PageBlocks {
  if (!raw || typeof raw !== "object") return { ...EMPTY_BLOCKS, contact: { ...EMPTY_CONTACT } };
  const b = raw as Record<string, unknown>;
  const c = (b.contact && typeof b.contact === "object" ? b.contact : {}) as Record<string, unknown>;

  return {
    contact: {
      phone:      str(c.phone),
      mobile:     str(c.mobile),
      email:      str(c.email),
      address:    str(c.address),
      postalCode: str(c.postalCode),
      workHours:  str(c.workHours),
      mapEmbed:   str(c.mapEmbed),
      socials:    arr(c.socials, r => ({ label: str(r.label), url: str(r.url) }), r => !!r.label && !!r.url),
    },
    faq:      arr(b.faq,      r => ({ q: str(r.q), a: str(r.a) }),                              r => !!r.q && !!r.a),
    stats:    arr(b.stats,    r => ({ value: str(r.value), label: str(r.label) }),              r => !!r.value && !!r.label),
    features: arr(b.features, r => ({ icon: str(r.icon), title: str(r.title), text: str(r.text) }), r => !!r.title),
    updatedLabel: str(b.updatedLabel),
  };
}

export function normalizeTemplate(v: unknown): PageTemplate {
  return PAGE_TEMPLATES.includes(v as PageTemplate) ? (v as PageTemplate) : "DEFAULT";
}

/**
 * اسلاگ‌هایی که نباید برگه بگیرند — چون مسیر ثابت سایت‌اند و مسیر ثابت در
 * Next.js بر مسیر داینامیک `/[slug]` اولویت دارد؛ یعنی چنین برگه‌ای ساخته
 * می‌شود ولی هرگز دیده نمی‌شود. جلوی این سردرگمی را در ادمین می‌گیریم.
 */
export const RESERVED_PAGE_SLUGS = new Set([
  "admin", "api", "auth", "account", "user", "seller", "cart", "checkout",
  "products", "categories", "brands", "collections", "search", "mag",
  "configurator", "warranty", "torob-products", "sitemap.xml", "robots.txt",
]);

// ── فهرست مطالب ────────────────────────────────────────────────────────────

export interface TocItem { id: string; text: string; level: 2 | 3 }

/** متن فارسی/انگلیسی سرتیتر → id پایدار برای لنگر */
function headingId(text: string, index: number): string {
  const base = text
    .replace(/\s+/g, "-")
    .replace(/[^؀-ۿ\w-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `h-${base}` : `h-${index}`;
}

/**
 * به سرتیترهای h2/h3 محتوا `id` می‌دهد و فهرست مطالب را برمی‌گرداند.
 *
 * عمداً با regex انجام می‌شود نه با DOM parser: محتوا از ادیتور Tiptap می‌آید
 * (HTML تمیز و قابل‌پیش‌بینی) و افزودن یک وابستگی برای این کار توجیه ندارد.
 * اگر سرتیتر از قبل `id` داشته باشد دست نمی‌خورد.
 */
export function withToc(html: string | null | undefined): { html: string; toc: TocItem[] } {
  if (!html) return { html: "", toc: [] };
  const toc: TocItem[] = [];
  let i = 0;

  const out = html.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, lvlRaw: string, attrs: string, inner: string) => {
      const level = Number(lvlRaw) as 2 | 3;
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (!text) return match;

      const existing = /\sid=["']([^"']+)["']/i.exec(attrs);
      const id = existing ? existing[1] : headingId(text, i++);
      toc.push({ id, text, level });

      return existing
        ? match
        : `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
    }
  );

  return { html: out, toc };
}
