/**
 * برچسب‌ها و ثابت‌های مشترک سئو، محتوا و لینک‌سازی.
 *
 * بدون `use client` نگه داشته می‌شود تا هم مسیرهای API و هم کامپوننت‌های
 * کلاینت از آن استفاده کنند — همان قرارداد `lib/worklist/types.ts`.
 *
 * مستندات: docs/plans/seo-marketing.md
 */

import type {
  SeoTaskStatus,
  SeoReviewOutcome,
  SeoRecurrenceUnit,
  MarketingEventAction,
  ContentTaskStatus,
  ContentDestination,
} from "@prisma/client";

export type {
  SeoTaskStatus,
  SeoReviewOutcome,
  SeoRecurrenceUnit,
  MarketingEventAction,
  ContentTaskStatus,
  ContentDestination,
};

export const SEO_STATUS_LABELS: Record<SeoTaskStatus, string> = {
  ASSIGNED: "واگذارشده",
  IN_PROGRESS: "در حال انجام",
  AWAITING_APPROVAL: "منتظر تأیید",
  DONE: "تأیید شد",
  CANCELED: "لغو شد",
};

/** کلاس‌های Tailwind کامل نوشته می‌شوند تا purge حذفشان نکند */
export const SEO_STATUS_COLORS: Record<SeoTaskStatus, string> = {
  ASSIGNED: "text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5",
  IN_PROGRESS: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  AWAITING_APPROVAL: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
  DONE: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
  CANCELED: "text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-500/10",
};

export const REVIEW_LABELS: Record<SeoReviewOutcome, string> = {
  EFFECTIVE: "اثر داشت",
  PARTIAL: "اثر جزئی",
  INEFFECTIVE: "اثر نداشت",
};

export const REVIEW_COLORS: Record<SeoReviewOutcome, string> = {
  EFFECTIVE: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
  PARTIAL: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
  INEFFECTIVE: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
};

/**
 * متنِ هر رویداد در تاریخچه.
 *
 * ⚠️ این نگاشت **مشترکِ هر سه حوزه** است (سئو، محتوا، لینک‌سازی) تا یک
 * جمله‌ی فارسی دو شکل پیدا نکند.
 */
export const EVENT_LABELS: Record<MarketingEventAction, string> = {
  CREATED: "ساخته شد",
  ASSIGNED: "مسئول عوض شد",
  STARTED: "شروع شد",
  REPORTED: "گزارش ثبت شد",
  PUBLISHING: "در حال انتشار",
  SUBMITTED: "تکمیل شد",
  APPROVED: "تأیید شد",
  RETURNED: "برگشت خورد",
  CANCELED: "لغو شد",
  REOPENED: "بازگشایی شد",
  FAILED: "نشد",
  LOST: "از دست رفت",
  REVIEWED: "نتیجه ثبت شد",
  SYSTEM: "سیستم",
};

// ─────────────────────────────────────────────────────────────────
// گردش کار کار سئو
// ─────────────────────────────────────────────────────────────────

/** کنش‌هایی که اندپوینتِ یکتای `transition` می‌پذیرد */
export const SEO_ACTIONS = [
  "start",
  "report",
  "approve",
  "return",
  "cancel",
  "reopen",
] as const;
export type SeoAction = (typeof SEO_ACTIONS)[number];

export const SEO_ACTION_LABELS: Record<SeoAction, string> = {
  start: "شروع کار",
  report: "ثبت گزارش انجام",
  approve: "تأیید",
  return: "برگشت با دلیل",
  cancel: "لغو",
  reopen: "بازگشایی",
};

/**
 * از کدام وضعیت‌ها هر کنش مجاز است.
 *
 * ⚠️ **`report` از `ASSIGNED` هم مجاز است** و این عمدی است: کار کوچکی مثل
 * «ارسال دوباره‌ی سایت‌مپ» ده ثانیه طول می‌کشد و اجبار به زدن «شروع» فقط یک
 * کلیک بی‌معنی می‌سازد. `startedAt` در آن حالت همان زمان ثبت گزارش است.
 */
