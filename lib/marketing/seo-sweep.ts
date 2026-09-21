/**
 * جاروب دوره‌ای سئو — روی `lib/worklist/scheduler.ts` سوار است.
 *
 * دو کار می‌کند و هر دو **باید در برابر اجرای هم‌زمان امن باشند**:
 *   ۱. ساخت کار از الگوهای دوره‌ای که موعدشان رسیده
 *   ۲. یادآوری «بررسی نتیجه» برای کارهای تأییدشده‌ای که تاریخ بررسی‌شان رسیده
 *
 * ⚠️ **مهم‌ترین نکته‌ی این فایل: قبضه‌ی اتمیک.** زمان‌بند در **هر پروسه‌ی
 * pm2** بالا می‌آید و چند سایت روی یک سرورند. اگر دو پروسه هم‌زمان الگویی را
 * ببینند، دو کار تکراری ساخته می‌شود. راهش `updateMany` با شرط روی **مقدار
 * قبلی** است: پروسه‌ی دوم صفر ردیف می‌گیرد و رد می‌شود. `findMany` و بعد
 * `update` این را نمی‌گیرد.
 *
 * ⚠️ **تا کار قبلیِ همان الگو باز است، کار تازه ساخته نمی‌شود.** موعد جلو
 * می‌رود و یک رویداد روی کار باز ثبت می‌شود. «بررسی ماهانه»ای که ماه قبلش
 * انجام نشده، با کار دوم انجام نمی‌شود — فقط دو ردیفِ باز می‌سازد که هیچ‌کدام
 * بسته نمی‌شوند.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵.۶
 */

import { prisma } from "@/lib/prisma";
import { notify, usersWithPermission } from "./notifications";
import { advanceToFuture, dueFromOffset } from "./seo-recurrence";
import type { Prisma, SeoRecurrenceUnit } from "@prisma/client";

export interface SeoSweepResult {
  created: number;
  blocked: number;
  reminded: number;
}

/** بندهای چک‌لیست از ستون Json — با احتیاط خوانده می‌شود */
function parseChecklist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => (typeof x === "string" && x.trim() ? [x.trim()] : []));
}

/**
 * ساخت کار از الگوهای سررسیده.
 *
 * ⚠️ الگوی غیرفعال یا حذف‌شده کار تازه نمی‌سازد، ولی کارهای ساخته‌شده‌اش
 * سرجایشان می‌مانند و عوض‌کردن مسئولِ الگو کارهای قبلی را جابه‌جا نمی‌کند.
 */
