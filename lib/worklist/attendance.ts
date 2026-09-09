/**
 * حضور — تبدیل ورود و خروجِ پنل به ساعتِ حضور روزانه.
 *
 * دستگاه حضور و غیاب وجود ندارد؛ مبنا ورود به پنل ادمین است، چون هر کارمند
 * کامپیوتر و حساب جدا دارد. مستندات: docs/features/staff-worklist.md بخش ۱۱
 *
 * سه قاعده‌ای که این فایل رویشان ایستاده است:
 *
 * **۱. خام جدا از تجمیع‌شده.** `StaffWorkSession` هرگز اصلاح نمی‌شود.
 * `StaffWorkDay` هر بار از نو ساخته می‌شود. وقتی عددِ یک ماه مشکوک است، تنها
 * راه بررسی، برگشتن به نشستِ خام است.
 *
 * **۲. بازه‌ها ادغام می‌شوند، جمع نمی‌شوند.** دو تب یا دو دستگاهِ باز یعنی دو
 * نشستِ هم‌پوشان. جمع‌زدنشان ساعت حضور را دو برابر می‌کند و این رایج‌ترین باگِ
 * این نوع گزارش است.
 *
 * **۳. این عدد «حضور در سیستم» است نه «ساعت کار».** هیچ‌جای این فایل سعی
 * نمی‌کند «بی‌کاری» را تشخیص دهد؛ کارمندی که یک ساعت پای تلفن است هم حاضر
 * است. تنها چیزی که کسر می‌شود، فاصله‌ی بینِ نشست‌هاست.
 */

import { prisma } from "@/lib/prisma";
import type { StaffSessionEnd } from "@prisma/client";
import { toJalali, fromJalali, jalaliMonthLength } from "@/lib/club/jalali";

// برچسب‌ها در `types.ts` می‌مانند تا کامپوننت کلاینت بتواند بدون کشیدنِ
// prisma به بسته‌ی مرورگر از همان قالب‌بندی استفاده کند.
export { formatMinutes } from "./types";

/**
 * ایران از ۱۴۰۱ ساعت تابستانی ندارد، پس اختلاف ثابت است.
 *
 * ⚠️ همین عدد مرزِ روز را تعیین می‌کند. اگر جایی روز را با
 * `setHours(0,0,0,0)` سرور حساب کنیم، روی سروری که ساعتش UTC است مرزِ روز
 * سه‌ونیم ساعت جابه‌جا می‌شود و آمار شبِ کارکنان به روز بعد می‌افتد.
 */
const TEHRAN_OFFSET_MS = 210 * 60_000;
const DAY_MS = 86_400_000;

/** ضربان هر پنج دقیقه می‌آید؛ سه ضربانِ ازدست‌رفته یعنی مرورگر بسته شده */
export const HEARTBEAT_MS = 5 * 60_000;
const STALE_MS = 15 * 60_000;

/** سقف پیش‌فرض روزانه وقتی `StoreSettings` هنوز ساخته نشده — ده ساعت */
const DEFAULT_CAP_MIN = 600;

// ─────────────────────────────────────────────────────────────────
// مرز روز — همیشه شمسی، همیشه به وقت تهران
// ─────────────────────────────────────────────────────────────────

/**
 * کلیدِ روزِ یک لحظه: نیمه‌شبِ UTC همان روزِ شمسی.
 *
 * همان قراردادی که `fromJalali` برمی‌گرداند، تا `StaffWorkDay.day` و خروجی
 * تقویم هرگز یک روز با هم اختلاف پیدا نکنند.
 */
export function dayKeyOf(at: Date): Date {
  return new Date(Math.floor((at.getTime() + TEHRAN_OFFSET_MS) / DAY_MS) * DAY_MS);
}

/** بازه‌ی واقعیِ یک روزِ شمسی: از نیمه‌شب تهران تا نیمه‌شب بعدی */
export function dayBounds(day: Date): { start: Date; end: Date } {
  const base = Math.floor(day.getTime() / DAY_MS) * DAY_MS - TEHRAN_OFFSET_MS;
  return { start: new Date(base), end: new Date(base + DAY_MS) };
}

