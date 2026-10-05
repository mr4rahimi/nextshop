import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { createShortLink, listShortLinks, serializeLink } from "@/lib/tools/short-links";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/** لینک‌های کوتاه — docs/features/tools.md بخش ۱. فقط `kind = MANUAL`؛ لینک QRها از بخش QR. */
export async function GET(req: Request) {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  return NextResponse.json(await listShortLinks(q, page), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const link = await createShortLink(await readJson(req), { createdById: g.access.userId });
    logActivityAsync({ action: "CREATE", entity: "OTHER", entityId: link.id, entityTitle: link.title, summary: `لینک کوتاه /s/${link.code} ساخته شد` });
    return NextResponse.json(serializeLink(link), { status: 201 });
  } catch (e) {
    return toolsError(e);
  }
}
