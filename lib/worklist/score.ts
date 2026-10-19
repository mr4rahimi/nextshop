/**
 * امتیاز عملکرد ماهانه — جمع‌آوری داده، قفل ماه، تنظیمات.
 * docs/features/staff-worklist.md بخش ۱۵.
 *
 * ⚠️ **این با پورسانت (بخش ۲۲) یکی نیست.** امتیاز می‌گوید چطور کار کرد و
 * ماهانه و نسبی است؛ پورسانت درصدی از سود ریالی است. برای همین «فروش» اینجا
 * **تعداد** معامله است نه مبلغ، و سود فقط ستون اطلاعاتی و تساوی‌شکن است —
 * وگرنه فروش بیشتر دو بار پاداش می‌گرفت.
 *
 * مبنای ماه همیشه شمسی است (`jalaliMonthDays`)، همان مرزی که حضور و معامله
 * (`StaffDeal.monthKey`) دارند. ماه جاری تا **همین لحظه** حساب می‌شود.
 *
 * منطق نرمال‌سازی و رتبه در `score-calc.ts` است و این فایل فقط عدد خام می‌سازد.
 */

import { prisma } from "@/lib/prisma";
import { toJalali, jalaliMonthName } from "@/lib/club/jalali";
import { normalizePhone } from "@/lib/club/phone";
import { jalaliMonthDays, dayBounds, dayKeyOf, getMonthSummary } from "./attendance";
import { countSystemWork } from "./system-map";
import { parseOutcomes } from "./types";
import { EARNING_STATUSES } from "./deals";
import { resolveWeights, scoreGroup, type GroupResult, type MemberInput, type RawValue } from "./score-calc";
import { SCORE_GROUPS, type ScoreGroup } from "./score-metrics";
import type { OrderStatus, Prisma } from "@prisma/client";

const DAY_MS = 86_400_000;

// ─────────────────────────────────────────────────────────────────
// ماه
// ─────────────────────────────────────────────────────────────────

export interface ScoreMonth {
  key: string;
  year: number;
  month: number;
  label: string;
  start: Date;
  /** انحصاری — نیمه‌شب تهرانِ روز اول ماه بعد */
  end: Date;
  /** برای ماه جاری «همین لحظه»، وگرنه `end` */
  cap: Date;
  isCurrent: boolean;
  isFuture: boolean;
  /** روزهای مانده تا پایان ماه — فقط ماه جاری */
  daysLeft: number;
}

export function currentMonthKey(now = new Date()): string {
  const j = toJalali(now);
  return `${j.year}-${String(j.month).padStart(2, "0")}`;
}

export function parseMonth(key: string | null | undefined, now = new Date()): ScoreMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? currentMonthKey(now));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;

  const days = jalaliMonthDays(year, month);
  if (days.length === 0) return null;
  const start = dayBounds(days[0]).start;
  const end = dayBounds(days[days.length - 1]).end;
  const isCurrent = now >= start && now < end;
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    year,
    month,
    label: `${jalaliMonthName(month)} ${year.toLocaleString("fa-IR", { useGrouping: false })}`,
    start,
    end,
    cap: isCurrent ? now : end,
    isCurrent,
    isFuture: start > now,
    daysLeft: isCurrent ? Math.ceil((end.getTime() - now.getTime()) / DAY_MS) : 0,
  };
}

// ─────────────────────────────────────────────────────────────────
// تنظیمات
// ─────────────────────────────────────────────────────────────────

export interface ScoreSettings {
  enabled: boolean;
  minVolumePct: number;
  conversionDays: number;
  showRank: boolean;
}

export async function getScoreSettings(): Promise<ScoreSettings> {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { scoreEnabled: true, scoreMinVolumePct: true, scoreConversionDays: true, scoreShowRank: true },
  });
  return {
    enabled: s?.scoreEnabled ?? false,
    minVolumePct: s?.scoreMinVolumePct ?? 60,
    conversionDays: s?.scoreConversionDays ?? 7,
    showRank: s?.scoreShowRank ?? false,
  };
}

