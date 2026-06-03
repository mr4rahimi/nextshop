import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { status } = await req.json();
  const comment = await prisma.blogComment.update({ where: { id }, data: { status } });
  return NextResponse.json(serialize(comment));
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.blogComment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
