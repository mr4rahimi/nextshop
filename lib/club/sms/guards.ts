import { prisma } from "@/lib/prisma";
import { normalizePhone } from "../phone";
import type { SmsKind } from "@prisma/client";

/**
 * نگهبان‌های ارسال پیامک
 *
 * هر پیام قبل از رفتن به پنل از این فیلترها عبور می‌کند. هدف: نه پول هدر برود،
 * نه قانون نقض شود، نه مشتری بمباران شود.
 *
 * پیام‌های تراکنشی (OTP، وضعیت سفارش) فقط از فیلتر «لغو» و «مسدود» عبور
 * می‌کنند — رضایت تبلیغاتی و ساعت مجاز به آن‌ها ربطی ندارد.
 */

export type SkipReason =
  | "OPTED_OUT"
  | "NO_CONSENT"
  | "BLOCKED"
  | "MONTHLY_CAP"
  | "INVALID_PHONE"
  | "USER_INACTIVE";

export const SKIP_REASON_FA: Record<SkipReason, string> = {
  OPTED_OUT: "لغو عضویت کرده",
  NO_CONSENT: "رضایت تبلیغاتی ندارد",
  BLOCKED: "توسط ادمین مسدود شده",
  MONTHLY_CAP: "سقف پیامک ماهانه",
  INVALID_PHONE: "شماره نامعتبر",
  USER_INACTIVE: "حساب غیرفعال",
};

export interface GuardSettings {
  allowedHourStart: number;
  allowedHourEnd: number;
  monthlyCapPerUser: number;
}

export interface GuardCandidate {
  phone: string;
  userId?: string | null;
}

export interface GuardResult {
  allowed: GuardCandidate[];
  skipped: { phone: string; userId?: string | null; reason: SkipReason }[];
}

/** خواندن تنظیمات نگهبان از StoreSettings */
export async function loadGuardSettings(): Promise<GuardSettings> {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: {
      smsAllowedHourStart: true,
      smsAllowedHourEnd: true,
      smsMonthlyCapPerUser: true,
    },
  });

  return {
    allowedHourStart: s?.smsAllowedHourStart ?? 9,
    allowedHourEnd: s?.smsAllowedHourEnd ?? 21,
    monthlyCapPerUser: s?.smsMonthlyCapPerUser ?? 4,
  };
}

/**
 * آیا الان می‌توان پیام تبلیغاتی فرستاد؟
 * ساعت بر اساس منطقه زمانی تهران محاسبه می‌شود، نه ساعت سرور.
 */
export function isWithinAllowedHours(settings: GuardSettings, at = new Date()): boolean {
  const hour = tehranHour(at);
  return hour >= settings.allowedHourStart && hour < settings.allowedHourEnd;
}

/**
 * چند میلی‌ثانیه تا شروع بازه مجاز بعدی؟
 * برای موکول کردن پیام‌های شبانه به صبح استفاده می‌شود.
 */
export function delayUntilAllowedHours(settings: GuardSettings, at = new Date()): number {
  if (isWithinAllowedHours(settings, at)) return 0;

  const hour = tehranHour(at);
  const minute = tehranMinute(at);

  // اگر قبل از شروع بازه هستیم → همین امروز
  // اگر بعد از پایان بازه هستیم → فردا صبح
  const hoursAhead =
    hour < settings.allowedHourStart
      ? settings.allowedHourStart - hour
      : 24 - hour + settings.allowedHourStart;

  return (hoursAhead * 60 - minute) * 60_000;
}

/**
 * فیلتر کردن یک لیست گیرنده
 *
 * برای کارایی، همه بررسی‌ها به‌صورت گروهی انجام می‌شوند (نه حلقه با کوئری).
 */
export async function applyGuards(
  candidates: GuardCandidate[],
  kind: SmsKind,
  settings?: GuardSettings
): Promise<GuardResult> {
  const cfg = settings ?? (await loadGuardSettings());

  const allowed: GuardCandidate[] = [];
  const skipped: GuardResult["skipped"] = [];

  // ── نرمال‌سازی و حذف تکراری ────────────────────────────────────
  const seen = new Set<string>();
  const clean: GuardCandidate[] = [];

  for (const c of candidates) {
    const phone = normalizePhone(c.phone);
    if (!phone) {
      skipped.push({ phone: c.phone, userId: c.userId, reason: "INVALID_PHONE" });
      continue;
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    clean.push({ phone, userId: c.userId });
  }

  if (clean.length === 0) return { allowed, skipped };

  const phones = clean.map((c) => c.phone);

  // ── لیست لغو ───────────────────────────────────────────────────
  const optedOut = new Set(
    (
      await prisma.smsOptOut.findMany({
        where: { phone: { in: phones } },
        select: { phone: true },
      })
    ).map((r) => r.phone)
  );

  // ── وضعیت پروفایل باشگاه ───────────────────────────────────────
  const profiles = await prisma.clubProfile.findMany({
    where: { user: { phone: { in: phones } } },
    select: {
      smsConsent: true,
      isBlocked: true,
      user: { select: { id: true, phone: true, isActive: true } },
    },
  });

  const profileByPhone = new Map(profiles.map((p) => [p.user.phone, p]));

  // ── سقف ماهانه (فقط تبلیغاتی) ──────────────────────────────────
  let capCount = new Map<string, number>();

  if (kind === "MARKETING" && cfg.monthlyCapPerUser > 0) {
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const grouped = await prisma.smsMessage.groupBy({
      by: ["phone"],
      where: {
        phone: { in: phones },
        kind: "MARKETING",
        status: { in: ["SENT", "DELIVERED"] },
        sentAt: { gte: monthAgo },
      },
      _count: { _all: true },
    });

    capCount = new Map(grouped.map((g) => [g.phone, g._count._all]));
  }

  // ── اعمال ──────────────────────────────────────────────────────
  for (const c of clean) {
    const profile = profileByPhone.get(c.phone);
    const userId = c.userId ?? profile?.user.id ?? null;

    if (optedOut.has(c.phone)) {
      skipped.push({ phone: c.phone, userId, reason: "OPTED_OUT" });
      continue;
    }

    if (profile?.isBlocked) {
      skipped.push({ phone: c.phone, userId, reason: "BLOCKED" });
      continue;
    }

    if (profile && !profile.user.isActive) {
      skipped.push({ phone: c.phone, userId, reason: "USER_INACTIVE" });
      continue;
    }

    // فیلترهای مخصوص پیام تبلیغاتی
    if (kind === "MARKETING") {
      if (!profile?.smsConsent) {
        skipped.push({ phone: c.phone, userId, reason: "NO_CONSENT" });
        continue;
      }

      const sent = capCount.get(c.phone) ?? 0;
      if (cfg.monthlyCapPerUser > 0 && sent >= cfg.monthlyCapPerUser) {
        skipped.push({ phone: c.phone, userId, reason: "MONTHLY_CAP" });
        continue;
      }
    }

    allowed.push({ phone: c.phone, userId });
  }

  return { allowed, skipped };
}

// ─── زمان تهران ─────────────────────────────────────────────────────

const tehranFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tehran",
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});

function tehranParts(at: Date): { hour: number; minute: number } {
  const parts = tehranFmt.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour") % 24, minute: get("minute") };
}

function tehranHour(at: Date): number {
  return tehranParts(at).hour;
}

function tehranMinute(at: Date): number {
  return tehranParts(at).minute;
}