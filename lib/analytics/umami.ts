/**
 * واسط Umami — فقط سمت سرور.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۱۳.۲ و ۱۳.۶
 * الگو: `bartar-crm/features/marketing/services/umami.service.ts`
 *
 * سه تصمیم برتر، عیناً:
 * ۱. **تجمیع با Umami می‌ماند.** از API آمارش می‌خوانیم نه از دیتابیسش؛ وگرنه
 *    پنل ما و خود Umami دو عدد متفاوت برای «نشست» و «پرش» می‌دهند.
 * ۲. **احراز هویت با کد اشتراک فقط‌خواندنی**، نه رمز ادمین.
 * ۳. **از لوپ‌بک** — هر سرور Umami خودش را دارد (بخش ۱۳.۲)، پس همیشه
 *    `127.0.0.1` و آدرس از `UMAMI_BASE_URL`.
 *
 * ⚠️ تله: توکن اشتراک **دو** هدر می‌خواهد. بدون `x-umami-share-context` پاسخ
 * ۴۰۱ است با همان متن «Unauthorized» که کد غلط می‌دهد.
 */

import { prisma } from "@/lib/prisma";

export function umamiBaseUrl() {
  return (process.env.UMAMI_BASE_URL || "http://127.0.0.1:3043").replace(/\/$/, "");
}

// ── تنظیمات ─────────────────────────────────────────────────────────────

export type AnalyticsSettings = {
  trackingEnabled: boolean;
  umamiWebsiteId: string | null;
  umamiShareSlug: string | null;
};

const EMPTY_SETTINGS: AnalyticsSettings = { trackingEnabled: false, umamiWebsiteId: null, umamiShareSlug: null };

/**
 * لایه‌ی ریشه در هر درخواست صفحه این را می‌خواند؛ یک دقیقه کش حافظه تا هر
 * بازدید یک SELECT اضافه نباشد. ذخیره از پنل کش را خالی می‌کند
 * (`forgetAnalyticsSettings`) — ولی فقط در همان پروسه، که برای یک سایت یکی است.
 */
const SETTINGS_TTL_MS = 60_000;
let settingsCache: { value: AnalyticsSettings; expiresAt: number } | null = null;

export async function getAnalyticsSettings(): Promise<AnalyticsSettings> {
  if (settingsCache && settingsCache.expiresAt > Date.now()) return settingsCache.value;
  try {
    const row = await prisma.seoAnalyticsSettings.findUnique({
      where: { id: "singleton" },
      select: { trackingEnabled: true, umamiWebsiteId: true, umamiShareSlug: true },
    });
    const value = row ?? EMPTY_SETTINGS;
    settingsCache = { value, expiresAt: Date.now() + SETTINGS_TTL_MS };
    return value;
  } catch {
    // دیتابیس در دسترس نیست — صفحه‌ی فروشگاه نباید به‌خاطر آمار بشکند
    return EMPTY_SETTINGS;
  }
}

export function forgetAnalyticsSettings() {
  settingsCache = null;
  tokenCache.clear();
  responseCache.clear();
}

/** شناسه‌ی سایت Umami همیشه uuid است؛ هر چیز دیگری در `data-website-id` یعنی ردیاب بی‌صدا کار نمی‌کند */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── خواندن آمار ─────────────────────────────────────────────────────────

export class AnalyticsUnavailableError extends Error {
  constructor(message = "آمار بازدید در دسترس نیست") {
    super(message);
    this.name = "AnalyticsUnavailableError";
  }
}

type Cached<T> = { value: T; expiresAt: number };
type Share = { token: string; websiteId: string };

/** توکن اشتراک انقضا ندارد؛ یک ساعت نگه می‌داریم تا کدِ باطل‌شده حداکثر یک ساعت بعد دیده شود */
const TOKEN_TTL_MS = 60 * 60 * 1000;
/** چند نفر که هم‌زمان صفحه را باز می‌کنند نباید چند برابر به Umami بزنند؛ کوتاه تا «زنده» زنده بماند */
const RESPONSE_TTL_MS = 30 * 1000;

const tokenCache = new Map<string, Cached<Share>>();
const responseCache = new Map<string, Cached<unknown>>();

function readCache<T>(cache: Map<string, Cached<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

async function umamiFetch(path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${umamiBaseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AnalyticsUnavailableError("سرویس آمار بازدید (Umami) پاسخ نداد — روی این سرور نصب و روشن است؟");
  }
  if (!res.ok) {
    throw new AnalyticsUnavailableError(
      res.status === 404
        ? "کد اشتراک در Umami پیدا نشد — شاید حذف شده باشد"
        : `سرویس آمار بازدید خطا داد (${res.status})`,
    );
  }
  return res.json();
}

async function resolveShare(slug: string): Promise<Share> {
  const cached = readCache(tokenCache, slug);
  if (cached) return cached;
  const data = await umamiFetch(`/api/share/${encodeURIComponent(slug)}`);
  const token: unknown = data?.token;
  const websiteId: unknown = data?.websiteId;
  if (typeof token !== "string" || typeof websiteId !== "string") {
    throw new AnalyticsUnavailableError("پاسخ کد اشتراک ناقص بود");
  }
  const share = { token, websiteId };
  tokenCache.set(slug, { value: share, expiresAt: Date.now() + TOKEN_TTL_MS });
  return share;
}

/** یک خوانش از API آمار Umami با کد اشتراک */
export async function umamiRead<T = unknown>(
  slug: string,
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const { token, websiteId } = await resolveShare(slug);
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") search.set(k, String(v));
  }
  const q = search.toString();
  const path = `/api/websites/${websiteId}/${endpoint}${q ? `?${q}` : ""}`;

  const key = `${slug}|${path}`;
  const cached = readCache(responseCache, key);
  if (cached !== null) return cached as T;

  const data = await umamiFetch(path, {
    headers: {
      // هر دو لازم‌اند
      "x-umami-share-token": token,
      "x-umami-share-context": "1",
    },
  });
  responseCache.set(key, { value: data, expiresAt: Date.now() + RESPONSE_TTL_MS });
  return data as T;
}

/**
 * «آزمایش اتصال» در تنظیمات: کد اشتراک را باز می‌کند و می‌گوید به کدام سایت
 * Umami اشاره دارد، تا اشتباهِ «کد سایت دیگری را چسباندم» همان‌جا دیده شود.
 */
export async function testUmami(slug: string, websiteId: string | null) {
  tokenCache.delete(slug);
  const share = await resolveShare(slug);
  const stats = await umamiRead<{ pageviews?: number }>(slug, "stats", {
    startAt: Date.now() - 24 * 60 * 60 * 1000,
    endAt: Date.now(),
  });
  return {
    ok: true,
    shareWebsiteId: share.websiteId,
    websiteMatches: !websiteId || share.websiteId === websiteId,
    pageviews24h: Number(stats?.pageviews) || 0,
  };
}
