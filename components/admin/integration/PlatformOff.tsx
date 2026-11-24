import Link from "next/link";
import { prisma } from "@/lib/prisma";

/**
 * هشدار بالای صفحه‌ی اتصال سرویسی که در «یکپارچه‌سازی ← تنظیمات» خاموش است.
 * docs/integrations/settings-and-guide.md
 */
export default async function PlatformOff({ code }: { code: string }) {
  const p = await prisma.integPlatform.findUnique({ where: { code }, select: { isActive: true, name: true } });
  if (!p || p.isActive) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
      <span className="flex-1">{p.name} در تنظیمات خاموش است؛ تا روشنش نکنید چیزی برایش ارسال یا از آن دریافت نمی‌شود.</span>
      <Link href="/admin/integration/settings" className="text-xs font-black underline">تنظیمات</Link>
    </div>
  );
}
