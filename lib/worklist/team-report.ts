import { prisma } from "@/lib/prisma";
import { eachDay, dayKey, startOfDay, type DateRange } from "@/lib/reports";
import { countSystemWork } from "@/lib/worklist/system-map";
import {
  DOMAIN_LABELS, CHANNEL_LABELS, PRIORITY_LABELS, SOURCE_LABELS, parseOutcomes,
} from "@/lib/worklist/types";
import type { Prisma, StaffDomain, StaffChannel, StaffPriority, StaffTaskSource } from "@prisma/client";

/**
 * گزارش عملکرد تیم — فاز ۶، بخش ۱۴ مستندات.
 *
 * ⚠️ **`ActivityLog` در `StaffTask` کپی نمی‌شود.** ادغام همین‌جا در لایه‌ی
 * خواندن انجام می‌شود (بخش ۹): کار دستی از `StaffTask` و کار خودکار از
 * `countSystemWork` می‌آید و کنار هم نشان داده می‌شوند، **نه جمع‌شده**. جمع‌زدن
 * این دو یعنی ثبت محصولی که هم `ActivityLog` دارد هم کارِ سیستمی، دو بار
 * شمرده شود.
 *
 * مبنای زمان هر معیار عمداً فرق دارد و در `docs` توضیح داده شده:
 *  - حجم کار، به‌موقع، موفقیت، زمان بستن: `doneAt` — کاری که در این بازه **بسته** شده
 *  - مستندسازی و نرخ ثبت نتیجه: `createdAt` — کاری که در این بازه **ثبت** شده
 *  - عقب‌افتاده: وضعیت **همین حالا**، نه در بازه
 *  - فروش و سود: `StaffDeal.occurredAt`، معامله‌ی باطل‌شده بیرون
 *
 * ⚠️ `ownerId` فقط نمودارها و کارت‌ها را ریز می‌کند؛ **جدول کارکنان همیشه کل
 * تیم است** تا کارمندِ انتخاب‌شده کنار بقیه دیده شود (رادار «او در برابر تیم»
 * بدون همین بی‌معنی است).
 *
 * روت `/api/admin/worklist/summary` و ابزار `report_team` دستیار هر دو همین را صدا می‌زنند.
 */

/** بیشتر از این یعنی نمودار خوانا نیست؛ بقیه در «سایر» جمع می‌شوند */
const TOP_N = 8;

const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

const DOMAIN_HEX: Record<StaffDomain, string> = {
  SALES: "#3b82f6",
  FINANCE: "#10b981",
  PROCUREMENT: "#f59e0b",
  FULFILLMENT: "#8b5cf6",
  CATALOG: "#06b6d4",
  CONTENT: "#ec4899",
  SUPPORT: "#f97316",
  INTERNAL: "#94a3b8",
};

const PRIORITY_HEX: Record<StaffPriority, string> = {
  LOW: "#94a3b8", NORMAL: "#6366f1", HIGH: "#f97316", URGENT: "#ef4444",
};

const CALL_CHANNELS: StaffChannel[] = ["CALL_IN", "CALL_OUT"];

/** سطل‌های «از ثبت تا بستن» — بر حسب دقیقه */
const CLOSE_BUCKETS: { label: string; max: number }[] = [
  { label: "کمتر از ۱ ساعت", max: 60 },
  { label: "۱ تا ۴ ساعت", max: 240 },
  { label: "۴ تا ۲۴ ساعت", max: 1440 },
  { label: "۱ تا ۳ روز", max: 4320 },
  { label: "۳ تا ۷ روز", max: 10080 },
  { label: "بیش از ۷ روز", max: Infinity },
];

// روز هفته و ساعت به وقت تهران — سرور ممکن است UTC باشد
const tehranClock = new Intl.DateTimeFormat("en-US", {
  weekday: "short", hour: "numeric", hour12: false, timeZone: "Asia/Tehran",
});
/** شنبه = ۰، مطابق تقویم ایران */
const WEEKDAY_INDEX: Record<string, number> = { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 };

