import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: columnId } = await ctx.params;
  const data = await req.json();
  const max = await prisma.footerItem.aggregate({ where: { columnId }, _max: { sortOrder: true } });

  if (data.bulk) {
    // آپدیت ترتیب bulk
    await Promise.all(data.items.map((item: { id: string; sortOrder: number }) =>
      prisma.footerItem.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
    ));
    return NextResponse.json({ success: true });
  }

  const item = await prisma.footerItem.create({
    data: {
      columnId,
      label:     data.label,
      url:       data.url ?? null,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      isActive:  data.isActive ?? true,
    },
  });
  return NextResponse.json(item);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const data = await req.json();
  const item = await prisma.footerItem.update({
    where: { id: data.id },
    data: { label: data.label, url: data.url ?? null, isActive: data.isActive },
  });
  return NextResponse.json(item);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.footerItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
