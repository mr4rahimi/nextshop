import { prisma as defaultPrisma } from "@/lib/prisma";
import type { Coupon, Prisma } from "@prisma/client";
import { couponAmount } from "./coupon-calc";

type Db = Prisma.TransactionClient | typeof defaultPrisma;

export { couponAmount };

/**
 * اعتبارسنجی و اعمال کد تخفیف
 *
 * ⚠️ اعتبارسنجی و اعمال **همیشه سمت سرور** انجام می‌شود. مقدار تخفیفی که
 *    کلاینت می‌فرستد هرگز مبنا نیست — فقط خود کد.
 *
 * ⚠️ شمارش استفاده از جدول `CouponRedemption` خوانده می‌شود، نه از شمارنده‌ی
 *    `usedCount`. شمارنده فقط برای نمایش سریع در ادمین است و اگر ناهمگام شود
 *    محدودیت را نمی‌شکند.
 */

export type CouponFailure =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "USAGE_LIMIT"
  | "USER_LIMIT"
  | "MIN_TOTAL"
  | "NOT_YOURS"
  | "CLUB_ONLY"
  | "TIER_ONLY"
  | "STORE_ONLY"
  | "ONLINE_ONLY"
  | "NEED_CUSTOMER";

const MESSAGES: Record<CouponFailure, string> = {
  NOT_FOUND: "کد تخفیف یافت نشد",
  INACTIVE: "این کد تخفیف غیرفعال است",
  NOT_STARTED: "زمان استفاده از این کد هنوز نرسیده است",
  EXPIRED: "مهلت این کد تخفیف تمام شده است",
  USAGE_LIMIT: "ظرفیت استفاده از این کد تکمیل شده است",
  USER_LIMIT: "شما قبلاً از این کد استفاده کرده‌اید",
  MIN_TOTAL: "مبلغ سبد خرید برای این کد کافی نیست",
  NOT_YOURS: "این کد برای حساب شما صادر نشده است",
  CLUB_ONLY: "این کد فقط برای اعضای باشگاه مشتریان است",
  TIER_ONLY: "این کد برای سطح عضویت شما نیست",
  STORE_ONLY: "این کد فقط در فروشگاه حضوری پذیرفته می‌شود",
  ONLINE_ONLY: "این کد فقط برای خرید از سایت است",
  NEED_CUSTOMER: "این کد برای هر مشتری محدود است؛ اول مشتری (با موبایل) را انتخاب کنید",
};

export interface CouponResult {
  ok: boolean;
  coupon?: Coupon;
  /** مبلغ تخفیف روی کالاها (تومان) */
  discount: bigint;
  /** آیا ارسال رایگان می‌شود */
  freeShipping: boolean;
  error?: string;
  code?: CouponFailure;
}

function fail(code: CouponFailure, msg?: string): CouponResult {
  return { ok: false, discount: 0n, freeShipping: false, error: msg ?? MESSAGES[code], code };
}

/** متن صندوقدار (نه خود مشتری) برای همان شکست‌ها */
const POS_MESSAGES: Partial<Record<CouponFailure, string>> = {
  USER_LIMIT: "این مشتری قبلاً از این کد استفاده کرده است",
  NOT_YOURS: "این کد برای مشتری دیگری صادر شده است",
  CLUB_ONLY: "این کد فقط برای اعضای باشگاه است؛ مشتری عضو را انتخاب کنید",
  TIER_ONLY: "این کد برای سطح عضویت این مشتری نیست",
};
const posFail = (code: CouponFailure, msg?: string) => fail(code, msg ?? POS_MESSAGES[code]);

