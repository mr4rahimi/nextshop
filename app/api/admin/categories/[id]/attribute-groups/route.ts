import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const groups = await prisma.categoryAttributeGroup.findMany({
    where: { categoryId: id },
    include: {
      attributeGroup: {
        include: {
          attributes: {
            include: { values: { orderBy: { sortOrder: "asc" } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
  return NextResponse.json(groups);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { attributeGroupId } = await req.json();
  const link = await prisma.categoryAttributeGroup.create({
    data: { categoryId: id, attributeGroupId },
  });
  return NextResponse.json(link);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { attributeGroupId } = await req.json();
  await prisma.categoryAttributeGroup.deleteMany({
    where: { categoryId: id, attributeGroupId },
  });
  return NextResponse.json({ success: true });
}