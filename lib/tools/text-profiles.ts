/**
 * «متن برای کجاست؟» — قالب‌های مقاله، توضیح محصول، عنوان سئو، توضیحات متا،
 * اینستاگرام، ایکس، تلگرام و پیامک، هر کدام با سقف طول و فهرست بررسی.
 *
 * خالص. هم‌نسخه‌ی CRM برتر: features/text-counter/utils/text-profiles.ts
 * مستندات: docs/features/tools.md بخش «کاراکترشمار»
 *
 * عددها (۱۴۰۵/۰۷): اینستاگرام از آذر ۱۴۰۴ حداکثر ۵ هشتگ می‌پذیرد، ۲۲۰۰
 * کاراکتر و ۱۲۵ کاراکتر اول پیش از «بیشتر». ایکس ۲۸۰ با وزن. تلگرام ۴۰۹۶
 * و کپشن ۱۰۲۴. پیامک تبلیغاتی در ایران باید «لغو۱۱» داشته باشد.
 */

import { fixAll } from "./text-fix";
import { LONG_SENTENCE, keywordStats, type KeywordStats, type TextStats } from "./text-stats";

export type ProfileKey =
  | "general" | "article" | "product" | "seoTitle" | "metaDesc"
  | "instagram" | "x" | "telegram" | "sms";

export type CheckStatus = "ok" | "warn" | "bad" | "info";

export interface Check {
  id: string;
  status: CheckStatus;
  title: string;
  detail?: string;
}

/** نوار طول اصلی قالب */
export interface Meter {
  label: string;
  value: number;
  min: number;
  /** بهترین بازه — سبز */
  idealMax: number;
  /** سقف سخت — قرمز */
  max: number;
  unit: "کاراکتر" | "کلمه" | "پیامک";
}

export interface ProfileDef {
  key: ProfileKey;
  label: string;
  /** یک خط زیر انتخاب‌گر */
  hint: string;
  /** کلمه‌ی کلیدی معنی دارد */
  keyword: boolean;
}

export const PROFILES: ProfileDef[] = [
  { key: "general", label: "عمومی", hint: "فقط شمارش و بررسی نگارش", keyword: false },
  { key: "article", label: "مقاله", hint: "طول، کلمه‌ی کلیدی، جمله و پاراگراف، زیرعنوان", keyword: true },
  { key: "product", label: "توضیح محصول", hint: "طول کافی، کلمه‌ی کلیدی، پاراگراف کوتاه", keyword: true },
  { key: "seoTitle", label: "عنوان سئو", hint: "۳۰ تا ۶۰ کاراکتر، کلمه‌ی کلیدی در ابتدا", keyword: true },
  { key: "metaDesc", label: "توضیحات متا", hint: "۱۲۰ تا ۱۶۰ کاراکتر، کلمه‌ی کلیدی", keyword: true },
  { key: "instagram", label: "کپشن اینستاگرام", hint: "۲۲۰۰ کاراکتر، ۱۲۵ کاراکتر اول، حداکثر ۵ هشتگ", keyword: false },
  { key: "x", label: "پست ایکس", hint: "۲۸۰ با وزن؛ لینک ۲۳ حساب می‌شود", keyword: false },
  { key: "telegram", label: "تلگرام", hint: "پیام ۴۰۹۶ و کپشن عکس ۱۰۲۴ کاراکتر", keyword: false },
  { key: "sms", label: "پیامک", hint: "تعداد پیامک، لغو۱۱، ایموجی و لینک", keyword: false },
];

export interface ProfileResult {
  meter: Meter | null;
  checks: Check[];
  /** ۰ تا ۱۰۰؛ null وقتی متن خالی است یا قالب عمومی */
  score: number | null;
}

const fa = (n: number) => n.toLocaleString("fa-IR");

