import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guaranty = await prisma.guaranty.findUnique({
    where: { id },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } },
      requests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!guaranty) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json(serialize(guaranty));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: any = {};
  if (body.productTitle !== undefined) data.productTitle = body.productTitle;
  if (body.serialNumber !== undefined) data.serialNumber = body.serialNumber;
  if (body.notes !== undefined) data.notes = body.notes;

  if (body.durationDays !== undefined) {
    const current = await prisma.guaranty.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    data.durationDays = Number(body.durationDays);
    data.endDate = new Date(current.startDate.getTime() + Number(body.durationDays) * 24 * 60 * 60 * 1000);
  }

  if (body.startDate !== undefined) {
    data.startDate = new Date(body.startDate);
    const duration = body.durationDays !== undefined ? Number(body.durationDays) : (await prisma.guaranty.findUnique({ where: { id } }))!.durationDays;
    data.endDate = new Date(data.startDate.getTime() + duration * 24 * 60 * 60 * 1000);
  }

  try {
    const updated = await prisma.guaranty.update({
      where: { id },
      data,
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    });
    return NextResponse.json(serialize(updated));
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "این شماره ستومان قبلاً ثبت شده است" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.guaranty.delete({ where: { id } });
  return NextResponse.json({ success: true });
}