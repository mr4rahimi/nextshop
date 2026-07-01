import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET
export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      parent: true,
      _count: { select: { products: true } },
    },
  });

  return NextResponse.json(categories);
}

// POST (Create)
export async function POST(req: Request) {
  const data = await req.json();

  const category = await prisma.category.create({
    data: {
      ...data,
      parentId: data.parentId ? data.parentId : null,
    },
  });

  return NextResponse.json(category);
}

// PUT (Update)
export async function PUT(req: Request) {
  const data = await req.json();

  const category = await prisma.category.update({
    where: { id: data.id },
    data: {
      title: data.title,
      slug: data.slug,

      description: data.description,
      imageUrl: data.imageUrl,

      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      seoKeywords: data.seoKeywords,

      sortOrder: data.sortOrder,
      isActive: data.isActive,

      parent: data.parentId
        ? { connect: { id: data.parentId } }
        : { disconnect: true },
    },
  });

  return NextResponse.json(category);
}

// DELETE
export async function DELETE(req: Request) {
  const { id } = await req.json();

  const [childrenCount, productsCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);

  if (childrenCount > 0) {
    return NextResponse.json(
      { error: `این دسته دارای ${childrenCount} زیردسته است و قابل حذف نیست` },
      { status: 400 }
    );
  }

  if (productsCount > 0) {
    return NextResponse.json(
      { error: `این دسته دارای ${productsCount} محصول است و قابل حذف نیست` },
      { status: 400 }
    );
  }

  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
