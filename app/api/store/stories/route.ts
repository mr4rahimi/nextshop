import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const stories = await prisma.story.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      linkUrl: true,
      duration: true,
    },
  });

  const formatted = stories.map(s => ({
    type: "image",
    user: s.title,
    avatar: s.imageUrl,
    url: s.imageUrl,
    duration: s.duration,
    link: s.linkUrl || undefined,
  }));



  return NextResponse.json(formatted);
}
