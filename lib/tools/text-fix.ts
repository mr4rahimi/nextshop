/**
 * ویرایش و استانداردسازی متن فارسی — هر اصلاح متن تازه و «چند مورد» را
 * برمی‌گرداند؛ همان عدد در بخش «بررسی نگارش» تعداد ایراد است.
 *
 * خالص و بدون وابستگی. هم‌نسخه‌ی CRM برتر: features/text-counter/utils/text-fix.ts
 * مستندات: docs/features/tools.md بخش «کاراکترشمار»
 */

const ZWNJ = "\u200c";
/** حروف فارسی و عربی (آ تا ی، شامل پ چ ژ ک گ) */
const FA = "آ-ی";

export interface FixResult {
  text: string;
  count: number;
}

type Rule = [RegExp, string | ((...m: string[]) => string)];

/** چند جایگزینی پشت‌سرهم با شمارش */
function apply(text: string, rules: Rule[]): FixResult {
  let count = 0;
  for (const [re, to] of rules) {
    text = text.replace(re, (...m: unknown[]) => {
      const args = m as string[];
      const next = typeof to === "string" ? to.replace(/\$(\d)/g, (_, i) => args[Number(i)] ?? "") : to(...args);
      if (next !== args[0]) count++;
      return next;
    });
  }
  return { text, count };
}

/** ي ى ك ە عربی و ارقام عربی (٤ ٥ ٦) ← فارسی */
export function fixArabicChars(text: string): FixResult {
  return apply(text, [
    [/[يى]/g, "ی"],
    [/ك/g, "ک"],
    [/ە/g, "ه"],
    [/[٠-٩]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d.charCodeAt(0) - 0x0660]],
  ]);
}

const SUFFIX = "ها|های|هایی|هایم|هایت|هایش|هایمان|هایتان|هایشان|تر|ترین|تری|ترها";
const AFTER_HEH = "ای|ام|ات|اش|ایم|اید|اند";

/**
 * نیم‌فاصله‌ی استاندارد: «می خواهم» ← «می‌خواهم»، «کتاب ها» ← «کتاب‌ها»،
 * «بهتر ین» نه — فقط پسوندهای جدا نوشته‌شده‌ی رایج، «خانه ای» ← «خانه‌ای»،
 * «رفته اند» ← «رفته‌اند». «میخواهم» چسبیده دست نمی‌خورد چون از «میز» و
 * «میدان» قابل تشخیص نیست. نیم‌فاصله‌ی تکراری یا کنار فاصله هم پاک می‌شود.
 */
export function fixHalfSpace(text: string): FixResult {
  return apply(text, [
    // نیم‌فاصله‌ی چندتایی ← یکی؛ نیم‌فاصله‌ی کنار فاصله ← فاصله (پسوند و پیشوند در قاعده‌های بعد دوباره می‌چسبند)
    [/\u200c{2,}/g, ZWNJ],
    [/ +\u200c+ *|\u200c+ +/g, " "],
    [new RegExp(`(^|[\\s«(\\[])(ن?می) +(?=[${FA}])`, "gmu"), (_, a, b) => `${a}${b}${ZWNJ}`],
    [new RegExp(`([${FA}]) +(${SUFFIX})(?![${FA}])`, "gu"), (_, a, b) => `${a}${ZWNJ}${b}`],
    [new RegExp(`ه +(${AFTER_HEH})(?![${FA}])`, "gu"), (_, a) => `ه${ZWNJ}${a}`],
    // نیم‌فاصله‌ی بی‌معنی اول یا آخر کلمه
    [new RegExp(`(^|[^${FA}])\\u200c+|\\u200c+(?![${FA}])`, "gmu"), (_, a) => a ?? ""],
  ]);
}

/** همه‌ی نیم‌فاصله‌ها ← فاصله‌ی معمولی */
export function halfSpaceToSpace(text: string): FixResult {
  return apply(text, [[/ ?\u200c+ ?/g, " "]]);
}

/**
 * ارقام لاتین ← فارسی؛ کلمه‌ای که حرف لاتین، لینک یا ایمیل دارد (site.ir/2) و
 * عددِ بعد از کلمه‌ی لاتین (iPhone 15، Galaxy A55) دست نمی‌خورد.
 */
export function digitsToPersian(text: string): FixResult {
  let count = 0;
  const parts = text.split(/(\s+)/);
  let prevLatin = false;
  for (let i = 0; i < parts.length; i++) {
    const tok = parts[i];
    if (!tok || /^\s+$/.test(tok)) continue;
    const latin = /[A-Za-z@]|:\/\//.test(tok);
    if (!latin && !prevLatin && /[0-9]/.test(tok)) {
      count++;
      parts[i] = tok.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
    }
    prevLatin = latin;
  }
  return { text: parts.join(""), count };
}

/** ارقام فارسی و عربی ← لاتین */
export function digitsToLatin(text: string): FixResult {
  return apply(text, [[/[۰-۹٠-٩]+/g, (m) => m.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))]]);
}

/**
 * علامت‌گذاری فارسی — فقط در خطی که حرف فارسی دارد:
 * , ; ? ← ، ؛ ؟ (نه بین دو رقم و نه داخل لینک)، "…" ← «…»، ... ← …،
 * !!! ← !، بدون فاصله پیش از علامت، یک فاصله بعد از آن، بدون فاصله داخل پرانتز و گیومه.
 */
