import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { clientIp } from "@/lib/moderation";
import { ToolError } from "@/lib/tools/common";
import { stockAlertState, subscribeStockAlert } from "@/lib/tools/stock-alerts";

export const runtime = "nodejs";

/**
 * فرم «موجود شد خبرم کن» صفحه‌ی محصول — docs/features/tools.md بخش ۷.
 *
 * ⚠️ خطای قابل‌نمایش با **۲۰۰ و `ok: false`**: CDN جلوی بعضی سایت‌ها بدنه‌ی ۴xx را
 * با صفحه‌ی HTML خودش عوض می‌کند.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId") ?? "";
  const user = await getAuthUser();
  const state = await stockAlertState(productId, user, url.searchParams.get("variantId") || null);
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "درخواست نامعتبر است" });
  }
  try {
    const user = await getAuthUser();
    const r = await subscribeStockAlert(body, { ip: clientIp(req), userId: user?.id ?? null });
    return NextResponse.json({ ok: true, already: r.already });
  } catch (e) {
    if (e instanceof ToolError) return NextResponse.json({ ok: false, error: e.message });
    console.error("[stock-alert]", e);
    return NextResponse.json({ ok: false, error: "ثبت نشد؛ دوباره تلاش کنید" }, { status: 500 });
  }
}
