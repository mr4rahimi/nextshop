/**
 * تحلیل متن — شمارش، جمله‌ها و پاراگراف‌ها با جایگاه، کلمه‌ی کلیدی، عبارت‌های
 * پرتکرار، ترکیب نویسه‌ها، پیامک، طول وزنی ایکس و سادگی خواندن.
 *
 * خالص و بدون وابستگی؛ در مرورگر و سرور یکسان اجرا می‌شود.
 * هم‌نسخه‌ی CRM برتر: features/text-counter/utils/text-stats.ts — تغییر در
 * یکی، در دیگری هم لازم است (هم‌چنین text-fix.ts، text-profiles.ts و
 * text-similarity.ts).
 *
 * مستندات: docs/features/tools.md بخش «کاراکترشمار»
 */

/** سرعت‌های میانگین فارسی — کلمه در دقیقه */
export const READ_WPM = 200;
export const SPEAK_WPM = 130;
export const TYPE_WPM = 35;
/** جمله‌ی بلندتر از این سخت خوانده می‌شود */
export const LONG_SENTENCE = 20;

export const ZWNJ = "\u200c";
const SENTENCE_END = /[.!?؟…]+(?=\s|$|["»)\]])/gu;
/** کلمه یعنی توکنی که دست‌کم یک حرف یا رقم دارد؛ «—» و «:» تنها کلمه نیستند */
const HAS_LETTER = /[\p{L}\p{N}]/u;
const HASHTAG = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;
const MENTION = /(^|[^\p{L}\p{N}_.])@([A-Za-z0-9_.]{2,})/gu;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s«»"<>]+/giu;
const EMOJI = /\p{Extended_Pictographic}/gu;

// ── تکه‌ها با جایگاه ─────────────────────────────────────────────────────

/** بازه‌ای از متن اصلی — برای علامت‌گذاری */
export interface Span {
  start: number;
  end: number;
  words: number;
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/u).filter((w) => HAS_LETTER.test(w));
}

/** پاراگراف = هر خط غیرخالی؛ متن‌های فارسی (پیامک، کپشن، چت) معمولاً با یک Enter جدا می‌شوند */
export function paragraphSpans(text: string): Span[] {
  const out: Span[] = [];
  const re = /[^\n]+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!HAS_LETTER.test(m[0])) continue;
    out.push({ start: m.index, end: m.index + m[0].length, words: splitWords(m[0]).length });
  }
  return out;
}

/**
 * جمله با . ! ? ؟ … تمام می‌شود — به شرط فاصله یا پایان بعدش، تا «۲.۵» و
 * «example.com» دو جمله نشوند. انتهای هر پاراگراف هم پایان جمله است، حتی بی‌نقطه.
 */
export function sentenceSpans(text: string): Span[] {
  const out: Span[] = [];
  for (const p of paragraphSpans(text)) {
    const line = text.slice(p.start, p.end);
    let from = 0;
    const push = (to: number) => {
      const seg = line.slice(from, to);
      if (HAS_LETTER.test(seg)) {
        const lead = seg.length - seg.trimStart().length;
        out.push({ start: p.start + from + lead, end: p.start + to, words: splitWords(seg).length });
      }
    };
    SENTENCE_END.lastIndex = 0;
    for (let m = SENTENCE_END.exec(line); m; m = SENTENCE_END.exec(line)) {
      push(m.index + m[0].length);
      from = m.index + m[0].length;
    }
    push(line.length);
  }
  return out;
}

// ── توکن برای مقایسه ─────────────────────────────────────────────────────

const LATIN_DIGIT: Record<string, string> = {};
"۰۱۲۳۴۵۶۷۸۹".split("").forEach((d, i) => (LATIN_DIGIT[d] = String(i)));
"٠١٢٣٤٥٦٧٨٩".split("").forEach((d, i) => (LATIN_DIGIT[d] = String(i)));

/**
 * یکسان‌سازی برای مقایسه: ي/ك/ى/ة/ۀ، آ/أ/إ، اعراب و کشیده، ارقام فارسی و
 * حروف بزرگ لاتین. «كتاب» و «کتاب» یکی‌اند و «۱۵» با «15».
 */
