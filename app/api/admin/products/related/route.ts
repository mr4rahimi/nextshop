import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// GET - گرفتن محصولات مرتبط یک محصول
export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  if (!productId) return NextResponse.json([], { status: 400 });

  const related = await prisma.productRelated.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
    include: {
      related: {
        select: {
          id: true, title: true, slug: true,
          mainImage: true, price: true, salePrice: true,
          category: { select: { title: true } },
          brand: { select: { title: true } },
        },
      },
    },
  });

  return NextResponse.json(serialize(related.map(r => r.related)));
}

// POST - اضافه کردن محصول مرتبط
export async function POST(req: Request) {
  const { productId, relatedId } = await req.json();
  const count = await prisma.productRelated.count({ where: { productId } });

  await prisma.productRelated.upsert({
    where: { productId_relatedId: { productId, relatedId } },
    create: { productId, relatedId, sortOrder: count },
    update: {},
  });

  return NextResponse.json({ success: true });
}

// DELETE - حذف محصول مرتبط
export async function DELETE(req: Request) {
  const { productId, relatedId } = await req.json();
  await prisma.productRelated.deleteMany({ where: { productId, relatedId } });
  return NextResponse.json({ success: true });
}
