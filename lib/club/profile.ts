import { prisma } from "@/lib/prisma";
import { normalizePhone } from "./phone";
import { toJalali } from "./jalali";
import type { ClubSource, Prisma } from "@prisma/client";

/**
 * سرویس پروفایل باشگاه مشتریان
 *
 * اصل طراحی: `User` تنها هویت است. `ClubProfile` یک رکورد یک‌به‌یک است که
 * اطلاعات باشگاه را نگه می‌دارد. چون `User.phone` یکتاست، هیچ‌گاه رکورد
 * تکراری یا نیاز به ادغام به‌وجود نمی‌آید.
 *
 * همه توابع این فایل **idempotent** هستند — فراخوانی چندباره امن است.
 */

export interface EnsureProfileOptions {
  source?: ClubSource;
  sourcePlatform?: string | null;
  registeredById?: string | null;
  smsConsent?: boolean;
  consentIp?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
}

/**
 * اطمینان از وجود پروفایل باشگاه برای یک کاربر موجود.
 * اگر پروفایل باشد، دست‌نخورده برمی‌گردد (منبع اولیه بازنویسی نمی‌شود).
 */
export async function ensureClubProfile(
  userId: string,
  opts: EnsureProfileOptions = {}
) {
  const existing = await prisma.clubProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  const birth = opts.birthDate ? jalaliFields(opts.birthDate) : {};

  return prisma.clubProfile.create({
    data: {
      userId,
      source: opts.source ?? "ONLINE",
      sourcePlatform: opts.sourcePlatform ?? null,
      registeredById: opts.registeredById ?? null,
      gender: opts.gender ?? null,
      birthDate: opts.birthDate ?? null,
      ...birth,
      smsConsent: opts.smsConsent ?? false,
      consentAt: opts.smsConsent ? new Date() : null,
      consentIp: opts.smsConsent ? opts.consentIp ?? null : null,
    },
  });
}

export interface UpsertCustomerInput {
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  source: ClubSource;
  sourcePlatform?: string | null;
  registeredById?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
  smsConsent?: boolean;
  consentIp?: string | null;
}

export interface UpsertCustomerResult {
  userId: string;
  profileId: string;
  /** آیا کاربر همین الان ساخته شد؟ */
  isNewUser: boolean;
  /** آیا پروفایل باشگاه همین الان ساخته شد؟ */
  isNewProfile: boolean;
  phone: string;
  fullName: string | null;
}

/**
 * ثبت یا بازیابی مشتری بر اساس شماره موبایل.
 *
 * کاربرد: صفحه ثبت فروشنده، ورود سفارش مارکت‌پلیس، ورود از فایل، شماره‌گیر.
 * اگر کاربر وجود نداشته باشد ساخته می‌شود (بدون رمز عبور — بعداً خودش
 * می‌تواند با OTP وارد شود و همین سابقه را ببیند).
 */
