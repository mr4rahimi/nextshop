import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { updateItem } from "@/lib/accounting/inventory/items";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { parseItemInput } from "../parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — مشخصات کالا با بارکدها و کدهای قبلی */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const item = await prisma.accItem.findUnique({
    where: { id },
    include: { barcodes: { orderBy: { barcode: "asc" } }, aliases: { orderBy: { createdAt: "desc" } } },
  });
  if (!item) return NextResponse.json({ error: "کالا پیدا نشد" }, { status: 404 });
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, title: true, slug: true } });
  return NextResponse.json(serialize({ item, product, can: { manage: can(guard.access, "ACC_INVENTORY") } }));
}

/** PATCH — ویرایش؛ کد عوض‌شده در «کدهای قبلی» می‌ماند */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const input = parseItemInput(await readJson(req));
    const item = await prisma.$transaction((tx) => updateItem(tx, id, input));
    return NextResponse.json(serialize({ ok: true, item }));
  } catch (e) {
    return accErrorResponse(e, "[acc-item]");
  }
}
