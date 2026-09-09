/**
 * اجرای قواعد تکرارشونده — ساخت خودکار کار.
 *
 * منطق ساده است: **کارمند برای کار تکراری هیچ‌وقت رکورد نمی‌سازد، فقط
 * رکوردِ از پیش ساخته‌شده را می‌بندد.** ردیفِ باز خودش فرمِ نیمه‌پرشده است.
 *
 * ⚠️ سه محافظ اجباری‌اند و بدون هرکدام این قابلیت به فاجعه تبدیل می‌شود:
 *
 * **۱. یکتایی** — `StaffTask.runKey` ایندکس یکتا دارد. اگر worker دو بار در
 * روز اجرا شود یا دو پروسه هم‌زمان بالا باشند، کارتابل دوبرابر نمی‌شود.
 * شرط `findFirst` قبل از `create` برای این کافی نیست.
 *
 * **۲. سقف** — `maxPerRun` سقفِ **روزانه** است نه سقفِ هر اجرا. زمان‌بند هر
 * ده دقیقه اجرا می‌شود؛ اگر سقف per-run بود، در یک روز تا ۲۸۸ برابرِ آن کار
 * ساخته می‌شد و کارتابل یک نفر پر می‌شد. سهمیه‌ی هر اجرا از روی تعداد کارِ
 * همان قاعده در همان روز حساب می‌شود.
 *
 * **۳. فاصله** — مشتری‌ای که در `idleDays` روز گذشته با او تماس گرفته شده
 * دوباره انتخاب نمی‌شود، حتی اگر شرط زمانی هنوز برقرار باشد.
 *
 * مستندات: docs/features/staff-worklist.md بخش ۸
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, StaffRecurringRule } from "@prisma/client";

/** بامداد امروز در وقت محلی سرور */
export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** کلید روز به‌صورت YYYY-MM-DD در وقت محلی سرور */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** شنبه = ۰، مطابق تقویم ایران (`getDay()` یکشنبه را ۰ می‌گیرد) */
export function iranDayOfWeek(d: Date = new Date()): number {
  return (d.getDay() + 1) % 7;
}

export interface RunResult {
  ruleId: string;
  title: string;
  created: number;
  skipped: string | null;
}

/** آیا قاعده امروز باید اجرا شود */
function isDue(rule: StaffRecurringRule, now: Date): boolean {
  switch (rule.schedule) {
    case "DAILY":
      return true;
    case "WEEKLY":
      return rule.daysOfWeek.includes(iranDayOfWeek(now));
    case "MONTHLY":
      // ماه میلادی عمدی است: این فقط «یک بار در ماه» را تضمین می‌کند و
      // واحد گزارش نیست. گزارش‌های ماهانه از تقویم شمسی استفاده می‌کنند.
      return rule.dayOfMonth === now.getDate();
    case "CUSTOMER_IDLE":
      return true;
    default:
      return false;
  }
}

/**
 * ساخت یک کار با کلید یکتا.
 *
 * برخورد کلید یکتا **خطا نیست** — یعنی این ردیف قبلاً ساخته شده. بی‌صدا
 * رد می‌شود و `false` برمی‌گردد.
 */
async function createOnce(
  data: Prisma.StaffTaskUncheckedCreateInput,
): Promise<boolean> {
  try {
    await prisma.staffTask.create({ data });
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") return false; // تکراری، همان چیزی که می‌خواستیم
    throw e;
  }
}

/** یک قاعده‌ی زمانی: یک کار در روز */
async function runScheduled(
  rule: StaffRecurringRule & { type: { domain: string; channel: string; slaMinutes: number | null } },
  now: Date,
): Promise<number> {
  if (!rule.ownerId) return 0; // بدون مسئول، ردیف بی‌صاحب می‌شود

  const key = `${rule.id}:${dayKey(now)}`;

  // بررسی قبلی فقط برای اینکه Prisma خطای کلید تکراری را بلند لاگ نکند؛
  // مرزِ واقعی همچنان ایندکس یکتاست، چون بین این خواندن و نوشتن فاصله هست.
  const exists = await prisma.staffTask.findUnique({
    where: { runKey: key },
    select: { id: true },
  });
  if (exists) return 0;

  const dueAt = rule.type.slaMinutes
    ? new Date(now.getTime() + rule.type.slaMinutes * 60_000)
    : dueFromTimeOfDay(rule.timeOfDay, now);

  const made = await createOnce({
    typeId: rule.typeId,
    domain: rule.type.domain as never,
    channel: rule.type.channel as never,
    source: "RECURRING",
    title: rule.title,
    ownerId: rule.ownerId,
    ownerName: rule.ownerName ?? "نامشخص",
    createdById: null,
    createdByName: "سیستم",
    status: "OPEN",
    ruleId: rule.id,
    runKey: key,
    dueAt,
    occurredAt: now,
  });

  return made ? 1 : 0;
}

