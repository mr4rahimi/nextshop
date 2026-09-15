/**
 * مانده و تسویه‌ی پورسانت — بخش ۲۲.۷ مستندات کارتابل.
 *
 * ⚠️ «دوره‌ی باز» ذخیره نمی‌شود. مانده همیشه از روی خودِ معامله‌ها حساب می‌شود:
 *
 *   قابل پرداخت = پورسانت معامله‌های CONFIRMED بدون payoutId
 *              − پورسانت معامله‌های تسویه‌شده‌ای که بعداً VOID شدند (کسری)
 *              + باقی‌مانده‌ی آخرین تسویه (پرداخت جزئی)
 *
 * «محاسبه» هیچ‌چیز نمی‌نویسد. «پرداخت شد» تنها نوشتن است و در یک تراکنش:
 * ساخت `StaffPayout` + چسباندن `payoutId` و `adjustedPayoutId`. اگر بین
 * محاسبه و پرداخت معامله‌ای عوض شده باشد، پرداخت رد می‌شود تا مدیر عدد تازه را ببیند.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { StaffAccess } from "@/lib/permissions";

export interface Statement {
  userId: string;
  userName: string;
  planTitle: string | null;
  dealIds: string[];
  adjustmentIds: string[];
  dealCount: number;
  totalProfit: bigint;
  grossCommission: bigint;
  adjustment: bigint;
  carriedIn: bigint;
  due: bigint;
  /** معامله‌هایی که قیمت خریدشان ثبت نشده و در این عدد نیستند */
  pendingCount: number;
  fromAt: Date;
  lastPaidAt: Date | null;
}

type Db = Prisma.TransactionClient | typeof prisma;

export async function computeStatement(userId: string, db: Db = prisma): Promise<Statement> {
  const [user, open, adjustments, last, pendingCount] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, lastName: true, phone: true, commissionPlan: { select: { title: true } } },
    }),
    db.staffDeal.findMany({
      where: { ownerId: userId, status: "CONFIRMED", payoutId: null },
      select: { id: true, profit: true, commission: true },
    }),
    db.staffDeal.findMany({
      where: { ownerId: userId, status: "VOID", payoutId: { not: null }, adjustedPayoutId: null, commission: { gt: 0 } },
      select: { id: true, commission: true },
    }),
    db.staffPayout.findFirst({ where: { userId }, orderBy: { paidAt: "desc" }, select: { remaining: true, paidAt: true } }),
    db.staffDeal.count({ where: { ownerId: userId, status: "PENDING" } }),
  ]);

  const totalProfit = open.reduce((s, d) => s + (d.profit ?? 0n), 0n);
  const grossCommission = open.reduce((s, d) => s + (d.commission ?? 0n), 0n);
  const adjustment = -adjustments.reduce((s, d) => s + (d.commission ?? 0n), 0n);
  const carriedIn = last?.remaining ?? 0n;

  return {
    userId,
    userName: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.phone,
    planTitle: user.commissionPlan?.title ?? null,
    dealIds: open.map((d) => d.id),
    adjustmentIds: adjustments.map((d) => d.id),
    dealCount: open.length,
    totalProfit,
    grossCommission,
    adjustment,
    carriedIn,
    due: grossCommission + adjustment + carriedIn,
    pendingCount,
    fromAt: last?.paidAt ?? new Date(0),
    lastPaidAt: last?.paidAt ?? null,
  };
}

export function statementJson(s: Statement) {
  return {
    userId: s.userId,
    userName: s.userName,
    planTitle: s.planTitle,
    dealCount: s.dealCount,
    adjustmentCount: s.adjustmentIds.length,
    totalProfit: String(s.totalProfit),
    grossCommission: String(s.grossCommission),
    adjustment: String(s.adjustment),
    carriedIn: String(s.carriedIn),
    due: String(s.due),
    pendingCount: s.pendingCount,
    lastPaidAt: s.lastPaidAt?.toISOString() ?? null,
    /** درصد مؤثر فقط برای نمایش — مبنای محاسبه نیست */
    percent: s.totalProfit > 0n ? Number((s.grossCommission * 10_000n) / s.totalProfit) / 100 : 0,
  };
}

/**
 * ثبت پرداخت. `amount` می‌تواند کمتر از قابل پرداخت باشد (پرداخت جزئی)؛
 * باقی در `remaining` می‌ماند و در تسویه‌ی بعدی به‌عنوان `carriedIn` برمی‌گردد.
 *
 * `expectedDue` همان عددی است که مدیر روی صفحه دید؛ اگر عوض شده باشد رد می‌شود.
 */
export async function recordPayout(
  input: { userId: string; amount: bigint; expectedDue: bigint; note?: string | null },
  access: StaffAccess,
) {
  return prisma.$transaction(
    async (tx) => {
      const s = await computeStatement(input.userId, tx);

      if (s.due !== input.expectedDue) {
        throw new Error("از زمان محاسبه معامله‌ای تغییر کرده است. دوباره محاسبه کنید.");
      }
      if (s.dealCount === 0 && s.adjustmentIds.length === 0 && s.carriedIn === 0n) {
        throw new Error("چیزی برای تسویه نیست");
      }
      if (input.amount < 0n) throw new Error("مبلغ پرداخت نمی‌تواند منفی باشد");
      if (input.amount > (s.due > 0n ? s.due : 0n)) {
        throw new Error("مبلغ پرداخت از قابل پرداخت بیشتر است");
      }

      const now = new Date();
      const payout = await tx.staffPayout.create({
        data: {
          userId: s.userId,
          userName: s.userName,
          fromAt: s.fromAt,
          toAt: now,
          dealCount: s.dealCount,
          totalProfit: s.totalProfit,
          grossCommission: s.grossCommission,
          percent: s.totalProfit > 0n ? Number((s.grossCommission * 10_000n) / s.totalProfit) / 100 : 0,
          planTitle: s.planTitle,
          adjustment: s.adjustment,
          carriedIn: s.carriedIn,
          due: s.due,
          amount: input.amount,
          remaining: s.due - input.amount,
          paidAt: now,
          paidById: access.userId,
          paidByName: access.name,
          note: input.note?.trim().slice(0, 500) || null,
        },
      });

      // شرط payoutId: null داخل همان نوشتن — اگر هم‌زمان پرداخت دیگری ثبت شد، شمارش نمی‌خواند
      const attached = await tx.staffDeal.updateMany({
        where: { id: { in: s.dealIds }, payoutId: null, status: "CONFIRMED" },
        data: { payoutId: payout.id },
      });
      const adjusted = await tx.staffDeal.updateMany({
        where: { id: { in: s.adjustmentIds }, adjustedPayoutId: null },
        data: { adjustedPayoutId: payout.id },
      });
      if (attached.count !== s.dealIds.length || adjusted.count !== s.adjustmentIds.length) {
        throw new Error("هم‌زمان تسویه‌ی دیگری ثبت شد. دوباره محاسبه کنید.");
      }

      return payout;
    },
    { isolationLevel: "Serializable" },
  );
}

/** کارکنانی که پورسانت دارند یا داشته‌اند — ردیف‌های جدول مدیر */
export async function commissionStaff(): Promise<string[]> {
  const [withPlan, withDeals] = await Promise.all([
    prisma.user.findMany({ where: { commissionPlanId: { not: null }, isActive: true }, select: { id: true } }),
    prisma.staffDeal.findMany({ where: { ownerId: { not: null } }, distinct: ["ownerId"], select: { ownerId: true } }),
  ]);
  return Array.from(new Set([...withPlan.map((u) => u.id), ...withDeals.map((d) => d.ownerId!)]));
}
