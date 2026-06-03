import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const attrs = await prisma.productAttribute.findMany({
    where: { productId: params.id },
    include: { attribute: true, value: true },
  });
  return NextResponse.json(attrs);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { attributes } = await req.json();

  // حذف ویژگی‌های قبلی
  await prisma.productAttribute.deleteMany({
    where: { productId: params.id },
  });

  // اضافه کردن ویژگی‌های جدید
  if (attributes && attributes.length > 0) {
    await prisma.productAttribute.createMany({
      data: attributes.map((a: any) => ({
        productId: params.id,
        attributeId: a.attributeId,
        attributeValueId: a.attributeValueId,
      })),
    });
  }

  return NextResponse.json({ success: true });
}