/**
 * صفحه‌ی ورود پنل مدیریت.
 *
 * تنها کار این فایل خواندن نام و لوگوی فروشگاه است؛ خود فرم در
 * `components/admin/AdminLoginForm.tsx` است تا این صفحه سروری بماند.
 *
 * اسکلت پنل (سایدبار و هدر) روی این مسیر رندر نمی‌شود —
 * `app/admin/layout.tsx` مسیر `/admin/login` را کنار می‌گذارد.
 */

import { prisma } from "@/lib/prisma";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const metadata = { title: "ورود به پنل مدیریت" };

export default async function AdminLoginPage() {
  let storeName = "فروشگاه";
  let storeLogo: string | null = null;

  // نبودن تنظیمات نباید جلوی ورود را بگیرد؛ در بدترین حالت نام پیش‌فرض می‌ماند.
  try {
    const s = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { storeName: true, storeLogo: true },
    });
    if (s?.storeName) storeName = s.storeName;
    storeLogo = s?.storeLogo ?? null;
  } catch {}

  return <AdminLoginForm storeName={storeName} storeLogo={storeLogo} />;
}