export async function getGroupWeights(group: ScoreGroup) {
  const rows = await prisma.staffScoreMetric.findMany({
    where: { group },
    select: { code: true, weight: true, isActive: true },
  });
  return resolveWeights(group, rows);
}

// ─────────────────────────────────────────────────────────────────
// عدد خام
// ─────────────────────────────────────────────────────────────────

const nameOf = (u: { firstName: string | null; lastName: string | null; phone: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone;

const rate = (num: number, den: number): RawValue | null =>
  den > 0 ? { value: num / den, num, den } : null;

interface Member {
  userId: string;
  name: string;
  group: ScoreGroup;
}

/** کارکنانی که در رتبه‌بندی می‌آیند، و آن‌هایی که هنوز گروه ندارند */
export async function scoreMembers(): Promise<{ members: Member[]; unassigned: { userId: string; name: string }[] }> {
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SELLER"] }, isActive: true },
    select: { id: true, firstName: true, lastName: true, phone: true, scoreGroup: true, scoreExcluded: true },
    orderBy: { createdAt: "asc" },
  });
  const members: Member[] = [];
  const unassigned: { userId: string; name: string }[] = [];
  for (const u of users) {
    if (u.scoreExcluded) continue;
    if (u.scoreGroup) members.push({ userId: u.id, name: nameOf(u), group: u.scoreGroup });
    else unassigned.push({ userId: u.id, name: nameOf(u) });
  }
  return { members, unassigned };
}

/**
 * عدد خام همه‌ی معیارها برای کارکنان داده‌شده در یک ماه.
 *
 * هر معیار صرف‌نظر از گروه حساب می‌شود و `score-calc` فقط معیارهای گروه را
 * برمی‌دارد — ساده‌تر از شرط‌گذاشتن روی هر کوئری، و تعداد کارکنان کم است.
 */
