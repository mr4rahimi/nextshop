import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { listPurchaseOrders, savePurchaseOrder, type PoFilter } from "@/lib/accounting/purchases/orders";
import { poFromBody, seesPrice, VIEW } from "./body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * سفارش خرید — docs/plans/webhesab-parity.md بخش ۱۳.
 * GET ?state=open|overdue|done|all&partyId&productId&q — فهرست با دریافت‌شده/سفارش
 * POST — سفارش تازه (ACC_PURCHASE)
 */
export async function GET(req: Request) {
  const guard = await requirePermission([...VIEW]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const sp = new URL(req.url).searchParams;
  const rows = await listPurchaseOrders(prisma, {
    state: (sp.get("state") as PoFilter["state"]) ?? "open",
    partyId: sp.get("partyId"),
    productId: sp.get("productId"),
    q: sp.get("q"),
  });
  const price = seesPrice(guard.access);
  const [warehouses, product] = await Promise.all([
    prisma.accWarehouse.findMany({ select: { id: true, name: true } }),
    sp.get("productId") ? prisma.accItem.findUnique({ where: { id: sp.get("productId")! }, select: { id: true, title: true, code: true } }) : null,
  ]);
  return NextResponse.json(
    serialize({
      items: rows.map((r) => (price ? r : { ...r, total: null })),
      warehouses,
      product,
      can: { write: can(guard.access, "ACC_PURCHASE"), price },
    }),
  );
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_PURCHASE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const input = poFromBody(await readJson(req));
    const po = await prisma.$transaction((tx) => savePurchaseOrder(tx, null, input, actorOf(guard.access)), { timeout: 30_000 });
    return NextResponse.json(serialize({ ok: true, id: po.id, number: po.number }));
  } catch (e) {
    return accErrorResponse(e, "[acc-po]");
  }
}
