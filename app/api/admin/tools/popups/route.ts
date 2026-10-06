import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { createPopup, listPopups } from "@/lib/tools/popups";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/** فهرست پاپ‌آپ‌ها — docs/features/tools.md بخش ۹ */
export async function GET() {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  return NextResponse.json({ items: await listPopups() }, { headers: { "Cache-Control": "no-store" } });
}

/** پاپ‌آپ تازه همیشه خاموش ساخته می‌شود */
export async function POST(req: Request) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  try {
    const p = await createPopup(await readJson(req));
    logActivityAsync({ action: "CREATE", entity: "OTHER", entityId: p.id, entityTitle: p.name, summary: `پاپ‌آپ «${p.name}» ساخته شد` });
    return NextResponse.json(p);
  } catch (e) {
    return toolsError(e);
  }
}