/** «۰۹:۰۰» را به مهلت امروز تبدیل می‌کند */
function dueFromTimeOfDay(timeOfDay: string | null, now: Date): Date | null {
  if (!timeOfDay) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeOfDay.trim());
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

/**
 * قاعده‌ی «مشتری راکد»: یک کار به‌ازای هر مشتری واجد شرایط.
 *
 * مشتری‌ها به ترتیب **قدیمی‌ترین خرید** انتخاب می‌شوند تا کسی که بیشتر از
 * همه رها شده اول در صف بیاید، و بقیه اجرای بعدی.
 */
async function runCustomerIdle(
  rule: StaffRecurringRule & { type: { domain: string; channel: string; slaMinutes: number | null } },
  now: Date,
): Promise<number> {
  if (!rule.ownerId) return 0;
  const idleDays = rule.idleDays ?? 90;

  // ⚠️ سهمیه‌ی امروز، نه سهمیه‌ی این اجرا. زمان‌بند هر ده دقیقه می‌آید.
  const key = dayKey(now);
  const madeToday = await prisma.staffTask.count({
    where: { ruleId: rule.id, runKey: { startsWith: `${rule.id}:` }, createdAt: { gte: startOfDay(now) } },
  });
  const quota = rule.maxPerRun - madeToday;
  if (quota <= 0) return 0;

  const idleBefore = new Date(now.getTime() - idleDays * 86_400_000);

  const candidates = await prisma.clubProfile.findMany({
    where: {
      isBlocked: false,
      lastPurchaseAt: { not: null, lt: idleBefore },
      // محافظ فاصله: مشتری‌ای که در همین بازه با او تماس گرفته شده، نه.
      // فیلتر روی `User` است چون `StaffTask.customerId` به کاربر اشاره دارد.
      user: {
        staffTasksAsCustomer: {
          none: { typeId: rule.typeId, createdAt: { gte: idleBefore } },
        },
      },
    },
    orderBy: { lastPurchaseAt: "asc" },
    take: quota,
    select: {
      userId: true,
      lastPurchaseAt: true,
      user: { select: { firstName: true, lastName: true, phone: true } },
    },
  });

  let created = 0;

  for (const c of candidates) {
    const name =
      [c.user.firstName, c.user.lastName].filter(Boolean).join(" ").trim() ||
      c.user.phone;
    const days = c.lastPurchaseAt
      ? Math.round((now.getTime() - c.lastPurchaseAt.getTime()) / 86_400_000)
      : null;

    const made = await createOnce({
      typeId: rule.typeId,
      domain: rule.type.domain as never,
      channel: rule.type.channel as never,
      source: "RECURRING",
      title: days ? `${rule.title} — ${days} روز از خرید` : rule.title,
      ownerId: rule.ownerId,
      ownerName: rule.ownerName ?? "نامشخص",
      createdById: null,
      createdByName: "سیستم",
      status: "OPEN",
      customerId: c.userId,
      contactName: name,
      contactPhone: c.user.phone,
      ruleId: rule.id,
      runKey: `${rule.id}:${c.userId}:${key}`,
      dueAt: dueFromTimeOfDay(rule.timeOfDay, now),
      occurredAt: now,
    });
    if (made) created++;
  }

  return created;
}

/**
 * اجرای همه‌ی قواعد فعال.
 *
 * **هیچ‌وقت خطا پرتاب نمی‌کند.** خطای یک قاعده نباید بقیه را متوقف کند یا
 * پروسه‌ی سایت را بشکند — همان قاعده‌ای که `logActivity` دارد.
 */
export async function runRecurringRules(now: Date = new Date()): Promise<RunResult[]> {
  const rules = await prisma.staffRecurringRule.findMany({
    where: { isActive: true },
    include: { type: { select: { domain: true, channel: true, slaMinutes: true, isActive: true } } },
  });

  const results: RunResult[] = [];

  for (const rule of rules) {
    try {
      if (!rule.type.isActive) {
        results.push({ ruleId: rule.id, title: rule.title, created: 0, skipped: "نوع کار غیرفعال است" });
        continue;
      }
      if (!rule.ownerId) {
        results.push({ ruleId: rule.id, title: rule.title, created: 0, skipped: "مسئول تعیین نشده" });
        continue;
      }
      if (!isDue(rule, now)) {
        results.push({ ruleId: rule.id, title: rule.title, created: 0, skipped: "امروز نوبتش نیست" });
        continue;
      }

      const created =
        rule.schedule === "CUSTOMER_IDLE"
          ? await runCustomerIdle(rule as never, now)
          : await runScheduled(rule as never, now);

      await prisma.staffRecurringRule.update({
        where: { id: rule.id },
        data: { lastRunAt: now, lastRunCount: created },
      });

      results.push({ ruleId: rule.id, title: rule.title, created, skipped: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : "خطای نامشخص";
      console.error(`[worklist] اجرای قاعده «${rule.title}» شکست خورد:`, message);
      results.push({ ruleId: rule.id, title: rule.title, created: 0, skipped: `خطا: ${message}` });
    }
  }

  return results;
}
