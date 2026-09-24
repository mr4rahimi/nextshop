/**
 * پردازش صف رویداد مالی — از چرخه‌ی worker یکپارچه‌سازی (هر ۳۰ ثانیه) و از
 * دکمه‌ی «اجرای الان» صفحه‌ی رویدادها صدا زده می‌شود.
 *
 * قواعد (docs/plans/accounting.md بخش ۴.۲):
 * - رویدادهای یک aggregate پشت سر هم اجرا می‌شوند: تا رویداد قبلی باز
 *   (منتظر، مسدود یا ناموفق) است، بعدی برداشته نمی‌شود — برگشت پیش از فروش ثبت نشود.
 * - خطای موقت با تأخیر فزاینده دوباره تلاش می‌شود و بعد از MAX_ATTEMPTS «ناموفق» می‌ماند.
 * - رویداد مسدود هر BLOCKED_RECHECK_MIN دقیقه دوباره سنجیده می‌شود؛ رفع مشکل
 *   (مثلاً نگاشت کالا) کافی است و دکمه‌ای لازم نیست.
 * - تا حالت حسابداری «داخلی» نیست، رویدادها «رد شده» علامت می‌خورند: حسابداری
 *   بیرونی از مسیر خودش ثبت می‌کند و سابقه‌ی قبل از انتقال از ویزارد می‌آید.
 */

import type { AccEvent, AccMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccMode } from "./settings";
import { internalProvider } from "./providers/internal";
import type { ApplyResult } from "./port";

const BATCH = 20;
const LOCK_SECONDS = 120;
const MAX_ATTEMPTS = 8;
const BLOCKED_RECHECK_MIN = 10;

export interface DispatchSummary {
  mode: AccMode;
  claimed: number;
  done: number;
  skipped: number;
  blocked: number;
  retried: number;
  failed: number;
}

/** برداشتن اتمیک یک دسته — worker و دکمه‌ی دستی هم‌زمان یک رویداد را نمی‌گیرند */
async function claimBatch(ids?: string[]): Promise<AccEvent[]> {
  const onlyIds = ids?.length ? ids : null;
  return prisma.$queryRaw<AccEvent[]>`
    UPDATE "AccEvent" SET "lockedUntil" = NOW() + make_interval(secs => ${LOCK_SECONDS})
    WHERE id IN (
      SELECT e.id FROM "AccEvent" e
      WHERE e.status IN ('PENDING', 'BLOCKED')
        AND e."nextAttemptAt" <= NOW()
        AND (e."lockedUntil" IS NULL OR e."lockedUntil" < NOW())
        AND (${onlyIds}::text[] IS NULL OR e.id = ANY(${onlyIds}::text[]))
        AND NOT EXISTS (
          SELECT 1 FROM "AccEvent" p
          WHERE p."aggregateType" = e."aggregateType"
            AND p."aggregateId" = e."aggregateId"
            AND p.status IN ('PENDING', 'BLOCKED', 'FAILED')
            AND (p."createdAt", p.id) < (e."createdAt", e.id)
        )
      ORDER BY e."createdAt" ASC
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}

function backoffMinutes(attempts: number): number {
  return Math.min(2 ** attempts, 60);
}

type Outcome = "done" | "skipped" | "blocked" | "retried" | "failed";

async function settle(event: AccEvent, mode: AccMode, result: ApplyResult): Promise<Outcome> {
  const now = new Date();
  const base = { mode, lockedUntil: null, updatedAt: now };

  switch (result.kind) {
    case "done":
      await prisma.accEvent.update({
        where: { id: event.id },
        data: { ...base, status: "DONE", resultRef: result.ref ?? null, lastError: null, blockedReason: null, processedAt: now },
      });
      return "done";
    case "skipped":
      await prisma.accEvent.update({
        where: { id: event.id },
        data: { ...base, status: "SKIPPED", blockedReason: result.reason, processedAt: now },
      });
      return "skipped";
    case "blocked":
      await prisma.accEvent.update({
        where: { id: event.id },
        data: {
          ...base,
          status: "BLOCKED",
          blockedReason: result.reason,
          nextAttemptAt: new Date(now.getTime() + BLOCKED_RECHECK_MIN * 60_000),
        },
      });
      return "blocked";
    case "retry": {
      const attempts = event.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      await prisma.accEvent.update({
        where: { id: event.id },
        data: {
          ...base,
          attempts,
          lastError: result.error.slice(0, 1000),
          status: failed ? "FAILED" : "PENDING",
          nextAttemptAt: new Date(now.getTime() + backoffMinutes(attempts) * 60_000),
        },
      });
      return failed ? "failed" : "retried";
    }
  }
}

/** یک دور پردازش. `ids` برای اجرای دستی چند رویداد مشخص است. */
export async function dispatchAccEvents(ids?: string[]): Promise<DispatchSummary> {
  const mode = await getAccMode();
  const summary: DispatchSummary = { mode, claimed: 0, done: 0, skipped: 0, blocked: 0, retried: 0, failed: 0 };

  const events = await claimBatch(ids);
  summary.claimed = events.length;

  for (const event of events) {
    let result: ApplyResult;
    if (mode !== "INTERNAL") {
      result = { kind: "skipped", reason: "حسابداری داخلی فعال نیست" };
    } else {
      try {
        result = await internalProvider.apply(event);
      } catch (e) {
        result = { kind: "retry", error: e instanceof Error ? e.message : String(e) };
      }
    }
    const key = await settle(event, mode, result).catch((e: unknown) => {
      console.error("[acc-dispatch] ثبت نتیجه‌ی رویداد ناموفق:", event.id, e);
      return null;
    });
    if (key) summary[key]++;
  }

  return summary;
}

/** «تلاش دوباره» ادمین — ناموفق و مسدود به صف برمی‌گردند و شمارش تلاش صفر می‌شود */
export async function retryAccEvents(ids: string[]): Promise<number> {
  const res = await prisma.accEvent.updateMany({
    where: { id: { in: ids }, status: { in: ["FAILED", "BLOCKED", "PENDING"] } },
    data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lockedUntil: null },
  });
  return res.count;
}
