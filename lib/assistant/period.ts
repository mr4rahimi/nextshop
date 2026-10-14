/**
 * بازه‌ی زمانی ابزارهای گزارش دستیار — docs/plans/admin-assistant.md بخش ۶ (فاز ۳)
 *
 * الگو: `bartar-crm/features/assistant/utils/period-args.ts`. مدل بازه را با یک `period` آماده یا
 * تاریخ شمسی می‌دهد و این‌جا به مرز **روز تهران** تبدیل می‌شود:
 *   - دوره‌ی ناتمام (امروز، این هفته، این ماه) تا همین لحظه بریده می‌شود و `unfinished` دارد؛
 *   - «دوره‌ی قبل» همیشه هم‌طولِ بلافاصله قبل است، پس ۲۲ روز اول مهر با ۲۲ روز پیش از آن
 *     مقایسه می‌شود، نه با کل شهریور.
 * روز = همان «روز کلید» حسابداری (`lib/accounting/dates.ts`): UTC نیمه‌شبِ همان روز شمسی.
 */
import { dayKey, previousRange } from "@/lib/accounting/dates";
import { formatJalali, fromJalali, jalaliMonthName, toJalali } from "@/lib/club/jalali";

const DAY_MS = 86_400_000;
const TEHRAN_OFFSET_MS = 3.5 * 3_600_000;
const MAX_DAYS = 366;

export const PERIOD_VALUES = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "month", "range"] as const;

/** ورودی‌های مشترک بازه — در `parameters` هر ابزار گزارش پخش می‌شود */
export const periodProperties = {
  period: {
    type: "string",
    enum: PERIOD_VALUES,
    description:
      "بازه: today، yesterday، this_week (از شنبه)، last_week، this_month (ماه شمسی جاری)، last_month، " +
      "month (با jYear و jMonth)، range (با from و to). پیش‌فرض this_month. مقایسه با دوره‌ی قبل خودکار در خروجی هست؛ برای آن دوباره صدا نزن.",
  },
  jYear: { type: "integer", description: "سال شمسی برای period=month، مثل 1405" },
  jMonth: { type: "integer", description: "ماه شمسی ۱ تا ۱۲ برای period=month (۷ = مهر)" },
  from: { type: "string", description: "برای period=range: روز شروع شمسی مثل 1405/07/01" },
  to: { type: "string", description: "برای period=range: روز پایان شمسی (شامل) مثل 1405/07/15" },
} as const;

export interface Span {
  /** روز اول و آخر (شامل) — برای گزارش‌های حسابداری */
  fromDay: Date;
  toDay: Date;
  /** لحظه‌ی شروع و پایان (پایان انحصاری) — برای جدول‌های `createdAt` */
  start: Date;
  end: Date;
  label: string;
}

export interface Period extends Span {
  days: number;
  fullDays: number;
  unfinished: boolean;
  previous: Span;
}

const instantOf = (day: Date) => new Date(day.getTime() - TEHRAN_OFFSET_MS);
const addDays = (day: Date, n: number) => new Date(day.getTime() + n * DAY_MS);

const rangeLabel = (from: Date, to: Date) =>
  from.getTime() === to.getTime() ? formatJalali(from) : `${formatJalali(from)} تا ${formatJalali(to)}`;

/** «۱۴۰۵/۰۷/۰۱» یا «1405-7-1» ← روز؛ نامعتبر ← null */
export function parseJalaliDay(value: unknown): Date | null {
  const text = String(value ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const m = /^(1[34]\d\d)\D+(\d{1,2})\D+(\d{1,2})$/.exec(text.trim());
  if (!m) return null;
  return fromJalali(Number(m[1]), Number(m[2]), Number(m[3]));
}

function monthBounds(jy: number, jm: number) {
  const from = fromJalali(jy, jm, 1);
  const next = jm === 12 ? fromJalali(jy + 1, 1, 1) : fromJalali(jy, jm + 1, 1);
  return from && next ? { from, to: addDays(next, -1), label: `${jalaliMonthName(jm)} ${jy.toLocaleString("fa-IR", { useGrouping: false })}` } : null;
}

/** شنبه‌ی هفته‌ی یک روز (getUTCDay شنبه = ۶) */
const saturdayOf = (day: Date) => addDays(day, -((day.getUTCDay() + 1) % 7));

function bounds(args: Record<string, unknown>, today: Date): { from: Date; to: Date; label?: string } | string {
  const { year: jy, month: jm } = toJalali(today);
  switch (args.period ?? "this_month") {
    case "today":
      return { from: today, to: today, label: `امروز (${formatJalali(today)})` };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y, label: `دیروز (${formatJalali(y)})` };
    }
    case "this_week": {
      const s = saturdayOf(today);
      return { from: s, to: addDays(s, 6), label: `این هفته (${rangeLabel(s, today)})` };
    }
    case "last_week": {
      const s = addDays(saturdayOf(today), -7);
      return { from: s, to: addDays(s, 6), label: `هفته‌ی قبل (${rangeLabel(s, addDays(s, 6))})` };
    }
    case "this_month":
      return monthBounds(jy, jm) ?? "ماه جاری معلوم نشد";
    case "last_month":
      return monthBounds(jm === 1 ? jy - 1 : jy, jm === 1 ? 12 : jm - 1) ?? "ماه قبل معلوم نشد";
    case "month": {
      const month = Number(args.jMonth);
      if (!(month >= 1 && month <= 12)) return "برای period=month ماه شمسی ۱ تا ۱۲ (jMonth) لازم است";
      return monthBounds(Number(args.jYear) || jy, month) ?? "ماه نامعتبر است";
    }
    case "range": {
      const from = parseJalaliDay(args.from);
      const to = parseJalaliDay(args.to ?? args.from);
      if (!from || !to) return "برای period=range تاریخ شمسی from و to به شکل 1405/07/01 لازم است";
      return from <= to ? { from, to } : { from: to, to: from };
    }
    default:
      return `period نامعتبر است؛ یکی از ${PERIOD_VALUES.join("، ")}`;
  }
}

