/**
 * تنظیمات کارتابل که در `StoreSettings` می‌نشینند — خواندن با کش کوتاه.
 *
 * زمان‌بند هر ده دقیقه و مسیر حضور با هر بار باز شدن صفحه این‌ها را می‌خوانند؛
 * بدون کش هر بار یک کوئری روی جدولی می‌رفت که تقریباً هیچ‌وقت عوض نمی‌شود.
 */

import { prisma } from "@/lib/prisma";
import { normalizeWorkHours, type DayHours } from "./work-hours";

/** یک بازارگاه، همان‌طور که در `StoreSettings.worklistPlatforms` ذخیره می‌شود */
export interface Platform {
  key: string;
  label: string;
}

/**
 * فهرست بازارگاه‌ها از Json. ردیف خراب کنار گذاشته می‌شود، نه اینکه کل فهرست
 * بیفتد — یک ردیف بد نباید فرم ثبت کار را از کار بیندازد.
 */
export function normalizePlatforms(raw: unknown): Platform[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const { key, label } = p as Record<string, unknown>;
    if (typeof key !== "string" || typeof label !== "string") return [];
    const k = key.trim();
    const l = label.trim();
    if (!k || !l || seen.has(k)) return [];
    seen.add(k);
    return [{ key: k, label: l }];
  });
}

export interface WorklistConfig {
  workHours: DayHours[];
  loyalMinOrders: number;
  loyalMinSpent: bigint;
  platforms: Platform[];
}

const TTL_MS = 60_000;
let cache: { at: number; value: WorklistConfig } | null = null;

export async function getWorklistConfig(): Promise<WorklistConfig> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  try {
    const s = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: {
        worklistWorkHours: true,
        worklistLoyalMinOrders: true,
        worklistLoyalMinSpent: true,
        worklistPlatforms: true,
      },
    });
    const value: WorklistConfig = {
      workHours: normalizeWorkHours(s?.worklistWorkHours),
      loyalMinOrders: s?.worklistLoyalMinOrders ?? 2,
      loyalMinSpent: s?.worklistLoyalMinSpent ?? 0n,
      platforms: normalizePlatforms(s?.worklistPlatforms),
    };
    cache = { at: now, value };
    return value;
  } catch {
    // دیتابیس در دسترس نیست: پیش‌فرض‌ها، بدون شکستن فراخواننده
    return { workHours: normalizeWorkHours(null), loyalMinOrders: 2, loyalMinSpent: 0n, platforms: [] };
  }
}

export function clearWorklistConfigCache(): void {
  cache = null;
}
