import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { myScore, parseMonth } from "@/lib/worklist/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * امتیاز خودِ کاربر جاری.
 *
 * ⚠️ شناسه هرگز از کلاینت گرفته نمی‌شود — فقط از نشست. وگرنه هر کارمندی با
 * عوض‌کردن یک پارامتر امتیاز همکارش را می‌دید.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["SCORE_VIEW_OWN", "SCORE_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const month = parseMonth(new URL(req.url).searchParams.get("month"));
  if (!month || month.isFuture) return NextResponse.json({ error: "ماه نامعتبر است" }, { status: 400 });

  return NextResponse.json(await myScore(guard.access.userId, month));
}
