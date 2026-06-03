import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET
export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { parent: true },
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

      // ✅ relation صحیح
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

  await prisma.category.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}