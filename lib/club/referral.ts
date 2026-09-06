import { prisma } from "@/lib/prisma";
import { grantPoints, loadPointRules } from "./points";
import { recordTouchpoint } from "./touchpoints";

/**
 * معرفی دوستان
 *
 * کم‌هزینه‌ترین کانال جذب: عضو موجود کدش را می‌دهد، دوستش با آن عضو می‌شود و
 * هر دو امتیاز می‌گیرند. مقدار امتیاز هر طرف جدا و از تنظیمات می‌آید.
 *
 * ⚠️ پاداش هنگام **اولین خرید** معرفی‌شده داده می‌شود، نه هنگام عضویتش —
 *    وگرنه ساختن حساب‌های جعلی برای گرفتن امتیاز صرف می‌کند.
 */

/** حروف مبهم (I O 0 1) حذف شده‌اند تا کد را تلفنی هم بشود گفت */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * کد معرفی عضو — با اولین درخواست ساخته و ذخیره می‌شود
 *
 * ⚠️ برخورد کد با تلاش دوباره حل می‌شود، نه با کد طولانی‌تر: با ۳۲ حرف و طول ۷،
 *    فضای کد ۳۴ میلیارد است و برخورد عملاً رخ نمی‌دهد؛ ولی اگر داد، بی‌صدا
 *    شکست خوردن بدتر از یک تلاش دوباره است.
 */
export async function getOrCreateReferralCode(profileId: string): Promise<string | null> {
  const existing = await prisma.clubProfile.findUnique({
    where: { id: profileId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      const updated = await prisma.clubProfile.update({
        where: { id: profileId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode;
    } catch {
      // برخورد کد یکتا — دوباره تلاش
    }
  }

  console.error("[club] ساخت کد معرفی بعد از ۵ تلاش ناموفق ماند");
  return null;
}

export type ReferralFailure =
  | "NOT_FOUND"
  | "SELF"
  | "ALREADY_REFERRED"
  | "TOO_LATE"
  | "DISABLED";

const MESSAGES: Record<ReferralFailure, string> = {
  NOT_FOUND: "کد معرفی معتبر نیست",
  SELF: "نمی‌توانید کد معرفی خودتان را استفاده کنید",
  ALREADY_REFERRED: "قبلاً با یک کد معرفی عضو شده‌اید",
  TOO_LATE: "کد معرفی را باید پیش از اولین خرید ثبت کنید",
  DISABLED: "معرفی دوستان فعال نیست",
};

/**
 * ثبت معرفی هنگام عضویت
 *
 * فقط پیوند را برقرار می‌کند؛ امتیاز بعداً با اولین خرید داده می‌شود.
 */
export async function applyReferral(input: {
  profileId: string;
  code: string;
}): Promise<{ ok: boolean; error?: string }> {
  const rules = await loadPointRules();
  if (rules.onReferrer <= 0 && rules.onReferee <= 0) {
    return { ok: false, error: MESSAGES.DISABLED };
  }

  const code = input.code.trim().toUpperCase();

  const me = await prisma.clubProfile.findUnique({
    where: { id: input.profileId },
    select: { id: true, referredById: true, referralCode: true, orderCount: true },
  });
  if (!me) return { ok: false, error: MESSAGES.NOT_FOUND };
  if (me.referredById) return { ok: false, error: MESSAGES.ALREADY_REFERRED };
  // بعد از اولین خرید دیگر نمی‌شود کد معرف ثبت کرد — وگرنه هر کسی بعد از خرید
  // یک کد پیدا می‌کند و امتیاز می‌گیرد
  if (me.orderCount > 0) return { ok: false, error: MESSAGES.TOO_LATE };
  if (me.referralCode === code) return { ok: false, error: MESSAGES.SELF };

  const referrer = await prisma.clubProfile.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!referrer) return { ok: false, error: MESSAGES.NOT_FOUND };
  if (referrer.id === input.profileId) return { ok: false, error: MESSAGES.SELF };

  await prisma.clubProfile.update({
    where: { id: input.profileId },
    data: { referredById: referrer.id, referredAt: new Date() },
  });

  await recordTouchpoint({
    profileId: input.profileId,
    source: "REFERRAL",
    externalId: referrer.id,
  });

  return { ok: true };
}

/**
 * پاداش معرفی — هنگام اولین خرید معرفی‌شده
 *
 * از `processOrderForClub` صدا زده می‌شود. تکرارش بی‌اثر است.
 */
export async function rewardReferralOnFirstPurchase(profileId: string): Promise<void> {
  try {
    const profile = await prisma.clubProfile.findUnique({
      where: { id: profileId },
      select: { id: true, referredById: true, orderCount: true },
    });

    if (!profile?.referredById) return;
    // فقط اولین خرید
    if (profile.orderCount !== 1) return;

    // معرفی‌شده
    await grantPoints({
      profileId: profile.id,
      reason: "REFERRAL",
      amount: (await loadPointRules()).onReferee,
      refType: "referral_referee",
      refId: profile.id,
      note: "پاداش عضویت با کد معرفی",
    });

    // معرف
    await grantPoints({
      profileId: profile.referredById,
      reason: "REFERRAL",
      refType: "referral_referrer",
      refId: profile.id,
      note: "پاداش معرفی دوست",
    });
  } catch (err) {
    console.error("[club] پاداش معرفی ناموفق:", err);
  }
}
