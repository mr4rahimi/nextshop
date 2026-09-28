/**
 * منبع ورود خریدار — توابع خالص (بدون prisma و بدون Next).
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۱۳.۵
 *
 * مدل: «آخرین لمسِ غیرمستقیم» با عمر ۳۰ روز. کوکی `nx_src` در `proxy.ts` روی
 * درخواست سند ساخته می‌شود و `/api/checkout` آن را روی سفارش می‌نویسد.
 *
 * آزمون: `pnpm tsx scripts/attribution-check.ts`
 */

export const ATTRIBUTION_COOKIE = "nx_src";
export const ATTRIBUTION_MAX_AGE = 30 * 24 * 60 * 60; // ثانیه

export type Touch = {
  /** کانال — تا جای ممکن همان کلیدهای کانال Umami */
  ch: string;
  /** صفحه‌ی ورود، بدون پارامتر */
  lp: string;
  /** دامنه‌ی ارجاع‌دهنده */
  rf?: string;
  us?: string;
  um?: string;
  uc?: string;
  /** زمان لمس — میلی‌ثانیه */
  t: number;
};

/**
 * درگاه‌های پرداخت. بازگشت از درگاه یک ناوبری با ارجاع‌دهنده‌ی بیرونی است؛
 * بدون این فهرست منبع هر خریدار «شاپرک» می‌شد.
 */
const PAYMENT_HOSTS =
  /(^|\.)(shaparak\.ir|aghayepardakht\.(ir|com)|zarinpal\.com|idpay\.ir|pay\.ir|sep\.ir|zibal\.ir|nextpay\.org|payping\.(ir|io)|sadadpsp\.ir|bpm\.bankmellat\.ir|pec\.ir|sizpay\.ir|vandar\.io|jibit\.ir|asanpardakht\.ir|irankish\.com|bitpay\.ir|digipay\.ir|snapppay\.ir|torobpay\.com)$/i;

const SEARCH_HOSTS =
  /(^|\.)(google\.[a-z.]+|bing\.com|yandex\.[a-z.]+|duckduckgo\.com|yahoo\.com|ecosia\.org|baidu\.com|brave\.com|startpage\.com|zarebin\.ir|yooz\.ir|parsijoo\.ir)$/i;

const SOCIAL_HOSTS =
  /(^|\.)(instagram\.com|facebook\.com|fb\.com|t\.me|telegram\.(org|me)|web\.telegram\.org|whatsapp\.com|wa\.me|x\.com|twitter\.com|t\.co|linkedin\.com|lnkd\.in|youtube\.com|youtu\.be|aparat\.com|eitaa\.com|ble\.ir|web\.bale\.ai|bale\.ai|rubika\.ir|virasty\.com|pinterest\.com|tiktok\.com|reddit\.com|threads\.net)$/i;

/** مقایسه‌ی قیمت و بازارگاه — مخصوص فروشگاه؛ در برتر نبود */
const COMPARISON_HOSTS =
  /(^|\.)(torob\.com|emalls\.ir|basalam\.com|digikala\.com|snappshop\.ir|tapsi\.shop|divar\.ir|sheypoor\.com|khanoumi\.com)$/i;

const AI_HOSTS = /(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|copilot\.microsoft\.com|deepseek\.com)$/i;

const PAID_MEDIUM = /^(cpc|ppc|paid|paidsearch|paid_search|cpm|display|ads?)$/i;

