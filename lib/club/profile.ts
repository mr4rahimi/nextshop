import { prisma } from "@/lib/prisma";
import { normalizePhone } from "./phone";
import { toJalali } from "./jalali";
import type { ClubSource, ConsentSource, Prisma } from "@prisma/client";
import { recordTouchpoint } from "./touchpoints";
import { grantPoints } from "./points";
import { setClubConsent } from "./consent";

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
  /** false = بی امتیاز عضویت (ورود انبوه از نرم‌افزار قبلی؛ امتیاز اینجا اعتبار پولی است) */
  welcome?: boolean;
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
  const source = opts.source ?? "ONLINE";

  const profile = await prisma.clubProfile.create({
    data: {
      userId,
      source,
      sourcePlatform: opts.sourcePlatform ?? null,
      registeredById: opts.registeredById ?? null,
      gender: opts.gender ?? null,
      birthDate: opts.birthDate ?? null,
      ...birth,
      // ⚠️ رضایت اینجا نوشته نمی‌شود؛ چند سطر پایین‌تر از مسیر واحد
      // `setClubConsent()` می‌آید تا سابقه و امتیاز تشویقی هم ثبت شود.
      // اولین منبع همین‌جا قطعی می‌شود — پروفایل تازه است، پس تماس دیگری نبوده
      firstSource: source,
      firstPlatform: opts.sourcePlatform ?? null,
      firstSeenAt: new Date(),
    },
  });

  await recordTouchpoint({
    profileId: profile.id,
    source,
    platform: opts.sourcePlatform ?? null,
  });

  if (opts.smsConsent) {
    await setClubConsent({
      profileId: profile.id,
      granted: true,
      source: consentSourceFor(source),
      ip: opts.consentIp ?? null,
    });
  }

  // امتیاز خوش‌آمد — مقدارش از تنظیمات می‌آید؛ ۰ یعنی این قابلیت خاموش است
  if (opts.welcome !== false) {
    await grantPoints({
      profileId: profile.id,
      reason: "SIGNUP",
      refType: "profile",
      refId: profile.id,
    });
  }

  return profile;
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
  /** false = بی امتیاز عضویت (ورود از نرم‌افزار قبلی) */
  welcome?: boolean;
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
      welcome: input.welcome,
    });

    // اگر پروفایل از قبل بود ولی رضایت پیامک تازه داده شده، ثبتش کن
    if (existingUser.clubProfile && input.smsConsent) {
      await setClubConsent({
        userId: existingUser.id,
        granted: true,
        source: consentSourceFor(input.source),
        ip: input.consentIp ?? null,
      });
    }

    // پروفایل تازه، نقطه‌ی تماسش را در ensureClubProfile گرفته. اینجا فقط
    // برخورد *مجدد* با عضو موجود ثبت می‌شود — همان چیزی که گزارش مسیر مشتری
    // (باسلام ← سایت ← تلگرام) به آن نیاز دارد.
    if (existingUser.clubProfile) {
      await recordTouchpoint({
        profileId: profile.id,
        source: input.source,
        platform: input.sourcePlatform ?? null,
      });
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
          firstSource: input.source,
          firstPlatform: input.sourcePlatform ?? null,
          firstSeenAt: new Date(),
          registeredById: input.registeredById ?? null,
          gender: input.gender ?? null,
          birthDate: input.birthDate ?? null,
          ...birth,
          // رضایت پس از ساخت، از مسیر واحد ثبت می‌شود
        },
      },
    },
    select: { id: true, firstName: true, lastName: true, clubProfile: { select: { id: true } } },
  });

  await recordTouchpoint({
    profileId: user.clubProfile!.id,
    source: input.source,
    platform: input.sourcePlatform ?? null,
  });

  // ⚠️ امتیاز عضویت اینجا هم لازم است. پروفایل در همان `user.create` تودرتو
  //    ساخته می‌شود، پس `ensureClubProfile()` — که تنها جای دیگر این امتیاز
  //    است — اصلاً صدا زده نمی‌شود. بدون این، هر عضوی که از ثبت فروشنده،
  //    ورود فایل، مارکت‌پلیس یا صفحه‌ی QR بیاید امتیاز عضویتش را نمی‌گیرد.
  if (input.welcome !== false) {
    await grantPoints({
      profileId: user.clubProfile!.id,
      reason: "SIGNUP",
      refType: "profile",
      refId: user.clubProfile!.id,
    });
  }

  if (input.smsConsent) {
    await setClubConsent({
      profileId: user.clubProfile!.id,
      granted: true,
      source: consentSourceFor(input.source),
      ip: input.consentIp ?? null,
    });
  }

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

