/**
 * منطق خالص پورسانت — بدون Prisma، تا هم سرور و هم فرم مرورگر از آن استفاده کنند.
 *
 * مستندات: docs/features/staff-worklist.md بخش ۲۲.۵ و ۲۲.۶
 */

export const CONDITION_LABELS: Record<string, string> = {
  NEW: "نو",
  STOCK: "استوک",
  USED: "دست‌دوم",
  REFURBISHED: "بازسازی‌شده",
};

export const DEAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "قیمت خرید ثبت نشده",
  CONFIRMED: "قطعی",
  VOID: "لغو یا مرجوع",
};

export interface RuleLike {
  id: string;
  categoryId: string | null;
  condition: string | null;
  percent: number;
  isActive: boolean;
}

export interface ItemLike {
  categoryId: string | null;
  categoryPath: string[];
  condition: string;
}

/**
 * مشخص‌ترین قاعده‌ی منطبق.
 *
 * امتیاز: دسته منطبق (خودش یا والدش) ۴، دقیقاً همان دسته ۲+، وضعیت منطبق ۱.
 * قاعده‌ی بدون شرط امتیاز صفر دارد و فقط وقتی برنده است که چیز دیگری نخورد.
 * تساوی با کمترین `id` شکسته می‌شود تا دو بار محاسبه دو جواب ندهد.
 */
export function pickRule<R extends RuleLike>(rules: R[], item: ItemLike): R | null {
  let best: R | null = null;
  let bestScore = -1;

  for (const r of rules) {
    if (!r.isActive) continue;
    let score = 0;
    if (r.categoryId) {
      if (!item.categoryPath.includes(r.categoryId) && item.categoryId !== r.categoryId) continue;
      score += 4;
      if (r.categoryId === item.categoryId) score += 2;
    }
    if (r.condition) {
      if (r.condition !== item.condition) continue;
      score += 1;
    }
    if (score > bestScore || (score === bestScore && best && r.id < best.id)) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

/**
 * پخش یک مبلغ به نسبت وزن‌ها، طوری که جمع دقیقاً همان مبلغ شود.
 *
 * باقی‌مانده‌ی گردکردن به ردیف‌هایی با بیشترین کسر می‌رسد (بزرگ‌ترین باقی‌مانده).
 * بدون این، جمع هزینه‌ی ردیف‌ها یکی دو ریال با عددی که کارمند وارد کرده نمی‌خواند.
 */
export function allocate(total: bigint, weights: bigint[]): bigint[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + (b > 0n ? b : 0n), 0n);
  if (sum === 0n) {
    // همه‌ی وزن‌ها صفر: مساوی پخش می‌شود
    const n = BigInt(weights.length);
    const base = total / n;
    const out = weights.map(() => base);
    out[out.length - 1] += total - base * n;
    return out;
  }
  const shares = weights.map((w) => ((w > 0n ? w : 0n) * total) / sum);
  let rest = total - shares.reduce((a, b) => a + b, 0n);
  const order = weights
    .map((w, i) => ({ i, frac: ((w > 0n ? w : 0n) * total) % sum }))
    .sort((a, b) => (b.frac > a.frac ? 1 : b.frac < a.frac ? -1 : a.i - b.i));
  for (let k = 0; rest > 0n; k = (k + 1) % order.length, rest--) shares[order[k].i] += 1n;
  return shares;
}

/** پورسانت یک ردیف: سود منفی پورسانت منفی نمی‌سازد */
export function commissionFor(profit: bigint, percent: number): bigint {
  if (profit <= 0n || percent <= 0) return 0n;
  // درصد تا دو رقم اعشار، بدون گذر از Number برای مبلغ
  const basis = BigInt(Math.round(percent * 100));
  return (profit * basis) / 10_000n;
}

export function ruleLabel(
  rule: { categoryId: string | null; condition: string | null; percent: number },
  categoryTitle?: string | null,
): string {
  const parts = [
    rule.categoryId ? categoryTitle ?? "دسته‌ی حذف‌شده" : "همه‌ی کالاها",
    rule.condition ? CONDITION_LABELS[rule.condition] ?? rule.condition : null,
  ].filter(Boolean);
  return `${parts.join(" · ")} — ${rule.percent}٪`;
}
