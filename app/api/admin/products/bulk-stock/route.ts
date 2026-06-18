import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const { id, stock, trackStock, lowStockThreshold } = await req.json();
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
  const { ids, type, value } = await req.json();
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

  return NextResponse.json({ success: true, count: ids.length });
}