export async function runSeoRecurring(now: Date = new Date()): Promise<{
  created: number;
  blocked: number;
}> {
  const due = await prisma.seoRecurringTask.findMany({
    where: { isActive: true, deletedAt: null, nextRunAt: { lte: now } },
    select: {
      id: true,
      title: true,
      categoryId: true,
      description: true,
      pageUrls: true,
      assigneeId: true,
      assigneeName: true,
      priority: true,
      checklist: true,
      unit: true,
      intervalCount: true,
      dueOffsetDays: true,
      reviewOffsetDays: true,
      nextRunAt: true,
    },
  });

  let created = 0;
  let blocked = 0;

  for (const rule of due) {
    const { nextRunAt, skipped } = advanceToFuture(
      rule.nextRunAt,
      rule.unit,
      rule.intervalCount,
      now,
    );

    // ⚠️ قبضه: فقط اگر `nextRunAt` هنوز همان مقداری باشد که خواندیم.
    // پروسه‌ی دوم صفر ردیف می‌گیرد و این الگو را رد می‌کند.
    const claim = await prisma.seoRecurringTask.updateMany({
      where: { id: rule.id, nextRunAt: rule.nextRunAt },
      data: { nextRunAt, lastRunAt: now },
    });
    if (claim.count === 0) continue;

    // کارِ باز از همین الگو؟ موعد جلو رفت ولی کار تازه ساخته نمی‌شود.
    const openTask = await prisma.seoTask.findFirst({
      where: {
        recurrenceId: rule.id,
        deletedAt: null,
        status: { in: ["ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL"] },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (openTask) {
      blocked++;
      await prisma.seoTaskEvent.create({
        data: {
          taskId: openTask.id,
          actorId: null, // کارِ سیستم است؛ نسبت‌دادنش به سازنده تاریخچه را دروغ می‌کند
          actorName: null,
          action: "SYSTEM",
          note: "نوبت بعدیِ این کار دوره‌ای رسید، ولی این کار هنوز باز است؛ کار تازه‌ای ساخته نشد.",
        },
      });
      continue;
    }

    if (!rule.assigneeId) {
      // کارِ بی‌صاحب بدتر از کارِ ساخته‌نشده است
      console.warn(`[seo] الگوی «${rule.title}» مسئول ندارد؛ کار ساخته نشد.`);
      continue;
    }

    const items = parseChecklist(rule.checklist);
    const skipNote =
      skipped > 0
        ? `\n(${skipped.toLocaleString("fa-IR")} نوبت از دست رفته بود و فقط همین یک کار ساخته شد.)`
        : "";

    const task = await prisma.seoTask.create({
      data: {
        categoryId: rule.categoryId,
        title: rule.title,
        description: rule.description,
        pageUrls: rule.pageUrls,
        assigneeId: rule.assigneeId,
        assigneeName: rule.assigneeName,
        createdById: null, // سیستم ساخته، نه آدم
        createdByName: "کار دوره‌ای",
        priority: rule.priority,
        dueAt: dueFromOffset(now, rule.dueOffsetDays),
        reviewAt: dueFromOffset(now, rule.reviewOffsetDays),
        recurrenceId: rule.id,
        checklist: { create: items.map((t, i) => ({ title: t, sortOrder: i })) },
        events: {
          create: {
            actorId: null,
            actorName: null,
            action: "SYSTEM",
            toStatus: "ASSIGNED",
            note: `از الگوی دوره‌ای «${rule.title}» ساخته شد.${skipNote}`,
          },
        },
      },
      select: { id: true, code: true },
    });

    created++;

    await notify({
      userIds: [rule.assigneeId],
      // بدون `actorId`: سازنده سیستم است، پس هیچ‌کس از فهرست بیرون نمی‌رود
      type: "SEO_TASK",
      entityId: task.id,
      title: `کار دوره‌ای سئو ${task.code.toLocaleString("fa-IR")} برای شما ساخته شد`,
      body: rule.title,
      url: `/admin/worklist/seo?task=${task.id}`,
    });
  }

  return { created, blocked };
}

/**
 * یادآوری بررسی نتیجه.
 *
 * ⚠️ همان قبضه: `reviewRemindedAt` از `null` به زمان فعلی، با شرط
 * `reviewRemindedAt: null`. بدون آن، هر ده دقیقه یک یادآوری تکراری می‌رفت و
 * کارمند صندوق اعلانش را می‌بست — و بعد اعلان‌های واقعی را هم نمی‌دید.
 *
 * گیرنده **تأییدکننده** است، وگرنه سازنده؛ اگر هیچ‌کدام نبودند مدیران سئو.
 * کسی که کار را تأیید کرده، همان کسی است که می‌تواند بگوید اثر داشت یا نه.
 */
export async function runSeoReviewReminders(
  now: Date = new Date(),
): Promise<number> {
  const ready = await prisma.seoTask.findMany({
    where: {
      deletedAt: null,
      status: "DONE",
      reviewOutcome: null,
      reviewRemindedAt: null,
      reviewAt: { not: null, lte: now },
    },
    select: {
      id: true,
      code: true,
      title: true,
      approvedById: true,
      createdById: true,
    },
    take: 50, // جاروب باید سبک بماند؛ بقیه در چرخه‌ی بعد
  });

  if (ready.length === 0) return 0;

  let managers: { id: string }[] | null = null;
  let reminded = 0;

  for (const task of ready) {
    const claim = await prisma.seoTask.updateMany({
      where: { id: task.id, reviewRemindedAt: null },
      data: { reviewRemindedAt: now },
    });
    if (claim.count === 0) continue;

    let targets: (string | null)[] = [task.approvedById ?? task.createdById];
    if (!targets[0]) {
      // فهرست مدیران فقط وقتی لازم شد خوانده می‌شود، نه در هر جاروب
      managers ??= await usersWithPermission("SEO_TASK_MANAGE");
      targets = managers.map((m) => m.id);
    }

    await notify({
      userIds: targets,
      type: "SEO_TASK",
      entityId: task.id,
      title: `وقتِ بررسی نتیجه‌ی کار سئو ${task.code.toLocaleString("fa-IR")} رسید`,
      body: task.title,
      url: `/admin/worklist/seo?task=${task.id}`,
    });

    await prisma.seoTaskEvent.create({
      data: {
        taskId: task.id,
        actorId: null,
        actorName: null,
        action: "SYSTEM",
        note: "یادآوری بررسی نتیجه فرستاده شد.",
      },
    });

    reminded++;
  }

  return reminded;
}

/** هر دو کار، برای صدازدن از زمان‌بند */
export async function runSeoSweep(now: Date = new Date()): Promise<SeoSweepResult> {
  const { created, blocked } = await runSeoRecurring(now);
  const reminded = await runSeoReviewReminders(now);
  return { created, blocked, reminded };
}

/** ورودی ساخت و ویرایش الگو — اعتبارسنجی مشترک روت‌ها */
export interface RecurringInput {
  title?: string;
  categoryId?: string;
  description?: string | null;
  pageUrls?: string | null;
  assigneeId?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  checklist?: string[];
  unit?: "WEEK" | "MONTH";
  intervalCount?: number;
  dueOffsetDays?: number | null;
  reviewOffsetDays?: number | null;
  firstRunAt?: string | null;
  isActive?: boolean;
}

export function checklistJson(items: string[] | undefined): Prisma.InputJsonValue {
  return (items ?? []).map((t) => String(t).trim()).filter(Boolean);
}

/** فیلدهای الگو که فهرست و فرم لازم دارند */
export const RECURRING_SELECT = {
  id: true,
  title: true,
  categoryId: true,
  description: true,
  pageUrls: true,
  assigneeId: true,
  assigneeName: true,
  priority: true,
  checklist: true,
  unit: true,
  intervalCount: true,
  dueOffsetDays: true,
  reviewOffsetDays: true,
  nextRunAt: true,
  lastRunAt: true,
  isActive: true,
  createdAt: true,
  category: { select: { id: true, title: true } },
  _count: { select: { tasks: true } },
} satisfies Prisma.SeoRecurringTaskSelect;

/**
 * اعتبارسنجی مشترکِ ساخت و ویرایش الگو.
 *
 * ⚠️ اینجاست نه در فایل روت: Next.js از فایل `route.ts` فقط هندلرهای HTTP و
 * تنظیمات را می‌پذیرد و هر export دیگری بیلد را می‌شکند.
 */
export function validateRecurring(body: RecurringInput) {
  const title = String(body.title ?? "").trim();
  if (!title) throw new Error("عنوان الگو لازم است");

  const unit: SeoRecurrenceUnit = body.unit === "WEEK" ? "WEEK" : "MONTH";
  const intervalCount = Math.max(1, Math.trunc(Number(body.intervalCount ?? 1)));
  if (!Number.isFinite(intervalCount)) throw new Error("فاصله‌ی تکرار معتبر نیست");

  /** عددِ روز — منفی و بی‌معنی به خالی تبدیل می‌شود، نه به صفر */
  const days = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  return {
    title,
    description: String(body.description ?? "").trim() || null,
    pageUrls: String(body.pageUrls ?? "").trim() || null,
    priority: body.priority ?? ("NORMAL" as const),
    unit,
    intervalCount,
    dueOffsetDays: days(body.dueOffsetDays),
    reviewOffsetDays: days(body.reviewOffsetDays),
    checklist: checklistJson(body.checklist),
  };
}