export function normalizeToken(w: string): string {
  return w
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ةۀە]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[۰-۹٠-٩]/g, (d) => LATIN_DIGIT[d] ?? d)
    .toLowerCase();
}

export interface Token {
  /** شکل یکسان‌شده */
  w: string;
  start: number;
  end: number;
}

/**
 * توکن‌های حرف و رقم با جایگاه. نیم‌فاصله جداکننده است، پس «می‌خواهم» و
 * «می خواهم» در مقایسه و جستجوی کلمه‌ی کلیدی یکی‌اند.
 */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /[\p{L}\p{N}\p{M}ـ]+/gu;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const w = normalizeToken(m[0]);
    if (w) out.push({ w, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

// ── آمار ─────────────────────────────────────────────────────────────────

export interface SmsInfo {
  unicode: boolean;
  parts: number;
  /** جای خالی در همین بخش آخر */
  left: number;
  perPart: number;
  length: number;
}

export interface Composition {
  persian: number;
  latin: number;
  digits: number;
  spaces: number;
  punct: number;
  emoji: number;
  other: number;
}

export interface TextStats {
  words: number;
  uniqueWords: number;
  chars: number;
  charsNoSpace: number;
  letters: number;
  sentences: Span[];
  paragraphs: Span[];
  lines: number;
  /** ثانیه */
  readSec: number;
  speakSec: number;
  typeSec: number;
  longestSentence: number;
  avgSentence: number;
  avgParagraph: number;
  /** درصد جمله‌های بلندتر از LONG_SENTENCE */
  longShare: number;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  emojis: number;
  halfSpaces: number;
  composition: Composition;
  sms: SmsInfo;
  /** طول با وزن ایکس (توییتر): لینک ۲۳، ایموجی و خط‌های شرق آسیا ۲ */
  xLength: number;
  readability: Readability;
}

// GSM-7: پیامک لاتین ۱۶۰ کاراکتری. هر حرف بیرون از آن (فارسی، ایموجی) کل پیامک را یونیکد می‌کند.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";

export function smsInfo(text: string): SmsInfo {
  const chars = Array.from(text);
  const unicode = chars.some((c) => !GSM_BASIC.includes(c) && !GSM_EXT.includes(c));
  // یونیکد بر حسب واحد UTF-16 شمرده می‌شود؛ ایموجی دو واحد است
  const length = unicode ? text.length : chars.reduce((n, c) => n + (GSM_EXT.includes(c) ? 2 : 1), 0);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  if (length === 0) return { unicode, parts: 0, left: single, perPart: single, length };
  if (length <= single) return { unicode, parts: 1, left: single - length, perPart: single, length };
  const parts = Math.ceil(length / multi);
  return { unicode, parts, left: parts * multi - length, perPart: multi, length };
}

/** قاعده‌ی twitter-text: این بازه‌ها وزن ۱ دارند (فارسی و لاتین هم)، بقیه ۲؛ هر لینک ۲۳ */
export function xWeightedLength(text: string): number {
  let n = 0;
  const rest = text.replace(URL_RE, () => {
    n += 23;
    return "";
  });
  for (const c of rest) {
    const cp = c.codePointAt(0)!;
    const light =
      cp <= 4351 || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247);
    n += light ? 1 : 2;
  }
  return n;
}

function composition(text: string): Composition {
  const c: Composition = { persian: 0, latin: 0, digits: 0, spaces: 0, punct: 0, emoji: 0, other: 0 };
  for (const ch of text.replace(/\r/g, "")) {
    if (/\p{Extended_Pictographic}/u.test(ch)) c.emoji++;
    else if (/[؀-ۿﭐ-﷿ﹰ-﻿]/.test(ch) && !/[۰-۹٠-٩،؛؟]/.test(ch)) c.persian++;
    else if (/[A-Za-zÀ-ɏ]/.test(ch)) c.latin++;
    else if (/[0-9۰-۹٠-٩]/.test(ch)) c.digits++;
    else if (/\s/u.test(ch) || ch === ZWNJ) c.spaces++;
    else if (/[\p{P}\p{S}]/u.test(ch)) c.punct++;
    else if (!/[️‍]/.test(ch)) c.other++;
  }
  return c;
}

export interface Readability {
  /** ۰ تا ۱۰۰ — بالاتر یعنی ساده‌تر */
  score: number;
  label: "ساده" | "متوسط" | "دشوار" | "—";
}

/**
 * سادگی خواندن — فرمول‌های فلش و دیانی برای فارسی هجا می‌خواهند و هجای فارسی
 * بدون اعراب قابل شمردن نیست؛ پس نمره از سه چیز قابل‌اندازه‌گیری ساخته می‌شود:
 * میانگین طول جمله، سهم جمله‌های بلند و میانگین طول پاراگراف.
 */
export function readability(avgSentence: number, longShare: number, avgParagraph: number, words: number): Readability {
  if (words < 30) return { score: 0, label: "—" };
  let s = 100;
  s -= Math.max(0, avgSentence - 12) * 3;
  s -= longShare * 0.4;
  s -= Math.max(0, avgParagraph - 90) * 0.25;
  const score = Math.max(0, Math.min(100, Math.round(s)));
  return { score, label: score >= 70 ? "ساده" : score >= 45 ? "متوسط" : "دشوار" };
}

export function textStats(text: string): TextStats {
  const wordList = splitWords(text);
  const words = wordList.length;
  const sentences = sentenceSpans(text);
  const paragraphs = paragraphSpans(text);
  const chars = Array.from(text.replace(/\r/g, ""));
  const lens = sentences.map((s) => s.words);
  const long = lens.filter((n) => n > LONG_SENTENCE).length;
  const avgSentence = lens.length ? Math.round(words / lens.length) : 0;
  const avgParagraph = paragraphs.length ? Math.round(words / paragraphs.length) : 0;
  const longShare = lens.length ? Math.round((long / lens.length) * 100) : 0;
  const comp = composition(text);
  return {
    words,
    uniqueWords: new Set(tokenize(text).map((t) => t.w)).size,
    chars: chars.length,
    charsNoSpace: chars.filter((c) => !/\s/u.test(c) && c !== ZWNJ).length,
    letters: comp.persian + comp.latin,
    sentences,
    paragraphs,
    lines: text ? text.split("\n").length : 0,
    readSec: Math.round((words / READ_WPM) * 60),
    speakSec: Math.round((words / SPEAK_WPM) * 60),
    typeSec: Math.round((words / TYPE_WPM) * 60),
    longestSentence: lens.length ? Math.max(...lens) : 0,
    avgSentence,
    avgParagraph,
    longShare,
    hashtags: [...text.matchAll(HASHTAG)].map((m) => m[2] ?? ""),
    mentions: [...text.matchAll(MENTION)].map((m) => m[2] ?? ""),
    urls: text.match(URL_RE) ?? [],
    emojis: (text.match(EMOJI) ?? []).length,
    halfSpaces: text.split(ZWNJ).length - 1,
    composition: comp,
    sms: smsInfo(text),
    xLength: xWeightedLength(text),
    readability: readability(avgSentence, longShare, avgParagraph, words),
  };
}

// ── کلمات و عبارت‌های پرتکرار ────────────────────────────────────────────

/** حروف ربط و اضافه و فعل‌های کمکی پرکاربرد — در «پرتکرار» شمرده نمی‌شوند */
export const STOP_WORDS = new Set(
  (
    "و در به از که را با این آن است هست بود شد می نمی هم یا تا برای بر یک های ها ای " +
    "اما اگر چه چون نه هر همه خود من تو او ما شما انها ایشان باید شود کرد کند کنند " +
    "دارد دارند داشت شده نیز پس ولی بی دیگر روی زیر بین پیش بعد مثل مانند " +
    "رو یه اون دیگه خیلی فقط کنید کنیم کرده کردن شوند شود بوده باشد باشند اند ام " +
    "ان اینکه انکه چرا چطور چگونه وقتی حتی همین همان چند کدام کجا اینجا انجا " +
    "the a an and or of to in on for is are was be it this that with as at by from"
  ).split(" "),
);

export interface WordFreq {
  word: string;
  count: number;
  /** درصد از کل کلمات */
  density: number;
}

/** کلمه‌های پرتکرار — روی توکن‌ها، پس «می‌خواهم» دو توکن «می» و «خواهم» است و «می» حذف می‌شود */
export function topWords(text: string, limit = 12): WordFreq[] {
  const toks = tokenize(text);
  const map = new Map<string, number>();
  for (const { w } of toks) {
    if (Array.from(w).length < 2 || STOP_WORDS.has(w) || /^\d+$/.test(w)) continue;
    map.set(w, (map.get(w) ?? 0) + 1);
  }
  return [...map.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count, density: Math.round((count / toks.length) * 1000) / 10 }));
}