function lengthCheck(value: number, min: number, idealMax: number, max: number, unit: string, what: string): Check {
  if (value > max) return { id: "len", status: "bad", title: `${what} بیش از حد بلند است`, detail: `${fa(value)} ${unit}؛ سقف ${fa(max)}` };
  if (value > idealMax) return { id: "len", status: "warn", title: `${what} کمی بلند است`, detail: `${fa(value)} ${unit}؛ بهتر است تا ${fa(idealMax)} باشد` };
  if (value < min) return { id: "len", status: value < min / 2 ? "bad" : "warn", title: `${what} کوتاه است`, detail: `${fa(value)} ${unit}؛ دست‌کم ${fa(min)}` };
  return { id: "len", status: "ok", title: `طول ${what} مناسب است`, detail: `${fa(value)} ${unit}` };
}

function keywordChecks(kw: KeywordStats | null, opts: { density?: [number, number]; first?: boolean; start?: boolean }): Check[] {
  if (!kw) return [{ id: "kw", status: "info", title: "کلمه‌ی کلیدی وارد نشده", detail: "برای بررسی تراکم و جایگاه، کلمه‌ی کلیدی را بنویسید" }];
  const out: Check[] = [];
  if (kw.count === 0) return [{ id: "kw", status: "bad", title: `«${kw.keyword}» در متن نیامده` }];
  if (opts.density) {
    const [lo, hi] = opts.density;
    out.push(
      kw.density > hi
        ? { id: "kwd", status: "bad", title: "تکرار کلمه‌ی کلیدی زیاد است", detail: `${fa(kw.density)}٪ (${fa(kw.count)} بار)؛ بهتر است زیر ${fa(hi)}٪ باشد — گوگل تکرار زیاد را اسپم می‌داند` }
        : kw.density < lo
          ? { id: "kwd", status: "warn", title: "کلمه‌ی کلیدی کم تکرار شده", detail: `${fa(kw.density)}٪ (${fa(kw.count)} بار)؛ بین ${fa(lo)} تا ${fa(hi)}٪ مناسب است` }
          : { id: "kwd", status: "ok", title: "تراکم کلمه‌ی کلیدی مناسب است", detail: `${fa(kw.density)}٪ (${fa(kw.count)} بار)` },
    );
  } else {
    out.push({ id: "kwd", status: "ok", title: "کلمه‌ی کلیدی در متن هست", detail: `${fa(kw.count)} بار` });
  }
  if (opts.first)
    out.push(kw.inFirstParagraph
      ? { id: "kwf", status: "ok", title: "کلمه‌ی کلیدی در پاراگراف اول آمده" }
      : { id: "kwf", status: "warn", title: "کلمه‌ی کلیدی در پاراگراف اول نیست", detail: "گوگل و خواننده از شروع متن موضوع را می‌فهمند" });
  if (opts.start)
    out.push(kw.nearStart
      ? { id: "kws", status: "ok", title: "کلمه‌ی کلیدی نزدیک ابتداست" }
      : { id: "kws", status: "warn", title: "کلمه‌ی کلیدی را به ابتدا نزدیک‌تر کنید", detail: "عنوان در نتایج جستجو ممکن است کوتاه شود" });
  return out;
}

function writingChecks(text: string, s: TextStats): Check[] {
  const fixes = fixAll(text).count;
  return [
    fixes === 0
      ? { id: "fix", status: "ok", title: "نگارش استاندارد است" }
      : { id: "fix", status: fixes > 5 ? "warn" : "info", title: `${fa(fixes)} مورد ایراد نگارشی`, detail: "بخش «ویرایش» — ی و ک، نیم‌فاصله، علامت‌ها و فاصله‌ها" },
    ...(s.sentences.length >= 3
      ? [s.longShare > 25
        ? { id: "long", status: "warn" as const, title: `${fa(s.longShare)}٪ جمله‌ها بلندند`, detail: `بیش از ${fa(LONG_SENTENCE)} کلمه؛ بهتر است کمتر از ۲۵٪ باشد` }
        : { id: "long", status: "ok" as const, title: "طول جمله‌ها مناسب است", detail: `میانگین ${fa(s.avgSentence)} کلمه` }]
      : []),
  ];
}