/** روزهای یک ماه شمسی، به ترتیب — برای ساخت تقویم و بازسازی ماه */
export function jalaliMonthDays(year: number, month: number): Date[] {
  const len = jalaliMonthLength(year, month);
  const first = fromJalali(year, month, 1);
  if (!first) return [];
  return Array.from({ length: len }, (_, i) => new Date(first.getTime() + i * DAY_MS));
}

// ─────────────────────────────────────────────────────────────────
// ادغام بازه — قلبِ درستیِ این گزارش
// ─────────────────────────────────────────────────────────────────

export interface Interval {
  start: number;
  end: number;
}

/**
 * بازه‌های هم‌پوشان را یکی می‌کند.
 *
 * ⚠️ بازه‌های چسبیده (`end === start` بعدی) هم ادغام می‌شوند، وگرنه نشستی که
 * دقیقاً سرِ نیمه‌شب بریده شده دو ردیف می‌ماند.
 */
export function mergeIntervals(list: Interval[]): Interval[] {
  if (list.length === 0) return [];
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// گیتِ قابلیت
// ─────────────────────────────────────────────────────────────────

let gateCache: { at: number; enabled: boolean; capMin: number } | null = null;
const GATE_TTL_MS = 60_000;

/**
 * `worklistEnabled` و سقف روزانه، با کشِ یک‌دقیقه‌ای.
 *
 * ضربان هر پنج دقیقه از هر تبِ باز می‌آید؛ بدون کش، هر ضربان یک کوئری اضافه
 * روی `StoreSettings` می‌زد که هیچ‌وقت تغییر نمی‌کند.
 */
export async function attendanceGate(): Promise<{ enabled: boolean; capMin: number }> {
  const now = Date.now();
  if (gateCache && now - gateCache.at < GATE_TTL_MS) {
    return { enabled: gateCache.enabled, capMin: gateCache.capMin };
  }
  try {
    const s = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { worklistEnabled: true, worklistDailyCapMin: true },
    });
    const enabled = s?.worklistEnabled ?? false;
    const capMin = s?.worklistDailyCapMin ?? DEFAULT_CAP_MIN;
    gateCache = { at: now, enabled, capMin };
    return { enabled, capMin };
  } catch {
    // دیتابیس در دسترس نیست: حضور خاموش می‌ماند، ولی مسیر اصلی نمی‌شکند
    return { enabled: false, capMin: DEFAULT_CAP_MIN };
  }
}

/** بعد از تغییر تنظیمات، تا یک دقیقه صبر نکنیم */
export function clearAttendanceGateCache(): void {
  gateCache = null;
}

// ─────────────────────────────────────────────────────────────────
// چرخه‌ی نشست
// ─────────────────────────────────────────────────────────────────

export interface SessionContext {
  ip?: string | null;
  userAgent?: string | null;
}

/** آی‌پی و مرورگر از هدرها — فقط برای وقتی که عددی مشکوک شد و باید ردیابی شود */
export function sessionContextFrom(req: Request): SessionContext {
  const h = req.headers;
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: (forwarded ? forwarded.split(",")[0] : h.get("x-real-ip"))?.trim() || null,
    userAgent: h.get("user-agent")?.slice(0, 250) || null,
  };
}

/**
 * ورود موفق: نشست تازه.
 *
 * ⚠️ هرگز throw نمی‌کند. حضور یک قابلیت جانبی است و نباید ورود به پنل را
 * بشکند — همان قاعده‌ی `logActivity`.
 */
export async function startWorkSession(
  userId: string,
  ctx: SessionContext = {},
): Promise<void> {
  try {
    const { enabled } = await attendanceGate();
    if (!enabled) return;

    // نشستِ جامانده‌ی همین کاربر را اول ببند، وگرنه ورودِ فردا با نشستِ دیروز
    // یک بازه‌ی چهل‌ساعته می‌سازد.
    await closeStaleSessions(userId);

    await prisma.staffWorkSession.create({
      data: { userId, ip: ctx.ip ?? null, userAgent: ctx.userAgent ?? null },
    });
  } catch (e) {
    console.error("[worklist] ساخت نشست حضور شکست خورد:", e);
  }
}

