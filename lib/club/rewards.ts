import { prisma } from "@/lib/prisma";
import { recomputePurchaseStats, getPointsBalance } from "./profile";
import { loadPointRules, expiryDate } from "./points";
import { rewardReferralOnFirstPurchase } from "./referral";

/**
 * موتور پاداش باشگاه — امتیاز و سطح
 *
 * این ماژول همان چیزی است که تا امروز نبود: `ClubTier` و `PointTransaction`
 * در schema بودند و پنل مشتری نشانشان می‌داد، ولی هیچ کدی آن‌ها را از روی خرید
 * واقعی پر نمی‌کرد. نتیجه‌اش این بود که همه‌ی اعضا امتیاز صفر و بدون سطح بودند
 * و بخش‌بندی بر اساس مبلغ خرید روی صفر فیلتر می‌کرد.
 *
 * ⚠️ هیچ‌کدام از توابع اینجا throw نمی‌کنند. ثبت سفارش و تغییر وضعیت آن هرگز
 *    نباید به‌خاطر باشگاه مشتریان شکست بخورد.
 */

/** وضعیت‌هایی که «خرید محقق‌شده» حساب می‌شوند */
export const EARNING_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "PACKAGING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
] as const;

export interface RewardResult {
  pointsAwarded: number;
  tierChanged: boolean;
  newTierTitle: string | null;
}

/**
 * پردازش کامل یک سفارش برای باشگاه
 *
 * بازمحاسبه‌ی آمار خرید → اعطای امتیاز → تعیین سطح.
 * چندبار صدا زدن برای یک سفارش بی‌خطر است (امتیاز تکراری داده نمی‌شود).
 */
export async function processOrderForClub(orderId: string): Promise<RewardResult | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, grandTotal: true, status: true },
    });

    if (!order?.userId) return null;
    if (!(EARNING_STATUSES as readonly string[]).includes(order.status)) return null;

    const profile = await prisma.clubProfile.findUnique({
      where: { userId: order.userId },
      select: { id: true, tierId: true },
    });
    if (!profile) return null;

    await recomputePurchaseStats(order.userId);

    const pointsAwarded = await awardPurchasePoints(profile.id, order.id, order.grandTotal);
    const tier = await assignTier(profile.id);

    // پاداش معرفی فقط با اولین خرید — نه با عضویت، وگرنه ساختن حساب جعلی صرف می‌کند
    await rewardReferralOnFirstPurchase(profile.id);

    return {
      pointsAwarded,
      tierChanged: tier.changed,
      newTierTitle: tier.title,
    };
  } catch (err) {
    console.error("[club] پردازش سفارش برای باشگاه ناموفق:", err);
    return null;
  }
}

/**
 * اعطای امتیاز خرید
 *
 * ⚠️ کلید بی‌خطر بودن تکرار: پیش از ثبت، وجود تراکنش با همان
 *    (profileId, refType="order", refId) بررسی می‌شود. بدون این، هر بار که
 *    ادمین وضعیت سفارش را عوض کند دوباره امتیاز داده می‌شود.
 */
export async function awardPurchasePoints(
  profileId: string,
  orderId: string,
  grandTotal: bigint
): Promise<number> {
  const already = await prisma.pointTransaction.findFirst({
    where: { profileId, refType: "order", refId: orderId, reason: "PURCHASE" },
    select: { id: true },
  });
  if (already) return 0;

  const rules = await loadPointRules();
  if (rules.perToman <= 0) return 0;

  // ضریب سطح — مثلاً سطح طلایی ۱.۵ برابر امتیاز می‌گیرد
  const profile = await prisma.clubProfile.findUnique({
    where: { id: profileId },
    select: { tier: { select: { pointRate: true } } },
  });
  const multiplier = profile?.tier?.pointRate ?? 1;

  const amount = Math.floor(Number(grandTotal) * rules.perToman * multiplier);
  if (amount <= 0) return 0;

  await prisma.pointTransaction.create({
    data: {
      profileId,
      amount,
      reason: "PURCHASE",
      refType: "order",
      refId: orderId,
      expiresAt: expiryDate(rules),
    },
  });

  return amount;
}

/**
 * تعیین سطح بر اساس مجموع خرید
 *
 * بالاترین سطحی که `minSpent` آن از مجموع خرید عضو بیشتر نباشد.
 * سطح هرگز خودکار پایین نمی‌آید مگر اینکه ادمین سطوح را عوض کند — تنزل
 * خودکار برای مشتری تجربه‌ی بدی است و در فاز بعد با قانون صریح اضافه می‌شود.
 */
export async function assignTier(
  profileId: string
): Promise<{ changed: boolean; title: string | null }> {
  const profile = await prisma.clubProfile.findUnique({
    where: { id: profileId },
    select: { totalSpent: true, tierId: true },
  });
  if (!profile) return { changed: false, title: null };

  const tier = await prisma.clubTier.findFirst({
    where: { isActive: true, minSpent: { lte: profile.totalSpent } },
    orderBy: { minSpent: "desc" },
    select: { id: true, title: true },
  });

  if (!tier || tier.id === profile.tierId) {
    return { changed: false, title: tier?.title ?? null };
  }

  await prisma.clubProfile.update({
    where: { id: profileId },
    data: { tierId: tier.id },
  });

  return { changed: true, title: tier.title };
}

export { getPointsBalance };
export { recordTouchpoint } from "./touchpoints";
export { loadPointRules, grantPoints, quoteRedeem } from "./points";
