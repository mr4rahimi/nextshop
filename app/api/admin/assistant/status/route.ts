import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";
import { assistantQuota } from "@/lib/assistant/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** روشن بودن و سهمیه‌ی امروز کاربر جاری — دکمه‌ی ✨ با `enabled: false` پنهان می‌شود */
export async function GET() {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ ok: false, error: "وارد نشده‌اید" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await assistantQuota(access.userId)) });
}
