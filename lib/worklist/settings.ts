/**
 * تنظیمات کارتابل که در `StoreSettings` می‌نشینند — خواندن با کش کوتاه.
 *
 * زمان‌بند هر ده دقیقه و مسیر حضور با هر بار باز شدن صفحه این‌ها را می‌خوانند؛
 * بدون کش هر بار یک کوئری روی جدولی می‌رفت که تقریباً هیچ‌وقت عوض نمی‌شود.
 */

import { prisma } from "@/lib/prisma";
import { normalizeWorkHours, type DayHours } from "./work-hours";

export interface WorklistConfig {
  workHours: DayHours[];
  loyalMinOrders: number;
  loyalMinSpent: bigint;
}

const TTL_MS = 60_000;
let cache: { at: number; value: WorklistConfig } | null = null;

export async function getWorklistConfig(): Promise<WorklistConfig> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  try {
    const s = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { worklistWorkHours: true, worklistLoyalMinOrders: true, worklistLoyalMinSpent: true },
    });
    const value: WorklistConfig = {
      workHours: normalizeWorkHours(s?.worklistWorkHours),
      loyalMinOrders: s?.worklistLoyalMinOrders ?? 2,
      loyalMinSpent: s?.worklistLoyalMinSpent ?? 0n,
    };
    cache = { at: now, value };
    return value;
  } catch {
    // دیتابیس در دسترس نیست: پیش‌فرض‌ها، بدون شکستن فراخواننده
    return { workHours: normalizeWorkHours(null), loyalMinOrders: 2, loyalMinSpent: 0n };
  }
}

export function clearWorklistConfigCache(): void {
  cache = null;
}
