import { prisma } from "@/lib/prisma";
import type { ClubSource, ClubChannel, Prisma } from "@prisma/client";

/**
 * ثبت نقاط تماس عضو
 *
 * ⚠️ در فایل جدا از `profile.ts` و `rewards.ts` است تا چرخه‌ی import نسازد —
 *    هر دو به آن نیاز دارند.
 *
 * ⚠️ هرگز throw نمی‌کند. ثبت‌نام یا سفارش نباید به‌خاطر گزارش‌گیری بشکند.
 */

export interface TouchpointInput {
  profileId: string;
  source: ClubSource;
  /** کد پلتفرم — "basalam" | "tapsi_shop" | "telegram" | "bale" | ... */
  platform?: string | null;
  channel?: ClubChannel | null;
  /** شناسه‌ی عضو در آن پلتفرم — chat_id تلگرام، شناسه‌ی خریدار باسلام و ... */
  externalId?: string | null;
  meta?: Prisma.InputJsonValue;
}

export async function recordTouchpoint(input: TouchpointInput): Promise<void> {
  try {
    await prisma.clubTouchpoint.create({
      data: {
        profileId: input.profileId,
        source: input.source,
        platform: input.platform ?? null,
        channel: input.channel ?? null,
        externalId: input.externalId ?? null,
        ...(input.meta !== undefined ? { meta: input.meta } : {}),
      },
    });

    // اولین منبع فقط یک بار نوشته می‌شود — شرط در where، نه در کد،
    // تا دو درخواست هم‌زمان هر دو ننویسند
    await prisma.clubProfile.updateMany({
      where: { id: input.profileId, firstSource: null },
      data: {
        firstSource: input.source,
        firstPlatform: input.platform ?? null,
        firstSeenAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[club] ثبت نقطه تماس ناموفق:", err);
  }
}

/**
 * پر کردن `firstSource` اعضای قدیمی از روی `source` فعلی
 *
 * برای اعضایی که پیش از افزوده شدن این فیلدها ثبت شده‌اند. یک نقطه‌ی تماس
 * جبرانی هم با زمان عضویت می‌سازد تا گزارش‌ها از روز اول عدد داشته باشند.
 */
export async function backfillFirstSource(): Promise<{ updated: number }> {
  const rows = await prisma.clubProfile.findMany({
    where: { firstSource: null },
    select: { id: true, source: true, sourcePlatform: true, joinedAt: true },
  });

  if (rows.length === 0) return { updated: 0 };

  await prisma.$transaction([
    ...rows.map((r) =>
      prisma.clubProfile.update({
        where: { id: r.id },
        data: {
          firstSource: r.source,
          firstPlatform: r.sourcePlatform,
          firstSeenAt: r.joinedAt,
        },
      })
    ),
    prisma.clubTouchpoint.createMany({
      data: rows.map((r) => ({
        profileId: r.id,
        source: r.source,
        platform: r.sourcePlatform,
        occurredAt: r.joinedAt,
        meta: { backfilled: true },
      })),
    }),
  ]);

  return { updated: rows.length };
}