/**
 * ضربان — تازه‌کردن `lastSeenAt`.
 *
 * اگر هیچ نشستِ زنده‌ای نباشد خودش یکی می‌سازد. این عمدی است: کاربری که با
 * کوکی قدیمی وارد است هیچ‌وقت از مسیر ورود رد نمی‌شود، و بدون این، حضورش
 * هرگز ثبت نمی‌شد.
 */
export async function recordHeartbeat(
  userId: string,
  ctx: SessionContext = {},
): Promise<{ recorded: boolean }> {
  const { enabled } = await attendanceGate();
  if (!enabled) return { recorded: false };

  const now = new Date();
  const fresh = new Date(now.getTime() - STALE_MS);

  // چند تب باز یعنی چند ضربان روی همان نشست‌ها؛ به‌روزرسانی idempotent است.
  const touched = await prisma.staffWorkSession.updateMany({
    where: { userId, endedAt: null, lastSeenAt: { gte: fresh } },
    data: { lastSeenAt: now },
  });

  if (touched.count === 0) {
    await closeStaleSessions(userId);
    await prisma.staffWorkSession.create({
      data: { userId, ip: ctx.ip ?? null, userAgent: ctx.userAgent ?? null },
    });
  }

  return { recorded: true };
}

/**
 * خروج — بستن نشست‌های باز.
 *
 * همه‌ی نشست‌های باز بسته می‌شوند نه فقط آخری. اگر دستگاه دیگری هنوز باز باشد،
 * ضربان بعدی‌اش نشست تازه می‌سازد و بازه‌ی حضور پیوسته می‌ماند.
 */
export async function endWorkSession(
  userId: string,
  reason: StaffSessionEnd = "LOGOUT",
): Promise<void> {
  try {
    const { enabled } = await attendanceGate();
    if (!enabled) return;

    await prisma.staffWorkSession.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: new Date(), endReason: reason },
    });
  } catch (e) {
    console.error("[worklist] بستن نشست حضور شکست خورد:", e);
  }
}

/**
 * نشستی که ضربانش قطع شده با `endedAt = lastSeenAt` بسته می‌شود.
 *
 * ⚠️ `endedAt` لحظه‌ی الان نیست. مرورگر معمولاً بدون خروج بسته می‌شود؛ اگر
 * لحظه‌ی الان را بنویسیم، کارمندی که جمعه یادش رفت خروج بزند شنبه صبح چهل
 * ساعت کار کرده به نظر می‌رسد.
 */
export async function closeStaleSessions(userId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await prisma.staffWorkSession.findMany({
    where: { endedAt: null, lastSeenAt: { lt: cutoff }, ...(userId ? { userId } : {}) },
    select: { id: true, lastSeenAt: true },
    take: 500,
  });

  for (const s of stale) {
    await prisma.staffWorkSession.update({
      where: { id: s.id },
      data: { endedAt: s.lastSeenAt, endReason: "TIMEOUT" },
    });
  }
  return stale.length;
}

// ─────────────────────────────────────────────────────────────────
// تجمیع روزانه
// ─────────────────────────────────────────────────────────────────

export interface DayTotals {
  firstIn: Date;
  lastOut: Date;
  activeMin: number;
  grossMin: number;
  capped: boolean;
}

/**
 * محاسبه‌ی یک روز از روی نشست‌های خام — بدون دست‌زدن به دیتابیس.
 *
 * نشست‌های باز با `lastSeenAt` بسته حساب می‌شوند نه با «الان»: تا وقتی ضربان
 * نیامده، نمی‌دانیم کارمند هنوز پشت سیستم است.
 */
