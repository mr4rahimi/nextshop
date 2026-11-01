import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { suggestLines } from "@/lib/accounting/purchases/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?partyId&warehouseId — پیشنهاد خرید: کالاهای رو به اتمام منهای در راه (webhesab-parity.md بخش ۱۳) */
export async function GET(req: Request) {
  const guard = await requirePermission("ACC_PURCHASE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const sp = new URL(req.url).searchParams;
  return NextResponse.json(serialize({ items: await suggestLines(prisma, { partyId: sp.get("partyId"), warehouseId: sp.get("warehouseId") }) }));
}
