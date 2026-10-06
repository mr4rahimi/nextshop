/**
 * درصد تکراری بودن متن نسبت به محتوای خود سایت — روش «شینگل»: هر پنج کلمه‌ی
 * پشت‌سرهم یک اثر انگشت است. هر کلمه‌ی متن که داخل دست‌کم یک اثر انگشتِ
 * پیداشده در منبعی دیگر باشد «تکراری» است. درصد = کلمه‌های تکراری ÷ کل.
 *
 * متن ورودی یک‌بار اثر انگشت می‌گیرد و منبع‌ها یکی‌یکی از رویش رد می‌شوند،
 * پس حافظه به اندازه‌ی متن ورودی است نه کل سایت.
 *
 * خالص. هم‌نسخه‌ی CRM برتر: features/text-counter/utils/text-similarity.ts
 * مستندات: docs/features/tools.md بخش «کاراکترشمار»
 */

import { tokenize } from "./text-stats";

export const SHINGLE = 5;
/** متن کوتاه‌تر از این بررسی نمی‌شود — پنج کلمه‌ی مشترک در متن کوتاه معنی ندارد */
export const MIN_WORDS = 15;
export const MAX_CHARS = 100_000;

/** هش ۵۳ بیتی cyrb53 — برخورد در چند میلیون شینگل عملاً صفر است */
function hash(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', zwnj: "\u200c", laquo: "«", raquo: "»" };

/** HTML ← متن ساده؛ بلوک‌ها خط جدا می‌شوند تا شینگل از مرز دو پاراگراف رد نشود */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|br|tr|td|th|section|article|blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}

/** همه‌ی رشته‌های داخل یک JSON (بلوک‌های لندینگ، FAQ) — کلیدها و آدرس‌ها نه */
export function jsonText(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (!/^(https?:|\/|#|[a-z0-9_-]+$)/i.test(value.trim())) out.push(value);
  } else if (Array.isArray(value)) value.forEach((v) => jsonText(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => jsonText(v, out));
  return out;
}

function shingles(words: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + SHINGLE <= words.length; i++) out.push(hash(words.slice(i, i + SHINGLE).join(" ")));
  return out;
}

export interface DupSource {
  id: string;
  /** «محصول»، «مقاله»، … */
  kind: string;
  title: string;
  /** آدرس عمومی یا پنل */
  url?: string | null;
  text: string;
}

export interface DupMatch {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  /** درصد کلمات متن ورودی که در این منبع هست */
  percent: number;
  /** بازه‌های اندیس توکن [از، تا) در متن ورودی */
  ranges: [number, number][];
}

export interface DupResult {
  percent: number;
  /** تعداد توکن متن ورودی */
  words: number;
  scanned: number;
  matches: DupMatch[];
  /** اجتماع همه‌ی بازه‌ها */
  ranges: [number, number][];
}

function toRanges(mask: Uint8Array): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const s = i;
    while (i < mask.length && mask[i]) i++;
    out.push([s, i]);
  }
  return out;
}

const count = (mask: Uint8Array) => mask.reduce((n, v) => n + v, 0);

export function createDuplicateScanner(input: string) {
  const words = tokenize(input).map((t) => t.w);
  /** هش ← جایگاه‌های شروع در متن ورودی */
  const index = new Map<number, number[]>();
  shingles(words).forEach((h, i) => {
    const list = index.get(h);
    if (list) list.push(i);
    else index.set(h, [i]);
  });
  const hits = new Map<string, { src: Omit<DupSource, "text">; mask: Uint8Array }>();
  let scanned = 0;

  return {
    add(src: DupSource) {
      scanned++;
      if (!index.size) return;
      const toks = tokenize(src.text).map((t) => t.w);
      let mask: Uint8Array | null = null;
      for (const h of shingles(toks)) {
        const at = index.get(h);
        if (!at) continue;
        mask ??= new Uint8Array(words.length);
        for (const p of at) for (let k = 0; k < SHINGLE; k++) mask[p + k] = 1;
      }
      if (!mask) return;
      const prev = hits.get(src.id);
      if (prev) prev.mask.forEach((v, i) => (mask![i] |= v));
      hits.set(src.id, { src: { id: src.id, kind: src.kind, title: src.title, url: src.url }, mask });
    },

    result(limit = 10): DupResult {
      const all = new Uint8Array(words.length);
      const matches: DupMatch[] = [];
      for (const { src, mask } of hits.values()) {
        mask.forEach((v, i) => (all[i] |= v));
        matches.push({
          id: src.id,
          kind: src.kind,
          title: src.title,
          url: src.url ?? null,
          percent: Math.round((count(mask) / words.length) * 1000) / 10,
          ranges: toRanges(mask),
        });
      }
      matches.sort((a, b) => b.percent - a.percent);
      return {
        percent: words.length ? Math.round((count(all) / words.length) * 1000) / 10 : 0,
        words: words.length,
        scanned,
        matches: matches.slice(0, limit),
        ranges: toRanges(all),
      };
    },
  };
}

/** بازه‌های توکن ← بازه‌های کاراکتر در متن اصلی، برای علامت‌گذاری */
export function tokenRangesToChars(text: string, ranges: [number, number][]): { start: number; end: number }[] {
  const toks = tokenize(text);
  return ranges
    .filter(([a, b]) => toks[a] && toks[b - 1])
    .map(([a, b]) => ({ start: toks[a].start, end: toks[b - 1].end }));
}
