import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { createAxis, listAxes } from "@/lib/accounting/inventory/catalog";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ویژگی‌های کالا (رنگ، سایز…) با مقدارهای تا امروز — جدا از ویژگی‌های فروشگاه */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ items: await listAxes() });
}

/** POST { name } — ویژگی تازه */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ name?: string }>(req);
    const a = await prisma.$transaction((tx) => createAxis(tx, b.name));
    return NextResponse.json({ ok: true, item: { ...a, values: [] } });
  } catch (e) {
    return accErrorResponse(e, "[acc-axis]");
  }
}
