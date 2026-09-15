/**
 * دسترسی کاربر برای دروازه‌ی بخش‌های پنل در `proxy.ts` — با کش کوتاه.
 *
 * proxy روی هر درخواست پنل اجرا می‌شود؛ بدون کش هر کلیک دو کوئری اضافه
 * داشت. کش ۳۰ ثانیه‌ای یعنی تغییر نقش یک کارمند حداکثر نیم دقیقه بعد اثر
 * می‌کند — مسیر تغییر نقش `clearAdminGateCache()` را صدا می‌زند تا روی همان
 * پروسه فوری باشد.
 *
 * ⚠️ همان قاعده‌ی `getStaffAccess`: ADMIN بدون نقش = دسترسی کامل؛ نقشِ
 * غیرفعال = هیچ مجوزی (تله‌های ۱۰ و ۲۴).
 */

import { prisma } from "@/lib/prisma";
import type { GateAccess } from "./admin-sections";

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: GateAccess | null }>();

export async function getGateAccess(userId: string): Promise<GateAccess | null> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && now - hit.at < TTL_MS) return hit.value;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isActive: true,
      staffRoleId: true,
      staffRole: { select: { isActive: true, permissions: true } },
    },
  });

  let value: GateAccess | null = null;
  if (user && user.isActive && (user.role === "ADMIN" || user.role === "SELLER")) {
    if (!user.staffRoleId) {
      value = { isUnrestricted: user.role === "ADMIN", permissions: [] };
    } else {
      value = {
        isUnrestricted: false,
        permissions: user.staffRole?.isActive ? user.staffRole.permissions : [],
      };
    }
  }

  // سقف اندازه در برابر رشد بی‌پایان روی سرورِ همیشه‌روشن
  if (cache.size > 500) cache.clear();
  cache.set(userId, { at: now, value });
  return value;
}

export function clearAdminGateCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}