export function stripWww(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

export function isPaymentHost(host: string) {
  return PAYMENT_HOSTS.test(stripWww(host));
}

/**
 * کانال از روی ارجاع‌دهنده و utm. ترتیب مهم است: utm صریح‌ترین نشانه است و
 * از دامنه جلو می‌زند (پیامک با لینک کوتاه ارجاع‌دهنده ندارد ولی `utm_medium=sms`
 * دارد).
 */
export function channelOf(input: { referrerHost?: string | null; utmSource?: string | null; utmMedium?: string | null }) {
  const medium = (input.utmMedium ?? "").trim().toLowerCase();
  const source = (input.utmSource ?? "").trim().toLowerCase();
  const host = input.referrerHost ? stripWww(input.referrerHost) : "";

  if (medium === "sms" || source === "sms") return "sms";
  if (medium === "email" || medium === "newsletter") return "email";
  if (medium === "affiliate") return "affiliate";

  const paid = PAID_MEDIUM.test(medium);
  const looksSearch = (host && SEARCH_HOSTS.test(host)) || /^(google|bing|yandex)$/.test(source);
  const looksSocial =
    (host && SOCIAL_HOSTS.test(host)) ||
    /^(instagram|telegram|whatsapp|facebook|twitter|x|linkedin|youtube|aparat|eitaa|bale|rubika)$/.test(source);

  if (looksSearch) return paid ? "paidSearch" : "organicSearch";
  if (looksSocial) return paid ? "paidSocial" : "organicSocial";
  if (paid) return "paidAds";
  if ((host && COMPARISON_HOSTS.test(host)) || /^(torob|emalls|basalam|digikala)$/.test(source)) {
    return "comparison";
  }
  if (host && AI_HOSTS.test(host)) return "llm";
  if (host) return "referral";
  if (source) return "referral";
  return "direct";
}

const clip = (v: string | null | undefined, n: number) => {
  const t = (v ?? "").trim();
  return t ? t.slice(0, n) : undefined;
};

/**
 * لمس تازه برای یک ناوبری، یا `null` یعنی «کوکی فعلی را دست نزن».
 *
 * @param url      آدرس کامل درخواست
 * @param referer  هدر Referer (ممکن است خالی باشد)
 * @param ownHost  دامنه‌ی خود سایت
 * @param hasCookie آیا کوکی منبع از قبل هست
 */
export function touchFor(
  url: URL,
  referer: string | null,
  ownHost: string,
  hasCookie: boolean,
  now = Date.now(),
): Touch | null {
  const q = url.searchParams;
  const us = clip(q.get("utm_source"), 80);
  const um = clip(q.get("utm_medium"), 80);
  const uc = clip(q.get("utm_campaign"), 120);

  let rf: string | undefined;
  if (referer) {
    try {
      const h = stripWww(new URL(referer).hostname);
      if (h && h !== stripWww(ownHost)) rf = h;
    } catch {
      /* ارجاع‌دهنده‌ی بدشکل = بدون ارجاع‌دهنده */
    }
  }

  // بازگشت از درگاه لمس نیست — نه بازنویسی، نه حتی «مستقیم»
  if (rf && isPaymentHost(rf) && !us) return null;

  const external = !!(us || um || uc || rf);
  if (!external && hasCookie) return null;

  const lp = clip(decodeSafe(url.pathname), 300) ?? "/";
  return {
    ch: channelOf({ referrerHost: rf, utmSource: us, utmMedium: um }),
    lp,
    ...(rf ? { rf } : {}),
    ...(us ? { us } : {}),
    ...(um ? { um } : {}),
    ...(uc ? { uc } : {}),
    t: now,
  };
}

/** آدرس فارسی در کوکی و پنل خوانا بماند، نه `%D8%…` */
function decodeSafe(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * ⚠️ JSON خام، نه `encodeURIComponent`: `response.cookies.set` در Next خودش
 * مقدار را کدگذاری می‌کند. کدگذاری دوباره یعنی `/api/checkout` که هدر خام را
 * یک بار باز می‌کند به `%7B…` برسد و منبع هیچ سفارشی ثبت نشود — بی‌صدا.
 */
export function encodeTouch(t: Touch) {
  return JSON.stringify(t);
}

function parseLoose(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(decodeURIComponent(raw));
  }
}

/** کوکی خراب یا دستکاری‌شده `null` می‌دهد، نه خطا — ثبت سفارش نباید بشکند */
export function decodeTouch(raw: string | null | undefined): Touch | null {
  if (!raw) return null;
  try {
    // هدر خام کوکی کدگذاری‌شده است؛ مقدارِ از پیش بازشده هم پذیرفته می‌شود
    const v = parseLoose(raw) as Partial<Touch>;
    if (typeof v.ch !== "string" || typeof v.lp !== "string" || typeof v.t !== "number") return null;
    const s = (x: unknown, n: number) => (typeof x === "string" && x ? x.slice(0, n) : undefined);
    return {
      ch: v.ch.slice(0, 40),
      lp: v.lp.slice(0, 300),
      rf: s(v.rf, 200),
      us: s(v.us, 80),
      um: s(v.um, 80),
      uc: s(v.uc, 120),
      t: v.t,
    };
  } catch {
    return null;
  }
}

/** ستون‌های `Order` از روی لمس — در `/api/checkout` */
export function orderFieldsFromTouch(t: Touch | null) {
  if (!t) return {};
  const at = new Date(t.t);
  return {
    trafficChannel: t.ch,
    landingPath: t.lp,
    referrerHost: t.rf ?? null,
    utmSource: t.us ?? null,
    utmMedium: t.um ?? null,
    utmCampaign: t.uc ?? null,
    touchedAt: Number.isNaN(at.getTime()) ? null : at,
  };
}

/**
 * آیا این درخواست یک ناوبری سند است؟ RSC، prefetch و fetch نباید لمس بسازند —
 * ارجاع‌دهنده‌ی آن‌ها همیشه خودِ سایت است و فقط کار اضافه است.
 */
export function isDocumentNavigation(method: string, headers: Headers, pathname: string) {
  if (method !== "GET") return false;
  if (/^\/(api|admin|seller|tq|_next)(\/|$)/.test(pathname)) return false;
  if (headers.get("rsc") || headers.get("next-router-prefetch") || headers.get("purpose") === "prefetch") {
    return false;
  }
  const dest = headers.get("sec-fetch-dest");
  if (dest) return dest === "document";
  return (headers.get("accept") ?? "").includes("text/html");
}
