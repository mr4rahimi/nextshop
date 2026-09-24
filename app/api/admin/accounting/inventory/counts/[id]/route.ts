import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { postCount, setCountLines, voidCount } from "@/lib/accounting/inventory/docs";
import { qtyAt } from "@/lib/accounting/inventory/stock";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — برگه‌ی انبارگردانی با موجودی دفتری فعلی هر ردیف (پیش‌نمایش اختلاف) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const c = await prisma.accStockCount.findUnique({ where: { id }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!c) return NextResponse.json({ error: "انبارگردانی پیدا نشد" }, { status: 404 });
  const [warehouse, products] = await Promise.all([
    prisma.accWarehouse.findUnique({ where: { id: c.warehouseId } }),
    prisma.product.findMany({ where: { id: { in: c.lines.map((l) => l.productId) } }, select: { id: true, title: true, sku: true, mainImage: true } }),
  ]);
  const pm = new Map(products.map((p) => [p.id, p]));
  const lines = await Promise.all(
    c.lines.map(async (l) => ({
      ...l,
      product: pm.get(l.productId) ?? null,
      bookQty: c.status === "DRAFT" ? await qtyAt(prisma as never, l.productId, c.warehouseId, c.date) : l.systemQty,
    })),
  );
  // کالاهای دارای موجودی که هنوز شمرده نشده‌اند — در ثبت «شمرده‌نشده» می‌مانند
  const counted = new Set(c.lines.map((l) => l.productId));
  const inWarehouse = await prisma.accStock.findMany({ where: { warehouseId: c.warehouseId, qty: { not: 0 } }, select: { productId: true } });
  return NextResponse.json(
    serialize({
      count: { ...c, lines: undefined },
      warehouse,
      lines,
      uncounted: inWarehouse.filter((s) => !counted.has(s.productId)).length,
      can: { manage: can(guard.access, "ACC_INVENTORY") },
    }),
  );
}

/**
 * PUT { lines: [{productId, countedQty|null}] }  — ثبت شمارش (پیش‌نویس)
 * POST { action: "fill" }  — همه‌ی کالاهای دارای موجودی این انبار با عدد دفتری
 * POST { action: "post" | "void", reason? }
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ lines?: { productId: string; countedQty: unknown }[] }>(req);
    const lines = (b.lines ?? []).map((l) => ({
      productId: String(l.productId),
      countedQty: l.countedQty === null || l.countedQty === "" ? null : Number(l.countedQty),
    }));
    await prisma.$transaction((tx) => setCountLines(tx, id, lines));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-count]");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; reason?: string }>(req);
    const actor = actorOf(guard.access);
    if (b.action === "fill") {
      const c = await prisma.accStockCount.findUnique({ where: { id }, include: { lines: { select: { productId: true } } } });
      if (!c) throw new AccError("انبارگردانی پیدا نشد", 404);
      const have = new Set(c.lines.map((l) => l.productId));
      const stock = await prisma.accStock.findMany({ where: { warehouseId: c.warehouseId, qty: { gt: 0 } } });
      const add = stock.filter((s) => !have.has(s.productId)).map((s) => ({ productId: s.productId, countedQty: s.qty }));
      await prisma.$transaction((tx) => setCountLines(tx, id, add));
      return NextResponse.json({ ok: true, added: add.length });
    }
    if (b.action === "post") {
      await prisma.$transaction((tx) => postCount(tx, id, actor), { timeout: 120_000 });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "void") {
      await prisma.$transaction((tx) => voidCount(tx, id, String(b.reason ?? ""), actor), { timeout: 120_000 });
      return NextResponse.json({ ok: true });
    }
    throw new AccError("اقدام نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-count]");
  }
}
