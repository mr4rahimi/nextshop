/**
 * ریاضی خالص اعتبار باشگاه و کارت اشتراک — docs/plans/webhesab-parity.md بخش ۲۳.
 * بی دیتابیس، تا هم سرور و هم آزمون از آن استفاده کنند.
 *
 * دفتر امتیاز (`PointTransaction`) فقط ردیف + و − دارد. هر ردیف مثبت یک «شارژ»
 * (lot) با تاریخ انقضای خودش است. ردیف منفی از شارژی که زودتر منقضی می‌شود
 * برمی‌دارد (مثل «تخصیص» وب حساب). ردیف `EXPIRE` با `refType = "lot"` مانده‌ی
 * همان شارژ را می‌سوزاند. منفیِ بیش از موجودی «کسری» می‌شود و اولین شارژ بعدی
 * اول آن را پر می‌کند (مرجوعی بعد از خرج کردن اعتبار).
 *
 * کش‌بک خرید (بخش ۳۴.۲) `availableAt` دارد: تا آن لحظه «در انتظار» است — در مانده‌ی قابل
 * خرج نیست و هیچ خرجی از آن برنمی‌دارد، ولی می‌سوزد/برمی‌گردد مثل بقیه.
 */

export interface LedgerRow {
  id: string;
  amount: number;
  reason: string;
  refType: string | null;
  refId: string | null;
  expiresAt: Date | null;
  availableAt?: Date | null;
  createdAt: Date;
}

export interface Lot {
  id: string;
  amount: number;
  remaining: number;
  expiresAt: Date | null;
  availableAt: Date | null;
  createdAt: Date;
}

export interface LedgerState {
  /** امتیاز قابل خرج (شارژهای معتبر − کسری) */
  balance: number;
  /** کسری باز (منفیِ بیش از موجودی) */
  deficit: number;
  /** شارژهای دارای مانده که هنوز معتبرند — زودانقضاترین اول (در انتظارها هم) */
  live: Lot[];
  /** کش‌بک در انتظار (هنوز خرج‌شدنی نیست) و زودترین زمان آزاد شدنش */
  pending: number;
  pendingAt: Date | null;
  /** شارژهای منقضی که مانده دارند و ردیف سوختشان هنوز نخورده */
  expiredUnposted: Lot[];
}

const byExpiry = (a: Lot, b: Lot) => {
  const ea = a.expiresAt?.getTime() ?? Infinity;
  const eb = b.expiresAt?.getTime() ?? Infinity;
  return ea - eb || a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1);
};

/**
 * بازپخش دفتر یک عضو. `enforceExpiry` خاموش = انقضا نادیده (رفتار قدیمی؛ مانده = جمع ساده).
 */
export function replayLedger(rows: LedgerRow[], now: Date, enforceExpiry: boolean): LedgerState {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1));
  const lots: Lot[] = [];
  let deficit = 0;
  const valid = (l: Lot, at: Date) => !enforceExpiry || !l.expiresAt || l.expiresAt.getTime() > at.getTime();
  const ready = (l: Lot, at: Date) => !l.availableAt || l.availableAt.getTime() <= at.getTime();

  for (const r of sorted) {
    if (r.amount > 0) {
      const fill = Math.min(deficit, r.amount);
      deficit -= fill;
      lots.push({ id: r.id, amount: r.amount, remaining: r.amount - fill, expiresAt: r.expiresAt, availableAt: r.availableAt ?? null, createdAt: r.createdAt });
      continue;
    }
    if (r.amount === 0) continue;
    let need = -r.amount;
    if (r.reason === "EXPIRE" && r.refType === "lot" && r.refId) {
      const lot = lots.find((l) => l.id === r.refId);
      if (lot) {
        const take = Math.min(lot.remaining, need);
        lot.remaining -= take;
        need -= take;
      }
      // سوخت بیش از مانده‌ی شارژ معنا ندارد؛ باقی‌اش نادیده می‌ماند
      continue;
    }
    for (const lot of lots.filter((l) => l.remaining > 0 && valid(l, r.createdAt) && ready(l, r.createdAt)).sort(byExpiry)) {
      if (!need) break;
      const take = Math.min(lot.remaining, need);
      lot.remaining -= take;
      need -= take;
    }
    deficit += need;
  }

  const open = lots.filter((l) => l.remaining > 0);
  const live = open.filter((l) => valid(l, now)).sort(byExpiry);
  const expiredUnposted = open.filter((l) => !valid(l, now));
  const waiting = live.filter((l) => !ready(l, now));
  const pendingAt = waiting.reduce<Date | null>((m, l) => (!m || l.availableAt!.getTime() < m.getTime() ? l.availableAt : m), null);
  return {
    balance: live.filter((l) => ready(l, now)).reduce((s, l) => s + l.remaining, 0) - deficit,
    deficit,
    live,
    pending: waiting.reduce((s, l) => s + l.remaining, 0),
    pendingAt,
    expiredUnposted,
  };
}