/** خطی کوتاه بدون نقطه‌ی پایانی که پاراگراف بلندتری بعدش آمده، یا خطی که با # شروع شده */
export function countHeadings(text: string, s: TextStats): number {
  let n = 0;
  s.paragraphs.forEach((p, i) => {
    const line = text.slice(p.start, p.end).trim();
    if (/^#{1,6}\s/.test(line)) n++;
    else if (p.words <= 12 && !/[.!?؟…:،]$/.test(line) && (s.paragraphs[i + 1]?.words ?? 0) > p.words) n++;
  });
  return n;
}

/** سه جمله‌ی پشت‌سرهم یا بیشتر که با یک کلمه شروع شده‌اند */
function repeatedStarts(text: string, s: TextStats): number {
  const first = s.sentences.map((x) => text.slice(x.start, x.end).trim().split(/\s+/)[0]);
  let runs = 0;
  let run = 1;
  for (let i = 1; i <= first.length; i++) {
    if (i < first.length && first[i] && first[i] === first[i - 1]) run++;
    else {
      if (run >= 3) runs++;
      run = 1;
    }
  }
  return runs;
}

export function evaluateProfile(key: ProfileKey, text: string, s: TextStats, keyword: string): ProfileResult {
  const kw = keyword.trim() ? keywordStats(text, keyword) : null;
  let meter: Meter | null = null;
  const checks: Check[] = [];
  const chars = s.chars;

  switch (key) {
    case "general":
      return { meter: null, checks: writingChecks(text, s), score: null };

    case "article": {
      meter = { label: "طول مقاله", value: s.words, min: 600, idealMax: 2500, max: 6000, unit: "کلمه" };
      checks.push(
        s.words < 300
          ? { id: "len", status: "bad", title: "مقاله کوتاه است", detail: `${fa(s.words)} کلمه؛ برای رقابت در گوگل دست‌کم ۶۰۰ و بهتر ۱۰۰۰+` }
          : s.words < 600
            ? { id: "len", status: "warn", title: "مقاله می‌تواند کامل‌تر باشد", detail: `${fa(s.words)} کلمه؛ ۶۰۰ تا ۲۵۰۰ مناسب است` }
            : { id: "len", status: "ok", title: "طول مقاله مناسب است", detail: `${fa(s.words)} کلمه` },
        ...keywordChecks(kw, { density: [0.5, 2.5], first: true }),
      );
      const heads = countHeadings(text, s);
      const needed = Math.floor(s.words / 300);
      if (s.words >= 300)
        checks.push(heads >= needed
          ? { id: "head", status: "ok", title: "زیرعنوان کافی دارد", detail: `${fa(heads)} زیرعنوان` }
          : { id: "head", status: "warn", title: "زیرعنوان کم است", detail: `${fa(heads)} زیرعنوان؛ تقریباً هر ۳۰۰ کلمه یکی (خطی کوتاه بدون نقطه، یا با # شروع کنید)` });
      const longPara = s.paragraphs.filter((p) => p.words > 150).length;
      checks.push(longPara
        ? { id: "para", status: "warn", title: `${fa(longPara)} پاراگراف بیش از ۱۵۰ کلمه`, detail: "پاراگراف بلند در موبایل دیوار متن می‌شود" }
        : { id: "para", status: "ok", title: "طول پاراگراف‌ها مناسب است" });
      const rep = repeatedStarts(text, s);
      if (rep) checks.push({ id: "rep", status: "warn", title: "شروع تکراری جمله‌ها", detail: `${fa(rep)} جا سه جمله یا بیشتر پشت‌سرهم با یک کلمه شروع شده‌اند` });
      checks.push(...writingChecks(text, s));
      break;
    }

    case "product": {
      meter = { label: "طول توضیح", value: s.words, min: 150, idealMax: 1000, max: 3000, unit: "کلمه" };
      checks.push(
        s.words < 50
          ? { id: "len", status: "bad", title: "توضیح محصول خیلی کوتاه است", detail: `${fa(s.words)} کلمه؛ صفحه‌ی کم‌محتوا در گوگل ضعیف است` }
          : s.words < 150
            ? { id: "len", status: "warn", title: "توضیح محصول کوتاه است", detail: `${fa(s.words)} کلمه؛ دست‌کم ۱۵۰` }
            : { id: "len", status: "ok", title: "طول توضیح مناسب است", detail: `${fa(s.words)} کلمه` },
        ...keywordChecks(kw, { density: [0.5, 3], first: true }),
      );
      const longPara = s.paragraphs.filter((p) => p.words > 100).length;
      checks.push(longPara
        ? { id: "para", status: "warn", title: `${fa(longPara)} پاراگراف بیش از ۱۰۰ کلمه`, detail: "خریدار متن را اسکن می‌کند؛ پاراگراف کوتاه یا فهرست بهتر است" }
        : { id: "para", status: "ok", title: "پاراگراف‌ها کوتاه‌اند" });
      checks.push(...writingChecks(text, s));
      break;
    }

    case "seoTitle": {
      meter = { label: "طول عنوان", value: chars, min: 30, idealMax: 60, max: 70, unit: "کاراکتر" };
      checks.push(lengthCheck(chars, 30, 60, 70, "کاراکتر", "عنوان"));
      checks.push(...keywordChecks(kw, { start: true }));
      if (s.paragraphs.length > 1) checks.push({ id: "line", status: "bad", title: "عنوان باید یک خط باشد" });
      if (/[.]$/.test(text.trim())) checks.push({ id: "dot", status: "warn", title: "عنوان با نقطه تمام نمی‌شود" });
      checks.push(...writingChecks(text, s).filter((c) => c.id === "fix"));
      break;
    }

    case "metaDesc": {
      meter = { label: "طول توضیحات", value: chars, min: 120, idealMax: 160, max: 170, unit: "کاراکتر" };
      checks.push(lengthCheck(chars, 120, 160, 170, "کاراکتر", "توضیحات متا"));
      checks.push(...keywordChecks(kw, {}));
      if (s.paragraphs.length > 1) checks.push({ id: "line", status: "warn", title: "توضیحات متا یک پاراگراف باشد", detail: "خط جدید در نتایج گوگل نمایش داده نمی‌شود" });
      checks.push(...writingChecks(text, s).filter((c) => c.id === "fix"));
      break;
    }

    case "instagram": {
      meter = { label: "طول کپشن", value: chars, min: 0, idealMax: 2200, max: 2200, unit: "کاراکتر" };
      checks.push(chars > 2200
        ? { id: "len", status: "bad", title: "از سقف ۲۲۰۰ کاراکتر گذشته", detail: `${fa(chars - 2200)} کاراکتر اضافه` }
        : { id: "len", status: "ok", title: "در سقف ۲۲۰۰ کاراکتر است", detail: `${fa(2200 - chars)} کاراکتر جا دارد` });
      const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
      const hook = Array.from(firstLine).length;
      checks.push(hook <= 125
        ? { id: "hook", status: "ok", title: "خط اول پیش از «بیشتر» کامل دیده می‌شود" }
        : { id: "hook", status: "warn", title: "خط اول بریده می‌شود", detail: `فقط ۱۲۵ کاراکتر اول پیش از «بیشتر» دیده می‌شود؛ خط اول ${fa(hook)} است` });
      const tags = s.hashtags.length;
      checks.push(tags > 5
        ? { id: "tags", status: "bad", title: `${fa(tags)} هشتگ — اینستاگرام حداکثر ۵ تا می‌پذیرد` }
        : tags === 0
          ? { id: "tags", status: "info", title: "هشتگ ندارد", detail: "۳ تا ۵ هشتگ مرتبط پیشنهاد می‌شود" }
          : { id: "tags", status: "ok", title: `${fa(tags)} هشتگ` });
      if (s.urls.length) checks.push({ id: "url", status: "warn", title: "لینک در کپشن کلیک‌خور نیست", detail: "لینک را در بیو یا استوری بگذارید" });
      checks.push(...writingChecks(text, s).filter((c) => c.id === "fix"));
      break;
    }

    case "x": {
      meter = { label: "طول پست", value: s.xLength, min: 0, idealMax: 280, max: 280, unit: "کاراکتر" };
      checks.push(s.xLength > 280
        ? { id: "len", status: "bad", title: "از ۲۸۰ گذشته", detail: `${fa(s.xLength)} با وزن ایکس؛ ${fa(s.xLength - 280)} اضافه (حساب‌های پریمیوم تا ۲۵۰۰۰)` }
        : { id: "len", status: "ok", title: "در ۲۸۰ جا می‌شود", detail: `${fa(s.xLength)} با وزن ایکس` });
      if (s.urls.length) checks.push({ id: "url", status: "info", title: `${fa(s.urls.length)} لینک — هر کدام ۲۳ حساب شد` });
      if (s.hashtags.length > 2) checks.push({ id: "tags", status: "warn", title: `${fa(s.hashtags.length)} هشتگ`, detail: "در ایکس یک یا دو هشتگ بهتر است" });
      break;
    }

    case "telegram": {
      meter = { label: "طول پیام", value: chars, min: 0, idealMax: 1024, max: 4096, unit: "کاراکتر" };
      checks.push(chars > 4096
        ? { id: "len", status: "bad", title: "از سقف پیام ۴۰۹۶ گذشته", detail: "تلگرام آن را دو پیام می‌کند" }
        : { id: "len", status: "ok", title: "در سقف پیام ۴۰۹۶ است" });
      checks.push(chars > 1024
        ? { id: "cap", status: "warn", title: "برای کپشن عکس یا ویدیو بلند است", detail: `کپشن تا ۱۰۲۴ کاراکتر؛ این متن ${fa(chars)} است` }
        : { id: "cap", status: "ok", title: "به‌عنوان کپشن عکس هم جا می‌شود" });
      checks.push(...writingChecks(text, s).filter((c) => c.id === "fix"));
      break;
    }

    case "sms": {
      meter = { label: "تعداد پیامک", value: s.sms.parts, min: 0, idealMax: 2, max: 5, unit: "پیامک" };
      checks.push(s.sms.parts <= 1
        ? { id: "len", status: "ok", title: "یک پیامک", detail: `${fa(s.sms.left)} کاراکتر جا دارد` }
        : { id: "len", status: s.sms.parts > 3 ? "bad" : "warn", title: `${fa(s.sms.parts)} پیامک برای هر گیرنده`, detail: `هزینه ${fa(s.sms.parts)} برابر یک پیامک است` });
      if (s.emojis) checks.push({ id: "emoji", status: "warn", title: `${fa(s.emojis)} ایموجی`, detail: s.sms.unicode ? "بعضی گوشی‌ها ایموجی را مربع نشان می‌دهند" : "ایموجی پیامک را فارسی (۷۰ کاراکتری) می‌کند" });
      const optOut = /لغو\s*(?:۱۱|11)/.test(text);
      checks.push(optOut
        ? { id: "optout", status: "ok", title: "«لغو۱۱» دارد" }
        : { id: "optout", status: "info", title: "«لغو۱۱» ندارد", detail: "برای پیامک تبلیغاتی الزامی است؛ برای پیامک خدماتی (کد، پیگیری) نه" });
      if (s.urls.length) checks.push({ id: "url", status: "info", title: "لینک دارد", detail: "لینک کوتاه بهتر است؛ بعضی اپراتورها لینک ناشناس را فیلتر می‌کنند" });
      break;
    }
  }

  const graded = checks.filter((c) => c.status !== "info");
  const score = text.trim() && graded.length
    ? Math.round((graded.reduce((n, c) => n + (c.status === "ok" ? 1 : c.status === "warn" ? 0.5 : 0), 0) / graded.length) * 100)
    : null;
  return { meter, checks, score };
}
