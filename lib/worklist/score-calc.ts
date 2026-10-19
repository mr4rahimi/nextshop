/**
 * الگوریتم امتیاز نسبی — منطق خالص، بدون Prisma.
 * docs/features/staff-worklist.md بخش ۱۵ — الگو: bartar-crm/docs/47.
 *
 * ```
 * normalized = جهت مثبت →  raw / best           best  = بیشترین میان واجدین
 *              جهت منفی  →  1 − raw / worst      worst = بیشترین میان واجدین
 * امتیاز     = Σ(normalized × وزن) ÷ Σ وزنِ معیارهای صادق × ۱۰۰
 * ```
 *
 * چهار قاعده که هر کدام یک بار در برتر لازم شد:
 *  - معیاری که هیچ واجدی عددی در آن ندارد (best = 0) برای همه **کنار** می‌رود
 *    و وزنش از مخرج بیرون می‌ماند، نه اینکه همه صفر بگیرند.
 *  - نرخی که مخرجش برای یک نفر صفر است («هیچ موعد اعتباری نداشت») برای
 *    **همان نفر** صدق نمی‌کند؛ نه جریمه می‌شود نه جایزه می‌گیرد.
 *  - مبنا فقط از واجدین است ولی امتیاز برای همه حساب می‌شود، پس نرمال‌شده
 *    به ۰ تا ۱ بریده می‌شود — وگرنه فرد غیرواجد از ۱۰۰ رد می‌شد.
 *  - کسی که هیچ حجم کاری ندارد صفر می‌گیرد، نه نمره‌ی کامل بابت «هیچ تأخیری نداشت».
 */

import { metricsOf, type ScoreGroup } from "./score-metrics";

export interface RawValue {
  /** برای `count` خودِ عدد؛ برای `rate` نسبت ۰ تا ۱ */
  value: number;
  num?: number;
  den?: number;
}

export interface MemberInput {
  userId: string;
  name: string;
  /** روزهای حضور در سیستم — `null` یعنی داده‌ای نیست */
  presentDays: number | null;
  /** `null` یعنی نرخی با مخرج صفر — برای این نفر صدق نمی‌کند */
  raw: Record<string, RawValue | null>;
  /** ستون اطلاعاتی و تساوی‌شکن — مثلاً سود. هرگز در امتیاز نمی‌آید. */
  info?: { profit?: number };
}

export interface MetricWeight {
  code: string;
  weight: number;
  isActive: boolean;
}

export type MetricStatus = "ok" | "na" | "dropped";

export interface MetricResult {
  code: string;
  /** عدد خام، پیش از تقسیم بر روز */
  raw: number | null;
  num?: number;
  den?: number;
  /** عددی که مقایسه شد — برای معیارهای روزانه، raw ÷ روز حضور */
  compared: number | null;
  /** بهترین (یا برای «کمتر بهتر»، بدترین) عدد میان واجدین */
  reference: number | null;
  normalized: number | null;
  weight: number;
  points: number;
  status: MetricStatus;
}

export interface MemberResult {
  userId: string;
  name: string;
  score: number;
  rank: number | null;
  eligible: boolean;
  /** چرا در رتبه‌بندی نیست */
  reason: string | null;
  volume: number;
  presentDays: number | null;
  metrics: MetricResult[];
  info?: { profit?: number };
}

