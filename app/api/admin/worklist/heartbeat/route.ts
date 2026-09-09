import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";
import {
  recordHeartbeat,
  sessionContextFrom,
  HEARTBEAT_MS,
} from "@/lib/worklist/attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ضربانِ حضور — هر پنج دقیقه تا وقتی تبِ ادمین باز است.
 *
 * ⚠️ مجوز نمی‌خواهد، فقط کارمند بودن. حضورِ همه ثبت می‌شود؛ اینکه چه کسی
 * می‌تواند **ببیندش** با `ATTENDANCE_VIEW_*` تعیین می‌شود. اگر اینجا مجوز
 * می‌خواستیم، کارمندی که مجوز دیدنِ حضور ندارد اصلاً حضورش ثبت نمی‌شد.
 *
 * ⚠️ باید سبک بماند: یک `updateMany` روی ایندکس و تمام.
 */
export async function POST(req: Request) {
  const access = await getStaffAccess();
  if (!access) {
    // بی‌سروصدا: کوکی منقضی شده و کلاینت نباید خطا نشان دهد
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await recordHeartbeat(access.userId, sessionContextFrom(req));
    return NextResponse.json({ ok: true, recorded: result.recorded, nextMs: HEARTBEAT_MS });
  } catch (e) {
    console.error("[worklist] ضربان حضور شکست خورد:", e);
    // ضربان هرگز نباید در پنل خطا نشان دهد
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