export function computeDayTotals(
  sessions: { startedAt: Date; endedAt: Date | null; lastSeenAt: Date }[],
  day: Date,
  capMin: number,
): DayTotals | null {
  const { start, end } = dayBounds(day);
  const lo = start.getTime();
  const hi = end.getTime();

  const clipped: Interval[] = [];
  for (const s of sessions) {
    const a = Math.max(s.startedAt.getTime(), lo);
    const b = Math.min((s.endedAt ?? s.lastSeenAt).getTime(), hi);
    if (b > a) clipped.push({ start: a, end: b });
  }
  if (clipped.length === 0) return null;

  const merged = mergeIntervals(clipped);
  const activeMs = merged.reduce((sum, i) => sum + (i.end - i.start), 0);
  const firstIn = merged[0].start;
  const lastOut = merged[merged.length - 1].end;

  const rawActive = Math.round(activeMs / 60_000);
  const capped = rawActive > capMin;

  return {
    firstIn: new Date(firstIn),
    lastOut: new Date(lastOut),
    activeMin: capped ? capMin : rawActive,
    grossMin: Math.round((lastOut - firstIn) / 60_000),
    capped,
  };
}

/**
 * بازسازی یک روزِ یک کارمند.
 *
 * ⚠️ روزی که مدیر اصلاحش کرده بازسازی نمی‌شود، مگر `force` بیاید. بدون این،
 * چرخه‌ی بعدیِ زمان‌بند اصلاح دستی را بی‌صدا پاک می‌کرد و مدیر دفعه‌ی دوم
 * دیگر اصلاح نمی‌کرد.
 */
export async function aggregateDay(
  userId: string,
  day: Date,
  opts: { capMin?: number; force?: boolean } = {},
): Promise<void> {
  const capMin = opts.capMin ?? (await attendanceGate()).capMin;
  const { start, end } = dayBounds(day);

  const existing = await prisma.staffWorkDay.findUnique({
    where: { userId_day: { userId, day } },
    select: { id: true, editedById: true },
  });
  if (existing?.editedById && !opts.force) return;

  const sessions = await prisma.staffWorkSession.findMany({
    where: {
      userId,
      startedAt: { lt: end },
      OR: [{ endedAt: null }, { endedAt: { gt: start } }],
    },
    select: { startedAt: true, endedAt: true, lastSeenAt: true },
  });

  const totals = computeDayTotals(sessions, day, capMin);

  if (!totals) {
    // نشستی نمانده (مثلاً همه دستی حذف شدند) — ردیفِ بی‌پشتوانه نگه نداریم
    if (existing) await prisma.staffWorkDay.delete({ where: { id: existing.id } });
    return;
  }

  await prisma.staffWorkDay.upsert({
    where: { userId_day: { userId, day } },
    create: {
      userId,
      day,
      firstIn: totals.firstIn,
      lastOut: totals.lastOut,
      activeMin: totals.activeMin,
      grossMin: totals.grossMin,
    },
    update: {
      firstIn: totals.firstIn,
      lastOut: totals.lastOut,
      activeMin: totals.activeMin,
      grossMin: totals.grossMin,
      // اصلاح دستیِ قبلی با `force` کنار می‌رود؛ رد پایش هم پاک می‌شود
      editedById: null,
      editedByName: null,
      editedAt: null,
    },
  });
}

/**
 * بازسازی روزهای اخیر برای همه — کارِ هر چرخه‌ی زمان‌بند.
 *
 * دو روز عقب می‌رود چون نشستی که شب شروع شده بعد از نیمه‌شب هم ادامه دارد و
 * روزِ دیروز تا بسته‌نشدنِ آن نشست کامل نیست.
 */
export async function aggregateRecentDays(days = 2): Promise<number> {
  const { capMin } = await attendanceGate();
  const today = dayKeyOf(new Date());
  const targets = Array.from({ length: days }, (_, i) => new Date(today.getTime() - i * DAY_MS));

  const oldest = dayBounds(targets[targets.length - 1]).start;
  const actors = await prisma.staffWorkSession.findMany({
    where: { OR: [{ endedAt: null }, { endedAt: { gte: oldest } }] },
    select: { userId: true },
    distinct: ["userId"],
  });

  let count = 0;
  for (const { userId } of actors) {
    for (const day of targets) {
      await aggregateDay(userId, day, { capMin });
      count++;
    }
  }
  return count;
}

