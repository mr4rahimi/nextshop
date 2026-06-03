import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { title, items } = body;

  await prisma.specItem.deleteMany({ where: { groupId: id } });

  const updated = await prisma.specGroup.update({
    where: { id },
    data: {
      title,
      items: {
        create: items.map((item: any, index: number) => ({
          title: item.title,
          sortOrder: index,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.specGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
