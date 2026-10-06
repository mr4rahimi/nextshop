/**
 * تحلیلگر سئوی مقاله — همان کاری که Yoast/RankMath در وردپرس می‌کنند، ولی
 * فقط در مرورگر و روی همان HTML خروجی ادیتور. هیچ‌چیز ذخیره نمی‌شود؛ فرم
 * مقاله با هر تغییر دوباره صدایش می‌زند.
 *
 * متن فارسی پیش از مقایسه یکدست می‌شود (ي/ك عربی، نیم‌فاصله، اعراب) تا
 * «کتاب‌خانه» و «كتاب خانه» یک کلمه حساب شوند.
 */

export type SeoStatus = "good" | "warn" | "bad";

export interface SeoCheck {
  id: string;
  group: "keyword" | "meta" | "content" | "media" | "links";
  status: SeoStatus;
  title: string;
  hint?: string;
}

export interface SeoInput {
  title: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
  excerpt: string;
  content: string;
  focusKeyword: string;
  coverImage: string;
  faqCount: number;
  noIndex?: boolean;
}

export interface SeoStats {
  words: number;
  chars: number;
  paragraphs: number;
  headings: { h2: number; h3: number; h4: number };
  images: number;
  imagesNoAlt: number;
  tables: number;
  internalLinks: number;
  externalLinks: number;
  keywordCount: number;
  density: number;
  readingMinutes: number;
}

export interface SeoReport {
  score: number;
  checks: SeoCheck[];
  stats: SeoStats;
}

/** یکدست‌سازی برای مقایسه — نه برای نمایش */
export function normalizeFa(s: string): string {
  return s
    .replace(/ي/g, "ی").replace(/ى/g, "ی").replace(/ك/g, "ک")
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[‌‏‎]/g, " ")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|td|th|blockquote|div)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0, i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

/** آیا کلمه‌ی کلیدی (یا همه‌ی کلمه‌هایش) در متن هست */
function hasKeyword(text: string, kw: string): boolean {
  const t = normalizeFa(text);
  if (!kw) return false;
  if (t.includes(kw)) return true;
  const parts = kw.split(" ").filter(p => p.length > 1);
  return parts.length > 1 && parts.every(p => t.includes(p));
}

function isInternal(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  if (href.startsWith("#")) return false;
  if (typeof window !== "undefined") {
    try { return new URL(href, window.location.href).host === window.location.host; } catch { return false; }
  }
  return false;
}

