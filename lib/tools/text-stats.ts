/**
 * شمارش متن — کلمه، کاراکتر، جمله، پاراگراف، زمان خواندن و نوشتن، پیامک.
 *
 * خالص و بدون وابستگی؛ همه در مرورگر اجرا می‌شود و متن به سرور نمی‌رود.
 * همین فایل در CRM برتر هم هست (features/text-counter/utils/text-stats.ts)؛
 * تغییر در یکی، در دیگری هم لازم است.
 *
 * مستندات: docs/features/tools.md بخش «کاراکترشمار»
 */

/** سرعت‌های میانگین فارسی — کلمه در دقیقه */
export const READ_WPM = 200;
export const SPEAK_WPM = 130;
export const TYPE_WPM = 35;

const ZWNJ = "‌";
const SENTENCE_END = /[.!?؟…]+(?=\s|$|["»)\]])/gu;
/** کلمه یعنی توکنی که دست‌کم یک حرف یا رقم دارد؛ «—» و «:» تنها کلمه نیستند */
const HAS_LETTER = /[\p{L}\p{N}]/u;

export interface TextStats {
  words: number;
  chars: number;
  charsNoSpace: number;
  sentences: number;
  paragraphs: number;
  /** ثانیه */
  readSec: number;
  speakSec: number;
  typeSec: number;
  /** طولانی‌ترین جمله به کلمه */
  longestSentence: number;
  avgSentence: number;
  sms: SmsInfo;
}

export interface SmsInfo {
  unicode: boolean;
  parts: number;
  /** جای خالی در همین بخش آخر */
  left: number;
  perPart: number;
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/u).filter((w) => HAS_LETTER.test(w));
}

/** پاراگراف = هر خط غیرخالی؛ متن‌های فارسی (پیامک، کپشن، چت) معمولاً با یک Enter جدا می‌شوند */
export function splitParagraphs(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => HAS_LETTER.test(l));
}

/**
 * جمله با . ! ? ؟ … تمام می‌شود — به شرط فاصله یا پایان بعدش، تا «۲.۵» و
 * «example.com» دو جمله نشوند. انتهای هر پاراگراف هم پایان جمله است، حتی بی‌نقطه.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const p of splitParagraphs(text)) {
    for (const s of p.split(SENTENCE_END)) if (HAS_LETTER.test(s)) out.push(s.trim());
  }
  return out;
}

// GSM-7: پیامک لاتین ۱۶۰ کاراکتری. هر حرف بیرون از آن (فارسی، ایموجی) کل پیامک را یونیکد می‌کند.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";

export function smsInfo(text: string): SmsInfo {
  const chars = Array.from(text);
  const unicode = chars.some((c) => !GSM_BASIC.includes(c) && !GSM_EXT.includes(c));
  // یونیکد بر حسب واحد UTF-16 شمرده می‌شود؛ ایموجی دو واحد است
  const len = unicode ? text.length : chars.reduce((n, c) => n + (GSM_EXT.includes(c) ? 2 : 1), 0);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  if (len === 0) return { unicode, parts: 0, left: single, perPart: single };
  if (len <= single) return { unicode, parts: 1, left: single - len, perPart: single };
  const parts = Math.ceil(len / multi);
  return { unicode, parts, left: parts * multi - len, perPart: multi };
}

export function textStats(text: string): TextStats {
  const words = splitWords(text).length;
  const sentences = splitSentences(text);
  const lens = sentences.map((s) => splitWords(s).length);
  const chars = Array.from(text.replace(/\r/g, ""));
  return {
    words,
    chars: chars.length,
    charsNoSpace: chars.filter((c) => !/\s/u.test(c) && c !== ZWNJ).length,
    sentences: sentences.length,
    paragraphs: splitParagraphs(text).length,
    readSec: Math.round((words / READ_WPM) * 60),
    speakSec: Math.round((words / SPEAK_WPM) * 60),
    typeSec: Math.round((words / TYPE_WPM) * 60),
    longestSentence: lens.length ? Math.max(...lens) : 0,
    avgSentence: lens.length ? Math.round(words / lens.length) : 0,
    sms: smsInfo(text),
  };
}

// ── کلمات پرتکرار ─────────────────────────────────────────────────────────

/** حروف ربط و اضافه‌ی پرکاربرد — در «کلمات پرتکرار» شمرده نمی‌شوند */
const STOP_WORDS = new Set(
  (
    "و در به از که را با این آن است هست بود شد می نمی هم یا تا برای بر یک های ها ای " +
    "اما اگر چه چون نه هر همه خود من تو او ما شما آنها ایشان باید شود کرد کند کنند " +
    "دارد دارند داشت شده نیز پس ولی بی دیگر روی زیر بین پیش بعد مثل مانند " +
    "رو یه اون دیگه هست خیلی فقط " +
    "the a an and or of to in on for is are was be it this that with as at by from"
  ).split(" "),
);

/** یکسان‌سازی برای مقایسه — ي/ك عربی، اعراب و حروف بزرگ لاتین */
export function normalizeWord(w: string): string {
  return w
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .toLowerCase();
}

export interface WordFreq {
  word: string;
  count: number;
  /** درصد از کل کلمات */
  density: number;
}

export function topWords(text: string, limit = 10): WordFreq[] {
  const all = splitWords(text);
  const map = new Map<string, number>();
  for (const raw of all) {
    const w = normalizeWord(raw);
    if (Array.from(w).length < 2 || STOP_WORDS.has(w)) continue;
    map.set(w, (map.get(w) ?? 0) + 1);
  }
  return [...map.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count, density: Math.round((count / all.length) * 1000) / 10 }));
}

// ── یکدست‌سازی ───────────────────────────────────────────────────────────

/**
 * پاک‌سازی رایج متن فارسی: ي/ك عربی، فاصله‌های تکراری، فاصله پیش از
 * علامت‌ها، فاصله‌ی آخر خط و خط‌های خالی پشت‌سرهم. ارقام عوض نمی‌شوند تا
 * لینک و کد خراب نشود.
 */
export function cleanupText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ \t ]+/g, " ")
    .replace(/ ([.,!?؟،؛:)»\]])/g, "$1")
    .replace(/([(«[]) /g, "$1")
    .replace(/ *‌+ */g, ZWNJ)
    .replace(/ +$/gm, "")
    .replace(/^ +/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

/** محدودیت‌های طول رایج — برای نوار «جا می‌شود؟» */
export const LENGTH_LIMITS = [
  { key: "seoTitle", label: "عنوان سئو", min: 30, max: 60 },
  { key: "metaDesc", label: "توضیحات متا", min: 120, max: 160 },
  { key: "x", label: "پست ایکس (توییتر)", min: 0, max: 280 },
  { key: "instagram", label: "کپشن اینستاگرام", min: 0, max: 2200 },
] as const;
