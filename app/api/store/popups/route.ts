import { NextResponse } from "next/server";
import { publicPopups, recordPopupEvent } from "@/lib/tools/popups";

export const runtime = "nodejs";

/**
 * پاپ‌آپ‌های روشن برای میزبان سایت — docs/features/tools.md بخش ۹.
 * برای همه یکسان است و کش کوتاه CDN دارد؛ تطبیق صفحه و دفعات در مرورگر است.
 */
export async function GET() {
  try {
    return NextResponse.json({ items: await publicPopups() }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60" } });
  } catch (e) {
    console.error("[popups]", e);
    return NextResponse.json({ items: [] });
  }
}

/** شمارش نمایش، کلیک و بستن — بی‌پاسخ و بی‌خطا */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { id?: unknown; type?: unknown };
    await recordPopupEvent(b.id, b.type);
  } catch {}
  return new NextResponse(null, { status: 204 });
}
