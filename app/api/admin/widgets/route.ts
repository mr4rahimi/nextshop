import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const widgets = await prisma.widget.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(widgets);
}

export async function POST(req: Request) {
  const data = await req.json();
  const last = await prisma.widget.findFirst({ orderBy: { sortOrder: "desc" } });
  const widget = await prisma.widget.create({
    data: {
      type: data.type,
      title: data.title,
      isActive: data.isActive ?? true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      config: data.config ?? {},
    },
  });
  return NextResponse.json(widget);
}

export async function PUT(req: Request) {
  const data = await req.json();

  // bulk reorder
  if (Array.isArray(data)) {
    await Promise.all(
      data.map((item: { id: string; sortOrder: number }) =>
        prisma.widget.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    return NextResponse.json({ success: true });
  }

  // single update
  const widget = await prisma.widget.update({
    where: { id: data.id },
    data: {
      title: data.title,
      isActive: data.isActive,
      config: data.config,
    },
  });
  return NextResponse.json(widget);
}

// DELETE
export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.widget.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
