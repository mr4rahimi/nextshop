import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const attributeId = searchParams.get("attributeId");

  const values = await prisma.attributeValue.findMany({
    where: attributeId
      ? {
          attributeId,
        }
      : undefined,
    orderBy: {
      sortOrder: "asc",
    },
  });

  return NextResponse.json(values);
}

export async function POST(req: Request) {
  const body = await req.json();

  const value = await prisma.attributeValue.create({
    data: {
      attributeId: body.attributeId,
      value: body.value,
      slug: body.slug,
      sortOrder: body.sortOrder ?? 0,
    },
  });

  return NextResponse.json(value);
}

export async function PUT(req: Request) {
  const { id, ...data } = await req.json();

  const value = await prisma.attributeValue.update({
    where: {
      id,
    },
    data,
  });

  return NextResponse.json(value);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  await prisma.attributeValue.delete({
    where: {
      id,
    },
  });

  return NextResponse.json({
    success: true,
  });
}