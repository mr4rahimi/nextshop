import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { productSearchWhere, stockRows } from "@/lib/accounting/inventory/query";
import { toLatinDigits } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?q — انتخابگر کالا. بارکد یا کد کالای دقیق اول می‌آید (بارکدخوان
 * مثل کیبورد تایپ می‌کند و Enter می‌زند؛ `exact` یعنی همین را بی‌پرسش اضافه کن).
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_VOUCHER"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const lat = toLatinDigits(q);

  const exact = lat
    ? await prisma.product.findFirst({ where: { OR: [{ gtin13: lat }, { sku: lat }] }, select: { id: true } })
    : null;
  const products = await prisma.product.findMany({
    where: productSearchWhere(q),
    orderBy: { title: "asc" },
    take: 15,
    select: { id: true, title: true, sku: true, mainImage: true, stock: true },
  });
  const rows = await stockRows(products.map((p) => p.id), can(guard.access, "ACC_COST_VIEW"));
  const items = products
    .map((p) => ({ id: p.id, title: p.title, sku: p.sku, image: p.mainImage, siteStock: p.stock, ...rows.get(p.id)! }))
    .sort((a, b) => (a.id === exact?.id ? -1 : b.id === exact?.id ? 1 : 0));
  return NextResponse.json(serialize({ items, exactId: exact?.id ?? null }));
}
