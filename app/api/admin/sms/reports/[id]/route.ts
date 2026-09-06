import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getProvider } from "@/lib/club/sms";
import { errorResponse } from "@/lib/club/sms/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * جزئیات یک ارسال + وضعیت تحویل تک‌تک گیرنده‌ها
 *
 * ⚠️ `getDeliveryItems` صفحه‌به‌صفحه تا ۵۰ صفحه می‌گیرد و برای ارسال‌های بزرگ
 *    کند است؛ فقط وقتی `?items=1` باشد صدا زده می‌شود، نه در بارگذاری صفحه.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getAuthUser();
  if (!u || u.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isFinite(requestId) || requestId <= 0) {
    return NextResponse.json({ error: "شناسه ارسال نامعتبر است" }, { status: 400 });
  }

  try {
    const provider = await getProvider();
    const info = await provider.getSendRequest(requestId);

    const wantItems = new URL(req.url).searchParams.get("items") === "1";
    const items = wantItems ? await provider.getDeliveryItems(requestId) : null;

    return NextResponse.json({ request: info, items });
  } catch (err) {
    return errorResponse(err);
  }
}
