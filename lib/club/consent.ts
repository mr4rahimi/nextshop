import { prisma } from "@/lib/prisma";
import type { ClubChannel, ConsentSource } from "@prisma/client";
import { normalizePhone } from "./phone";
import { grantPoints } from "./points";

/**
 * رضایت دریافت پیام — تنها مسیر تغییر
 *
 * پیش از این، رضایت از سه جای مختلف مستقیم روی `ClubProfile.smsConsent`
 * نوشته می‌شد و هیچ‌کدام سابقه‌ای نمی‌گذاشتند. سه ایراد داشت:
 *
 * ۱. اگر مشتری شکایت کند، سندی از «کِی و از کجا رضایت داد» نداریم.
 * ۲. `SmsOptOut` جداگانه ارسال را می‌بندد؛ روشن کردن `smsConsent` بدون پاک
 *    کردن آن یعنی رضایتی که هیچ اثری ندارد — دقیقاً همان چیزی که باعث شد
 *    روی مهام‌پرینت رضایت‌ها بی‌اثر بمانند.
 * ۳. با آمدن بله و تلگرام، رضایت دیگر تک‌کاناله نیست.
 *
 * ⚠️ هرگز throw نمی‌کند — مثل بقیه‌ی توابع باشگاه، ثبت سفارش نباید به‌خاطر
 *    رضایت بشکند.
 */

export interface SetConsentInput {
  /** یکی از این سه کافی است */
  profileId?: string;
  userId?: string;
  phone?: string;
  /** پیش‌فرض پیامک */
  channel?: ClubChannel;
  granted: boolean;
  source: ConsentSource;
  ip?: string | null;
  userAgent?: string | null;
  note?: string | null;
}

export interface SetConsentResult {
  ok: boolean;
  /** آیا وضعیت واقعاً عوض شد؟ تیک زدن دوباره‌ی همان تیک، تغییر نیست */
  changed: boolean;
  profileId: string | null;
  /** امتیاز تشویقی که همین حالا داده شد — ۰ یعنی نداد */
  pointsGranted: number;
}

const NO_OP: SetConsentResult = {
  ok: false,
  changed: false,
  profileId: null,
  pointsGranted: 0,
};

export async function setClubConsent(
  input: SetConsentInput
): Promise<SetConsentResult> {
  try {
    const channel: ClubChannel = input.channel ?? "SMS";
    const profile = await resolveProfile(input);
    if (!profile) return NO_OP;

    const changed =
      channel === "SMS"
        ? await applySmsConsent(profile.id, profile.phone, input.granted, input.ip ?? null)
        : await applyChannelConsent(profile.id, channel, input.granted);

    if (!changed) {
      return { ok: true, changed: false, profileId: profile.id, pointsGranted: 0 };
    }

    await prisma.clubConsentEvent.create({
      data: {
        profileId: profile.id,
        channel,
        granted: input.granted,
        source: input.source,
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        note: input.note ?? null,
      },
    });

    // امتیاز تشویقی فقط برای اولین رضایت روی هر کانال — `refType`+`refId`
    // جلوی تکرار را می‌گیرد، پس روشن/خاموش کردن پیاپی امتیاز نمی‌سازد.
    let pointsGranted = 0;
    if (input.granted) {
      pointsGranted = await grantPoints({
        profileId: profile.id,
        reason: "CONSENT",
        refType: "consent",
        refId: `${profile.id}:${channel}`,
        note: `رضایت ${channel} از ${input.source}`,
      });
    }

    return { ok: true, changed: true, profileId: profile.id, pointsGranted };
  } catch (err) {
    console.error("[club] ثبت رضایت ناموفق:", err);
    return NO_OP;
  }
}

/**
 * رضایت پیامک
 *
 * ⚠️ پاک کردن `SmsOptOut` بخش جدانشدنی این کار است. مشتری‌ای که قبلاً «لغو»
 *    فرستاده و حالا در تسویه‌حساب تیک زده، تا وقتی آن ردیف هست پیامی
 *    نمی‌گیرد و نگهبان بی‌صدا ردش می‌کند.
 */
async function applySmsConsent(
  profileId: string,
  phone: string | null,
  granted: boolean,
  ip: string | null
): Promise<boolean> {
  const current = await prisma.clubProfile.findUnique({
    where: { id: profileId },
    select: { smsConsent: true },
  });

  const hadOptOut = granted && phone
    ? (await prisma.smsOptOut.deleteMany({ where: { phone } })).count > 0
    : false;

  // اگر فقط لیست لغو پاک شده باشد، باز هم تغییر معنادار است
  if (current?.smsConsent === granted && !hadOptOut) return false;

  await prisma.clubProfile.update({
    where: { id: profileId },
    data: {
      smsConsent: granted,
      consentAt: granted ? new Date() : null,
      consentIp: granted ? ip : null,
    },
  });

  return true;
}