function tehranSlot(d: Date): { wd: number; hour: number } {
  const p = tehranClock.formatToParts(d);
  const wd = WEEKDAY_INDEX[p.find((x) => x.type === "weekday")?.value ?? "Sat"] ?? 0;
  const hour = Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24;
  return { wd, hour };
}

function median(list: number[]): number | null {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

export interface StaffReportRow {
  userId: string;
  name: string;
  done: number;
  created: number;
  withOutcome: number;
  documented: number;
  overdue: number;
  system: number;
  /** بسته‌شده‌های مهلت‌دار و آن‌هایی که تا مهلت بسته شدند */
  onTime: number;
  withDue: number;
  /** بسته‌شده‌های نتیجه‌دار و آن‌هایی که نتیجه‌ی موفق دارند */
  success: number;
  rated: number;
  /** میانه‌ی دقیقه از ثبت تا بستن */
  closeMin: number | null;
  calls: number;
  referralsOut: number;
  referralsIn: number;
  notes: number;
  activeMin: number;
  presentDays: number;
  deals: number;
  revenue: number;
  profit: number;
  /** بسته‌شده‌ی روزانه — اسپارک‌لاین ردیف */
  spark: number[];
  byDomain: Partial<Record<StaffDomain, number>>;
}

/** `ownerId` اختیاری — «چرا عدد او این است» با همین باز می‌شود */
export async function teamReport(range: DateRange, ownerId: string | null = null) {
  const inRange = { gte: range.from, lte: range.to };
  // دوره‌ی قبلِ هم‌طول — برای فلش‌های «نسبت به قبل»
  const span = range.to.getTime() - range.from.getTime();
  const prevRange = { gte: new Date(range.from.getTime() - span - 1), lt: range.from };
  const prevOwner: Prisma.StaffTaskWhereInput = ownerId ? { ownerId } : {};

  const [
    done, created, overdue, notes, referrals, types, staff, workDays, deals,
    prevDone, prevCreated, prevDeals,
  ] = await Promise.all([
    // بسته‌شده در بازه
    prisma.staffTask.findMany({
      where: { status: "DONE", doneAt: inRange },
      select: {
        id: true, domain: true, typeId: true, outcome: true, channel: true, priority: true, source: true,
        ownerId: true, ownerName: true, doneAt: true, dueAt: true, createdAt: true,
      },
    }),
    // ثبت‌شده در بازه — مخرجِ «نرخ ثبت نتیجه»
    prisma.staffTask.findMany({
      where: { createdAt: inRange },
      select: { id: true, outcome: true, ownerId: true, ownerName: true, createdAt: true, status: true },
    }),
    // عقب‌افتاده: وضعیت همین حالا
    prisma.staffTask.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lt: new Date() } },
      select: { ownerId: true, ownerName: true, priority: true },
    }),
    // ⚠️ مستندسازی = کارِ **متمایز**، نه تعداد یادداشت. ده یادداشت روی یک کار
    // یک واحد است، وگرنه پرحرفی امتیاز می‌آورد. تعداد خام فقط برای نمایش است.
    prisma.staffTaskNote.findMany({
      where: { createdAt: inRange },
      select: { taskId: true, authorId: true },
    }),
    prisma.staffTaskReferral.findMany({
      where: { createdAt: inRange },
      select: { taskId: true, fromId: true, toId: true },
    }),
    prisma.staffTaskType.findMany({
      select: { id: true, title: true, domain: true, outcomes: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SELLER"] }, isActive: true },
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
    prisma.staffWorkDay.findMany({
      where: { day: { gte: startOfDay(range.from), lte: range.to } },
      select: { userId: true, day: true, activeMin: true },
    }),
    prisma.staffDeal.findMany({
      where: { occurredAt: inRange, status: { not: "VOID" } },
      select: { ownerId: true, revenue: true, profit: true, occurredAt: true },
    }),
    prisma.staffTask.findMany({
      where: { ...prevOwner, status: "DONE", doneAt: prevRange },
      select: { doneAt: true, dueAt: true },
    }),
    prisma.staffTask.count({ where: { ...prevOwner, createdAt: prevRange } }),
    prisma.staffDeal.aggregate({
      where: { ...(ownerId ? { ownerId } : {}), occurredAt: prevRange, status: { not: "VOID" } },
      _sum: { revenue: true },
    }),
  ]);

  const typeById = new Map(types.map((t) => [t.id, t]));
  const outcomesOf = new Map(types.map((t) => [t.id, parseOutcomes(t.outcomes)]));
  const isSuccess = (typeId: string, outcome: string | null) =>
    !!outcome && outcomesOf.get(typeId)?.find((o) => o.value === outcome)?.isSuccess === true;

  const mine = (id: string | null) => !ownerId || id === ownerId;
  const fDone = done.filter((t) => mine(t.ownerId));
  const fCreated = created.filter((t) => mine(t.ownerId));
  const fOverdue = overdue.filter((t) => mine(t.ownerId));

  // ── سری زمانی روزانه ──────────────────────────────────────────
  const days = eachDay(range);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const blank = () => days.map(() => 0);
  const seriesDone = blank();
  const seriesCreated = blank();
  const seriesLate = blank();
  const seriesHours = blank();

  for (const t of fDone) {
    const i = t.doneAt ? dayIndex.get(dayKey(t.doneAt)) : undefined;
    if (i === undefined) continue;
    seriesDone[i]++;
    if (t.dueAt && t.doneAt! > t.dueAt) seriesLate[i]++;
  }
  for (const t of fCreated) {
    const i = dayIndex.get(dayKey(t.createdAt));
    if (i !== undefined) seriesCreated[i]++;
  }
  for (const w of workDays) {
    if (!mine(w.userId)) continue;
    const i = dayIndex.get(dayKey(w.day));
    if (i !== undefined) seriesHours[i] += w.activeMin / 60;
  }

  // ── تفکیک دامنه، نوع، نتیجه، کانال، اولویت، منبع ───────────────
  const byDomain: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byOutcome: Record<string, { label: string; count: number; isSuccess: boolean }> = {};
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  const closeBuckets = CLOSE_BUCKETS.map(() => 0);
  const closeMins: number[] = [];
  let onTime = 0, withDue = 0, success = 0, rated = 0;

  for (const t of fDone) {
    byDomain[t.domain] = (byDomain[t.domain] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    bySource[t.source] = (bySource[t.source] ?? 0) + 1;
    if (t.channel !== "NONE") byChannel[t.channel] = (byChannel[t.channel] ?? 0) + 1;
    const type = typeById.get(t.typeId);
    if (type) byType[type.title] = (byType[type.title] ?? 0) + 1;

    if (t.outcome && type) {
      // برچسبِ نتیجه از خود نوع می‌آید. نتیجه‌ای که دیگر در نوع نیست (چون
      // مدیر عوضش کرده) با مقدار خامش دیده می‌شود، نه اینکه ناپدید شود.
      const known = outcomesOf.get(type.id)?.find((o) => o.value === t.outcome);
      const key = `${type.id}:${t.outcome}`;
      byOutcome[key] ??= {
        label: `${known?.label ?? t.outcome} — ${type.title}`,
        count: 0,
        isSuccess: known?.isSuccess === true,
      };
      byOutcome[key].count++;
      rated++;
      if (known?.isSuccess) success++;
    }

    if (t.doneAt) {
      const { wd, hour } = tehranSlot(t.doneAt);
      heat[wd][hour]++;
      const mins = Math.max(0, (t.doneAt.getTime() - t.createdAt.getTime()) / 60_000);
      closeMins.push(mins);
      closeBuckets[CLOSE_BUCKETS.findIndex((b) => mins < b.max)]++;
      if (t.dueAt) {
        withDue++;
        if (t.doneAt <= t.dueAt) onTime++;
      }
    }
  }

  // ── جدول کارکنان — همیشه کل تیم ───────────────────────────────
  const nameOf = (u: { firstName: string | null; lastName: string | null; phone: string }) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone;

  const rows = new Map<string, StaffReportRow & { _close: number[]; _days: Set<string> }>();
  const row = (id: string | null, fallbackName: string) => {
    if (!id) return null; // کارِ بی‌مسئول در گزارش عملکرد جایی ندارد
    let r = rows.get(id);
    if (!r) {
      r = {
        userId: id, name: fallbackName, done: 0, created: 0, withOutcome: 0, documented: 0, overdue: 0,
        system: 0, onTime: 0, withDue: 0, success: 0, rated: 0, closeMin: null, calls: 0,
        referralsOut: 0, referralsIn: 0, notes: 0, activeMin: 0, presentDays: 0, deals: 0,
        revenue: 0, profit: 0, spark: blank(), byDomain: {}, _close: [], _days: new Set(),
      };
      rows.set(id, r);
    }
    return r;
  };

  for (const u of staff) row(u.id, nameOf(u));
  for (const t of done) {
    const r = row(t.ownerId, t.ownerName);
    if (!r) continue;
    r.done++;
    r.byDomain[t.domain] = (r.byDomain[t.domain] ?? 0) + 1;
    if (CALL_CHANNELS.includes(t.channel)) r.calls++;
    if (t.outcome) {
      r.rated++;
      if (isSuccess(t.typeId, t.outcome)) r.success++;
    }
    if (t.doneAt) {
      const i = dayIndex.get(dayKey(t.doneAt));
      if (i !== undefined) r.spark[i]++;
      r._close.push(Math.max(0, (t.doneAt.getTime() - t.createdAt.getTime()) / 60_000));
      if (t.dueAt) {
        r.withDue++;
        if (t.doneAt <= t.dueAt) r.onTime++;
      }
    }
  }
  for (const t of created) {
    const r = row(t.ownerId, t.ownerName);
    if (!r) continue;
    r.created++;
    if (t.outcome) r.withOutcome++;
  }
  for (const t of overdue) { const r = row(t.ownerId, t.ownerName); if (r) r.overdue++; }

  // یادداشت و ارجاع روی یک کار، یک واحد مستندسازی است نه دو تا
  const docPairs = new Set<string>();
  for (const n of notes) {
    if (!n.authorId) continue;
    docPairs.add(`${n.authorId}:${n.taskId}`);
    const r = rows.get(n.authorId);
    if (r) r.notes++;
  }
  for (const rf of referrals) {
    if (rf.fromId) {
      docPairs.add(`${rf.fromId}:${rf.taskId}`);
      const r = rows.get(rf.fromId);
      if (r) r.referralsOut++;
    }
    const to = rows.get(rf.toId);
    if (to) to.referralsIn++;
  }
  for (const pair of docPairs) {
    const [userId] = pair.split(":");
    const r = rows.get(userId);
    if (r) r.documented++;
  }

  for (const w of workDays) {
    const r = rows.get(w.userId);
    if (!r) continue;
    r.activeMin += w.activeMin;
    r._days.add(dayKey(w.day));
  }

  for (const d of deals) {
    const r = d.ownerId ? rows.get(d.ownerId) : null;
    if (!r) continue;
    r.deals++;
    r.revenue += Number(d.revenue);
    r.profit += Number(d.profit ?? 0);
  }

  // کار خودکار از ActivityLog — کنار کار دستی، نه جمع‌شده با آن
  const system = await countSystemWork(range.from, range.to);
  for (const src of system) {
    for (const [userId, count] of Object.entries(src.byActor)) {
      const r = rows.get(userId);
      if (r) r.system += count;
    }
  }

  const staffRows: StaffReportRow[] = Array.from(rows.values())
    .map(({ _close, _days, ...r }) => ({
      ...r,
      closeMin: median(_close),
      presentDays: _days.size,
    }))
    .filter((r) => r.done + r.created + r.documented + r.overdue + r.system + r.activeMin + r.deals > 0)
    .sort((a, b) => b.done - a.done);

  const topN = (obj: Record<string, number>) => {
    const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const head = sorted.slice(0, TOP_N);
    const restTotal = sorted.slice(TOP_N).reduce((s, [, v]) => s + v, 0);
    const items = head.map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
    if (restTotal > 0) items.push({ label: "سایر", value: restTotal, color: "#94a3b8" });
    return items;
  };

  const fRows = staffRows.filter((r) => mine(r.userId));
  const sum = (k: keyof StaffReportRow) => fRows.reduce((s, r) => s + (r[k] as number), 0);
  const activeMin = sum("activeMin");
  const revenue = sum("revenue");

  const totalCreated = fCreated.length;
  const totalWithOutcome = fCreated.filter((t) => t.outcome).length;
  const prevOnTimeDen = prevDone.filter((t) => t.dueAt).length;
  const prevOnTime = prevDone.filter((t) => t.dueAt && t.doneAt && t.doneAt <= t.dueAt).length;

  const systemFor = (s: (typeof system)[number]) =>
    ownerId ? (s.byActor[ownerId] ?? 0) : s.total;

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    days,
    kpi: {
      done: fDone.length,
      created: totalCreated,
      // نرخ ثبت نتیجه: درصد کارهای ثبت‌شده‌ی بازه که نتیجه خورده‌اند
      outcomeRate: pct(totalWithOutcome, totalCreated) ?? 0,
      overdue: fOverdue.length,
      overdueUrgent: fOverdue.filter((t) => t.priority === "URGENT" || t.priority === "HIGH").length,
      documented: ownerId ? sum("documented") : docPairs.size,
      system: system.reduce((s, x) => s + systemFor(x), 0),
      openNow: fCreated.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length,
      onTime, withDue, onTimeRate: pct(onTime, withDue),
      success, rated, successRate: pct(success, rated),
      closeMin: median(closeMins),
      calls: fDone.filter((t) => CALL_CHANNELS.includes(t.channel)).length,
      referrals: sum("referralsOut"),
      activeMin,
      presentDays: sum("presentDays"),
      // کار بسته‌شده به ازای هر ساعت حضور — بی حضور ثبت‌شده معنا ندارد
      perHour: activeMin > 0 ? Math.round((fDone.length / (activeMin / 60)) * 10) / 10 : null,
      deals: sum("deals"),
      revenue,
      profit: sum("profit"),
      activeStaff: fRows.filter((r) => r.done > 0).length,
    },
    prev: {
      done: prevDone.length,
      created: prevCreated,
      onTimeRate: pct(prevOnTime, prevOnTimeDen),
      revenue: Number(prevDeals._sum.revenue ?? 0),
    },
    series: {
      done: seriesDone,
      created: seriesCreated,
      late: seriesLate,
      hours: seriesHours.map((h) => Math.round(h * 10) / 10),
    },
    byDomain: Object.entries(byDomain)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({
        key,
        label: DOMAIN_LABELS[key as StaffDomain] ?? key,
        value,
        color: DOMAIN_HEX[key as StaffDomain] ?? "#94a3b8",
      })),
    domains: (Object.keys(DOMAIN_LABELS) as StaffDomain[]).map((k) => ({
      key: k, label: DOMAIN_LABELS[k], color: DOMAIN_HEX[k],
    })),
    byType: topN(byType),
    byChannel: Object.entries(byChannel)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value], i) => ({ label: CHANNEL_LABELS[key as StaffChannel] ?? key, value, color: COLORS[i % COLORS.length] })),
    byPriority: (["URGENT", "HIGH", "NORMAL", "LOW"] as StaffPriority[])
      .filter((k) => byPriority[k])
      .map((k) => ({ label: PRIORITY_LABELS[k], value: byPriority[k], color: PRIORITY_HEX[k] })),
    bySource: Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value], i) => ({ label: SOURCE_LABELS[key as StaffTaskSource] ?? key, value, color: COLORS[(i + 4) % COLORS.length] })),
    byOutcome: Object.values(byOutcome)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((o) => ({ label: o.label, value: o.count, color: o.isSuccess ? "#10b981" : "#94a3b8" })),
    closeTime: CLOSE_BUCKETS.map((b, i) => ({ label: b.label, value: closeBuckets[i] })),
    heatmap: heat,
    system: system
      .map((s) => ({ key: s.key, label: s.label, value: systemFor(s) }))
      .filter((s) => s.value > 0),
    staff: staffRows,
  };
}