/** عبارت‌های دو و سه کلمه‌ای پرتکرار — عبارتی که با حرف ربط شروع یا تمام شود حساب نمی‌شود */
export function topPhrases(text: string, n: 2 | 3, limit = 10): WordFreq[] {
  const toks = tokenize(text).map((t) => t.w);
  const map = new Map<string, number>();
  for (let i = 0; i + n <= toks.length; i++) {
    const g = toks.slice(i, i + n);
    if (STOP_WORDS.has(g[0]!) || STOP_WORDS.has(g[n - 1]!)) continue;
    const key = g.join(" ");
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count, density: Math.round(((count * n) / Math.max(1, toks.length)) * 1000) / 10 }));
}

// ── کلمه‌ی کلیدی ─────────────────────────────────────────────────────────

export interface KeywordStats {
  keyword: string;
  count: number;
  /** درصد کلمات متن که جزء کلمه‌ی کلیدی‌اند */
  density: number;
  inFirstParagraph: boolean;
  /** در ۱۰٪ اول متن (برای عنوان: نیمه‌ی اول) */
  nearStart: boolean;
  /** جایگاه‌ها برای علامت‌گذاری */
  hits: { start: number; end: number }[];
}

export function keywordStats(text: string, keyword: string): KeywordStats | null {
  const kw = tokenize(keyword).map((t) => t.w);
  if (!kw.length) return null;
  const toks = tokenize(text);
  const hits: { start: number; end: number }[] = [];
  for (let i = 0; i + kw.length <= toks.length; i++) {
    if (kw.every((w, j) => toks[i + j]?.w === w)) {
      hits.push({ start: toks[i]!.start, end: toks[i + kw.length - 1]!.end });
      i += kw.length - 1;
    }
  }
  const firstPara = paragraphSpans(text)[0];
  return {
    keyword: keyword.trim(),
    count: hits.length,
    density: toks.length ? Math.round(((hits.length * kw.length) / toks.length) * 1000) / 10 : 0,
    inFirstParagraph: !!firstPara && hits.some((h) => h.start < firstPara.end),
    nearStart: hits.length > 0 && hits[0]!.start <= Math.max(text.length * 0.1, 60),
    hits,
  };
}

// ── قالب‌بندی ────────────────────────────────────────────────────────────

const fa = (n: number) => n.toLocaleString("fa-IR");

/** «۳۲ ثانیه»، «۲ دقیقه و ۱۰ ثانیه»، «۱ ساعت و ۵ دقیقه» */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${fa(sec)} ثانیه`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return m ? `${fa(h)} ساعت و ${fa(m)} دقیقه` : `${fa(h)} ساعت`;
  return s ? `${fa(m)} دقیقه و ${fa(s)} ثانیه` : `${fa(m)} دقیقه`;
}

/** کوتاه برای جای تنگ: «۴۰ ثانیه»، «۴ دقیقه»، «۱:۰۵ ساعت» */
export function formatDurationShort(sec: number): string {
  if (sec < 60) return `${fa(sec)} ثانیه`;
  if (sec < 3600) return `${fa(Math.round(sec / 60))} دقیقه`;
  const m = Math.round(sec / 60);
  return `${fa(Math.floor(m / 60))}:${fa(m % 60).padStart(2, "۰")} ساعت`;
}
