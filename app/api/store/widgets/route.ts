import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const widgets = await prisma.widget.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, type: true, title: true, config: true },
  });
  return NextResponse.json(widgets);
}
