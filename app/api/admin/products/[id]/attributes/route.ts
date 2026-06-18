import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attrs = await prisma.productAttribute.findMany({
    where: { productId: id },
    include: { attribute: true, value: true },
  });
  return NextResponse.json(attrs);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { attributes } = await req.json();

  await prisma.productAttribute.deleteMany({
    where: { productId: id },
  });

  if (attributes && attributes.length > 0) {
    await prisma.productAttribute.createMany({
      data: attributes.map((a: any) => ({
        productId: id,
        attributeId: a.attributeId,
        attributeValueId: a.attributeValueId,
      })),
    });
  }

  return NextResponse.json({ success: true });
}
