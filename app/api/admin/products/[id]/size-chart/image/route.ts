import { NextResponse } from "next/server";
import { setSizeChartImage } from "@/lib/size-guide-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT { url | null } — عکس جدول سایز آخر گالری (docs/features/size-guide.md فاز ۲).
 * عکس را مرورگر می‌سازد و از /api/admin/upload بالا می‌برد؛ اینجا فقط جای عکس قبلی عوض می‌شود.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const url = typeof b?.url === "string" && b.url.trim() ? b.url.trim() : null;
  if (url && (url.length > 500 || !/^(\/|https:\/\/)/.test(url))) return NextResponse.json({ error: "نشانی عکس نامعتبر است" }, { status: 400 });
  try {
    const old = await setSizeChartImage(id, url);
    return NextResponse.json({ ok: true, old, url });
  } catch (e) {
    console.error("[size-chart/image]", e);
    return NextResponse.json({ error: "عکس در گالری ثبت نشد" }, { status: 500 });
  }
}
