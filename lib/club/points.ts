import { prisma } from "@/lib/prisma";
import type { PointReason } from "@prisma/client";

/**
 * قواعد امتیازدهی — همه از تنظیمات، هیچ عدد ثابتی در کد
 *
 * ⚠️ اگر رویداد امتیازدهی جدیدی اضافه می‌کنید، مقدارش را **حتماً** به
 *    `StoreSettings` اضافه کنید و از اینجا بخوانید. عدد ثابت در کد یعنی هر
 *    کسب‌وکار مجبور است با همان عدد کار کند و تغییرش دیپلوی می‌خواهد.
 */

export interface PointRules {
  perToman: number;
  expiryDays: number;
  onSignup: number;
  onBirthday: number;
  onReview: number;
  onConsent: number;
  onReferrer: number;
  onReferee: number;
  redeemEnabled: boolean;
  redeemRate: number;
  redeemMin: number;
  redeemMaxPct: number;
}

export async function loadPointRules(): Promise<PointRules> {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: {
      pointPerToman: true,
      pointExpiryDays: true,
      pointOnSignup: true,
      pointOnBirthday: true,
      pointOnReview: true,
      pointOnConsent: true,
      pointOnReferrer: true,
      pointOnReferee: true,
      pointRedeemEnabled: true,
      pointRedeemRate: true,
      pointRedeemMin: true,
      pointRedeemMaxPct: true,
    },
  });

  return {
    perToman: s?.pointPerToman ?? 0,
    expiryDays: s?.pointExpiryDays ?? 0,
    onSignup: s?.pointOnSignup ?? 0,
    onBirthday: s?.pointOnBirthday ?? 0,
    onReview: s?.pointOnReview ?? 0,
    onConsent: s?.pointOnConsent ?? 0,
    onReferrer: s?.pointOnReferrer ?? 0,
    onReferee: s?.pointOnReferee ?? 0,
    redeemEnabled: s?.pointRedeemEnabled ?? false,
    redeemRate: s?.pointRedeemRate ?? 1,
    redeemMin: s?.pointRedeemMin ?? 0,
    redeemMaxPct: s?.pointRedeemMaxPct ?? 100,
  };
}

/** تاریخ انقضای امتیاز طبق تنظیمات — `null` یعنی بی‌انقضا */
export function expiryDate(rules: PointRules): Date | null {
  return rules.expiryDays > 0
    ? new Date(Date.now() + rules.expiryDays * 86_400_000)
    : null;
}

/**
 * اعطای امتیاز رویدادی با محافظت در برابر تکرار
 *
 * `refType` + `refId` کلید یکتایی است: امتیاز نظر روی یک محصول، تولد یک سال،
 * معرفی یک نفر — همه فقط یک بار داده می‌شوند.
 *
 * ⚠️ هرگز throw نمی‌کند.
 */
export async function grantPoints(input: {
  profileId: string;
  reason: PointReason;
  /** اگر داده نشود، از قواعد تنظیمات بر اساس `reason` خوانده می‌شود */
  amount?: number;
  refType?: string;
  refId?: string;
  note?: string;
}): Promise<number> {
  try {
    const rules = await loadPointRules();
    const amount = input.amount ?? amountForReason(input.reason, rules);
    if (amount <= 0) return 0;

    if (input.refType && input.refId) {
      const already = await prisma.pointTransaction.findFirst({
        where: {
          profileId: input.profileId,
          reason: input.reason,
          refType: input.refType,
          refId: input.refId,
        },
        select: { id: true },
      });
      if (already) return 0;
    }

    await prisma.pointTransaction.create({
      data: {
        profileId: input.profileId,
        amount,
        reason: input.reason,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        note: input.note ?? null,
        expiresAt: expiryDate(rules),
      },
    });

    return amount;
  } catch (err) {
    console.error("[club] اعطای امتیاز ناموفق:", err);
    return 0;
  }
}

function amountForReason(reason: PointReason, r: PointRules): number {
  switch (reason) {
    case "SIGNUP":
      return r.onSignup;
    case "BIRTHDAY":
      return r.onBirthday;
    case "REVIEW":
      return r.onReview;
    case "CONSENT":
      return r.onConsent;
    case "REFERRAL":
      return r.onReferrer;
    default:
      // PURCHASE از مبلغ سفارش حساب می‌شود، MANUAL/ADJUST را ادمین وارد می‌کند
      return 0;
  }
}

export interface RedeemQuote {
  allowed: boolean;
  /** حداکثر امتیاز قابل استفاده روی این سفارش */
  maxPoints: number;
  /** معادل تومانی آن */
  maxDiscount: number;
  reason?: string;
}