// ── جزئیات پشت هر عدد ─────────────────────────────────────────────

export const DRILL_METRICS = {
  done: "کارهای بسته‌شده",
  created: "کارهای ثبت‌شده",
  late: "بسته‌شده بعد از مهلت",
  noOutcome: "ثبت‌شده بدون نتیجه",
  overdue: "عقب‌افتاده‌ی همین حالا",
  calls: "تماس‌های انجام‌شده",
  success: "بسته‌شده با نتیجه‌ی موفق",
} as const;

export type DrillMetric = keyof typeof DRILL_METRICS;

/**
 * کارهای پشت یک عدد گزارش — برای پنجره‌ی جزئیات. همان شرط‌های `teamReport`
 * را تکرار می‌کند تا عددِ پنجره با عددِ جدول یکی باشد.
 */
export async function teamReportDetail(range: DateRange, metric: DrillMetric, ownerId: string | null) {
  const inRange = { gte: range.from, lte: range.to };
  const base: Prisma.StaffTaskWhereInput = ownerId ? { ownerId } : {};
  const where: Prisma.StaffTaskWhereInput =
    metric === "created" ? { ...base, createdAt: inRange }
      : metric === "noOutcome" ? { ...base, createdAt: inRange, outcome: null }
        : metric === "overdue" ? { ...base, status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lt: new Date() } }
          : metric === "calls" ? { ...base, status: "DONE", doneAt: inRange, channel: { in: CALL_CHANNELS } }
            : metric === "success" ? { ...base, status: "DONE", doneAt: inRange, outcome: { not: null } }
              : { ...base, status: "DONE", doneAt: inRange, ...(metric === "late" ? { dueAt: { not: null } } : {}) };

  const [list, types] = await Promise.all([
    prisma.staffTask.findMany({
      where,
      orderBy: metric === "overdue" ? { dueAt: "asc" } : metric === "created" || metric === "noOutcome" ? { createdAt: "desc" } : { doneAt: "desc" },
      take: 1000,
      select: {
        id: true, title: true, typeId: true, domain: true, status: true, priority: true, channel: true,
        ownerName: true, contactName: true, contactPhone: true, linkUrl: true, outcome: true,
        createdAt: true, dueAt: true, doneAt: true,
      },
    }),
    prisma.staffTaskType.findMany({ select: { id: true, title: true, outcomes: true } }),
  ]);
  const typeById = new Map(types.map((t) => [t.id, { title: t.title, outcomes: parseOutcomes(t.outcomes) }]));

  let rows = list.map((t) => {
    const type = typeById.get(t.typeId);
    const o = t.outcome ? type?.outcomes.find((x) => x.value === t.outcome) : undefined;
    return {
      id: t.id,
      title: t.title,
      type: type?.title ?? "",
      domain: DOMAIN_LABELS[t.domain],
      status: t.status,
      priority: t.priority,
      channel: t.channel,
      owner: t.ownerName,
      contact: t.contactName || t.contactPhone || null,
      linkUrl: t.linkUrl,
      outcome: t.outcome ? (o?.label ?? t.outcome) : null,
      isSuccess: o?.isSuccess === true,
      createdAt: t.createdAt.toISOString(),
      dueAt: t.dueAt?.toISOString() ?? null,
      doneAt: t.doneAt?.toISOString() ?? null,
      late: !!(t.dueAt && t.doneAt && t.doneAt > t.dueAt),
    };
  });
  // «دیرکرد» و «موفق» شرطی روی دو ستون یا روی Json نوع است؛ در حافظه
  if (metric === "late") rows = rows.filter((r) => r.late);
  if (metric === "success") rows = rows.filter((r) => r.isSuccess);

  return { metric, title: DRILL_METRICS[metric], total: rows.length, rows: rows.slice(0, 300) };
}
