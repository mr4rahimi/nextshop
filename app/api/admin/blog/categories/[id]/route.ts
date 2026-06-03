import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await req.json();
  const cat = await prisma.blogCategory.update({ where: { id }, data: { title: data.title, slug: data.slug, isActive: data.isActive } });
  return NextResponse.json(cat);
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.blogCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
