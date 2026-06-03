import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET
export async function GET() {
  const data = await prisma.specGroup.findMany({
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(data);
}

// POST
export async function POST(req: Request) {
  const body = await req.json();

  const group = await prisma.specGroup.create({
    data: {
      title: body.title,
      isActive: true,
      items: {
        create: body.items.map((item: any, index: number) => ({
          title: item.title,
          sortOrder: index,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(group);
}

// PUT
export async function PUT(req: Request) {
  const body = await req.json();

  // delete old items
  await prisma.specItem.deleteMany({
    where: { groupId: body.id },
  });

  const updated = await prisma.specGroup.update({
    where: { id: body.id },
    data: {
      title: body.title,
      items: {
        create: body.items.map((item: any, index: number) => ({
          title: item.title,
          sortOrder: index,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(updated);
}

// DELETE
export async function DELETE(req: Request) {
  const { id } = await req.json();

  await prisma.specGroup.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}