import { NextResponse } from "next/server";
import { normalizeChart } from "@/lib/size-guide";
import { loadSizeChartAdmin, saveSizeChart } from "@/lib/size-guide-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — جدول سایز، نوع پیشنهادی، سایزهای تنوع، جدول هم‌دسته (docs/features/size-guide.md) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadSizeChartAdmin(id);
  if (!data) return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
  return NextResponse.json(data);
}

/** PUT { kind, columns, rows, fit, sizing, note } — بی‌ردیف یعنی حذف جدول */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = normalizeChart(await req.json().catch(() => null));
  if ("error" in n) return NextResponse.json({ error: n.error }, { status: 400 });
  let removedImage: string | null;
  try {
    removedImage = await saveSizeChart(id, n.chart);
  } catch (e) {
    console.error("[size-chart]", e);
    return NextResponse.json({ error: "ذخیره نشد" }, { status: 500 });
  }
  return NextResponse.json({ ...(await loadSizeChartAdmin(id)), removedImage });
}
