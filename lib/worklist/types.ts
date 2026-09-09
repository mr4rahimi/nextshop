/**
 * برچسب‌ها و ثابت‌های مشترک کارتابل.
 *
 * بدون `use client` نگه داشته می‌شود تا هم مسیرهای API و هم کامپوننت‌های
 * کلاینت از آن استفاده کنند — همان قراردادی که `lib/reports.ts` دارد.
 *
 * مستندات: docs/features/staff-worklist.md
 */

import type {
  StaffDomain,
  StaffChannel,
  StaffTaskSource,
  StaffTaskStatus,
  StaffPriority,
} from "@prisma/client";

export type {
  StaffDomain,
  StaffChannel,
  StaffTaskSource,
  StaffTaskStatus,
  StaffPriority,
};

export const DOMAIN_LABELS: Record<StaffDomain, string> = {
  SALES: "فروش",
  FINANCE: "مالی",
  PROCUREMENT: "تأمین و خرید",
  FULFILLMENT: "ارسال",
  CATALOG: "کاتالوگ و قیمت",
  CONTENT: "محتوا و بازاریابی",
  SUPPORT: "پشتیبانی",
  INTERNAL: "داخلی",
};

/** رنگ هر دامنه — کلاس‌های Tailwind کامل نوشته می‌شوند تا purge حذفشان نکند */
export const DOMAIN_COLORS: Record<StaffDomain, string> = {
  SALES: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  FINANCE: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
  PROCUREMENT: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
  FULFILLMENT: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10",
  CATALOG: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10",
  CONTENT: "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10",
  SUPPORT: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10",
  INTERNAL: "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/10",
};

export const CHANNEL_LABELS: Record<StaffChannel, string> = {
  NONE: "بدون کانال",
  CALL_IN: "تماس ورودی",
  CALL_OUT: "تماس خروجی",
  SMS: "پیامک",
  MESSENGER: "پیام‌رسان",
  EMAIL: "ایمیل",
  IN_PERSON: "حضوری",
  ONLINE: "آنلاین",
};

export const SOURCE_LABELS: Record<StaffTaskSource, string> = {
  MANUAL: "ثبت دستی",
  RECURRING: "تکرارشونده",
  ASSIGNED: "ارجاع‌شده",
  SYSTEM: "خودکار",
};

export const STATUS_LABELS: Record<StaffTaskStatus, string> = {
  OPEN: "باز",
  IN_PROGRESS: "در حال انجام",
  DONE: "انجام شد",
  CANCELED: "لغو شد",
};

export const STATUS_COLORS: Record<StaffTaskStatus, string> = {
  OPEN: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
  IN_PROGRESS: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  DONE: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
  CANCELED: "text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-500/10",
};

export const PRIORITY_LABELS: Record<StaffPriority, string> = {
  LOW: "کم",
  NORMAL: "عادی",
  HIGH: "زیاد",
  URGENT: "فوری",
};

export const PRIORITY_COLORS: Record<StaffPriority, string> = {
  LOW: "text-gray-500 dark:text-gray-500",
  NORMAL: "text-gray-600 dark:text-gray-400",
  HIGH: "text-orange-600 dark:text-orange-400",
  URGENT: "text-red-600 dark:text-red-400",
};

/** باربری‌هایی که مهام‌پرینت با آن‌ها کار می‌کند — فهرست باز است، متن آزاد هم پذیرفته می‌شود */
export const CARRIERS = ["تیپاکس", "چاپار", "بار هوایی", "ترمینال", "پست", "پیک موتوری"];

/** یک نتیجه‌ی آماده، همان‌طور که در `StaffTaskType.outcomes` ذخیره می‌شود */
export interface TaskOutcome {
  value: string;
  label: string;
  isSuccess?: boolean;
}

/** `outcomes` از دیتابیس Json است؛ این تابع آن را با احتیاط می‌خواند */
export function parseOutcomes(raw: unknown): TaskOutcome[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((o) => {
    if (!o || typeof o !== "object") return [];
    const { value, label, isSuccess } = o as Record<string, unknown>;
    if (typeof value !== "string" || typeof label !== "string") return [];
    return [{ value, label, isSuccess: isSuccess === true }];
  });
}

/** برچسب فارسی یک نتیجه — اگر نوع عوض شده و مقدار قدیمی مانده، خودِ مقدار برمی‌گردد */
export function outcomeLabel(outcomes: TaskOutcome[], value: string | null): string | null {
  if (!value) return null;
  return outcomes.find((o) => o.value === value)?.label ?? value;
}

// ─────────────────────────────────────────────────────────────────
// تاریخ و زمان
// ─────────────────────────────────────────────────────────────────

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** آیا این کار از مهلتش گذشته و هنوز بسته نشده */
export function isOverdue(task: { dueAt: string | Date | null; status: StaffTaskStatus }): boolean {
  if (!task.dueAt) return false;
  if (task.status === "DONE" || task.status === "CANCELED") return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("fa-IR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

/** مهلت به زبان آدم: «۲ ساعت مانده» یا «۳ ساعت گذشته» */
export function dueLabel(dueAt: string | Date | null | undefined): string | null {
  if (!dueAt) return null;
  const diffMin = Math.round((new Date(dueAt).getTime() - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  const unit =
    abs < 60
      ? `${abs} دقیقه`
      : abs < 1440
        ? `${Math.round(abs / 60)} ساعت`
        : `${Math.round(abs / 1440)} روز`;
  return diffMin >= 0 ? `${unit} مانده` : `${unit} گذشته`;
}

/** «۷ ساعت و ۲۵ دقیقه» — عدد خام دقیقه در گزارش حضور خوانده نمی‌شود */
export function formatMinutes(min: number): string {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} دقیقه`;
  if (m === 0) return `${h} ساعت`;
  return `${h} ساعت و ${m} دقیقه`;
}

/** «۷:۲۵» — شکل فشرده برای خانه‌ی تقویم */
export function formatHoursShort(min: number): string {
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * ساعت به وقت تهران — «۰۹:۱۵».
 *
 * ⚠️ `formatTime` منطقه‌ی زمانیِ خودِ مرورگر را می‌گیرد. برای گزارش حضور این
 * کافی نیست: مرزِ روز سمت سرور تهران است و اگر کارمندی مرورگرش روی UTC باشد،
 * ساعتِ ورودش سه‌ونیم ساعت جابه‌جا دیده می‌شود.
 */
export function formatTimeTehran(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tehran",
    });
  } catch {
    return String(value);
  }
}