export function fixPunctuation(text: string): FixResult {
  let count = 0;
  const lines = text.split("\n").map((line) => {
    if (!new RegExp(`[${FA}]`).test(line)) return line;
    // لینک‌ها کنار گذاشته و بعد برگردانده می‌شوند
    const urls: string[] = [];
    let l = line.replace(/\b(?:https?:\/\/|www\.)\S+/gi, (u) => `\u0000${urls.push(u) - 1}\u0000`);
    const r = apply(l, [
      [/(?<!\d),|,(?!\d)/g, "،"],
      [/;/g, "؛"],
      [new RegExp(`(?<=[${FA}\\s»)])\\?`, "gu"), "؟"],
      [new RegExp(`"([^"\\n]*[${FA}][^"\\n]*)"`, "gu"), "«$1»"],
      [/\.{3,}/g, "…"],
      [/([!؟])\1+/g, "$1"],
      [/[ \t]+([،؛:!؟.…])(?=\s|$|[«»()])/g, "$1"],
      [/[ \t]+([)\]»])/g, "$1"],
      [/([(\[«])[ \t]+/g, "$1"],
      [new RegExp(`([،؛!؟:])(?=[${FA}«(])`, "gu"), "$1 "],
      [new RegExp(`(?<=[${FA}])\\.(?=[${FA}])`, "gu"), ". "],
    ]);
    count += r.count;
    l = r.text.replace(/\u0000(\d+)\u0000/g, (_, i) => urls[Number(i)]);
    return l;
  });
  return { text: lines.join("\n"), count };
}

/** فاصله‌های تکراری، تب و فاصله‌ی نشکن، فاصله‌ی اول و آخر خط، بیش از یک خط خالی */
export function fixSpaces(text: string): FixResult {
  const r = apply(text, [
    [/\r/g, ""],
    [/[\t ]/g, " "],
    [/ {2,}/g, " "],
    [/ +$/gm, ""],
    [/^ +/gm, ""],
    [/\n{3,}/g, "\n\n"],
  ]);
  const trimmed = r.text.trim();
  return { text: trimmed, count: r.count + (trimmed !== r.text ? 1 : 0) };
}

/** کشیده (ـ) و اعراب؛ تنوین نصب (ـً مثل «حتماً») و همزه‌ی روی ه (ـٔ) می‌مانند */
export function removeKashida(text: string): FixResult {
  return apply(text, [
    [/ـ+/g, ""],
    [/[ٌ-ْ]/g, ""],
  ]);
}

/** ایموجی‌ها — برای پیامک (هر ایموجی پیامک را یونیکد و کوتاه می‌کند) و متن رسمی */
export function removeEmoji(text: string): FixResult {
  return apply(text, [
    [/[\p{Extended_Pictographic}️‍]+/gu, ""],
    [/ {2,}/g, " "],
  ]);
}

export type FixKey =
  | "arabic" | "halfSpace" | "punct" | "spaces" | "kashida"
  | "halfToSpace" | "digitsFa" | "digitsEn" | "emoji";

export interface FixDef {
  key: FixKey;
  label: string;
  /** توضیح کوتاه زیر دکمه / در ایرادها */
  desc: string;
  run: (t: string) => FixResult;
  /** جزء «اصلاح همه» است و تعدادش ایراد نگارشی حساب می‌شود */
  standard: boolean;
}

export const FIXES: FixDef[] = [
  { key: "arabic", label: "ی و ک عربی", desc: "ي ك و ارقام عربی به شکل فارسی", run: fixArabicChars, standard: true },
  { key: "halfSpace", label: "اصلاح نیم‌فاصله", desc: "می خواهم ← می‌خواهم، کتاب ها ← کتاب‌ها، خانه ای ← خانه‌ای", run: fixHalfSpace, standard: true },
  { key: "punct", label: "علامت‌گذاری", desc: "ویرگول و علامت سؤال فارسی، گیومه‌ی «»، فاصله‌ی درست کنار علامت‌ها", run: fixPunctuation, standard: true },
  { key: "spaces", label: "فاصله‌ها و خطوط", desc: "فاصله‌ی تکراری، فاصله‌ی آخر خط، خطوط خالی پشت‌سرهم", run: fixSpaces, standard: true },
  { key: "kashida", label: "کشیده و اعراب", desc: "ـــ و اعراب (تنوین «حتماً» می‌ماند)", run: removeKashida, standard: true },
  { key: "halfToSpace", label: "نیم‌فاصله ← فاصله", desc: "همه‌ی نیم‌فاصله‌ها فاصله‌ی معمولی می‌شوند", run: halfSpaceToSpace, standard: false },
  { key: "digitsFa", label: "ارقام ← فارسی", desc: "123 ← ۱۲۳ (لینک و مدل لاتین دست نمی‌خورد)", run: digitsToPersian, standard: false },
  { key: "digitsEn", label: "ارقام ← انگلیسی", desc: "۱۲۳ ← 123", run: digitsToLatin, standard: false },
  { key: "emoji", label: "حذف ایموجی", desc: "برای پیامک و متن رسمی", run: removeEmoji, standard: false },
];

/** «استانداردسازی کامل»: همه‌ی اصلاح‌های standard به ترتیب */
export function fixAll(text: string): FixResult {
  let count = 0;
  for (const f of FIXES) {
    if (!f.standard) continue;
    const r = f.run(text);
    text = r.text;
    count += r.count;
  }
  return { text, count };
}