/**
 * رضایت کانال‌های پیام‌رسان
 *
 * ⚠️ لغو با `isActive: false` ثبت می‌شود نه با حذف رکورد — وگرنه تاریخچه گم
 *    می‌شود و کاربر با یک `/start` دوباره «عضو جدید» حساب می‌شود.
 *
 * ⚠️ شناسه‌ی **تازه‌ساخته‌شده** از همان اول فعال است، پس «تغییر وضعیت» رخ
 *    نمی‌دهد. بدون شرط دوم، اولین عضویت در ربات نه در دفتر ثبت می‌شد نه
 *    امتیاز تشویقی می‌گرفت — یعنی دقیقاً همان لحظه‌ای که رضایت داده شده،
 *    ثبت نمی‌شد.
 */
async function applyChannelConsent(
  profileId: string,
  channel: ClubChannel,
  granted: boolean
): Promise<boolean> {
  const identity = await prisma.clubChannelIdentity.findFirst({
    where: { profileId, channel },
    select: { id: true, isActive: true },
  });

  // بدون شناسه، رضایت در این کانال بی‌معناست
  if (!identity) return false;

  if (identity.isActive !== granted) {
    await prisma.clubChannelIdentity.update({
      where: { id: identity.id },
      data: { isActive: granted },
    });
    return true;
  }

  // وضعیت شناسه همان است — ولی ممکن است دفتر عقب باشد: شناسه‌ی تازه‌ساخته
  // از اول فعال است و هنوز هیچ رویدادی ندارد.
  const last = await prisma.clubConsentEvent.findFirst({
    where: { profileId, channel },
    orderBy: { createdAt: "desc" },
    select: { granted: true },
  });

  // ⚠️ آخرین رویداد را می‌سنجیم، نه «آیا هرگز رضایت داده» — کسی که لغو کرده
  //    و دوباره برگشته باید رویداد تازه بگیرد، وگرنه دفتر می‌گوید هنوز
  //    لغو است در حالی که دارد پیام می‌گیرد.
  return last === null ? granted : last.granted !== granted;
}

async function resolveProfile(
  input: SetConsentInput
): Promise<{ id: string; phone: string | null } | null> {
  if (input.profileId) {
    const p = await prisma.clubProfile.findUnique({
      where: { id: input.profileId },
      select: { id: true, user: { select: { phone: true } } },
    });
    return p ? { id: p.id, phone: p.user?.phone ?? null } : null;
  }

  if (input.userId) {
    const p = await prisma.clubProfile.findUnique({
      where: { userId: input.userId },
      select: { id: true, user: { select: { phone: true } } },
    });
    return p ? { id: p.id, phone: p.user?.phone ?? null } : null;
  }

  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (!phone) return null;

  const p = await prisma.clubProfile.findFirst({
    where: { user: { phone } },
    select: { id: true },
  });
  return p ? { id: p.id, phone } : null;
}

// ─── آمار ──────────────────────────────────────────────────────────

export interface ConsentStats {
  total: number;
  smsConsent: number;
  /** درصد گرد شده */
  smsRate: number;
  /** رضایت‌های ۳۰ روز گذشته، به تفکیک منبع */
  recentBySource: Record<string, number>;
  /** اعضایی که شناسه‌ی فعال پیام‌رسان دارند */
  messengerReachable: number;
}

/**
 * نرخ رضایت — برای فهرست اعضا
 *
 * ⚠️ «قابل دسترس» فقط رضایت پیامک نیست: عضوی که در بله عضو ربات است بدون
 *    رضایت پیامک هم پیام می‌گیرد. نمایش تنها یک عدد، تصویر غلط می‌دهد.
 */
export async function getConsentStats(): Promise<ConsentStats> {
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [total, smsConsent, recent, messenger] = await Promise.all([
    prisma.clubProfile.count(),
    prisma.clubProfile.count({ where: { smsConsent: true } }),
    prisma.clubConsentEvent.groupBy({
      by: ["source"],
      where: { granted: true, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.clubProfile.count({
      where: { identities: { some: { isActive: true, channel: { not: "SMS" } } } },
    }),
  ]);

  return {
    total,
    smsConsent,
    smsRate: total > 0 ? Math.round((smsConsent / total) * 100) : 0,
    recentBySource: Object.fromEntries(
      recent.map((r) => [r.source, r._count._all])
    ),
    messengerReachable: messenger,
  };
}