async function collectRaw(
  ids: string[],
  month: ScoreMonth,
  conversionDays: number,
): Promise<Map<string, { raw: Record<string, RawValue | null>; profit: number }>> {
  const out = new Map(ids.map((id) => [id, { raw: {} as Record<string, RawValue | null>, profit: 0 }]));
  if (ids.length === 0) return out;

  const inMonth = { gte: month.start, lt: month.cap };
  const now = new Date();

  const [types, done, due, notes, referrals, system, deals, calls, installments, contents, seos] =
    await Promise.all([
      prisma.staffTaskType.findMany({ select: { id: true, weight: true, outcomes: true, systemKey: true } }),
      prisma.staffTask.findMany({
        where: { ownerId: { in: ids }, status: "DONE", doneAt: inMonth },
        select: { ownerId: true, typeId: true, outcome: true },
      }),
      // ⚠️ مهلتی که هنوز نرسیده شمرده نمی‌شود: `cap` برای ماه جاری «الان» است
      prisma.staffTask.findMany({
        where: { ownerId: { in: ids }, status: { not: "CANCELED" }, dueAt: inMonth },
        select: { ownerId: true, dueAt: true, doneAt: true },
      }),
      prisma.staffTaskNote.findMany({
        where: { authorId: { in: ids }, createdAt: inMonth },
        select: { taskId: true, authorId: true },
        distinct: ["taskId", "authorId"],
      }),
      prisma.staffTaskReferral.findMany({
        where: { fromId: { in: ids }, createdAt: inMonth },
        select: { taskId: true, fromId: true },
        distinct: ["taskId", "fromId"],
      }),
      countSystemWork(month.start, new Date(month.cap.getTime() - 1), ids),
      prisma.staffDeal.findMany({
        where: { ownerId: { in: ids }, monthKey: month.key },
        select: { ownerId: true, status: true, profit: true },
      }),
      prisma.staffTask.findMany({
        where: {
          ownerId: { in: ids },
          domain: "SALES",
          channel: { in: ["CALL_IN", "CALL_OUT"] },
          createdAt: inMonth,
        },
        select: { ownerId: true, customerId: true, contactPhone: true, createdAt: true },
      }),
      // موعدهایی که روزشان کامل گذشته؛ موعدِ امروز هنوز فرصت واریز دارد
      prisma.orderCreditInstallment.findMany({
        where: {
          status: { not: "CANCELED" },
          dueDate: { gte: dayKeyOf(month.start), lt: dayKeyOf(month.isCurrent ? now : month.end) },
          order: { staffDeal: { ownerId: { in: ids } } },
        },
        select: { dueDate: true, paidAt: true, order: { select: { staffDeal: { select: { ownerId: true } } } } },
      }),
      prisma.contentTask.findMany({
        where: { writerId: { in: ids }, status: "DONE", approvedAt: inMonth, deletedAt: null },
        select: { id: true, writerId: true, dueAt: true, submittedAt: true, approvedAt: true },
      }),
      prisma.seoTask.findMany({
        where: { assigneeId: { in: ids }, status: "DONE", approvedAt: inMonth, deletedAt: null },
        select: { id: true, assigneeId: true, dueAt: true, reportedAt: true, approvedAt: true },
      }),
    ]);

  const typeById = new Map(types.map((t) => [t.id, t]));
  const hasOutcomes = (typeId: string) => parseOutcomes(typeById.get(typeId)?.outcomes).length > 0;

  // ── کار بسته‌شده و ثبت نتیجه ──────────────────────────────────
  const doneW = new Map<string, number>();
  const doneN = new Map<string, number>();
  const outDen = new Map<string, number>();
  const outNum = new Map<string, number>();
  for (const t of done) {
    if (!t.ownerId) continue;
    doneW.set(t.ownerId, (doneW.get(t.ownerId) ?? 0) + (typeById.get(t.typeId)?.weight ?? 1));
    doneN.set(t.ownerId, (doneN.get(t.ownerId) ?? 0) + 1);
    if (hasOutcomes(t.typeId)) {
      outDen.set(t.ownerId, (outDen.get(t.ownerId) ?? 0) + 1);
      if (t.outcome) outNum.set(t.ownerId, (outNum.get(t.ownerId) ?? 0) + 1);
    }
  }

  // ── به‌موقع ───────────────────────────────────────────────────
  const dueDen = new Map<string, number>();
  const dueNum = new Map<string, number>();
  for (const t of due) {
    if (!t.ownerId || !t.dueAt) continue;
    dueDen.set(t.ownerId, (dueDen.get(t.ownerId) ?? 0) + 1);
    if (t.doneAt && t.doneAt <= t.dueAt) dueNum.set(t.ownerId, (dueNum.get(t.ownerId) ?? 0) + 1);
  }

  // ── مستندسازی: یادداشت و ارجاع روی یک کار یک واحد است ──────────
  const docPairs = new Set<string>();
  for (const n of notes) if (n.authorId) docPairs.add(`${n.authorId}:${n.taskId}`);
  for (const r of referrals) if (r.fromId) docPairs.add(`${r.fromId}:${r.taskId}`);
  const docs = new Map<string, number>();
  for (const pair of docPairs) {
    const id = pair.split(":")[0];
    docs.set(id, (docs.get(id) ?? 0) + 1);
  }

  // ── کار خودکار، ضرب در وزن نوع سیستمیِ هم‌کلید ─────────────────
  const sysWeight = new Map(types.filter((t) => t.systemKey).map((t) => [t.systemKey!, t.weight]));
  const sys = new Map<string, number>();
  const sysN = new Map<string, number>();
  for (const src of system) {
    const w = sysWeight.get(src.key) ?? 1;
    for (const [id, count] of Object.entries(src.byActor)) {
      sys.set(id, (sys.get(id) ?? 0) + count * w);
      sysN.set(id, (sysN.get(id) ?? 0) + count);
    }
  }

  // ── معامله ───────────────────────────────────────────────────
  const dealAll = new Map<string, number>();
  const dealVoid = new Map<string, number>();
  for (const d of deals) {
    if (!d.ownerId) continue;
    dealAll.set(d.ownerId, (dealAll.get(d.ownerId) ?? 0) + 1);
    if (d.status === "VOID") dealVoid.set(d.ownerId, (dealVoid.get(d.ownerId) ?? 0) + 1);
    else if (d.status === "CONFIRMED" && d.profit) {
      const o = out.get(d.ownerId);
      if (o) o.profit += Number(d.profit);
    }
  }

  // ── تبدیل تماس فروش به سفارش ──────────────────────────────────
  // واحد، مشتریِ متمایز است نه تماس: پنج تماس با یک مشتری و یک سفارش یعنی ۱ از ۱.
  // فقط تماسی شمرده می‌شود که پنجره‌اش بسته شده، تا عدد ماه بعداً تکان نخورد.
  const windowMs = conversionDays * DAY_MS;
  const phones = [...new Set(calls.filter((c) => !c.customerId).map((c) => normalizePhone(c.contactPhone)).filter((p): p is string => !!p))];
  const byPhone = new Map(
    (phones.length
      ? await prisma.user.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true } })
      : []
    ).map((u) => [u.phone, u.id]),
  );
  const firstCall = new Map<string, Date>(); // `${ownerId}:${customerId}`
  for (const c of calls) {
    if (!c.ownerId) continue;
    const cust = c.customerId ?? byPhone.get(normalizePhone(c.contactPhone) ?? "") ?? null;
    if (!cust) continue;
    if (c.createdAt.getTime() + windowMs > now.getTime()) continue;
    const k = `${c.ownerId}:${cust}`;
    const prev = firstCall.get(k);
    if (!prev || c.createdAt < prev) firstCall.set(k, c.createdAt);
  }
  const customerIds = [...new Set([...firstCall.keys()].map((k) => k.split(":")[1]))];
  const orders = customerIds.length
    ? await prisma.order.findMany({
        where: {
          userId: { in: customerIds },
          status: { in: EARNING_STATUSES as OrderStatus[] },
          createdAt: { gte: month.start, lt: new Date(month.cap.getTime() + windowMs) },
        },
        select: { userId: true, createdAt: true },
      })
    : [];
  const ordersOf = new Map<string, Date[]>();
  for (const o of orders) ordersOf.set(o.userId, [...(ordersOf.get(o.userId) ?? []), o.createdAt]);
  const convDen = new Map<string, number>();
  const convNum = new Map<string, number>();
  for (const [k, at] of firstCall) {
    const [owner, cust] = k.split(":");
    convDen.set(owner, (convDen.get(owner) ?? 0) + 1);
    const hit = (ordersOf.get(cust) ?? []).some((d) => d >= at && d.getTime() <= at.getTime() + windowMs);
    if (hit) convNum.set(owner, (convNum.get(owner) ?? 0) + 1);
  }

  // ── وصول اعتباری ─────────────────────────────────────────────
  const credDen = new Map<string, number>();
  const credNum = new Map<string, number>();
  for (const i of installments) {
    const owner = i.order.staffDeal?.ownerId;
    if (!owner) continue;
    credDen.set(owner, (credDen.get(owner) ?? 0) + 1);
    if (i.paidAt && i.paidAt < dayBounds(i.dueDate).end) credNum.set(owner, (credNum.get(owner) ?? 0) + 1);
  }

  // ── محتوا و سئو ──────────────────────────────────────────────
  const [contentReturns, seoReturns] = await Promise.all([
    contents.length
      ? prisma.contentTaskEvent.findMany({
          where: { taskId: { in: contents.map((c) => c.id) }, action: "RETURNED" },
          select: { taskId: true },
          distinct: ["taskId"],
        })
      : [],
    seos.length
      ? prisma.seoTaskEvent.findMany({
          where: { taskId: { in: seos.map((s) => s.id) }, action: "RETURNED" },
          select: { taskId: true },
          distinct: ["taskId"],
        })
      : [],
  ]);
  const returned = new Set([...contentReturns, ...seoReturns].map((r) => r.taskId));
  const contentN = new Map<string, number>();
  const seoN = new Map<string, number>();
  const passDen = new Map<string, number>();
  const passNum = new Map<string, number>();
  const mktDueDen = new Map<string, number>();
  const mktDueNum = new Map<string, number>();
  const marketing = [
    ...contents.map((c) => ({ id: c.id, owner: c.writerId, dueAt: c.dueAt, delivered: c.submittedAt ?? c.approvedAt, kind: "content" as const })),
    ...seos.map((s) => ({ id: s.id, owner: s.assigneeId, dueAt: s.dueAt, delivered: s.reportedAt ?? s.approvedAt, kind: "seo" as const })),
  ];
  for (const t of marketing) {
    if (!t.owner) continue;
    const counter = t.kind === "content" ? contentN : seoN;
    counter.set(t.owner, (counter.get(t.owner) ?? 0) + 1);
    passDen.set(t.owner, (passDen.get(t.owner) ?? 0) + 1);
    if (!returned.has(t.id)) passNum.set(t.owner, (passNum.get(t.owner) ?? 0) + 1);
    if (t.dueAt) {
      mktDueDen.set(t.owner, (mktDueDen.get(t.owner) ?? 0) + 1);
      if (t.delivered && t.delivered <= t.dueAt) mktDueNum.set(t.owner, (mktDueNum.get(t.owner) ?? 0) + 1);
    }
  }

  for (const id of ids) {
    const o = out.get(id)!;
    const g = (m: Map<string, number>) => m.get(id) ?? 0;
    o.raw = {
      TASK_DONE: { value: g(doneW), num: g(doneN) },
      TASK_ONTIME: rate(g(dueNum), g(dueDen)),
      TASK_OUTCOME: rate(g(outNum), g(outDen)),
      TASK_DOC: { value: g(docs) },
      SYSTEM_WORK: { value: g(sys), num: g(sysN) },
      SALES_DEALS: { value: g(dealAll) - g(dealVoid) },
      SALES_CONVERSION: rate(g(convNum), g(convDen)),
      SALES_VOID: rate(g(dealVoid), g(dealAll)),
      CREDIT_ONTIME: rate(g(credNum), g(credDen)),
      CONTENT_DONE: { value: g(contentN) },
      SEO_DONE: { value: g(seoN) },
      MKT_FIRST_PASS: rate(g(passNum), g(passDen)),
      MKT_ONTIME: rate(g(mktDueNum), g(mktDueDen)),
    };
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────
// امتیاز ماه
// ─────────────────────────────────────────────────────────────────

export interface AwardInfo {
  id: string;
  userId: string | null;
  userName: string;
  score: number;
  note: string | null;
  createdByName: string;
  createdAt: string;
}

export interface GroupView extends GroupResult {
  label?: string;
  /** برنده ثبت شده و اعداد از اسنپ‌شات قفل‌شده خوانده می‌شود */
  locked: boolean;
  award: AwardInfo | null;
}

export interface MonthScore {
  month: Omit<ScoreMonth, "start" | "end" | "cap"> & { start: string; end: string };
  settings: ScoreSettings;
  groups: GroupView[];
  unassigned: { userId: string; name: string }[];
  /** پنجره‌ی تبدیلِ تماس‌های آخر ماه هنوز باز است — برنده را بعد از آن ثبت کنید */
  conversionPendingUntil: string | null;
}

/** امتیاز زنده‌ی گروه‌ها — بدون نگاه به قفل */
async function computeLive(month: ScoreMonth, settings: ScoreSettings, groups: ScoreGroup[]) {
  const { members, unassigned } = await scoreMembers();
  const wanted = members.filter((m) => groups.includes(m.group));
  const [raw, presence] = await Promise.all([
    collectRaw(wanted.map((m) => m.userId), month, settings.conversionDays),
    getMonthSummary(month.year, month.month),
  ]);

  const results = new Map<ScoreGroup, GroupResult>();
  for (const group of groups) {
    const inputs: MemberInput[] = wanted
      .filter((m) => m.group === group)
      .map((m) => {
        const r = raw.get(m.userId)!;
        return {
          userId: m.userId,
          name: m.name,
          presentDays: presence.get(m.userId)?.presentDays ?? null,
          raw: r.raw,
          info: group === "SALES" ? { profit: r.profit } : undefined,
        };
      });
    results.set(group, scoreGroup(group, inputs, await getGroupWeights(group), settings.minVolumePct));
  }
  return { results, unassigned };
}

function awardInfo(a: {
  id: string; userId: string | null; userName: string; score: number; note: string | null;
  createdByName: string; createdAt: Date;
}): AwardInfo {
  return {
    id: a.id, userId: a.userId, userName: a.userName, score: a.score, note: a.note,
    createdByName: a.createdByName, createdAt: a.createdAt.toISOString(),
  };
}

export async function monthScore(month: ScoreMonth): Promise<MonthScore> {
  const settings = await getScoreSettings();
  const awards = await prisma.staffScoreAward.findMany({ where: { monthKey: month.key } });
  const awardOf = new Map(awards.map((a) => [a.group as ScoreGroup, a]));

  // گروه قفل‌شده دوباره حساب نمی‌شود — اسنپ‌شات حرف آخر است
  const liveGroups = SCORE_GROUPS.filter((g) => !awardOf.has(g));
  const { results, unassigned } = await computeLive(month, settings, liveGroups);

  const groups: GroupView[] = SCORE_GROUPS.map((g) => {
    const a = awardOf.get(g);
    if (a) return { ...(a.snapshot as unknown as GroupResult), locked: true, award: awardInfo(a) };
    return { ...results.get(g)!, locked: false, award: null };
  });

  const pendingUntil = new Date(month.end.getTime() + settings.conversionDays * DAY_MS);
  return {
    month: {
      key: month.key, year: month.year, month: month.month, label: month.label,
      isCurrent: month.isCurrent, isFuture: month.isFuture, daysLeft: month.daysLeft,
      start: month.start.toISOString(), end: month.end.toISOString(),
    },
    settings,
    groups,
    unassigned,
    conversionPendingUntil: !month.isCurrent && pendingUntil > new Date() ? pendingUntil.toISOString() : null,
  };
}

// ─────────────────────────────────────────────────────────────────
// امتیاز من — هرگز نام یا عدد دیگران
// ─────────────────────────────────────────────────────────────────

export interface MyScore {
  enabled: boolean;
  group: ScoreGroup | null;
  month: { key: string; label: string; daysLeft: number; isCurrent: boolean };
  score: number | null;
  eligible: boolean;
  reason: string | null;
  /** فقط اگر مدیر «نمایش رتبه» را روشن کرده باشد */
  rank: number | null;
  rankOf: number | null;
  metrics: { code: string; raw: number | null; num?: number; den?: number; normalized: number | null; weight: number; status: string }[];
  locked: boolean;
}

/**
 * ⚠️ `reference` (بهترین عدد گروه) عمداً برگردانده نمی‌شود: خودش عدد خامِ یک
 * همکار است. کارمند فقط عدد خودش و درصدِ نرمال‌شده‌اش را می‌بیند.
 */
export async function myScore(userId: string, month: ScoreMonth): Promise<MyScore> {
  const settings = await getScoreSettings();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { scoreGroup: true, scoreExcluded: true } });
  const group = user && !user.scoreExcluded ? (user.scoreGroup as ScoreGroup | null) : null;
  const base: MyScore = {
    enabled: settings.enabled,
    group,
    month: { key: month.key, label: month.label, daysLeft: month.daysLeft, isCurrent: month.isCurrent },
    score: null, eligible: false, reason: null, rank: null, rankOf: null, metrics: [], locked: false,
  };
  if (!settings.enabled || !group) return base;

  const award = await prisma.staffScoreAward.findUnique({ where: { monthKey_group: { monthKey: month.key, group } } });
  let result: GroupResult;
  if (award) {
    result = award.snapshot as unknown as GroupResult;
  } else {
    const { results } = await computeLive(month, settings, [group]);
    result = results.get(group)!;
  }
  const me = result.members.find((m) => m.userId === userId);
  if (!me) return { ...base, locked: !!award };

  return {
    ...base,
    locked: !!award,
    score: me.score,
    eligible: me.eligible,
    reason: me.reason,
    rank: settings.showRank ? me.rank : null,
    rankOf: settings.showRank ? result.members.filter((m) => m.eligible).length : null,
    metrics: me.metrics.map((m) => ({
      code: m.code, raw: m.raw, num: m.num, den: m.den,
      normalized: m.normalized, weight: m.weight, status: m.status,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────
// قفل ماه
// ─────────────────────────────────────────────────────────────────

/**
 * ثبت برنده‌ی یک گروه در یک ماه — اسنپ‌شات کامل همان لحظه ذخیره می‌شود.
 *
 * ⚠️ ماه تمام‌نشده رد می‌شود. در برتر برنده‌ی شهریور روی مهر (با هشت روز
 * داده) ثبت شد چون صفحه روی ماه جاری باز می‌شد.
 */
export async function awardMonth(input: {
  month: ScoreMonth;
  group: ScoreGroup;
  userId: string;
  note: string | null;
  by: { userId: string; name: string };
}): Promise<AwardInfo> {
  const { month, group } = input;
  if (month.isCurrent || month.isFuture) throw new Error("ماه هنوز تمام نشده — برنده بعد از پایان ماه ثبت می‌شود");

  const exists = await prisma.staffScoreAward.findUnique({ where: { monthKey_group: { monthKey: month.key, group } } });
  if (exists) throw new Error("برنده‌ی این گروه در این ماه قبلاً ثبت شده");

  const settings = await getScoreSettings();
  const { results } = await computeLive(month, settings, [group]);
  const result = results.get(group)!;
  const winner = result.members.find((m) => m.userId === input.userId);
  if (!winner) throw new Error("این کارمند در این گروه نیست");
  // مدیر می‌تواند کسی جز نفر اول را انتخاب کند — قضاوت با آدم است — ولی
  // کسی که واجد شرایط نیست برنده نمی‌شود، وگرنه کف حجم بی‌معنی بود.
  if (!winner.eligible) throw new Error(`این کارمند واجد شرایط نیست: ${winner.reason ?? ""}`);

  try {
    const a = await prisma.staffScoreAward.create({
      data: {
        monthKey: month.key,
        group,
        userId: winner.userId,
        userName: winner.name,
        score: winner.score,
        note: input.note,
        snapshot: result as unknown as Prisma.InputJsonValue,
        createdById: input.by.userId,
        createdByName: input.by.name,
      },
    });
    return awardInfo(a);
  } catch (e) {
    // دو کلیک هم‌زمان — ایندکس یکتا تنها مرز واقعی است
    if ((e as { code?: string }).code === "P2002") throw new Error("برنده‌ی این گروه در این ماه قبلاً ثبت شده");
    throw e;
  }
}

/** برداشتن قفل — ماه دوباره زنده حساب می‌شود */
export async function removeAward(monthKey: string, group: ScoreGroup): Promise<boolean> {
  const r = await prisma.staffScoreAward.deleteMany({ where: { monthKey, group } });
  return r.count > 0;
}

/** برنده‌های همه‌ی ماه‌ها — تالار افتخار، بدون امتیاز دیگران */
export async function listAwards(limit = 24) {
  const rows = await prisma.staffScoreAward.findMany({
    orderBy: [{ monthKey: "desc" }, { group: "asc" }],
    take: limit,
    // ⚠️ `score` عمداً نیست: این فهرست را همه می‌بینند و عددِ همکار نباید دیده شود
    select: { id: true, monthKey: true, group: true, userId: true, userName: true, note: true, createdByName: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
