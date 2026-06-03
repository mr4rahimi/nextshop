import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const stories = await prisma.story.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(stories);
}

export async function POST(req: Request) {
  const data = await req.json();
  const last = await prisma.story.findFirst({ orderBy: { sortOrder: "desc" } });
  const story = await prisma.story.create({
    data: {
      title: data.title,
      imageUrl: data.imageUrl,
      linkUrl: data.linkUrl || null,
      duration: data.duration ?? 5000,
      isActive: data.isActive ?? true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(story);
}

export async function PUT(req: Request) {
  const data = await req.json();

  // bulk reorder
  if (Array.isArray(data)) {
    await Promise.all(
      data.map((item: { id: string; sortOrder: number }) =>
        prisma.story.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
      )
    );
    return NextResponse.json({ success: true });
  }

  const story = await prisma.story.update({
    where: { id: data.id },
    data: {
      title: data.title,
      imageUrl: data.imageUrl,
      linkUrl: data.linkUrl || null,
      duration: data.duration ?? 5000,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });
  return NextResponse.json(story);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.story.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
