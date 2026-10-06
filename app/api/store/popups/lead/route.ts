import { NextResponse } from "next/server";
import { clientIp } from "@/lib/moderation";
import { ToolError } from "@/lib/tools/common";
import { submitPopupLead } from "@/lib/tools/popups";

export const runtime = "nodejs";

/**
 * ثبت شماره در پاپ‌آپ — docs/features/tools.md بخش ۹.
 * ⚠️ خطای قابل‌نمایش با ۲۰۰ و `ok: false` (CDN بدنه‌ی ۴xx را عوض می‌کند).
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "درخواست نامعتبر است" });
  }
  try {
    const r = await submitPopupLead(body, { ip: clientIp(req) });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof ToolError) return NextResponse.json({ ok: false, error: e.message });
    console.error("[popup-lead]", e);
    return NextResponse.json({ ok: false, error: "ثبت نشد؛ دوباره تلاش کنید" }, { status: 500 });
  }
}
