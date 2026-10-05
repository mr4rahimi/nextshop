import { NextResponse } from "next/server";
import { clientIp } from "@/lib/moderation";
import { ToolError } from "@/lib/tools/common";
import { submitLandingCallback } from "@/lib/tools/landings";

export const runtime = "nodejs";

/**
 * فرم «درخواست تماس» لندینگ → «درخواست‌های تماس» پنل.
 * فقط لندینگ منتشرشده‌ای که واقعاً بلوک فرم دارد؛ سقف ۳ در ساعت به‌ازای IP.
 * docs/features/tools.md بخش ۳
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    await submitLandingCallback(decodeURIComponent(slug), body, { ip: clientIp(req), host });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ToolError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[landing-callback]", e);
    return NextResponse.json({ error: "ثبت نشد؛ دوباره تلاش کنید" }, { status: 500 });
  }
}
