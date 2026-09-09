import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { runRecurringRules } from "@/lib/worklist/recurring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * اجرای دستی قواعد تکرارشونده.
 *
 * زمان‌بند خودش هر ده دقیقه اجرا می‌شود؛ این دکمه برای وقتی است که مدیر
 * قاعده‌ای ساخته و می‌خواهد **همین حالا** نتیجه‌اش را ببیند، بی‌آنکه منتظر
 * چرخه‌ی بعدی بماند.
 *
 * اجرای دوباره بی‌خطر است: ایندکس یکتای `StaffTask.runKey` جلوی ساخت تکراری
 * را می‌گیرد، پس فشردن چندباره‌ی دکمه کارتابل را پر نمی‌کند.
 */
export async function POST() {
  const guard = await requirePermission("WORK_SETTINGS_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const results = await runRecurringRules();
  const created = results.reduce((sum, r) => sum + r.created, 0);

  return NextResponse.json({ created, results });
}
