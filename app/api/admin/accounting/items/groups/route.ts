import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/permissions";
import { listGroups, saveGroup } from "@/lib/accounting/inventory/catalog";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** گروه‌های کالا — docs/plans/inventory-items.md فاز ۲ */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ items: await listGroups(), can: { manage: can(guard.access, "ACC_INVENTORY") } });
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson(req);
    const g = await prisma.$transaction((tx) => saveGroup(tx, null, b));
    return NextResponse.json({ ok: true, item: g });
  } catch (e) {
    return accErrorResponse(e, "[acc-item-group]");
  }
}
