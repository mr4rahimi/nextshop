import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: any = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.adminNote !== undefined) data.adminNote = body.adminNote;

  const updated = await prisma.guarantyRequest.update({
    where: { id },
    data,
    include: {
      guaranty: {
        select: {
          serialNumber: true, productTitle: true, endDate: true,
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
  });

  return NextResponse.json(serialize(updated));
}