import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const { id, price, salePrice } = await req.json();
  await prisma.product.update({
    where: { id },
    data: {
      price:     BigInt(price || 0),
      salePrice: salePrice ? BigInt(salePrice) : null,
    },
  });
  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  const { ids, type, value, field } = await req.json();
  // type: "percent" | "amount"
  // field: "price" | "salePrice" | "both"

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, price: true, salePrice: true },
  });

  await Promise.all(products.map(p => {
    function adjust(original: bigint): bigint {
      if (type === "percent") {
        return BigInt(Math.max(0, Math.round(Number(original) * (1 + value / 100))));
      } else {
        return BigInt(Math.max(0, Number(original) + value));
      }
    }

    const newPrice     = (field === "price" || field === "both") ? adjust(p.price) : p.price;
    const newSalePrice = p.salePrice && (field === "salePrice" || field === "both")
      ? adjust(p.salePrice) : p.salePrice;

    return prisma.product.update({
      where: { id: p.id },
      data: { price: newPrice, salePrice: newSalePrice },
    });
  }));

  return NextResponse.json({ success: true, count: products.length });
}
