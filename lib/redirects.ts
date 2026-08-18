/**
 * منطق مشترک ریدایرکت‌ها.
 *
 * این فایل عمداً به Prisma و به هیچ API مخصوص Node وابسته نیست تا هم در
 * middleware (که ممکن است روی edge اجرا شود) و هم در route handlerها و هم در
 * فرم ادمین قابل import باشد. نتیجه‌اش این است که «نرمال‌سازی مسیر» یک
 * پیاده‌سازی بیشتر ندارد؛ اگر ادمین `/Old-Path/` وارد کند و کاربر
 * `/old-path` بزند، هر دو به یک کلید می‌رسند.
 */

export type RedirectMatch = "EXACT" | "PREFIX" | "REGEX";

export type RedirectRule = {
  id: string;
  source: string;
  destination: string;
  statusCode: number;
  matchType: RedirectMatch;
};

/** کدهایی که اجازه داریم برگردانیم. 410 یعنی «حذف شده» و مقصد نمی‌خواهد. */
export const ALLOWED_STATUS = [301, 302, 307, 308, 410] as const;

export const STATUS_LABEL: Record<number, string> = {
  301: "۳۰۱ — دائمی (Moved Permanently)",
  302: "۳۰۲ — موقت (Found)",
  307: "۳۰۷ — موقت، متد حفظ می‌شود",
  308: "۳۰۸ — دائمی، متد حفظ می‌شود",
  410: "۴۱۰ — حذف شده (Gone)",
};

export const MATCH_LABEL: Record<RedirectMatch, string> = {
  EXACT: "دقیق",
  PREFIX: "شروع‌شونده با",
  REGEX: "الگوی regex",
};

/**
 * مسیر را به شکل استاندارد درمی‌آورد.
 *
 * - دامنه حذف می‌شود (اگر ادمین آدرس کامل paste کند)
 * - query string و hash حذف می‌شوند
 * - با `/` شروع می‌شود
 * - `/` انتهایی حذف می‌شود مگر خود ریشه
 * - حروف کوچک می‌شود؛ عمداً، چون nginx هم روی کلیدهای map حساس به بزرگی نیست
 *   و دو قاعده‌ی متفاوت باعث سردرگمی می‌شد
 *
 * درصد-دیکد **نمی‌شود**: مسیرهای فارسی هم به شکل encode و هم decode ممکن است
 * برسند، و تصمیم گرفتیم هر دو شکل را جداگانه در `matchPath` امتحان کنیم
 * به‌جای اینکه اینجا یکی را به دیگری تبدیل کنیم و اطلاعات از دست برود.
 */
export function normalizePath(input: string): string {
  let p = (input || "").trim();
  if (!p) return "/";

  // آدرس کامل → فقط مسیر
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      /* اگر پارس نشد همان رشته را ادامه می‌دهیم */
    }
  }

  p = p.split("#")[0].split("?")[0];
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p.toLowerCase() || "/";
}

/** مقصد می‌تواند مسیر داخلی یا آدرس کامل خارجی باشد. */
export function normalizeDestination(input: string): string {
  const d = (input || "").trim();
  if (!d) return "";
  if (/^https?:\/\//i.test(d)) return d;
  return d.startsWith("/") ? d : "/" + d;
}

export type ValidationError = { field: string; message: string };

/**
 * اعتبارسنجی یک قاعده پیش از ذخیره. هم در API و هم در فرم ادمین صدا زده
 * می‌شود تا پیام خطا یکی باشد.
 */
export function validateRule(rule: {
  source: string;
  destination: string;
  statusCode: number;
  matchType: RedirectMatch;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  const source = rule.source?.trim();
  const dest = rule.destination?.trim();

  if (!source) {
    errors.push({ field: "source", message: "آدرس مبدأ الزامی است" });
  }

  if (rule.statusCode !== 410 && !dest) {
    errors.push({ field: "destination", message: "آدرس مقصد الزامی است" });
  }

  if (!ALLOWED_STATUS.includes(rule.statusCode as (typeof ALLOWED_STATUS)[number])) {
    errors.push({ field: "statusCode", message: "کد وضعیت مجاز نیست" });
  }

  if (rule.matchType === "REGEX" && source) {
    try {
      new RegExp(source);
    } catch (e) {
      errors.push({ field: "source", message: `الگوی regex نامعتبر: ${(e as Error).message}` });
    }
  }

  // حلقه‌ی بدیهی: مبدأ و مقصد یکی
  if (source && dest && rule.matchType === "EXACT") {
    if (normalizePath(source) === normalizePath(dest)) {
      errors.push({ field: "destination", message: "مبدأ و مقصد یکی است — حلقه‌ی بی‌نهایت می‌سازد" });
    }
  }

  return errors;
}

/**
 * تطبیق یک مسیر با مجموعه قواعد.
 *
 * ترتیب اهمیت دارد و عمدی است: EXACT قبل از PREFIX و PREFIX قبل از REGEX،
 * چون قاعده‌ی خاص‌تر باید بر عام‌تر بچربد. بین PREFIXها هم طولانی‌ترین مبدأ
 * برنده است تا `/blog/archive` بر `/blog` مقدم شود.
 *
 * `rawPath` باید مسیر خام درخواست باشد (بدون query). هم شکل خام و هم شکل
 * decode‌شده امتحان می‌شوند تا آدرس‌های فارسی در هر دو حالت کار کنند.
 */
export function matchPath(
  rawPath: string,
  rules: RedirectRule[],
): { rule: RedirectRule; destination: string } | null {
  const candidates = new Set<string>();
  candidates.add(normalizePath(rawPath));
  try {
    candidates.add(normalizePath(decodeURIComponent(rawPath)));
  } catch {
    /* دنباله‌ی درصد نامعتبر — همان شکل خام کافی است */
  }

  const exact = rules.filter((r) => r.matchType === "EXACT");
  const prefix = rules
    .filter((r) => r.matchType === "PREFIX")
    .sort((a, b) => b.source.length - a.source.length);
  const regex = rules.filter((r) => r.matchType === "REGEX");

  for (const p of candidates) {
    const hit = exact.find((r) => r.source === p);
    if (hit) return { rule: hit, destination: hit.destination };
  }

  for (const p of candidates) {
    for (const r of prefix) {
      if (p === r.source || p.startsWith(r.source.endsWith("/") ? r.source : r.source + "/")) {
        const rest = p.slice(r.source.length);
        const dest = r.destination.replace(/\/+$/, "") + rest;
        return { rule: r, destination: dest || "/" };
      }
    }
  }

  for (const r of regex) {
    let re: RegExp;
    try {
      re = new RegExp(r.source, "i");
    } catch {
      continue; // قاعده‌ی خراب نباید کل تطبیق را بشکند
    }
    for (const p of candidates) {
      const m = p.match(re);
      if (m) {
        const dest = r.destination.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
        return { rule: r, destination: dest };
      }
    }
  }

  return null;
}

/** مسیرهایی که هرگز نباید ریدایرکت یا لاگ شوند. */
export const SKIP_PREFIXES = [
  "/_next",
  "/api",
  "/admin",
  "/uploads",
  "/upload",
  "/assets",
  "/static",
  "/.well-known",
];

export const SKIP_EXACT = ["/favicon.ico", "/robots.txt", "/sitemap.xml", "/manifest.json"];

export function shouldSkip(pathname: string): boolean {
  if (SKIP_EXACT.includes(pathname)) return true;
  if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  // هر چیزی که پسوند فایل دارد (تصویر، فونت، css) — ریدایرکت محتوایی نیست
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return true;
  return false;
}
