import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { createQrCode, listQrCodes } from "@/lib/tools/qr-codes";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/**
 * کیوآر کدهای ذخیره‌شده — docs/features/tools.md بخش ۲.
 * QR ثابت بدون ذخیره هم در مرورگر ساخته و دانلود می‌شود؛ اینجا فقط ذخیره است.
 */
export async function GET() {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  return NextResponse.json({ items: await listQrCodes() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const qr = await createQrCode(await readJson(req), g.access.userId);
    logActivityAsync({ action: "CREATE", entity: "OTHER", entityId: qr.id, entityTitle: qr.title, summary: `کیوآر کد ${qr.isDynamic ? "پویا" : "ثابت"} ساخته شد` });
    return NextResponse.json(qr, { status: 201 });
  } catch (e) {
    return toolsError(e);
  }
}