export async function upsertClubCustomer(
  input: UpsertCustomerInput
): Promise<UpsertCustomerResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("INVALID_PHONE");

  const existingUser = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, firstName: true, lastName: true, clubProfile: { select: { id: true } } },
  });

  // ── کاربر موجود ────────────────────────────────────────────────
  if (existingUser) {
    // نام را فقط وقتی پر می‌کنیم که خالی باشد — داده موجود بازنویسی نشود
    const nameUpdate: Prisma.UserUpdateInput = {};
    if (!existingUser.firstName && input.firstName) nameUpdate.firstName = input.firstName;
    if (!existingUser.lastName && input.lastName) nameUpdate.lastName = input.lastName;

    if (Object.keys(nameUpdate).length > 0) {
      await prisma.user.update({ where: { id: existingUser.id }, data: nameUpdate });
    }

    const profile = await ensureClubProfile(existingUser.id, {
      source: input.source,
      sourcePlatform: input.sourcePlatform,
      registeredById: input.registeredById,
      birthDate: input.birthDate,
      gender: input.gender,
      smsConsent: input.smsConsent,
      consentIp: input.consentIp,
    });

    // اگر پروفایل از قبل بود ولی رضایت پیامک تازه داده شده، ثبتش کن
    if (existingUser.clubProfile && input.smsConsent) {
      await setSmsConsent(existingUser.id, true, input.consentIp ?? null);
    }

    return {
      userId: existingUser.id,
      profileId: profile.id,
      isNewUser: false,
      isNewProfile: !existingUser.clubProfile,
      phone,
      fullName: joinName(
        nameUpdate.firstName as string ?? existingUser.firstName,
        nameUpdate.lastName as string ?? existingUser.lastName
      ),
    };
  }

  // ── کاربر جدید ─────────────────────────────────────────────────
  const birth = input.birthDate ? jalaliFields(input.birthDate) : {};

  const user = await prisma.user.create({
    data: {
      phone,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      role: "CUSTOMER",
      // بدون رمز عبور — ورود بعدی با OTP انجام می‌شود
      passwordHash: null,
      clubProfile: {
        create: {
          source: input.source,
          sourcePlatform: input.sourcePlatform ?? null,
          registeredById: input.registeredById ?? null,
          gender: input.gender ?? null,
          birthDate: input.birthDate ?? null,
          ...birth,
          smsConsent: input.smsConsent ?? false,
          consentAt: input.smsConsent ? new Date() : null,
          consentIp: input.smsConsent ? input.consentIp ?? null : null,
        },
      },
    },
    select: { id: true, firstName: true, lastName: true, clubProfile: { select: { id: true } } },
  });

  return {
    userId: user.id,
    profileId: user.clubProfile!.id,
    isNewUser: true,
    isNewProfile: true,
    phone,
    fullName: joinName(user.firstName, user.lastName),
  };
}

/** ثبت یا تغییر تاریخ تولد به همراه فیلدهای شمسی */
export async function setBirthDate(userId: string, birthDate: Date | null) {
  const fields = birthDate ? jalaliFields(birthDate) : { birthMonth: null, birthDay: null };

  return prisma.clubProfile.update({
    where: { userId },
    data: { birthDate, ...fields },
  });
}

/** ثبت رضایت یا لغو رضایت دریافت پیامک تبلیغاتی */
export async function setSmsConsent(
  userId: string,
  consent: boolean,
  ip: string | null = null
) {
  return prisma.clubProfile.update({
    where: { userId },
    data: {
      smsConsent: consent,
      consentAt: consent ? new Date() : null,
      consentIp: consent ? ip : null,
    },
  });
}

/**
 * بازمحاسبه آمار خرید از روی سفارش‌های واقعی.
 * فعلاً فقط سفارش‌های سایت؛ خرید حضوری در فاز ۴ اضافه می‌شود.
 */
export async function recomputePurchaseStats(userId: string) {
  const agg = await prisma.order.aggregate({
    where: {
      userId,
      status: { in: ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED", "DELIVERED", "COMPLETED"] },
    },
    _sum: { grandTotal: true },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  return prisma.clubProfile.update({
    where: { userId },
    data: {
      totalSpent: agg._sum.grandTotal ?? 0n,
      orderCount: agg._count._all,
      lastPurchaseAt: agg._max.createdAt ?? null,
    },
  });
}

/** موجودی امتیاز از روی دفتر کل — هرگز از فیلد کش‌شده استفاده نکنید */
export async function getPointsBalance(profileId: string): Promise<number> {
  const agg = await prisma.pointTransaction.aggregate({
    where: { profileId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

// ─── کمکی‌ها ────────────────────────────────────────────────────

function jalaliFields(date: Date) {
  const { month, day } = toJalali(date);
  return { birthMonth: month, birthDay: day };
}

function joinName(first?: string | null, last?: string | null): string | null {
  const n = [first, last].filter(Boolean).join(" ").trim();
  return n || null;
}