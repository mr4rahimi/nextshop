import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET() {
  const articles = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 8,
    select: {
      id: true, title: true, slug: true, excerpt: true,
      coverImage: true, publishedAt: true, readingTime: true,
      category: { select: { title: true, slug: true } },
    },
  });
  return NextResponse.json(serialize(articles));
}
