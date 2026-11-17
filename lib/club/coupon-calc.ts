/**
 * مبلغ تخفیف یک کد روی یک جمع — بی وابستگی به پایگاه، تا صندوق (مرورگر) و سرور یک فرمول داشته باشند.
 * docs/plans/webhesab-parity.md بخش ۲۶.
 */
export function couponAmount(c: { type: string; value: bigint; maxDiscount: bigint }, total: bigint): bigint {
  if (c.type === "FREE_SHIP" || total <= 0n) return 0n;
  let d = c.type === "PERCENT" ? (total * c.value) / 100n : c.value;
  if (c.type === "PERCENT" && c.maxDiscount > 0n && d > c.maxDiscount) d = c.maxDiscount;
  return d > total ? total : d;
}
