import { prisma } from "@/lib/prisma";
import type { ClubChannel } from "@prisma/client";
import type { MessageChannel } from "./types";
import { smsChannel } from "./sms";
import { baleChannel, isSafirActive } from "./bale";

/**
 * رجیستری کانال‌ها
 *
 * افزودن کانال جدید = یک فایل در این پوشه + یک سطر اینجا. هیچ‌جای دیگری
 * (موتور کمپین، اتوماسیون، ادمین) نباید نام کانال را بشناسد.
 */
const CHANNELS: Record<string, MessageChannel> = {
  SMS: smsChannel,
  BALE: baleChannel,
  // TELEGRAM: telegramChannel,   ← وقتی رله‌ی خارج از فیلتر آماده شود
};

export function getChannel(channel: ClubChannel): MessageChannel | null {
  return CHANNELS[channel] ?? null;
}

export function allChannels(): MessageChannel[] {
  return Object.values(CHANNELS);
}

/** ترتیب پیش‌فرض وقتی ادمین چیزی تنظیم نکرده */
const DEFAULT_PRIORITY: ClubChannel[] = ["SMS"];

/**
 * ترتیب اولویت کانال‌ها از تنظیمات فروشگاه
 *
 * ⚠️ همیشه اعتبارسنجی می‌شود: مقدار ناشناخته در JSON (مثلاً کانالی که بعداً
 *    حذف شده) نباید موتور ارسال را بشکند.
 */
export async function getChannelPriority(): Promise<ClubChannel[]> {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { channelPriority: true },
  });

  const raw = Array.isArray(s?.channelPriority) ? s.channelPriority : [];
  const valid = raw
    .map((v) => String(v))
    .filter((v): v is ClubChannel => v in CHANNELS);

  // پیامک همیشه آخرین پناهگاه است، حتی اگر ادمین از فهرست حذفش کند
  if (!valid.includes("SMS")) valid.push("SMS");

  return valid.length > 0 ? valid : DEFAULT_PRIORITY;
}

/**
 * انتخاب کانال برای هر گیرنده
 *
 * برای هر عضو، اولین کانالِ در دسترس از فهرست اولویت که شناسه‌ی فعال دارد.
 * پیامک همیشه با شماره‌ی موبایل کار می‌کند، پس عملاً همیشه پناهگاه نهایی است.
 *
 * ⚠️ در یک کوئری برای همه‌ی اعضا انجام می‌شود، نه یک کوئری به‌ازای هر نفر —
 *    کمپین ۱۰ هزار نفره وگرنه ۱۰ هزار رفت‌وبرگشت به دیتابیس می‌زند.
 */
export interface ResolvedTarget {
  profileId: string;
  userId: string | null;
  phone: string;
  channel: ClubChannel;
  destination: string;
}

export async function resolveTargets(
  profileIds: string[],
  priority?: ClubChannel[],
  /** کانال‌هایی که برای این اجرا کنار گذاشته شده‌اند (خطای دائمی در پاس قبل) */
  excludeByProfile?: Map<string, Set<ClubChannel>>
): Promise<ResolvedTarget[]> {
  if (profileIds.length === 0) return [];

  const order = priority ?? (await getChannelPriority());

  // ⚠️ با فعال بودن سفیر، «قابل دسترس در بله» یعنی هر عضوی که شماره دارد —
  //    نه فقط کسی که `/start` زده. بدون این، سفیر عملاً بی‌استفاده می‌ماند
  //    چون هیچ‌کس بدون شناسه‌ی ربات به کانال بله نمی‌رسد.
  const safir = order.includes("BALE") ? await isSafirActive() : false;

  const profiles = await prisma.clubProfile.findMany({
    // ⚠️ عضو مسدود اینجا کنار می‌رود، نه پایین‌تر. نگهبان‌های `guards.ts`
    //    فقط روی مسیر پیامک‌اند؛ کانال‌های پیام‌رسان از آن‌ها رد نمی‌شوند و
    //    بدون این شرط، عضوی که ادمین مسدودش کرده از بله پیام می‌گیرد.
    where: { id: { in: profileIds }, isBlocked: false },
    select: {
      id: true,
      userId: true,
      user: { select: { phone: true } },
      identities: {
        where: { isActive: true },
        select: { channel: true, externalId: true },
      },
    },
  });

  const out: ResolvedTarget[] = [];

  for (const p of profiles) {
    const byChannel = new Map(p.identities.map((i) => [i.channel, i.externalId]));
    const excluded = excludeByProfile?.get(p.id);

    for (const channel of order) {
      if (excluded?.has(channel)) continue;

      // پیامک شناسه‌ی جدا نمی‌خواهد — شماره‌ی موبایل کاربر کافی است
      let destination =
        channel === "SMS" ? p.user?.phone ?? "" : byChannel.get(channel) ?? "";

      // بله با سفیر: نبودِ شناسه‌ی ربات مانع نیست، شماره کافی است.
      // ⚠️ عمداً بعد از تلاش برای شناسه — ارسال از ربات رایگان است و سفیر
      //    هزینه دارد؛ هرکس `/start` زده باید از مسیر رایگان پیام بگیرد.
      if (!destination && channel === "BALE" && safir) {
        destination = p.user?.phone ?? "";
      }

      if (!destination) continue;

      out.push({
        profileId: p.id,
        userId: p.userId,
        phone: p.user?.phone ?? "",
        channel,
        destination,
      });
      break;
    }
  }

  return out;
}