/**
 * ثبت رضایت یا لغو رضایت دریافت پیامک تبلیغاتی
 *
 * ⚠️ پوسته‌ای روی `setClubConsent()` است و عمداً خودش چیزی نمی‌نویسد: تنها
 *    آنجاست که سابقه در `ClubConsentEvent` ثبت می‌شود، `SmsOptOut` پاک
 *    می‌شود و امتیاز تشویقی داده می‌شود.
 */
export async function setSmsConsent(
  userId: string,
  consent: boolean,
  ip: string | null = null,
  source: ConsentSource = "ADMIN"
) {
  return setClubConsent({ userId, granted: consent, source, ip });
}

/**
 * بازمحاسبه آمار خرید: سفارش‌های سایت + رسیدهای صندوق (شخص وصل به همین کاربر) + سابقه‌ی
 * نرم‌افزار قبلی (`LegacyCustomer`). فرمول یک‌جا در `recomputePurchaseStatsMany` است.
 */
export async function recomputePurchaseStats(userId: string) {
  await recomputePurchaseStatsMany([userId]);
  return prisma.clubProfile.findUnique({ where: { userId } });
}

/** همان بازمحاسبه برای چند کاربر با یک کوئری (ورود انبوه، صندوق) */
export async function recomputePurchaseStatsMany(userIds: string[], db: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!userIds.length) return 0;
  return db.$executeRaw`
    WITH u AS (SELECT unnest(${userIds}::text[]) AS "userId"),
    o AS (
      SELECT o."userId", SUM(o."grandTotal") AS s, COUNT(*)::int AS n, MAX(o."createdAt") AS last
      FROM "Order" o JOIN u ON u."userId" = o."userId"
      WHERE o.status::text IN ('PAID','CONFIRMED','PROCESSING','PACKAGING','SHIPPED','DELIVERED','COMPLETED')
      GROUP BY o."userId"
    ),
    t AS (
      SELECT pa."userId", SUM(t."saleTotal" - t."returnTotal") AS s,
             COUNT(*) FILTER (WHERE t."saleTotal" > 0)::int AS n,
             MAX(t."createdAt") FILTER (WHERE t."saleTotal" > 0) AS last
      FROM "AccPosTicket" t JOIN "AccParty" pa ON pa.id = t."partyId" JOIN u ON u."userId" = pa."userId"
      GROUP BY pa."userId"
    ),
    l AS (
      SELECT l."userId", SUM(l.spent) AS s, SUM(l."invoiceCount")::int AS n, MAX(l."lastPurchaseAt") AS last
      FROM "LegacyCustomer" l JOIN u ON u."userId" = l."userId"
      GROUP BY l."userId"
    )
    UPDATE "ClubProfile" p SET
      "totalSpent" = GREATEST(0, COALESCE(o.s, 0) + COALESCE(t.s, 0) + COALESCE(l.s, 0)),
      "orderCount" = COALESCE(o.n, 0) + COALESCE(t.n, 0) + COALESCE(l.n, 0),
      "lastPurchaseAt" = GREATEST(o.last, t.last, l.last)
    FROM u
    LEFT JOIN o ON o."userId" = u."userId"
    LEFT JOIN t ON t."userId" = u."userId"
    LEFT JOIN l ON l."userId" = u."userId"
    WHERE p."userId" = u."userId"
  `;
}

/** موجودی امتیاز از روی دفتر کل — هرگز از فیلد کش‌شده استفاده نکنید */
export async function getPointsBalance(profileId: string): Promise<number> {
  // بازپخش دفتر — با «انقضا روشن» شارژ تاریخ‌گذشته حساب نمی‌شود (webhesab-parity.md بخش ۲۳)
  const { ledgerState } = await import("./credit");
  return (await ledgerState(prisma, profileId)).balance;
}

// ─── کمکی‌ها ────────────────────────────────────────────────────

/**
 * منبع جذب (`ClubSource`) → منبع رضایت (`ConsentSource`)
 *
 * ⚠️ این دو enum عمداً جدا هستند (بخش ۰.۱ سند باشگاه). این تابع فقط برای
 *    مسیرهایی است که رضایت را همراه ثبت‌نام می‌گیرند؛ جای دیگری نباید یکی
 *    فرض شوند.
 */
function consentSourceFor(source: ClubSource): ConsentSource {
  switch (source) {
    case "IN_STORE":
      return "SELLER";
    case "IMPORT":
      return "IMPORT";
    case "MESSAGING":
      return "MESSENGER";
    default:
      return "LANDING";
  }
}

function jalaliFields(date: Date) {
  const { month, day } = toJalali(date);
  return { birthMonth: month, birthDay: day };
}

function joinName(first?: string | null, last?: string | null): string | null {
  const n = [first, last].filter(Boolean).join(" ").trim();
  return n || null;
}