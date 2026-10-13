import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";
import { setFeedback } from "@/lib/assistant/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** 👍/👎 روی پاسخ — فقط پیام خود کاربر */
export async function POST(req: Request, { params }: Params) {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ ok: false, error: "وارد نشده‌اید" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { feedback?: unknown } | null;
  const feedback = body?.feedback === 1 || body?.feedback === -1 ? body.feedback : null;
  const ok = await setFeedback(access.userId, id, feedback);
  return NextResponse.json(ok ? { ok: true } : { ok: false, error: "پیام پیدا نشد" });
}