export const SEO_ALLOWED_FROM: Record<SeoAction, SeoTaskStatus[]> = {
  start: ["ASSIGNED"],
  report: ["ASSIGNED", "IN_PROGRESS"],
  approve: ["AWAITING_APPROVAL"],
  return: ["AWAITING_APPROVAL"],
  cancel: ["ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL"],
  reopen: ["DONE", "CANCELED"],
};

/** وضعیت مقصد هر کنش */
export const SEO_NEXT_STATUS: Record<SeoAction, SeoTaskStatus> = {
  start: "IN_PROGRESS",
  report: "AWAITING_APPROVAL",
  approve: "DONE",
  return: "IN_PROGRESS",
  cancel: "CANCELED",
  reopen: "IN_PROGRESS",
};

/**
 * کنش‌هایی که فقط مدیر (`SEO_TASK_MANAGE`) می‌زند.
 *
 * ⚠️ `cancel` هم اینجاست و عمدی است: کارمندی که کارِ خودش را لغو کند، همان
 * کاری را می‌کند که گزارش عملکرد نباید اجازه‌اش را بدهد — کارِ نکرده از فهرست
 * ناپدید می‌شود بدون اینکه کسی بداند. لغو یعنی «این کار دیگر لازم نیست» و آن
 * قضاوتِ مدیر است. کارمند به‌جایش گزارش می‌دهد که چرا انجام نشد.
 */
export const SEO_MANAGER_ACTIONS: SeoAction[] = ["approve", "return", "cancel", "reopen"];

/** کنش‌هایی که بدون متن معنی ندارند */
export const SEO_ACTIONS_NEEDING_NOTE: SeoAction[] = ["report", "return"];

export function isOpenStatus(status: SeoTaskStatus): boolean {
  return status !== "DONE" && status !== "CANCELED";
}

/**
 * از مهلتش گذشته و هنوز بسته نشده.
 *
 * ⚠️ عمداً اینجاست نه داخل کامپوننت: `Date.now()` در بدنه‌ی رندر یک فراخوانی
 * ناخالص است و قاعده‌ی purity ری‌اکت ردش می‌کند (همان کاری که `isOverdue`
 * کارتابل می‌کند).
 */
export function isSeoOverdue(task: {
  dueAt: string | Date | null;
  status: SeoTaskStatus;
}): boolean {
  if (!task.dueAt) return false;
  if (!isOpenStatus(task.status)) return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

/**
 * آدرس صفحه‌ها یک متن چندخطی است؛ این تابع آن را به آرایه‌ی تمیز تبدیل می‌کند.
 * تکراری‌ها حذف می‌شوند تا شمارش «چند صفحه» دروغ نگوید.
 */
export function parsePageUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const url = line.trim();
    if (url) seen.add(url);
  }
  return [...seen];
}

// ─────────────────────────────────────────────────────────────────
// گردش کار محتوا — بخش ۶ مستندات
// ─────────────────────────────────────────────────────────────────

export const CONTENT_STATUS_LABELS: Record<ContentTaskStatus, string> = {
  ASSIGNED: "واگذارشده",
  WRITING: "در حال نوشتن",
  AWAITING_PUBLISH: "منتظر انتشار",
  PUBLISHING: "در حال انتشار",
  AWAITING_APPROVAL: "منتظر تأیید",
  DONE: "تأیید شد",
  CANCELED: "لغو شد",
};

export const CONTENT_STATUS_COLORS: Record<ContentTaskStatus, string> = {
  ASSIGNED: "text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5",
  WRITING: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  AWAITING_PUBLISH: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10",
  PUBLISHING: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
  AWAITING_APPROVAL: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
  DONE: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
  CANCELED: "text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-500/10",
};

