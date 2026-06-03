import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET
export async function GET() {
  const brands = await prisma.brand.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(brands);
}

// POST
export async function POST(req: Request) {
  const data = await req.json();

  const brand = await prisma.brand.create({
    data,
  });

  return NextResponse.json(brand);
}

// PUT
export async function PUT(req: Request) {
  const data = await req.json();

  const brand = await prisma.brand.update({
    where: { id: data.id },
    data: {
      title: data.title,
      slug: data.slug,
      logoUrl: data.logoUrl || null,
      description: data.description || null,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      seoKeywords: data.seoKeywords || null,
      isActive: data.isActive,
    },
  });

  return NextResponse.json(brand);
}

// DELETE
export async function DELETE(req: Request) {
  const { id } = await req.json();

  await prisma.brand.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}