/** بازسازی یک ماه کامل برای یک کارمند — پشتِ دکمه‌ی «بازسازی» در پنل */
export async function aggregateMonth(
  userId: string,
  year: number,
  month: number,
): Promise<number> {
  const { capMin } = await attendanceGate();
  const days = jalaliMonthDays(year, month);
  for (const day of days) await aggregateDay(userId, day, { capMin });
  return days.length;
}

// ─────────────────────────────────────────────────────────────────
// خواندن برای گزارش
// ─────────────────────────────────────────────────────────────────

export interface AttendanceDay {
  /** «1405-05-02» — کلید یکتا برای تطبیق با خانه‌های تقویم */
  key: string;
  day: string;
  jy: number;
  jm: number;
  jd: number;
  /** شنبه = ۰، مطابق تقویم ایران */
  weekday: number;
  firstIn: string | null;
  lastOut: string | null;
  activeMin: number;
  grossMin: number;
  note: string | null;
  editedByName: string | null;
  editedAt: string | null;
  isFuture: boolean;
}

export function jalaliKey(day: Date): string {
  const { year, month, day: d } = toJalali(day);
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** شنبه = ۰ — `getUTCDay` شنبه را ۶ می‌دهد */
export function iranWeekday(day: Date): number {
  return (day.getUTCDay() + 1) % 7;
}

/**
 * تقویم یک ماهِ یک کارمند: همه‌ی روزهای ماه، حتی روزهای بدون حضور.
 *
 * خانه‌ی خالی هم اطلاعات است — مدیر باید غیبت را ببیند، نه اینکه ردیف نباشد.
 */
export async function getMonthAttendance(
  userId: string,
  year: number,
  month: number,
): Promise<{ days: AttendanceDay[]; totals: { activeMin: number; presentDays: number } }> {
  const days = jalaliMonthDays(year, month);
  if (days.length === 0) return { days: [], totals: { activeMin: 0, presentDays: 0 } };

  const rows = await prisma.staffWorkDay.findMany({
    where: { userId, day: { gte: days[0], lte: days[days.length - 1] } },
    select: {
      day: true,
      firstIn: true,
      lastOut: true,
      activeMin: true,
      grossMin: true,
      note: true,
      editedByName: true,
      editedAt: true,
    },
  });

  const byKey = new Map(rows.map((r) => [jalaliKey(r.day), r]));
  const todayKey = jalaliKey(dayKeyOf(new Date()));

  const out: AttendanceDay[] = days.map((day) => {
    const key = jalaliKey(day);
    const j = toJalali(day);
    const row = byKey.get(key);
    return {
      key,
      day: day.toISOString(),
      jy: j.year,
      jm: j.month,
      jd: j.day,
      weekday: iranWeekday(day),
      firstIn: row?.firstIn.toISOString() ?? null,
      lastOut: row?.lastOut.toISOString() ?? null,
      activeMin: row?.activeMin ?? 0,
      grossMin: row?.grossMin ?? 0,
      note: row?.note ?? null,
      editedByName: row?.editedByName ?? null,
      editedAt: row?.editedAt?.toISOString() ?? null,
      isFuture: key > todayKey,
    };
  });

  return {
    days: out,
    totals: {
      activeMin: out.reduce((s, d) => s + d.activeMin, 0),
      presentDays: out.filter((d) => d.activeMin > 0).length,
    },
  };
}

/** جمعِ ماهِ همه‌ی کارکنان — سطر بالای صفحه‌ی حضور */
export async function getMonthSummary(
  year: number,
  month: number,
): Promise<Map<string, { activeMin: number; presentDays: number }>> {
  const days = jalaliMonthDays(year, month);
  const out = new Map<string, { activeMin: number; presentDays: number }>();
  if (days.length === 0) return out;

  const grouped = await prisma.staffWorkDay.groupBy({
    by: ["userId"],
    where: { day: { gte: days[0], lte: days[days.length - 1] }, activeMin: { gt: 0 } },
    _sum: { activeMin: true },
    _count: { _all: true },
  });

  for (const g of grouped) {
    out.set(g.userId, { activeMin: g._sum.activeMin ?? 0, presentDays: g._count._all });
  }
  return out;
}
