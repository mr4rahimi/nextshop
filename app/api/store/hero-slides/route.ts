import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const slides = await prisma.heroSlide.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, imageUrl: true, linkUrl: true },
  });
  return NextResponse.json(slides);
}
