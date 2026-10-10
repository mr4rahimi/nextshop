import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";

/** محصول تنوع‌دار: موجودی جمع تنوع‌هاست و اینجا عوض نمی‌شود (docs/plans/inventory-items.md تله‌ی ۱) */
async function variantProducts(ids: string[]) {
  const rows = await prisma.productVariant.findMany({ where: { productId: { in: ids } }, select: { productId: true }, distinct: ["productId"] });
  return new Set(rows.map((r) => r.productId));
}

export async function PATCH(req: Request) {
  const { id, stock, trackStock, lowStockThreshold } = await req.json();
  if ((await variantProducts([id])).has(id)) {
    return NextResponse.json({ error: "موجودی این محصول جمع رنگ/سایزهایش است — در ویرایش محصول، بخش «تنوع» عوض کنید" }, { status: 400 });
  }
  await prisma.product.update({
    where: { id },
    data: {
      stock: parseInt(stock) || 0,
      trackStock: trackStock ?? true,
      lowStockThreshold: parseInt(lowStockThreshold) || 3,
    },
  });
  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  const { ids: all, type, value } = await req.json();
  const skip = await variantProducts(all);
  const ids: string[] = all.filter((id: string) => !skip.has(id));
  // type: "set" | "increase" | "decrease"

  if (type === "set") {
    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { stock: parseInt(value) || 0, trackStock: true },
    });
  } else {
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, stock: true },
    });
    await Promise.all(products.map(p => {
      const newStock = type === "increase"
        ? p.stock + parseInt(value)
        : Math.max(0, p.stock - parseInt(value));
      return prisma.product.update({
        where: { id: p.id },
        data: { stock: newStock, trackStock: true },
      });
    }));
  }

  logActivityAsync({
    action: "BULK_UPDATE",
    entity: "PRODUCT",
    entityTitle: `${ids.length} محصول`,
    summary: `موجودی ${ids.length} محصول به‌صورت گروهی ` +
      (type === "set" ? `روی ${value} تنظیم شد` : type === "increase" ? `${value} واحد زیاد شد` : `${value} واحد کم شد`),
    changes: [{ field: "stock", label: "موجودی", before: null, after: `${type}: ${value}` }],
  });

  return NextResponse.json({ success: true, count: ids.length, skippedVariants: skip.size });
}