/**
 * برچسب رویدادها در تاریخچه‌ی **کار محتوا**.
 *
 * همان enum مشترک است، ولی «گزارش ثبت شد» در محتوا یعنی ارسال متن به
 * محتواگذار و «تکمیل شد» یعنی انتشار — جمله‌ی عمومی اینجا گمراه می‌کرد.
 */
export const CONTENT_EVENT_LABELS: Record<MarketingEventAction, string> = {
  ...EVENT_LABELS,
  STARTED: "نوشتن شروع شد",
  REPORTED: "متن به محتواگذار رسید",
  PUBLISHING: "انتشار شروع شد",
  SUBMITTED: "انتشار تکمیل شد",
};

export const DESTINATION_LABELS: Record<ContentDestination, string> = {
  BLOG: "مجله‌ی همین فروشگاه",
  EXTERNAL: "سایت بیرونی (مهمان‌نویسی / رپورتاژ)",
};

export const CONTENT_ACTIONS = [
  "start",
  "submit",
  "take",
  "complete",
  "approve",
  "return",
  "cancel",
  "reopen",
] as const;
export type ContentAction = (typeof CONTENT_ACTIONS)[number];

export const CONTENT_ACTION_LABELS: Record<ContentAction, string> = {
  start: "شروع نوشتن",
  submit: "ارسال به محتواگذار",
  take: "در حال انتشار",
  complete: "تکمیل انتشار",
  approve: "تأیید",
  return: "برگشت با دلیل",
  cancel: "لغو",
  reopen: "بازگشایی",
};

export const CONTENT_ALLOWED_FROM: Record<ContentAction, ContentTaskStatus[]> = {
  start: ["ASSIGNED"],
  submit: ["WRITING"],
  take: ["AWAITING_PUBLISH"],
  complete: ["PUBLISHING"],
  approve: ["AWAITING_APPROVAL"],
  // برگشت از هر مرحله‌ای که متن از دست نویسنده بیرون رفته
  return: ["AWAITING_PUBLISH", "PUBLISHING", "AWAITING_APPROVAL"],
  cancel: ["ASSIGNED", "WRITING", "AWAITING_PUBLISH", "PUBLISHING", "AWAITING_APPROVAL"],
  reopen: ["DONE", "CANCELED"],
};

/** کنش‌هایی که فقط مدیر (`CONTENT_TASK_MANAGE`) می‌زند — لغو قضاوتِ مدیر است */
export const CONTENT_MANAGER_ACTIONS: ContentAction[] = ["approve", "cancel", "reopen"];

/**
 * وضعیت‌هایی که یعنی «متن آماده است».
 *
 * گره‌ی لینک‌سازیِ متصل از همین‌جا آزاد می‌شود. ⚠️ منتظر `DONE` ماندن اشتباه
 * است: در مهمان‌نویسی، انتشار **خودِ ساختن لینک** است (بخش ۷.۶).
 */
export const CONTENT_READY_STATUSES: ContentTaskStatus[] = [
  "AWAITING_PUBLISH",
  "PUBLISHING",
  "AWAITING_APPROVAL",
  "DONE",
];

export function isContentOpen(status: ContentTaskStatus): boolean {
  return status !== "DONE" && status !== "CANCELED";
}

export function isContentOverdue(task: {
  dueAt: string | Date | null;
  status: ContentTaskStatus;
}): boolean {
  if (!task.dueAt) return false;
  if (!isContentOpen(task.status)) return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

/**
 * تعداد کلمه‌ی متن HTML. تگ‌ها و فاصله‌ی بی‌معنی حذف می‌شوند.
 *
 * ⚠️ `&nbsp;` و موجودیت‌های HTML هم فاصله حساب می‌شوند، وگرنه متنی که از
 * ورد چسبانده شده یک کلمه‌ی خیلی بلند می‌شود.
 */
export function countWords(html: string | null | undefined): number {
  if (!html) return 0;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
