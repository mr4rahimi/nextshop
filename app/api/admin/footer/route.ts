import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET() {
  const columns = await prisma.footerColumn.findMany({
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(serialize(columns));
}

export async function POST(req: Request) {
  const data = await req.json();
  const max = await prisma.footerColumn.aggregate({ _max: { sortOrder: true } });
  const col = await prisma.footerColumn.create({
    data: {
      title:     data.title,
      type:      data.type,
      isActive:  data.isActive ?? true,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
    include: { items: true },
  });
  return NextResponse.json(serialize(col));
}
