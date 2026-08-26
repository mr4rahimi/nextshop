/**
 * ابزارهای مشترک گزارش عملکرد.
 *
 * بدون `use client` نگه داشته می‌شود تا هم مسیرهای API و هم کامپوننت‌های
 * سرور بتوانند از آن استفاده کنند.
 */

export type RangePreset = "7d" | "30d" | "90d" | "month" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

/** بازه‌ی درخواستی را از پارامترهای کوئری می‌سازد (پیش‌فرض: ۳۰ روز اخیر) */
export function parseRange(params: URLSearchParams): DateRange {
  const now = new Date();
  const to = params.get("to") ? new Date(params.get("to")!) : now;
  const preset = params.get("preset") ?? "30d";

  if (params.get("from")) {
    return { from: startOfDay(new Date(params.get("from")!)), to: endOfDay(to) };
  }

  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  if (preset === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return { from: startOfDay(from), to: endOfDay(to) };
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** کلید روز به‌صورت YYYY-MM-DD در وقت محلی سرور */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** همه‌ی روزهای بازه — تا نمودار روزهای خالی را هم نشان دهد، نه اینکه بپرد */
export function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  const cur = startOfDay(range.from);
  const last = startOfDay(range.to);
  while (cur <= last) {
    out.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** برچسب فارسی هر نوع فعالیت */
export const ACTION_LABELS: Record<string, string> = {
  CREATE: "ایجاد",
  UPDATE: "ویرایش",
  DELETE: "حذف",
  BULK_UPDATE: "ویرایش گروهی",
  UPLOAD: "آپلود",
  LOGIN: "ورود",
};

/** برچسب فارسی هر نوع موجودیت */
export const ENTITY_LABELS: Record<string, string> = {
  PRODUCT: "محصول",
  CATEGORY: "دسته‌بندی",
  BRAND: "برند",
  MEDIA: "رسانه",
  WIDGET: "ویجت",
  PAGE: "برگه",
  ORDER: "سفارش",
  STORY: "استوری",
  HERO_SLIDE: "اسلاید",
  BLOG: "بلاگ",
  USER: "کاربر",
  SETTINGS: "تنظیمات",
  OTHER: "سایر",
};
