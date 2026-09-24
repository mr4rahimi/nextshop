/**
 * شماره‌ی پیوسته — تله‌ی ۵: نه `max+1`.
 *
 * یک UPSERT اتمیک: ردیف را می‌سازد یا قفل و یکی زیاد می‌کند و مقدار قبلی را
 * برمی‌گرداند. داخل تراکنش صدا زده شود تا اگر ثبت سند شکست خورد، شماره هم
 * برگردد و حفره نماند.
 */

import type { Prisma } from "@prisma/client";

/** کلید سال برای شماره‌های سراسری (کد شخص، کد خزانه) */
export const GLOBAL_SEQ = "global";

export async function nextNumber(
  tx: Prisma.TransactionClient,
  yearId: string,
  key: string,
  start = 1,
): Promise<number> {
  const rows = await tx.$queryRaw<{ n: number }[]>`
    INSERT INTO "AccSequence" ("yearId", "key", "next")
    VALUES (${yearId}, ${key}, ${start + 1})
    ON CONFLICT ("yearId", "key") DO UPDATE SET "next" = "AccSequence"."next" + 1
    RETURNING ("next" - 1)::int AS n
  `;
  return Number(rows[0].n);
}
