import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";

export async function GET() {
  const cats = await prisma.blogCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { posts: true } } } });
  return NextResponse.json(cats);
}

export async function POST(req: Request) {
  const data = await req.json();
  const cat = await prisma.blogCategory.create({
    data: { title: data.title, slug: data.slug || slugify(data.title), isActive: data.isActive ?? true },
  });
  return NextResponse.json(cat);
}