/** بازه‌ی حل‌شده، یا متن خطا برای مدل */
export function resolvePeriod(args: Record<string, unknown>, now = new Date()): Period | { error: string } {
  const today = dayKey(now);
  const b = bounds(args, today);
  if (typeof b === "string") return { error: b };
  if (b.from > today) return { error: "این بازه هنوز نرسیده است" };

  const fullDays = Math.round((b.to.getTime() - b.from.getTime()) / DAY_MS) + 1;
  if (fullDays > MAX_DAYS) return { error: `بازه حداکثر ${MAX_DAYS} روز است` };

  const unfinished = b.to >= today;
  const toDay = unfinished ? today : b.to;
  const start = instantOf(b.from);
  const end = unfinished ? now : instantOf(addDays(b.to, 1));
  const days = Math.round((toDay.getTime() - b.from.getTime()) / DAY_MS) + 1;

  // هم‌طولِ بلافاصله قبل — به لحظه، تا امروزِ ناتمام با همان چند ساعتِ دیروز مقایسه شود
  const span = end.getTime() - start.getTime();
  const prevDays = previousRange(b.from, toDay);
  const previous: Span = {
    fromDay: prevDays.from,
    toDay: prevDays.to,
    start: new Date(start.getTime() - span),
    end: start,
    label: rangeLabel(prevDays.from, prevDays.to),
  };

  return {
    fromDay: b.from,
    toDay,
    start,
    end,
    label: b.label ?? rangeLabel(b.from, b.to),
    days,
    fullDays,
    unfinished,
    previous,
  };
}

/** شرح بازه برای خروجی ابزار — مدل باید بداند دوره ناتمام است و با چه مقایسه شده */
export function periodInfo(p: Period) {
  return {
    label: p.label,
    days: p.days,
    unfinished: p.unfinished,
    ...(p.unfinished && p.fullDays > 1
      ? { note: `دوره هنوز تمام نشده؛ ${p.days} روز از ${p.fullDays} روز تا همین لحظه حساب شده` }
      : {}),
    comparedWith: `${p.previous.label} (دوره‌ی هم‌طولِ درست قبل)`,
  };
}

/** درصد تغییر آماده — مدل درصدی را که در خروجی نیست خودش حساب نمی‌کند (بخش ۶) */
export function change(current: number, previous: number): string | null {
  if (previous === 0) return current === 0 ? "بدون تغییر" : null;
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  return `${pct > 0 ? "+" : ""}${pct.toLocaleString("fa-IR")}٪`;
}

/**
 * هشدار شروع داده: اگر بازه پیش از اولین داده‌ی این منبع باشد، «صفر» افت نیست.
 * `since` = اولین ردیف منبع (یا روز نصب قابلیت).
 */
export function dataWarnings(p: Period, since: Date | null, what: string): string[] {
  if (!since) return [`هنوز هیچ داده‌ای برای ${what} ثبت نشده است`];
  const out: string[] = [];
  if (p.start < since) out.push(`داده‌ی ${what} از ${formatJalali(since)} ثبت می‌شود؛ بخشی از این بازه پیش از آن است و صفر بودنش به معنی افت نیست`);
  if (p.previous.start < since && p.start >= since)
    out.push(`دوره‌ی قبل (${p.previous.label}) پیش از شروع داده‌ی ${what} است؛ درصد تغییر معتبر نیست`);
  return out;
}
