/**
 * محاسبه‌ی خالص قیمت آنلاین — بی‌دیتابیس، هم سرور هم مرورگر (نمونه‌ی صفحه‌ی «قیمت آنلاین»).
 * docs/plans/inventory-items.md بخش ۱۴.
 */

export type RoundMode = "down" | "nearest" | "up";
export function applyRule(store: bigint, pctBp: number, roundTo: number, mode: RoundMode): bigint {
  const raw = (store * BigInt(10000 + pctBp) + 5000n) / 10000n;
  if (roundTo <= 0) return raw;
  const r = BigInt(roundTo);
  const down = (raw / r) * r;
  if (down === raw) return raw;
  if (mode === "down") return down > 0n ? down : raw;
  if (mode === "up") return down + r;
  return raw - down >= r / 2n + (r % 2n) ? down + r : down > 0n ? down : raw;
}

