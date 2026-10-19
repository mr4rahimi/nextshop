import { NextResponse } from "next/server";
import { requirePermission, can } from "@/lib/permissions";
import { monthScore, parseMonth } from "@/lib/worklist/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * رتبه‌بندی ماهانه‌ی همه‌ی گروه‌ها — بخش ۱۵ مستندات کارتابل.
 * گروهی که برنده‌اش ثبت شده از اسنپ‌شات قفل‌شده خوانده می‌شود، بقیه زنده.
 */
export async function GET(req: Request) {
  const guard = await requirePermission("SCORE_VIEW_ALL");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const month = parseMonth(new URL(req.url).searchParams.get("month"));
  if (!month) return NextResponse.json({ error: "ماه نامعتبر است" }, { status: 400 });
  if (month.isFuture) return NextResponse.json({ error: "این ماه هنوز نرسیده" }, { status: 400 });

  const data = await monthScore(month);
  return NextResponse.json({ ...data, canManage: can(guard.access, "SCORE_SETTINGS_MANAGE") });
}
