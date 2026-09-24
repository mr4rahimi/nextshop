import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { saveWarehouse, type WarehouseInput } from "@/lib/accounting/inventory/docs";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const body = await readJson<WarehouseInput>(req);
    const w = await prisma.$transaction((tx) => saveWarehouse(tx, id, body));
    return NextResponse.json(serialize({ ok: true, item: w }));
  } catch (e) {
    return accErrorResponse(e, "[acc-warehouse]");
  }
}
