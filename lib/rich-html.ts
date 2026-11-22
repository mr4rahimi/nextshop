/**
 * آماده‌سازی HTML ذخیره‌شده‌ی ادیتور برای نمایش در سایت.
 *
 * - هر جدول در `.rc-table-wrap` پیچیده می‌شود تا در موبایل فقط جدول اسکرول شود
 * - به H2/H3 شناسه داده می‌شود و فهرست مطالب از همان‌ها ساخته می‌شود
 * - لینک داخلی nofollow نمی‌ماند (نسخه‌های قبلی ادیتور همه‌ی لینک‌ها را
 *   nofollow و «تب جدید» ذخیره می‌کردند)
 * - تصاویر lazy می‌شوند، جز اولی که ممکن است LCP باشد
 *
 * با رشته کار می‌کند (بدون DOM) تا روی سرور و کلاینت یکسان باشد.
 */

export interface RichHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function isInternalHref(href: string, siteHost?: string) {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  if (!siteHost) return false;
  try { return new URL(href).host.replace(/^www\./, "") === siteHost.replace(/^www\./, ""); } catch { return false; }
}

export function enhanceRichHtml(
  html: string,
  /** `fallbackAlt`: متن جایگزین تصویرهای بی‌alt — نزدیک‌ترین تیتر قبل از تصویر، وگرنه همین متن (عنوان مطلب) */
  opts: { siteHost?: string; fallbackAlt?: string } = {},
): { html: string; headings: RichHeading[] } {
  const headings: RichHeading[] = [];
  let idx = 0;

  let out = (html || "").replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, attrs: string, inner: string) => {
    const text = stripTags(inner);
    if (!text) return `<h${lvl}${attrs}>${inner}</h${lvl}>`;
    const existing = attrs.match(/\bid="([^"]+)"/i)?.[1];
    const id = existing ?? `heading-${idx++}`;
    headings.push({ id, text, level: Number(lvl) as 2 | 3 });
    const a = existing ? attrs : `${attrs} id="${id}"`;
    return `<h${lvl}${a}>${inner}</h${lvl}>`;
  });

  // جدول‌هایی که قبلاً پیچیده شده‌اند (tableWrapper ادیتور) دوباره پیچیده نشوند
  out = out.replace(/<div class="tableWrapper">\s*(<table[\s\S]*?<\/table>)\s*<\/div>/gi, "$1");
  out = out.replace(/<table([\s\S]*?)<\/table>/gi, m => `<div class="rc-table-wrap">${m}</div>`);

  out = out.replace(/<a\b([^>]*)>/gi, (m, attrs: string) => {
    const href = attrs.match(/\bhref="([^"]*)"/i)?.[1] ?? "";
    if (!isInternalHref(href, opts.siteHost)) return m;
    const cleaned = attrs
      .replace(/\s*target="_blank"/i, "")
      .replace(/\brel="([^"]*)"/i, (_r, v: string) => {
        const rest = v.split(/\s+/).filter(x => x && !/^(nofollow|noopener|noreferrer)$/i.test(x));
        return rest.length ? `rel="${rest.join(" ")}"` : "";
      });
    return `<a${cleaned}>`;
  });

  // تصویر بی‌alt یا با alt خالی (محتوای منتقل‌شده از وردپرس) برای گوگل‌ایمیج بی‌معناست
  const fallbackAlt = opts.fallbackAlt?.trim();
  if (fallbackAlt) {
    const marks = [...out.matchAll(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi)].map(h => ({ at: h.index ?? 0, text: stripTags(h[2]) }));
    out = out.replace(/<img\b[^>]*>/gi, (m, offset: number) => {
      if (/\balt="[^"]*[^"\s][^"]*"/i.test(m)) return m;
      const near = marks.filter(h => h.at < offset && h.text).pop()?.text;
      const alt = escapeAttr(near ? `${fallbackAlt} — ${near}` : fallbackAlt);
      return /\balt="[^"]*"/i.test(m) ? m.replace(/\balt="[^"]*"/i, `alt="${alt}"`) : m.replace(/^<img\b/i, `<img alt="${alt}"`);
    });
  }

  let imgIdx = 0;
  out = out.replace(/<img\b([^>]*?)\s*\/?>/gi, (m, attrs: string) => {
    const first = imgIdx++ === 0;
    if (/\bloading=/i.test(attrs)) return first ? m.replace(/\sloading="lazy"/i, "") : m;
    return first ? m : `<img${attrs} loading="lazy" decoding="async">`;
  });

  return { html: out, headings };
}

function escapeAttr(v: string) {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
