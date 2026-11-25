/**
 * حساب دارایی ثابت و پیش‌پرداخت — بی‌پایگاه‌داده، در فرم هم اجرا می‌شود.
 * docs/plans/webhesab-parity.md بخش ۳۴.۵.
 *
 * استهلاک ماه‌به‌ماه شمسی، از اول ماهی که دارایی به کار افتاده (ماه کامل؛ ماده‌ی ۱۴۹).
 *   خط مستقیم: انباشته پس از n ماه = (بها − ارزش اسقاط) × n ÷ عمر
 *   نزولی:     ارزش دفتری هر ماه × نرخ سالانه ÷ ۱۲، هرگز زیر ارزش اسقاط
 * «هدف انباشته» تجمعی است؛ هر سند = هدف تا آخر ماه − ثبت‌شده. پس ماه بسته یا قفل
 * جا نمی‌ماند (در اولین ماه باز می‌نشیند) و گرد کردن روی هم جمع نمی‌شود.
 */

import { fromJalali, toJalali } from "@/lib/club/jalali";

export type AssetCategory = "FURNITURE" | "EQUIPMENT" | "VEHICLE" | "FITOUT" | "COMPUTER" | "OTHER";
export type DepMethod = "STRAIGHT" | "DECLINING";

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  FURNITURE: "اثاثه و منصوبات",
  EQUIPMENT: "تجهیزات و ابزار",
  VEHICLE: "وسیله‌ی نقلیه",
  FITOUT: "دکوراسیون و بهسازی مغازه",
  COMPUTER: "رایانه و تجهیزات الکترونیکی",
  OTHER: "سایر",
};

/**
 * پیش‌فرض هر گروه — از جدول استهلاکات ماده‌ی ۱۴۹ ق.م.م (قابل تغییر در فرم).
 * `accountCode` حساب پیشنهادی در سرفصل پیش‌فرض است، نه اجبار.
 */
export const CATEGORY_DEFAULTS: Record<AssetCategory, { method: DepMethod; lifeMonths?: number; rateBp?: number; accountCode: string; hint: string }> = {
  FURNITURE: { method: "STRAIGHT", lifeMonths: 120, accountCode: "2101", hint: "میز، قفسه، ویترین، صندلی — ۱۰ ساله" },
  EQUIPMENT: { method: "STRAIGHT", lifeMonths: 120, accountCode: "2101", hint: "یخچال، کولر، دوربین، ترازو — ۱۰ ساله" },
  VEHICLE: { method: "DECLINING", rateBp: 2500, accountCode: "2102", hint: "سواری و وانت — نزولی ۲۵٪" },
  FITOUT: { method: "STRAIGHT", lifeMonths: 60, accountCode: "2103", hint: "دکور و بهسازی مغازه — ۵ ساله، یا مدت اجاره اگر کوتاه‌تر است" },
  COMPUTER: { method: "STRAIGHT", lifeMonths: 36, accountCode: "2104", hint: "رایانه، کارتخوان، چاپگر — ۳ ساله" },
  OTHER: { method: "STRAIGHT", lifeMonths: 60, accountCode: "2101", hint: "" },
};

export const ASSET_CATEGORIES = Object.keys(CATEGORY_LABELS) as AssetCategory[];

/** شماره‌ی ماه `at` از ماه `start` — ماه خود start = ۱؛ پیش از آن = ۰ */
export function monthIndex(start: Date, at: Date): number {
  const a = toJalali(start);
  const b = toJalali(at);
  return Math.max(0, (b.year - a.year) * 12 + (b.month - a.month) + 1);
}

/** آخر ماه شمسیِ n-امین ماه از ماه start (n = ۱ ← آخر همان ماه) */
export function monthEndAt(start: Date, n: number): Date {
  const j = toJalali(start);
  const total = j.year * 12 + (j.month - 1) + n;
  const y = Math.floor(total / 12);
  const m = total % 12;
  return new Date(fromJalali(y, m + 1, 1)!.getTime() - 86_400_000);
}

export interface DepParams {
  cost: bigint;
  salvage: bigint;
  method: DepMethod;
  lifeMonths: number | null;
  rateBp: number | null;
  openingAccum: bigint;
}

/** استهلاک انباشته‌ی کل پس از n ماه (شامل آنچه پیش از برنامه بوده) */
export function depTotal(p: DepParams, n: number): bigint {
  const base = p.cost - p.salvage;
  if (base <= 0n || n <= 0) return 0n;
  if (p.method === "STRAIGHT") {
    const life = p.lifeMonths ?? 0;
    if (life <= 0) return 0n;
    return n >= life ? base : (base * BigInt(n)) / BigInt(life);
  }
  const r = BigInt(p.rateBp ?? 0);
  if (r <= 0n) return 0n;
  let bv = p.cost;
  for (let i = 0; i < n && bv > p.salvage; i++) {
    const d = (bv * r + 60_000n) / 120_000n;
    bv = bv - d < p.salvage ? p.salvage : bv - d;
    if (d === 0n) break;
  }
  return p.cost - bv;
}

/** سهم برنامه از انباشته پس از n ماه — انباشته‌ی قبلی کم می‌شود، سقف = بها − اسقاط − قبلی */
export function depTarget(p: DepParams, n: number): bigint {
  const cap = p.cost - p.salvage - p.openingAccum;
  if (cap <= 0n) return 0n;
  const t = depTotal(p, n) - p.openingAccum;
  return t <= 0n ? 0n : t > cap ? cap : t;
}

/** پیش‌پرداخت: هزینه‌ی انباشته پس از n ماه */
export function prepaidTarget(amount: bigint, months: number, n: number): bigint {
  if (n <= 0 || months <= 0) return 0n;
  return n >= months ? amount : (amount * BigInt(n)) / BigInt(months);
}

/** جدول پیش‌نمایش استهلاک: ماه‌به‌ماه تا تمام شدن (حداکثر `max` ردیف) */
export function depSchedule(p: DepParams, start: Date, max = 600): { n: number; end: Date; amount: bigint; accum: bigint; book: bigint }[] {
  const out: { n: number; end: Date; amount: bigint; accum: bigint; book: bigint }[] = [];
  let prev = 0n;
  for (let n = 1; n <= max; n++) {
    const t = depTarget(p, n);
    if (t === prev && n > 1) {
      if (p.method === "STRAIGHT" && n > (p.lifeMonths ?? 0)) break;
      if (p.method === "DECLINING" && t >= p.cost - p.salvage - p.openingAccum) break;
    }
    out.push({ n, end: monthEndAt(start, n), amount: t - prev, accum: p.openingAccum + t, book: p.cost - p.openingAccum - t });
    prev = t;
    if (t >= p.cost - p.salvage - p.openingAccum) break;
  }
  return out;
}

/** خلاصه‌ی سالانه‌ی جدول — هر سال شمسی یک ردیف */
export function yearlySchedule(rows: ReturnType<typeof depSchedule>) {
  const by = new Map<number, { year: number; amount: bigint; book: bigint }>();
  for (const r of rows) {
    const y = toJalali(r.end).year;
    const cur = by.get(y) ?? { year: y, amount: 0n, book: r.book };
    cur.amount += r.amount;
    cur.book = r.book;
    by.set(y, cur);
  }
  return [...by.values()];
}
