import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const groups = await prisma.attributeGroup.findMany({
    include: {
      attributes: {
        include: { values: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
      categories: { include: { category: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const body = await req.json();
  const group = await prisma.attributeGroup.create({
    data: {
      title: body.title,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return NextResponse.json(group);
}

export async function PUT(req: Request) {
  const { id, ...data } = await req.json();
  const updated = await prisma.attributeGroup.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.attributeGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}