export interface GroupResult {
  group: ScoreGroup;
  members: MemberResult[];
  medianVolume: number;
  minVolume: number;
  /** حجم بر روز حضور تقسیم شد؟ */
  perDayApplied: boolean;
  warnings: string[];
  weights: MetricWeight[];
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function median(list: number[]): number {
  if (list.length === 0) return 0;
  const s = [...list].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** وزن نهایی هر معیارِ گروه: ردیف دیتابیس اگر هست، وگرنه پیش‌فرض کد */
export function resolveWeights(group: ScoreGroup, rows: { code: string; weight: number; isActive: boolean }[]): MetricWeight[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return metricsOf(group).map((m) => {
    const row = byCode.get(m.code);
    return {
      code: m.code,
      weight: row ? Math.max(0, row.weight) : (m.defaults[group] ?? 0),
      isActive: row ? row.isActive : true,
    };
  });
}

export function scoreGroup(
  group: ScoreGroup,
  members: MemberInput[],
  weights: MetricWeight[],
  minVolumePct: number,
): GroupResult {
  const defs = metricsOf(group);
  const active = defs.filter((d) => {
    const w = weights.find((x) => x.code === d.code);
    return w?.isActive && w.weight > 0;
  });
  const weightOf = (code: string) => weights.find((w) => w.code === code)?.weight ?? 0;
  const warnings: string[] = [];

  // ── نرمال‌سازی بر حضور: یا برای همه، یا برای هیچ‌کس ──────────────
  const perDayApplied = members.length > 0 && members.every((m) => (m.presentDays ?? 0) > 0);
  if (!perDayApplied && members.length > 1) {
    const missing = members.filter((m) => !(m.presentDays && m.presentDays > 0)).map((m) => m.name);
    warnings.push(
      `حضور ${missing.join("، ")} در این ماه ثبت نشده؛ حجم کار بر روز حضور تقسیم نشد. مقایسه‌ی نصفه‌نیمه بدتر از نکردنش است.`,
    );
  }

  // ── حجم و کف واجد شرایط بودن ──────────────────────────────────
  const volumeCodes = defs.filter((d) => d.volume && active.includes(d)).map((d) => d.code);
  const volumeOf = (m: MemberInput) => volumeCodes.reduce((s, c) => s + (m.raw[c]?.value ?? 0), 0);
  const volumes = new Map(members.map((m) => [m.userId, volumeOf(m)]));
  const medianVolume = median(members.map((m) => volumes.get(m.userId) ?? 0));
  const minVolume = medianVolume * (minVolumePct / 100);

  const eligibility = new Map<string, string | null>();
  for (const m of members) {
    const v = volumes.get(m.userId) ?? 0;
    if (v <= 0) eligibility.set(m.userId, "در این ماه حجم کاری ثبت نشده");
    else if (v < minVolume) eligibility.set(m.userId, `حجم کار کمتر از ${minVolumePct.toLocaleString("fa-IR")}٪ میانه‌ی گروه`);
    else eligibility.set(m.userId, null);
  }
  const eligibleIds = new Set(members.filter((m) => eligibility.get(m.userId) === null).map((m) => m.userId));

  // عددی که مقایسه می‌شود
  const compared = (m: MemberInput, code: string): number | null => {
    const r = m.raw[code];
    if (!r) return null;
    const def = defs.find((d) => d.code === code);
    if (def?.perDay && perDayApplied && m.presentDays) return r.value / m.presentDays;
    return r.value;
  };

  // ── مبنای هر معیار، فقط از واجدین ─────────────────────────────
  const reference = new Map<string, number>();
  for (const d of active) {
    let ref = 0;
    for (const m of members) {
      if (!eligibleIds.has(m.userId)) continue;
      const v = compared(m, d.code);
      if (v !== null && v > ref) ref = v;
    }
    reference.set(d.code, ref);
  }

  const results: MemberResult[] = members.map((m) => {
    const volume = volumes.get(m.userId) ?? 0;
    let sumPoints = 0;
    let sumWeight = 0;

    const metrics: MetricResult[] = defs.map((d) => {
      const r = m.raw[d.code] ?? null;
      const isActive = active.includes(d);
      const base: MetricResult = {
        code: d.code,
        raw: r ? round(r.value, 4) : null,
        num: r?.num,
        den: r?.den,
        compared: null,
        reference: null,
        normalized: null,
        weight: isActive ? weightOf(d.code) : 0,
        points: 0,
        status: "dropped",
      };
      if (!isActive) return base;

      const ref = reference.get(d.code) ?? 0;
      const v = compared(m, d.code);
      base.compared = v === null ? null : round(v, 4);
      base.reference = round(ref, 4);

      if (ref <= 0) return base; // هیچ واجدی عددی نداشت — برای همه کنار می‌رود
      if (v === null) return { ...base, status: "na" };

      const normalized = d.direction === 1 ? clamp01(v / ref) : clamp01(1 - v / ref);
      const w = weightOf(d.code);
      sumPoints += normalized * w;
      sumWeight += w;
      return { ...base, normalized: round(normalized, 4), points: round(normalized * w, 2), status: "ok" };
    });

    // غایبِ کامل: «کمتر بهتر» نباید به کسی که نبوده نمره‌ی کامل بدهد
    const score = volume <= 0 || sumWeight <= 0 ? 0 : round((sumPoints / sumWeight) * 100, 1);

    return {
      userId: m.userId,
      name: m.name,
      score,
      rank: null,
      eligible: eligibleIds.has(m.userId),
      reason: eligibility.get(m.userId) ?? null,
      volume: round(volume, 2),
      presentDays: m.presentDays,
      metrics,
      info: m.info,
    };
  });

  // ── رتبه: امتیاز، بعد سود (فقط تساوی‌شکن)، بعد حجم ─────────────
  results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    const pa = a.info?.profit ?? 0;
    const pb = b.info?.profit ?? 0;
    if (pb !== pa) return pb - pa;
    return b.volume - a.volume;
  });
  let rank = 0;
  for (const r of results) if (r.eligible) r.rank = ++rank;

  if (active.length === 0) warnings.push("هیچ معیاری در این گروه فعال نیست.");

  return {
    group,
    members: results,
    medianVolume: round(medianVolume, 2),
    minVolume: round(minVolume, 2),
    perDayApplied,
    warnings,
    weights,
  };
}