/**
 * محاسبه‌ی سقف استفاده از امتیاز روی یک سفارش
 *
 * سه سقف هم‌زمان اعمال می‌شود: موجودی عضو، درصد مجاز از مبلغ سفارش، و
 * حداقل امتیاز لازم. همه از تنظیمات می‌آیند.
 */
export async function quoteRedeem(
  profileId: string,
  orderTotal: bigint
): Promise<RedeemQuote> {
  const rules = await loadPointRules();

  if (!rules.redeemEnabled) {
    return { allowed: false, maxPoints: 0, maxDiscount: 0, reason: "استفاده از امتیاز فعال نیست" };
  }
  if (rules.redeemRate <= 0) {
    return { allowed: false, maxPoints: 0, maxDiscount: 0, reason: "ارزش امتیاز تنظیم نشده" };
  }

  const agg = await prisma.pointTransaction.aggregate({
    where: { profileId },
    _sum: { amount: true },
  });
  const balance = agg._sum.amount ?? 0;

  if (balance < rules.redeemMin) {
    return {
      allowed: false,
      maxPoints: 0,
      maxDiscount: 0,
      reason: `حداقل ${rules.redeemMin.toLocaleString("fa-IR")} امتیاز لازم است`,
    };
  }

  const pctCap = (Number(orderTotal) * rules.redeemMaxPct) / 100;
  const byBalance = balance * rules.redeemRate;
  const maxDiscount = Math.floor(Math.min(pctCap, byBalance));
  const maxPoints = Math.floor(maxDiscount / rules.redeemRate);

  return {
    allowed: maxPoints > 0,
    maxPoints,
    maxDiscount,
    ...(maxPoints > 0 ? {} : { reason: "امتیاز کافی برای این سفارش نیست" }),
  };
}


/**
 * برداشت امتیاز بابت یک سفارش
 *
 * ⚠️ مقدار درخواستی کلاینت **هرگز** مستقیم اعمال نمی‌شود؛ همیشه با
 *    `quoteRedeem` سقف‌گذاری می‌شود. بدون این، کلاینت می‌تواند امتیازی که
 *    ندارد خرج کند.
 *
 * ⚠️ تراکنش منفی با `refType="order"` ثبت می‌شود تا هم در دفتر کل دیده شود و
 *    هم اگر سفارش لغو شد بتوان برش گرداند.
 */
export async function redeemPointsForOrder(input: {
  profileId: string;
  orderId: string;
  orderTotal: bigint;
  /** امتیاز درخواستی کاربر — `"max"` یعنی بیشترین مقدار ممکن */
  requested: number | "max";
}): Promise<{ points: number; discount: bigint }> {
  const quote = await quoteRedeem(input.profileId, input.orderTotal);
  if (!quote.allowed || quote.maxPoints <= 0) return { points: 0, discount: 0n };

  const wanted =
    input.requested === "max"
      ? quote.maxPoints
      : Math.max(0, Math.floor(input.requested));

  const points = Math.min(wanted, quote.maxPoints);
  if (points <= 0) return { points: 0, discount: 0n };

  const rules = await loadPointRules();
  const discount = BigInt(Math.floor(points * rules.redeemRate));
  if (discount <= 0n) return { points: 0, discount: 0n };

  await prisma.pointTransaction.create({
    data: {
      profileId: input.profileId,
      amount: -points,
      reason: "REDEEM",
      refType: "order",
      refId: input.orderId,
      note: `استفاده در سفارش — ${discount.toLocaleString("fa-IR")} تومان تخفیف`,
    },
  });

  return { points, discount };
}

/**
 * بازگرداندن امتیاز خرج‌شده هنگام لغو سفارش
 *
 * بدون این، مشتری هم سفارشش لغو می‌شود هم امتیازش می‌سوزد.
 * تکرارش بی‌اثر است.
 */
export async function refundOrderPoints(orderId: string): Promise<number> {
  try {
    const spent = await prisma.pointTransaction.findFirst({
      where: { refType: "order", refId: orderId, reason: "REDEEM" },
      select: { id: true, profileId: true, amount: true },
    });
    if (!spent || spent.amount >= 0) return 0;

    const already = await prisma.pointTransaction.findFirst({
      where: { refType: "order_refund", refId: orderId, reason: "ADJUST" },
      select: { id: true },
    });
    if (already) return 0;

    const amount = -spent.amount;

    await prisma.pointTransaction.create({
      data: {
        profileId: spent.profileId,
        amount,
        reason: "ADJUST",
        refType: "order_refund",
        refId: orderId,
        note: "بازگشت امتیاز بابت لغو سفارش",
      },
    });

    return amount;
  } catch (err) {
    console.error("[club] بازگرداندن امتیاز ناموفق:", err);
    return 0;
  }
}
