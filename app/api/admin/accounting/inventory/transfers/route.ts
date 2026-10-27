import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { createTransfer, IN_TRANSIT } from "@/lib/accounting/inventory/docs";
import { listReasons } from "@/lib/accounting/inventory/adjust";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, rangeFrom, readJson, requireDay } from "@/lib/accounting/api";
import { itemTitles } from "@/lib/accounting/inventory/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `?view=transit` فقط حواله‌های در راه (webhesab-parity.md بخش ۸)؛ `from`/`to` = بازه‌ی تاریخ،
 * `src`/`dst` = انبار مبدأ/مقصد، `q` = شماره‌ی حواله، `id` = یک حواله (لینک کاردکس).
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_STOCK_RECEIVE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const { from, to } = rangeFrom(url);
  const transit = url.searchParams.get("view") === "transit";
  const src = url.searchParams.get("src");
  const dst = url.searchParams.get("dst");
  const num = Number(url.searchParams.get("q") || NaN);
  const one = url.searchParams.get("id");
  const where: Prisma.AccTransferWhereInput = {
    ...(transit ? IN_TRANSIT : {}),
    ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(src ? { fromWarehouseId: src } : {}),
    ...(dst ? { toWarehouseId: dst } : {}),
    ...(Number.isInteger(num) && num > 0 ? { number: num } : {}),
    ...(one ? { id: one } : {}),
  };
  const items = await prisma.accTransfer.findMany({
    where,
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: transit ? 1000 : 200,
    include: { lines: true },
  });
  const ids = [...new Set(items.flatMap((t) => t.lines.map((l) => l.productId)))];
  const costs = can(guard.access, "ACC_COST_VIEW");
  const manage = can(guard.access, "ACC_INVENTORY");
  const receive = manage || can(guard.access, "ACC_STOCK_RECEIVE");
  const [titles, cost, inTransit, reasons] = await Promise.all([
    itemTitles(ids),
    // ارزش کالای در راه با میانگین سراسری — همان که «ارزش موجودی» برای مقصد می‌شمارد
    costs ? prisma.accProductCost.findMany({ where: { productId: { in: ids } }, select: { productId: true, avgCost: true } }) : [],
    prisma.accTransfer.count({ where: IN_TRANSIT }),
    receive ? listReasons(prisma) : [],
  ]);
  return NextResponse.json(
    serialize({
      items,
      titles: Object.fromEntries(titles),
      avgCost: costs ? Object.fromEntries(cost.map((c) => [c.productId, c.avgCost])) : null,
      inTransit,
      reasons: reasons.filter((r) => r.direction === "OUT").map((r) => ({ id: r.id, name: r.name })),
      can: { manage, receive, costs },
    }),
  );
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ date?: string; fromWarehouseId?: string; toWarehouseId?: string; note?: string; lines?: { productId: string; qty: unknown }[] }>(req);
    if (!b.fromWarehouseId || !b.toWarehouseId) throw new AccError("انبار مبدأ و مقصد را انتخاب کنید");
    const lines = (b.lines ?? []).map((l) => ({ productId: String(l.productId), qty: Number(l.qty) }));
    if (lines.some((l) => !Number.isInteger(l.qty) || l.qty < 0)) throw new AccError("تعداد باید عدد صحیح باشد");
    const t = await prisma.$transaction(
      (tx) => createTransfer(tx, { date: requireDay(b.date), fromWarehouseId: b.fromWarehouseId!, toWarehouseId: b.toWarehouseId!, note: b.note, lines }, actorOf(guard.access)),
      { timeout: 60_000 },
    );
    return NextResponse.json(serialize({ ok: true, id: t.id, number: t.number, needsReceipt: t.needsReceipt }));
  } catch (e) {
    return accErrorResponse(e, "[acc-transfer]");
  }
}
