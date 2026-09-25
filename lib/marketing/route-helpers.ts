/**
 * پوسته‌ی مشترک مسیرهای API لینک‌سازی: نگهبان مجوز + تبدیل خطای سرویس به
 * پاسخ فارسی.
 *
 * ⚠️ در `lib` است نه در فایل روت: Next.js از `route.ts` فقط هندلرهای HTTP
 * را می‌پذیرد و هر export دیگری بیلد را می‌شکند (درس ۶ بخش ۱۰.۶).
 */

import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { requirePermission, type StaffAccess } from "@/lib/permissions";

/** هر کسی که در لینک‌سازی کاری دارد */
export const LINK_ANY = ["LINK_WORK", "LINK_MANAGE", "MARKETING_VIEW_ALL"];

export async function withLinkGuard(
  permissions: string | string[],
  fn: (access: StaffAccess) => Promise<unknown>,
  status = 200,
) {
  const guard = await requirePermission(permissions);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const result = await fn(guard.access);
    if (result instanceof NextResponse) return result;
    return NextResponse.json(serialize(result ?? { ok: true }), { status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export function forbidden(message = "به این بخش دسترسی ندارید") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  return ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
}
