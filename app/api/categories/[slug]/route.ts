import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      parent:   { select: { title: true, slug: true } },
      children: { where: { isActive: true }, select: { id: true, title: true, slug: true, imageUrl: true } },
    },
  });

  if (!category || !category.isActive) {
    return NextResponse.json({ message: "دسته‌بندی یافت نشد" }, { status: 404 });
  }

  return NextResponse.json(serialize(category));
}