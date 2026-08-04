const MAP: Record<string, string> = {
  "ا":"a","آ":"a","أ":"a","إ":"a","ب":"b","پ":"p","ت":"t","ث":"s","ج":"j",
  "چ":"ch","ح":"h","خ":"kh","د":"d","ذ":"z","ر":"r","ز":"z","ژ":"zh",
  "س":"s","ش":"sh","ص":"s","ض":"z","ط":"t","ظ":"z","ع":"a","غ":"gh",
  "ف":"f","ق":"gh","ک":"k","ك":"k","گ":"g","ل":"l","م":"m","ن":"n",
  "و":"v","ه":"h","ی":"i","ي":"i","ئ":"y","ة":"h",
  "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
};

export const RESERVED_SLUGS = new Set([
  "q", "category", "brand", "sort", "page", "pageSize",
  "minPrice", "maxPrice", "attr", "utm_source", "utm_medium", "utm_campaign",
]);

/** فارسی → لاتین، سپس slug استاندارد */
export function slugify(raw: string, maxLen = 80): string {
  const clean = raw.trim().replace(/\u200c/g, " ").replace(/\s+/g, " ");
  return [...clean].map(ch => MAP[ch] ?? ch).join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/, "");
}

/** slug معتبر: a-z0-9 با خط تیره، حداقل ۲ کاراکتر، غیر رزروشده */
export function isValidSlug(s: string | null | undefined): s is string {
  if (!s || s.length < 2) return false;
  if (RESERVED_SLUGS.has(s)) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
}

/** slug پیشنهادی برای صفحه فرود از روی دسته و فیلترها */
export function suggestLandingSlug(
  categorySlug: string,
  filters: Record<string, string>
): string {
  const parts = Object.keys(filters).sort().map(k => filters[k]);
  return [categorySlug, ...parts].filter(Boolean).join("-").slice(0, 80);
}