import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";
import { deleteConversation, getConversationView } from "@/lib/assistant/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * یک گفتگوی خود کاربر. کلاینت وقتی جریان SSE نرسید یا وسطش قطع شد، پاسخ ذخیره‌شده را از
 * همین‌جا می‌خواند (بخش ۹ سند — بافر CDN).
 */
export async function GET(_req: Request, { params }: Params) {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ ok: false, error: "وارد نشده‌اید" }, { status: 401 });
  const { id } = await params;
  const view = await getConversationView(access.userId, id);
  if (!view) return NextResponse.json({ ok: false, error: "گفتگو پیدا نشد" });
  return NextResponse.json({ ok: true, ...view });
}

export async function DELETE(_req: Request, { params }: Params) {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ ok: false, error: "وارد نشده‌اید" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteConversation(access.userId, id);
  return NextResponse.json(ok ? { ok: true } : { ok: false, error: "گفتگو پیدا نشد" });
}
