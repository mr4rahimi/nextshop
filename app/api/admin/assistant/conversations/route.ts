import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";
import { listConversations } from "@/lib/assistant/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** گفتگوهای خود کاربر — هیچ مسیری گفتگوی دیگران را برنمی‌گرداند (تصمیم ۴) */
export async function GET() {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ ok: false, error: "وارد نشده‌اید" }, { status: 401 });
  return NextResponse.json({ ok: true, items: await listConversations(access.userId) });
}
