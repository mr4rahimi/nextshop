import { prisma } from "@/lib/prisma";
import type { ClubChannel, SmsKind } from "@prisma/client";
import { getChannel, resolveTargets, getChannelPriority } from "./registry";
import type { ChannelSendResult } from "./types";

export * from "./types";
export { getChannel, allChannels, getChannelPriority, resolveTargets } from "./registry";
export type { ResolvedTarget } from "./registry";

/**
 * متن قالب برای یک کانال مشخص
 *
 * SMS به `SmsTemplate.body` برمی‌گردد (سازگاری با قالب‌های موجود). بقیه‌ی
 * کانال‌ها باید متن اختصاصی داشته باشند؛ نبودش یعنی آن قالب روی آن کانال
 * ارسال نمی‌شود — عمداً، چون متن پیامک روی تلگرام بد خوانده می‌شود.
 */
export async function getTemplateBody(
  templateId: string,
  channel: ClubChannel
): Promise<{ body: string; extra: unknown } | null> {
  const override = await prisma.templateChannelBody.findUnique({
    where: { templateId_channel: { templateId, channel } },
    select: { body: true, extra: true, isActive: true },
  });

  if (override?.isActive && override.body.trim()) {
    return { body: override.body, extra: override.extra };
  }

  if (channel !== "SMS") return null;

  const template = await prisma.smsTemplate.findUnique({
    where: { id: templateId },
    select: { body: true },
  });

  return template?.body ? { body: template.body, extra: null } : null;
}

export interface MultiChannelResult {
  byChannel: Record<string, ChannelSendResult>;
  totalSent: number;
  totalFailed: number;
  /** اعضایی که هیچ کانال قابل استفاده‌ای نداشتند */
  unreachable: number;
}

/**
 * ارسال چندکاناله به یک فهرست عضو
 *
 * هر عضو از اولین کانالِ در دسترسِ فهرست اولویت پیام می‌گیرد، نه از همه‌ی
 * کانال‌ها — وگرنه یک نفر سه بار یک پیام می‌گیرد.
 *
 * ⚠️ گیرنده‌ها بر اساس کانال دسته‌بندی و هر دسته یک‌جا فرستاده می‌شود. ارسال
 *    تک‌تک یعنی برای کمپین بزرگ هزاران درخواست جدا به ارائه‌دهنده.
 */
export async function dispatchMultiChannel(input: {
  profileIds: string[];
  kind: SmsKind;
  /** متن هر کانال — کلید نام کانال است */
  bodyByChannel: Partial<Record<ClubChannel, string>>;
  varsByProfile?: Map<string, Record<string, string>>;
  extra?: Record<string, unknown>;
}): Promise<MultiChannelResult> {
  const priority = await getChannelPriority();

  const byChannel: Record<string, ChannelSendResult> = {};
  let totalSent = 0;
  let totalFailed = 0;

  // ⚠️ دو پاس، نه بیشتر. پاس دوم فقط برای کسانی است که کانال اولشان **دائماً**
  //    شکست خورده (مثلاً حساب بله ندارند). بدون آن، عضوی که شماره و رضایت
  //    پیامک دارد ولی در بله نیست، هیچ پیامی نمی‌گیرد — بدترین حالت ممکن.
  //    حلقه‌ی بی‌پایان هم نداریم: هر پاس کانالِ شکست‌خورده را کنار می‌گذارد.
  const excluded = new Map<string, Set<ClubChannel>>();
  let pending = input.profileIds;
  let reached = 0;

  for (let pass = 0; pass < 2 && pending.length > 0; pass++) {
    const targets = await resolveTargets(pending, priority, excluded);
    if (targets.length === 0) break;

    reached += targets.length;

    const grouped = new Map<ClubChannel, typeof targets>();
    for (const t of targets) {
      const list = grouped.get(t.channel) ?? [];
      list.push(t);
      grouped.set(t.channel, list);
    }

    const retry: string[] = [];

    for (const [channel, list] of grouped) {
      const impl = getChannel(channel);
      const text = input.bodyByChannel[channel];

      // کانالی که متن ندارد یا پیاده‌سازی ندارد، رد می‌شود — بی‌صدا نه:
      // در نتیجه به‌عنوان ناموفق شمرده می‌شود تا ادمین ببیند
      if (!impl || !text) {
        byChannel[channel] = {
          ok: false,
          sentCount: 0,
          failedCount: list.length,
          error: !impl ? "کانال پیاده‌سازی نشده" : "متن این کانال تعریف نشده",
        };
        totalFailed += list.length;
        continue;
      }

      const result = await impl.send({
        kind: input.kind,
        text,
        recipients: list.map((t) => ({
          profileId: t.profileId,
          destination: t.destination,
          userId: t.userId,
          ...(input.varsByProfile?.get(t.profileId)
            ? { vars: input.varsByProfile.get(t.profileId) }
            : {}),
        })),
        ...(input.extra ? { extra: input.extra } : {}),
      });

      // نتیجه‌ی پاس دوم روی پاس اول جمع می‌شود، نه جایگزینش
      const prev = byChannel[channel];
      byChannel[channel] = prev
        ? {
            ok: prev.ok || result.ok,
            sentCount: prev.sentCount + result.sentCount,
            failedCount: prev.failedCount + result.failedCount,
            ...(result.error ?? prev.error ? { error: result.error ?? prev.error } : {}),
          }
        : result;

      totalSent += result.sentCount;
      totalFailed += result.failedCount;

      for (const f of result.permanentlyFailed ?? []) {
        const set = excluded.get(f.profileId) ?? new Set<ClubChannel>();
        set.add(channel);
        excluded.set(f.profileId, set);
        retry.push(f.profileId);
        // شکست دائمی در پاس بعد جبران می‌شود، پس از شمارش ناموفق کم می‌شود
        totalFailed--;
        reached--;
      }
    }

    pending = retry;
  }

  return {
    byChannel,
    totalSent,
    totalFailed,
    unreachable: input.profileIds.length - reached,
  };
}
