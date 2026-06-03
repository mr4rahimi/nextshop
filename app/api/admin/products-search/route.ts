import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// GET /api/admin/products-search?q=text&ids=id1,id2
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(ids.length > 0
        ? { id: { in: ids } }
        : q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      salePrice: true,
      mainImage: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: ids.length > 0 ? ids.length + 5 : 20,
  });

  const result = products.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: p.price,
    salePrice: p.salePrice,
    image: p.mainImage ?? p.images[0]?.url ?? null,
  }));

  return NextResponse.json(serialize(result));
}
