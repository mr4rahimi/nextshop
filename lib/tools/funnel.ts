/**
 * قیف فروش و نرخ تبدیل — منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۱۲
 *
 * مرحله‌ها پشت سر هم‌اند (نمایش ← کلیک ← تماس ← فروش …). برای هر مرحله:
 *   نرخ از مرحله‌ی قبل   n[i] / n[i−1]
 *   نرخ از اول قیف        n[i] / n[0]
 *   هزینه‌ی هر نفر         هزینه‌ی کل / n[i]
 *
 * «بزرگ‌ترین ریزش» = مرحله‌ای با کمترین نرخ از مرحله‌ی قبل.
 * «اگر»: نرخ یک مرحله عوض شود، چون مرحله‌های بعد نرخشان ثابت می‌ماند، خروجی آخر به همان نسبت
 * عوض می‌شود — `whatIf`.
 */

export interface FunnelStage {
  id: string;
  name: string;
  count: number;
}

export interface FunnelInput {
  stages: FunnelStage[];
  /** هزینه‌ی کل تبلیغ — اختیاری */
  cost: number;
  /** میانگین مبلغ هر فروش — اختیاری، برای درآمد و ROAS */
  avgOrder: number;
}

export interface StageResult {
  stage: FunnelStage;
  /** نسبت به مرحله‌ی قبل (۰ تا ۱)؛ null برای مرحله‌ی اول یا وقتی قبلی صفر است */
  fromPrev: number | null;
  /** نسبت به مرحله‌ی اول */
  fromFirst: number | null;
  /** چند نفر از مرحله‌ی قبل نرسیدند */
  dropped: number;
  /** هزینه‌ی هر نفر در این مرحله */
  costPer: number | null;
  /** عدد از مرحله‌ی قبل بیشتر است — احتمالاً منبع دیگری هم دارد */
  exceedsPrev: boolean;
}

export interface FunnelResult {
  rows: StageResult[];
  /** نرخ تبدیل کل: آخرین ÷ اولین */
  overall: number | null;
  /** اندیس مرحله‌ای با کمترین نرخ از قبلی */
  weakest: number | null;
  revenue: number | null;
  roas: number | null;
}

export const DEFAULT_FUNNEL: FunnelInput = {
  stages: [
    { id: "imp", name: "نمایش", count: 0 },
    { id: "click", name: "کلیک", count: 0 },
    { id: "lead", name: "تماس یا پیام", count: 0 },
    { id: "sale", name: "فروش", count: 0 },
  ],
  cost: 0,
  avgOrder: 0,
};

export const MAX_STAGES = 8;

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function calcFunnel(input: FunnelInput): FunnelResult {
  const counts = input.stages.map((s) => pos(s.count));
  const first = counts[0] ?? 0;
  const cost = pos(input.cost);

  const rows = input.stages.map((stage, i): StageResult => {
    const n = counts[i];
    const prev = i > 0 ? counts[i - 1] : 0;
    const fromPrev = i > 0 && prev > 0 ? n / prev : null;
    return {
      stage,
      fromPrev,
      fromFirst: i > 0 && first > 0 ? n / first : null,
      dropped: i > 0 ? Math.max(0, prev - n) : 0,
      costPer: cost > 0 && n > 0 ? cost / n : null,
      exceedsPrev: i > 0 && n > prev,
    };
  });

  // مرحله‌ای که نرخش ≥ ۱ است ریزشی ندارد و «ضعیف‌ترین» نمی‌شود
  let weakest: number | null = null;
  rows.forEach((r, i) => {
    if (r.fromPrev !== null && r.fromPrev < 1 && (weakest === null || r.fromPrev < rows[weakest].fromPrev!)) weakest = i;
  });

  const last = counts[counts.length - 1] ?? 0;
  const revenue = pos(input.avgOrder) > 0 && last > 0 ? last * pos(input.avgOrder) : null;
  return {
    rows,
    overall: counts.length > 1 && first > 0 ? last / first : null,
    weakest,
    revenue,
    roas: revenue !== null && cost > 0 ? revenue / cost : null,
  };
}

/** اگر نرخ مرحله‌ی `index` (از قبلی) به `rate` برسد، آخر قیف چند می‌شود */
export function whatIf(input: FunnelInput, index: number, rate: number): number | null {
  const counts = input.stages.map((s) => pos(s.count));
  if (index < 1 || index >= counts.length || counts[index - 1] <= 0 || counts[index] <= 0) return null;
  const current = counts[index] / counts[index - 1];
  return counts[counts.length - 1] * (pos(rate) / current);
}
