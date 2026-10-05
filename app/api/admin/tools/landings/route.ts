import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { createLanding, listLandings } from "@/lib/tools/landings";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/** لندینگ‌ها — docs/features/tools.md بخش ۳ */
export async function GET() {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  return NextResponse.json({ items: await listLandings() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const l = await createLanding(await readJson(req), g.access.userId);
    logActivityAsync({ action: "CREATE", entity: "OTHER", entityId: l.id, entityTitle: l.title, summary: `لندینگ /l/${l.slug} ساخته شد` });
    return NextResponse.json(l, { status: 201 });
  } catch (e) {
    return toolsError(e);
  }
}
