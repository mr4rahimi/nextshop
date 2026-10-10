import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { deleteGroup, saveGroup } from "@/lib/accounting/inventory/catalog";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson(req);
    const g = await prisma.$transaction((tx) => saveGroup(tx, id, b));
    return NextResponse.json({ ok: true, item: g });
  } catch (e) {
    return accErrorResponse(e, "[acc-item-group]");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    await prisma.$transaction((tx) => deleteGroup(tx, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-item-group]");
  }
}
