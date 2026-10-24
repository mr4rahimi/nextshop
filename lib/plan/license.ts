/**
 * لایسنس گردانوس — خواندن، تأیید امضا و وضعیت فعلی. docs/plans/licensing.md
 *
 * قاعده‌ی طلایی (همان برتر): **نبودِ لایسنس ⟺ همه‌چیز روشن ⟺ رفتار امروز سایت‌ها.**
 * سایت‌های فعلی بدون هیچ تغییری همان می‌مانند؛ فقط نصب‌های تازه‌ی گردانوس لایسنس دارند.
 *
 * شکل توکن: `GL1.<payload base64url>.<امضای ed25519 base64url>` — امضا روی
 * `GL1.<payload>`. کلید خصوصی فقط در پنل گردانوس است؛ اینجا فقط کلید عمومی.
 * تأیید آفلاین است: سایت برای فهمیدن بسته‌اش به هیچ سروری زنگ نمی‌زند.
 *
 * منبع توکن: `StoreSettings.licenseToken` (مدیر از صفحه‌ی «بسته‌ی من» می‌چسباند) و
 * متغیر `GARDANOS_LICENSE` (نصاب در `.env`). اگر هر دو معتبر باشند، تازه‌ترین برنده است.
 *
 * ⚠️ توکنِ هست‌ولی‌نامعتبر (امضای غلط، دامنه‌ی دیگر) «همه‌چیز روشن» نیست — پنل به
 *    هسته محدود می‌شود. وگرنه دست‌کاری لایسنس راه باز کردن همه‌چیز بود.
 * ⚠️ فروشگاه هیچ‌وقت با لایسنس خاموش نمی‌شود؛ انقضا فقط پنل را محدود می‌کند.
 */

import { createPublicKey, verify } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { FEATURE_KEYS, type FeatureKey, type PanelFeatures } from "./features";