export function analyzeSeo(input: SeoInput): SeoReport {
  const html = input.content || "";
  const text = htmlToText(html);
  const words = countWords(text);
  const kw = normalizeFa(input.focusKeyword || "");
  const normText = normalizeFa(text);

  const h2 = (html.match(/<h2[\s>]/gi) ?? []).length;
  const h3 = (html.match(/<h3[\s>]/gi) ?? []).length;
  const h4 = (html.match(/<h4[\s>]/gi) ?? []).length;
  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  const headingTexts = [...html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)].map(m => htmlToText(m[1]));

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesNoAlt = imgTags.filter(t => !/\balt="[^"]+"/i.test(t)).length;
  const altTexts = imgTags.map(t => (t.match(/\balt="([^"]*)"/i)?.[1] ?? ""));

  const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map(m => m[1]);
  const internalLinks = hrefs.filter(isInternal).length;
  const externalLinks = hrefs.filter(h => /^https?:\/\//i.test(h) && !isInternal(h)).length;

  const tables = (html.match(/<table[\s>]/gi) ?? []).length;
  const tablesNoHeader = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].filter(m => !/<th[\s>]/i.test(m[0])).length;

  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => htmlToText(m[1])).filter(Boolean);
  const longParagraphs = paragraphs.filter(p => countWords(p) > 150).length;
  const firstParagraph = paragraphs[0] ?? "";

  const keywordCount = kw ? countOccurrences(normText, kw) : 0;
  const kwWords = kw ? kw.split(" ").length : 1;
  const density = words > 0 && kw ? (keywordCount * kwWords * 100) / words : 0;

  const seoTitle = (input.seoTitle || input.title || "").trim();
  const metaDesc = (input.seoDescription || input.excerpt || "").trim();

  const checks: SeoCheck[] = [];
  const add = (c: SeoCheck) => checks.push(c);

  // ── کلمه‌ی کلیدی ──
  if (!kw) {
    add({ id: "kw", group: "keyword", status: "bad", title: "کلمه‌ی کلیدی اصلی تعیین نشده",
      hint: "یک عبارت که می‌خواهید مقاله با آن در گوگل دیده شود بنویسید؛ بقیه‌ی بررسی‌ها بر پایه‌ی آن است." });
  } else {
    add({ id: "kw-title", group: "keyword", status: hasKeyword(input.title, kw) ? "good" : "bad",
      title: hasKeyword(input.title, kw) ? "کلمه‌ی کلیدی در عنوان مقاله هست" : "کلمه‌ی کلیدی در عنوان مقاله نیست" });
    add({ id: "kw-seotitle", group: "keyword", status: hasKeyword(seoTitle, kw) ? "good" : "bad",
      title: hasKeyword(seoTitle, kw) ? "کلمه‌ی کلیدی در عنوان سئو هست" : "کلمه‌ی کلیدی در عنوان سئو نیست",
      hint: normalizeFa(seoTitle).startsWith(kw) ? undefined : "بهتر است عنوان سئو با کلمه‌ی کلیدی شروع شود." });
    add({ id: "kw-desc", group: "keyword", status: hasKeyword(metaDesc, kw) ? "good" : "warn",
      title: hasKeyword(metaDesc, kw) ? "کلمه‌ی کلیدی در توضیح متا هست" : "کلمه‌ی کلیدی در توضیح متا نیامده" });
    add({ id: "kw-intro", group: "keyword", status: hasKeyword(firstParagraph, kw) ? "good" : "warn",
      title: hasKeyword(firstParagraph, kw) ? "کلمه‌ی کلیدی در پاراگراف اول آمده" : "کلمه‌ی کلیدی در پاراگراف اول نیامده",
      hint: "گوگل و خواننده هر دو از پاراگراف اول می‌فهمند مقاله درباره‌ی چیست." });
    const inHeading = headingTexts.some(h => hasKeyword(h, kw));
    add({ id: "kw-heading", group: "keyword", status: inHeading ? "good" : "warn",
      title: inHeading ? "کلمه‌ی کلیدی در یکی از سرتیترها هست" : "کلمه‌ی کلیدی در هیچ سرتیتری (H2–H4) نیست" });
    // اسلاگ لاتین است؛ کلمه‌ی کلیدی فارسی فقط با آوانویسی می‌تواند در آن باشد
    if (/^[a-z0-9\s-]+$/.test(kw)) {
      const inSlug = input.slug.includes(kw.replace(/\s+/g, "-"));
      add({ id: "kw-slug", group: "keyword", status: inSlug ? "good" : "warn",
        title: inSlug ? "کلمه‌ی کلیدی در آدرس (slug) هست" : "کلمه‌ی کلیدی در آدرس (slug) نیست" });
    }
    const altHit = altTexts.some(a => hasKeyword(a, kw));
    if (imgTags.length > 0) {
      add({ id: "kw-alt", group: "keyword", status: altHit ? "good" : "warn",
        title: altHit ? "کلمه‌ی کلیدی در متن جایگزین (alt) تصویری آمده" : "کلمه‌ی کلیدی در alt هیچ تصویری نیست" });
    }
    const d = Math.round(density * 10) / 10;
    add({ id: "kw-density", group: "keyword",
      status: keywordCount === 0 ? "bad" : density < 0.5 ? "warn" : density > 2.5 ? "bad" : "good",
      title: `تراکم کلمه‌ی کلیدی ${d.toLocaleString("fa-IR")}٪ (${keywordCount.toLocaleString("fa-IR")} بار)`,
      hint: density > 2.5 ? "تکرار بیش از حد، از نظر گوگل پرکردن کلمه‌ی کلیدی (keyword stuffing) است." : "محدوده‌ی مناسب ۰٫۵ تا ۲٫۵ درصد است." });
  }

  // ── متا ──
  const tLen = seoTitle.length;
  add({ id: "title-len", group: "meta", status: tLen >= 30 && tLen <= 60 ? "good" : tLen === 0 || tLen > 70 ? "bad" : "warn",
    title: `طول عنوان سئو ${tLen.toLocaleString("fa-IR")} کاراکتر`, hint: "بین ۳۰ تا ۶۰ کاراکتر؛ بیشتر از آن در نتایج گوگل بریده می‌شود." });
  const dLen = metaDesc.length;
  add({ id: "desc-len", group: "meta", status: dLen >= 110 && dLen <= 160 ? "good" : dLen === 0 ? "bad" : "warn",
    title: dLen === 0 ? "توضیح متا خالی است" : `طول توضیح متا ${dLen.toLocaleString("fa-IR")} کاراکتر`,
    hint: "بین ۱۱۰ تا ۱۶۰ کاراکتر، با دعوت به خواندن." });
  add({ id: "slug", group: "meta", status: input.slug && input.slug.length <= 75 ? "good" : input.slug ? "warn" : "warn",
    title: !input.slug ? "آدرس (slug) از روی عنوان ساخته می‌شود" : input.slug.length > 75 ? "آدرس مقاله طولانی است" : "آدرس مقاله کوتاه و خواناست" });
  add({ id: "excerpt", group: "meta", status: input.excerpt.trim() ? "good" : "warn",
    title: input.excerpt.trim() ? "خلاصه‌ی مقاله نوشته شده" : "خلاصه‌ی مقاله خالی است",
    hint: "در کارت مقاله و — اگر توضیح متا خالی باشد — در گوگل نمایش داده می‌شود." });
  if (input.noIndex) {
    add({ id: "noindex", group: "meta", status: "bad", title: "مقاله noindex است و در گوگل نمایه نمی‌شود" });
  }

  // ── محتوا ──
  add({ id: "length", group: "content", status: words >= 600 ? "good" : words >= 300 ? "warn" : "bad",
    title: `طول محتوا ${words.toLocaleString("fa-IR")} کلمه`, hint: "مقاله‌ی آموزشی/بررسی حداقل ۶۰۰ و ترجیحاً بیش از ۱۰۰۰ کلمه." });
  add({ id: "h2", group: "content", status: h2 >= 2 ? "good" : h2 === 1 ? "warn" : "bad",
    title: h2 >= 2 ? `${h2.toLocaleString("fa-IR")} سرتیتر H2 — فهرست مطالب ساخته می‌شود` : "سرتیتر H2 کافی ندارد",
    hint: h2 >= 2 ? undefined : "متن را با سرتیتر H2 بخش‌بندی کنید؛ فهرست مطالب صفحه از روی همین‌ها ساخته می‌شود." });
  if (h1 > 0) {
    add({ id: "h1", group: "content", status: "bad", title: "محتوا تیتر H1 دارد",
      hint: "عنوان مقاله خودش H1 صفحه است؛ داخل متن از H2 به پایین استفاده کنید." });
  }
  if (h3 > 0 && h2 === 0) {
    add({ id: "hierarchy", group: "content", status: "warn", title: "H3 بدون H2 آمده — سلسله‌مراتب سرتیترها به‌هم ریخته" });
  }
  add({ id: "paragraphs", group: "content", status: longParagraphs === 0 ? "good" : "warn",
    title: longParagraphs === 0 ? "پاراگراف‌ها کوتاه و خوانا هستند" : `${longParagraphs.toLocaleString("fa-IR")} پاراگراف بیش از ۱۵۰ کلمه`,
    hint: longParagraphs ? "پاراگراف بلند را بشکنید یا با فهرست و جدول خلاصه کنید." : undefined });
  if (tables > 0) {
    add({ id: "tables", group: "content", status: tablesNoHeader === 0 ? "good" : "warn",
      title: tablesNoHeader === 0 ? "جدول‌ها ردیف عنوان دارند" : `${tablesNoHeader.toLocaleString("fa-IR")} جدول بدون ردیف عنوان`,
      hint: tablesNoHeader ? "ردیف اول را «عنوان» کنید؛ گوگل جدول‌های دارای عنوان را در نتایج ویژه نشان می‌دهد." : undefined });
  }
  add({ id: "faq", group: "content", status: input.faqCount > 0 ? "good" : "warn",
    title: input.faqCount > 0 ? `${input.faqCount.toLocaleString("fa-IR")} سوال متداول — اسکیمای FAQ ساخته می‌شود` : "سوال متداول ندارد",
    hint: input.faqCount > 0 ? undefined : "چند سوال متداول در تب «سوالات متداول» شانس نمایش در «سوالات مرتبط» گوگل را بالا می‌برد." });

  // ── تصویر ──
  add({ id: "cover", group: "media", status: input.coverImage ? "good" : "bad",
    title: input.coverImage ? "تصویر شاخص دارد" : "تصویر شاخص ندارد", hint: input.coverImage ? undefined : "برای کارت مقاله، اشتراک در شبکه‌های اجتماعی و اسکیمای Article لازم است." });
  add({ id: "images", group: "media", status: imgTags.length > 0 ? "good" : "warn",
    title: imgTags.length > 0 ? `${imgTags.length.toLocaleString("fa-IR")} تصویر در متن` : "متن تصویری ندارد" });
  if (imgTags.length > 0) {
    add({ id: "alt", group: "media", status: imagesNoAlt === 0 ? "good" : "bad",
      title: imagesNoAlt === 0 ? "همه‌ی تصاویر متن جایگزین (alt) دارند" : `${imagesNoAlt.toLocaleString("fa-IR")} تصویر بدون متن جایگزین (alt)`,
      hint: imagesNoAlt ? "روی تصویر کلیک کنید و از نوار ابزار تصویر، alt را بنویسید." : undefined });
  }

  // ── لینک ──
  add({ id: "internal", group: "links", status: internalLinks >= 2 ? "good" : internalLinks === 1 ? "warn" : "bad",
    title: `${internalLinks.toLocaleString("fa-IR")} لینک داخلی`, hint: "به محصولات، دسته‌ها یا مقاله‌های مرتبط خودتان لینک بدهید (حداقل ۲)." });
  add({ id: "external", group: "links", status: externalLinks > 0 ? "good" : "warn",
    title: externalLinks > 0 ? `${externalLinks.toLocaleString("fa-IR")} لینک خارجی به منبع` : "لینک خارجی به منبع معتبر ندارد" });

  const weight = { good: 1, warn: 0.5, bad: 0 } as const;
  const score = checks.length ? Math.round((checks.reduce((s, c) => s + weight[c.status], 0) / checks.length) * 100) : 0;

  return {
    score,
    checks,
    stats: {
      words, chars: text.length, paragraphs: paragraphs.length,
      headings: { h2, h3, h4 }, images: imgTags.length, imagesNoAlt, tables,
      internalLinks, externalLinks, keywordCount, density,
      readingMinutes: Math.max(1, Math.round(words / 200)),
    },
  };
}

export function scoreTone(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "عالی", color: "#10b981" };
  if (score >= 60) return { label: "خوب", color: "#84cc16" };
  if (score >= 40) return { label: "متوسط", color: "#f59e0b" };
  return { label: "ضعیف", color: "#ef4444" };
}