export async function validateCoupon(
  input: {
    code: string;
    userId: string;
    itemsTotal: bigint;
    shippingFee: bigint;
  },
  prisma: Db = defaultPrisma,
): Promise<CouponResult> {
  const code = input.code.trim().toUpperCase();
  if (!code) return fail("NOT_FOUND");

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return fail("NOT_FOUND");
  if (!coupon.isActive) return fail("INACTIVE");
  if (!coupon.onlineEnabled) return fail("STORE_ONLY");

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return fail("NOT_STARTED");
  if (coupon.expiresAt && coupon.expiresAt < now) return fail("EXPIRED");

  if (coupon.userId && coupon.userId !== input.userId) return fail("NOT_YOURS");
  if (input.itemsTotal < coupon.minOrderTotal) return fail("MIN_TOTAL");

  // شمارش واقعی از جدول مصرف، نه از usedCount
  if (coupon.usageLimit > 0) {
    const total = await prisma.couponRedemption.count({ where: { couponId: coupon.id } });
    if (total >= coupon.usageLimit) return fail("USAGE_LIMIT");
  }

  if (coupon.perUserLimit > 0) {
    const mine = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId: input.userId },
    });
    if (mine >= coupon.perUserLimit) return fail("USER_LIMIT");
  }

  if (coupon.clubOnly || coupon.tierIds.length > 0) {
    const profile = await prisma.clubProfile.findUnique({
      where: { userId: input.userId },
      select: { tierId: true, isBlocked: true },
    });

    if (!profile || profile.isBlocked) return fail("CLUB_ONLY");
    if (coupon.tierIds.length > 0 && (!profile.tierId || !coupon.tierIds.includes(profile.tierId))) {
      return fail("TIER_ONLY");
    }
  }

  // ── محاسبه‌ی مبلغ ────────────────────────────────────────────────
  if (coupon.type === "FREE_SHIP") {
    return { ok: true, coupon, discount: 0n, freeShipping: true };
  }

  let discount: bigint;

  if (coupon.type === "PERCENT") {
    const pct = Number(coupon.value);
    discount = (input.itemsTotal * BigInt(Math.floor(pct))) / 100n;
    if (coupon.maxDiscount > 0n && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else {
    discount = coupon.value;
  }

  // تخفیف هرگز از مبلغ کالاها بیشتر نمی‌شود — وگرنه جمع سفارش منفی می‌شود
  if (discount > input.itemsTotal) discount = input.itemsTotal;

  return { ok: true, coupon, discount, freeShipping: false };
}

/**
 * ثبت مصرف کد روی یک سفارش
 *
 * ⚠️ بعد از ساخت سفارش صدا زده می‌شود. خطای یکتایی (`couponId+orderId`) یعنی
 *    قبلاً ثبت شده و بی‌خطر نادیده گرفته می‌شود.
 */
export async function consumeCoupon(input: {
  couponId: string;
  userId: string;
  orderId: string;
  discount: bigint;
}): Promise<void> {
  try {
    await defaultPrisma.$transaction([
      defaultPrisma.couponRedemption.create({
        data: {
          couponId: input.couponId,
          userId: input.userId,
          orderId: input.orderId,
          discount: input.discount,
        },
      }),
      defaultPrisma.coupon.update({
        where: { id: input.couponId },
        data: { usedCount: { increment: 1 } },
      }),
    ]);
  } catch {
    // ثبت تکراری — سفارش نباید به‌خاطرش شکست بخورد
  }
}

/** بازگرداندن ظرفیت کد هنگام لغو سفارش */
export async function releaseCoupon(orderId: string): Promise<void> {
  try {
    const row = await defaultPrisma.couponRedemption.findFirst({
      where: { orderId },
      select: { id: true, couponId: true },
    });
    if (!row) return;

    await defaultPrisma.$transaction([
      defaultPrisma.couponRedemption.delete({ where: { id: row.id } }),
      defaultPrisma.coupon.update({
        where: { id: row.couponId },
        data: { usedCount: { decrement: 1 } },
      }),
    ]);
  } catch (err) {
    console.error("[club] آزادسازی کد تخفیف ناموفق:", err);
  }
}

// ───────────────────────── صندوق فروشگاه — webhesab-parity.md بخش ۲۶ ─────────────────────────


/** پیام خطای کد تخفیف صندوق برای کد شکست */
export const couponMessage = (code: CouponFailure) => MESSAGES[code];

/**
 * کد تخفیف در صندوق. `userId` = کاربرِ وصل به مشتری رسید (null برای «مشتری حضوری» یا شخص بی‌حساب).
 * همان قاعده‌های سایت، به‌جز: «ارسال رایگان» معنا ندارد؛ کد باید «در صندوق» روشن باشد؛ کد با سقف
 * «هر کاربر» بی مشتری شناخته‌شده پذیرفته نمی‌شود (وگرنه سقف شکسته می‌شود).
 * `itemsTotal` = جمع سبد بعد از تخفیف‌های صندوقدار (مالیات‌دار، همان مبلغی که مشتری می‌دهد).
 */
export async function validatePosCoupon(db: Db, input: { code: string; userId: string | null; itemsTotal: bigint }): Promise<CouponResult> {
  const code = input.code.trim().toUpperCase().replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  if (!code) return posFail("NOT_FOUND");
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) return posFail("NOT_FOUND");
  if (!coupon.isActive) return posFail("INACTIVE");
  if (!coupon.posEnabled) return posFail("ONLINE_ONLY");
  if (coupon.type === "FREE_SHIP") return posFail("ONLINE_ONLY");
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return posFail("NOT_STARTED");
  if (coupon.expiresAt && coupon.expiresAt < now) return posFail("EXPIRED");
  if (coupon.userId && coupon.userId !== input.userId) return posFail(input.userId ? "NOT_YOURS" : "NEED_CUSTOMER");
  if (input.itemsTotal < coupon.minOrderTotal)
    return posFail("MIN_TOTAL", `مبلغ خرید برای این کد کافی نیست؛ حداقل ${coupon.minOrderTotal.toLocaleString("fa-IR")} تومان`);
  if (coupon.usageLimit > 0 && (await db.couponRedemption.count({ where: { couponId: coupon.id } })) >= coupon.usageLimit) return posFail("USAGE_LIMIT");
  if (coupon.perUserLimit > 0) {
    if (!input.userId) return posFail("NEED_CUSTOMER");
    if ((await db.couponRedemption.count({ where: { couponId: coupon.id, userId: input.userId } })) >= coupon.perUserLimit) return posFail("USER_LIMIT");
  }
  if (coupon.clubOnly || coupon.tierIds.length > 0) {
    const profile = input.userId ? await db.clubProfile.findUnique({ where: { userId: input.userId }, select: { tierId: true, isBlocked: true } }) : null;
    if (!profile || profile.isBlocked) return posFail("CLUB_ONLY");
    if (coupon.tierIds.length > 0 && (!profile.tierId || !coupon.tierIds.includes(profile.tierId))) return posFail("TIER_ONLY");
  }
  return { ok: true, coupon, discount: couponAmount(coupon, input.itemsTotal), freeShipping: false };
}

