import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { createTransfer } from "@/lib/accounting/inventory/docs";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, rangeFrom, readJson, requireDay } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { from, to } = rangeFrom(new URL(req.url));
  const items = await prisma.accTransfer.findMany({
    where: from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {},
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: 200,
    include: { lines: true },
  });
  const ids = [...new Set(items.flatMap((t) => t.lines.map((l) => l.productId)))];
  const titles = Object.fromEntries(
    (await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })).map((p) => [p.id, p.title]),
  );
  return NextResponse.json(serialize({ items, titles, can: { manage: can(guard.access, "ACC_INVENTORY") } }));
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
    return NextResponse.json(serialize({ ok: true, id: t.id, number: t.number }));
  } catch (e) {
    return accErrorResponse(e, "[acc-transfer]");
  }
}
