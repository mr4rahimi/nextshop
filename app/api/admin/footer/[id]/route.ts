import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await req.json();
  const col = await prisma.footerColumn.update({
    where: { id },
    data: { title: data.title, type: data.type, isActive: data.isActive, sortOrder: data.sortOrder },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(serialize(col));
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.footerColumn.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
