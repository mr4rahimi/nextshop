/**
 * لینک داخل متن ساده — توضیحات دسته، متن صفحه‌ی فرود و متن کارشناسی محصول.
 *
 * این فیلدها HTML نیستند (متن ساده با خط جدید)؛ لینک به شکل مارک‌داون
 * `[متن لینک](/collections/kharid-printer)` ذخیره می‌شود و سایت آن را با
 * `components/store/LinkedText.tsx` به لینک واقعی تبدیل می‌کند. هر جا متن
 * به متا، اسکیما یا خوراک می‌رود باید با `stripTextLinks` ساده شود.
 */

export type TextSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string; internal: boolean };

// متن داخل [] نباید ] یا خط جدید داشته باشد؛ آدرس فاصله و ) ندارد
const LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/** فقط مسیر داخلی، http(s)، tel و mailto؛ javascript: و مانند آن لینک نمی‌شوند */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (/^https?:\/\/[^\s]+$/i.test(href)) return href;
  if (/^(tel|mailto):[^\s]+$/i.test(href)) return href;
  return null;
}

/** آدرس کامل همین سایت به مسیر نسبی تبدیل می‌شود تا لینک داخلی حساب شود */
export function normalizeHref(raw: string, siteHost?: string): { href: string; internal: boolean } | null {
  const href = safeHref(raw);
  if (!href) return null;
  if (href.startsWith("/")) return { href, internal: true };
  if (siteHost && /^https?:/i.test(href)) {
    try {
      const u = new URL(href);
      if (u.host.replace(/^www\./, "") === siteHost.replace(/^www\./, "")) {
        return { href: `${u.pathname}${u.search}${u.hash}` || "/", internal: true };
      }
    } catch { /* آدرس نامعتبر؛ همان بیرونی می‌ماند */ }
  }
  return { href, internal: false };
}

export function parseTextLinks(text: string, siteHost?: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of (text ?? "").matchAll(LINK_RE)) {
    const link = normalizeHref(m[2], siteHost);
    if (!link) continue; // آدرس ناامن همان متن خام می‌ماند
    if (m.index! > last) out.push({ type: "text", text: text.slice(last, m.index) });
    out.push({ type: "link", text: m[1], ...link });
    last = m.index! + m[0].length;
  }
  if (last < (text ?? "").length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** `[متن](آدرس)` ← `متن`؛ برای متا، اسکیما، خوراک و شمارش کلمه */
export function stripTextLinks(text: string | null | undefined): string {
  return (text ?? "").replace(LINK_RE, "$1");
}

export function countTextLinks(text: string | null | undefined): number {
  return [...(text ?? "").matchAll(LINK_RE)].filter(m => safeHref(m[2])).length;
}
