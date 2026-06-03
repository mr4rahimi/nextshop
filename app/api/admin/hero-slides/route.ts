import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const slides = await prisma.heroSlide.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(slides);
}

export async function POST(req: Request) {
  const data = await req.json();
  const last = await prisma.heroSlide.findFirst({ orderBy: { sortOrder: "desc" } });
  const slide = await prisma.heroSlide.create({
    data: {
      title: data.title || null,
      imageUrl: data.imageUrl,
      linkUrl: data.linkUrl || null,
      isActive: data.isActive ?? true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(slide);
}

export async function PUT(req: Request) {
  const data = await req.json();
  if (Array.isArray(data)) {
    await Promise.all(
      data.map((item: { id: string; sortOrder: number }) =>
        prisma.heroSlide.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
      )
    );
    return NextResponse.json({ success: true });
  }
  const slide = await prisma.heroSlide.update({
    where: { id: data.id },
    data: { title: data.title || null, imageUrl: data.imageUrl, linkUrl: data.linkUrl || null, isActive: data.isActive },
  });
  return NextResponse.json(slide);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.heroSlide.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
