import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const attributes = await prisma.attribute.findMany({
    include: {
      values: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      group: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return NextResponse.json(attributes);
}

export async function POST(req: Request) {
  const body = await req.json();

  const attribute = await prisma.attribute.create({
    data: {
      groupId: body.groupId,
      title: body.title,
      slug: body.slug,
      isFilterable: body.isFilterable ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });

  return NextResponse.json(attribute);
}

export async function PUT(req: Request) {
  const { id, ...data } = await req.json();

  const attribute = await prisma.attribute.update({
    where: { id },
    data,
  });

  return NextResponse.json(attribute);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  await prisma.attribute.delete({
    where: { id },
  });

  return NextResponse.json({
    success: true,
  });
}