/** امتیاز → تومان (به پایین) */
export const pointsToToman = (points: number, rate: number) => (points > 0 ? BigInt(Math.floor(points * rate)) : 0n);

/** تومان → امتیاز لازم (به بالا، تا ارزشش کمتر از مبلغ نشود) */
export function tomanToPoints(toman: bigint, rate: number): number {
  if (toman <= 0n || rate <= 0) return 0;
  return Math.ceil(Number(toman) / rate - 1e-9);
}

export interface EarnRules {
  perToman: number;
  redeemRate: number;
}

/**
 * امتیاز یک خرید. سطح با `cardChargeBp` (مثلاً ۱۰۰۰ = ۱۰٪) ارزش امتیاز را درصدی از
 * مبلغ می‌کند؛ وگرنه فرمول قدیمی `مبلغ × امتیاز هر تومان × ضریب سطح`.
 */
export function earnPoints(amount: bigint, rules: EarnRules, tier: { pointRate: number; cardChargeBp: number | null } | null): number {
  // ⚠️ مبنای کش‌بک (مبلغ خرید یا سود ناخالص) را فراخوان با `chargeBase` می‌دهد
  if (amount <= 0n) return 0;
  if (tier?.cardChargeBp != null) {
    if (tier.cardChargeBp <= 0 || rules.redeemRate <= 0) return 0;
    return Math.floor((Number(amount) * tier.cardChargeBp) / 10_000 / rules.redeemRate + 1e-9);
  }
  if (rules.perToman <= 0) return 0;
  return Math.floor(Number(amount) * rules.perToman * (tier?.pointRate ?? 1));
}

/**
 * شماره‌ی کارت یکدست: کارت‌خوان مغناطیسی `%2111…؟` یا با کیبورد فارسی `٪۲۱۱۱…؟`
 * می‌فرستد. علامت‌های آغاز و پایان track، فاصله و رقم فارسی/عربی حذف/لاتین می‌شوند.
 */
export function normalizeCardNumber(raw: string | null | undefined): string {
  const latin = String(raw ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return latin.replace(/[%٪;؛?؟=\s\-_]/g, "").toUpperCase();
}

/** شبیه شماره‌ی کارت؟ (برای اسکن صندوق، پیش از جستجوی کالا) */
export const looksLikeCard = (raw: string) => /^[%٪;]/.test(raw.trim()) || /[?؟]$/.test(raw.trim());

/** سهم تناسبی با گرد کردن، تجمعی (جمع سهم‌ها در برگشت کامل دقیقاً برابر کل شود) */
export function proportional(total: bigint, part: bigint, whole: bigint): bigint {
  if (whole <= 0n || total <= 0n) return 0n;
  if (part >= whole) return total;
  return (total * part + whole / 2n) / whole;
}

/**
 * مبنای کش‌بک کارت (بخش ۳۴.۲): مبلغ خرید، یا با «از سود ناخالص» فروش خالص (بی مالیات و
 * هزینه‌ی ارسال) منهای بهای تمام‌شده — منفی ← صفر. فقط برای سطح با «درصد شارژ کارت»؛
 * فرمول قدیمی امتیاز هر تومان همیشه روی مبلغ خرید است.
 */
export function chargeBase(input: { amount: bigint; netSale: bigint; cost: bigint }, onProfit: boolean, tier: { cardChargeBp: number | null } | null): bigint {
  if (!onProfit || tier?.cardChargeBp == null) return input.amount;
  const p = input.netSale - input.cost;
  return p > 0n ? p : 0n;
}
