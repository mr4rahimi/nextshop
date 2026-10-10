import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { searchModels } from "@/lib/accounting/inventory/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q — مدل‌های کالا (افزودن ترکیب تازه به مدل موجود) */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const models = await searchModels(new URL(req.url).searchParams.get("q"));
  return NextResponse.json({ items: models.map((m) => ({ id: m.id, title: m.title, groupId: m.groupId, items: m._count.items })) });
}