const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAZGmZUGTqG7BD+JfH1rHPSHMGyWxxciGXj/UzjFG4RJU=
-----END PUBLIC KEY-----`;

const PREFIX = "GL1";
const DAY_MS = 86_400_000;
const DEFAULT_GRACE_DAYS = 14;

export interface LicensePayload {
  /** شناسه‌ی اشتراک در پنل گردانوس */
  sub: string;
  /** دامنه‌ی سایت بدون www — باید با SITE_URL بخواند */
  domain: string;
  business: string;
  plan: string;
  planName: string;
  /** کلیدهای امکان یا "*" برای همه */
  features: FeatureKey[] | "*";
  /** سقف ادمین فعال؛ ۰ یعنی نامحدود */
  seats: number;
  /** ISO */
  issuedAt: string;
  /** ISO؛ null یعنی بی‌انقضا */
  expiresAt: string | null;
  graceDays?: number;
}

export type LicenseStatus =
  /** لایسنسی نیست — همه‌چیز روشن */
  | "none"
  | "active"
  /** منقضی ولی در مهلت — همه‌چیز روشن با هشدار */
  | "grace"
  /** بعد از مهلت — پنل فقط هسته */
  | "expired"
  /** امضا یا دامنه نمی‌خواند — پنل فقط هسته */
  | "invalid";

export interface LicenseState {
  status: LicenseStatus;
  payload: LicensePayload | null;
  /** امکان‌هایی که پنل الان باز می‌کند */
  panelFeatures: PanelFeatures;
  /** امکان‌های سمت فروشگاه (باشگاه، چت، تنوع) — انقضا خاموششان نمی‌کند */
  shopFeatures: PanelFeatures;
  /** ۰ یعنی نامحدود */
  seats: number;
  /** روزهای مانده تا انقضا (منفی = گذشته)؛ null یعنی بی‌انقضا */
  daysLeft: number | null;
  /** روزهای مانده از مهلت بعد از انقضا */
  graceLeft: number | null;
  /** شرح خطا برای صفحه‌ی «بسته‌ی من» */
  error: string | null;
}

const UNLIMITED: LicenseState = {
  status: "none",
  payload: null,
  panelFeatures: "*",
  shopFeatures: "*",
  seats: 0,
  daysLeft: null,
  graceLeft: null,
  error: null,
};

function b64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function siteDomain(): string | null {
  try {
    return new URL(SITE_URL).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export type ParseResult = { ok: true; payload: LicensePayload } | { ok: false; error: string };

/** تأیید امضا و شکل توکن — بدون نگاه به تاریخ */
export function parseLicense(token: string): ParseResult {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, error: "شکل لایسنس درست نیست" };
  let valid = false;
  try {
    valid = verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey(LICENSE_PUBLIC_KEY), b64url(parts[2]));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, error: "امضای لایسنس معتبر نیست" };

  let payload: LicensePayload;
  try {
    payload = JSON.parse(b64url(parts[1]).toString("utf8"));
  } catch {
    return { ok: false, error: "محتوای لایسنس خوانا نیست" };
  }
  if (!payload.sub || !payload.domain || !payload.issuedAt) return { ok: false, error: "لایسنس ناقص است" };
  if (payload.features !== "*") {
    payload.features = (Array.isArray(payload.features) ? payload.features : []).filter((f) =>
      FEATURE_KEYS.includes(f),
    );
  }
  return { ok: true, payload };
}

/** دامنه‌ی لایسنس با این سایت می‌خواند؟ (www مهم نیست) */
export function domainMatches(payload: LicensePayload): boolean {
  const here = siteDomain();
  return !!here && payload.domain.replace(/^www\./, "").toLowerCase() === here;
}

export function stateFor(token: string | null, now = Date.now()): LicenseState {
  if (!token?.trim()) return UNLIMITED;

  const parsed = parseLicense(token);
  if (!parsed.ok) return restricted(null, parsed.error);
  const p = parsed.payload;
  if (!domainMatches(p)) return restricted(p, `این لایسنس برای ${p.domain} است، نه این سایت`);

  const seats = Math.max(0, Math.floor(p.seats || 0));
  const base = { payload: p, shopFeatures: p.features, seats, error: null };
  if (!p.expiresAt) {
    return { ...base, status: "active", panelFeatures: p.features, daysLeft: null, graceLeft: null };
  }
  const daysLeft = Math.ceil((Date.parse(p.expiresAt) - now) / DAY_MS);
  if (daysLeft > 0) {
    return { ...base, status: "active", panelFeatures: p.features, daysLeft, graceLeft: null };
  }
  const graceLeft = (p.graceDays ?? DEFAULT_GRACE_DAYS) + daysLeft;
  if (graceLeft > 0) {
    return { ...base, status: "grace", panelFeatures: p.features, daysLeft, graceLeft };
  }
  return { ...base, status: "expired", panelFeatures: [], daysLeft, graceLeft: 0 };
}

function restricted(payload: LicensePayload | null, error: string): LicenseState {
  return {
    status: "invalid",
    payload,
    panelFeatures: [],
    shopFeatures: [],
    seats: Math.max(1, payload?.seats || 1),
    daysLeft: null,
    graceLeft: null,
    error,
  };
}

/** از بین چند توکن، معتبرِ تازه‌تر؛ اگر هیچ‌کدام معتبر نبود، اولیِ موجود (برای پیام خطا) */
export function pickToken(tokens: (string | null | undefined)[]): string | null {
  const present = tokens.filter((t): t is string => !!t?.trim());
  let best: { token: string; at: number } | null = null;
  for (const t of present) {
    const r = parseLicense(t);
    if (r.ok && domainMatches(r.payload)) {
      const at = Date.parse(r.payload.issuedAt) || 0;
      if (!best || at > best.at) best = { token: t, at };
    }
  }
  return best?.token ?? present[0] ?? null;
}

// ─── کش — proxy روی هر درخواست پنل این را می‌خواند ───────────────────────

const TTL_MS = 60_000;
let cache: { at: number; state: LicenseState } | null = null;

export async function getLicenseState(): Promise<LicenseState> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.state;
  let dbToken: string | null = null;
  try {
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { licenseToken: true } });
    dbToken = s?.licenseToken ?? null;
  } catch (e) {
    // دیتابیس نیست: اگر قبلاً چیزی خوانده‌ایم همان را نگه داریم
    console.error("[license] خواندن از دیتابیس شکست خورد:", e);
    if (cache) return cache.state;
  }
  const state = stateFor(pickToken([dbToken, process.env.GARDANOS_LICENSE]), now);
  cache = { at: now, state };
  return state;
}

export function clearLicenseCache(): void {
  cache = null;
}

/** امکان در پنل باز است؟ */
export async function panelHas(feature: FeatureKey): Promise<boolean> {
  const f = (await getLicenseState()).panelFeatures;
  return f === "*" || f.includes(feature);
}

/** امکان سمت فروشگاه باز است؟ (انقضا اثری ندارد، فقط بسته) */
export async function shopHas(feature: FeatureKey): Promise<boolean> {
  const f = (await getLicenseState()).shopFeatures;
  return f === "*" || f.includes(feature);
}

/**
 * سقف ادمین فعال — برای ساختن ادمین تازه یا فعال‌کردن دوباره.
 * `null` یعنی اجازه هست؛ وگرنه پیام خطا.
 */
export async function seatError(extra = 1): Promise<string | null> {
  const { seats, status } = await getLicenseState();
  if (status === "none" || seats === 0) return null;
  const active = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
  if (active + extra <= seats) return null;
  return `بسته‌ی شما ${seats.toLocaleString("fa-IR")} کاربر پنل دارد و همه پر است. برای کاربر بیشتر بسته را ارتقا دهید یا یک ادمین را غیرفعال کنید.`;
}
