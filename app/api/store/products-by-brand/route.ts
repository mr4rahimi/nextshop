import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brandId");
  const count = Math.min(20, parseInt(url.searchParams.get("count") ?? "8"));

  if (!brandId) return NextResponse.json([]);

  const products = await prisma.product.findMany({
    where: { isActive: true, brandId },
    orderBy: { createdAt: "desc" },
    take: count,
    include: {
      category: { select: { title: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  return NextResponse.json(
    serialize(
      products.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: p.price,
        salePrice: p.salePrice,
        category: p.category,
        image: p.mainImage ?? p.images[0]?.url ?? null,
        stock: p.stock,
        trackStock: p.trackStock,
        lowStockThreshold: p.lowStockThreshold,
      }))
    )
  );
}
