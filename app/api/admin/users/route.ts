import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const PAGE_SIZE = 20;

  const where = q ? {
    OR: [
      { phone: { contains: q } },
      { firstName: { contains: q, mode: "insensitive" as const } },
      { lastName:  { contains: q, mode: "insensitive" as const } },
    ],
  } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, firstName: true, lastName: true, phone: true,
        email: true, avatarUrl: true, role: true, isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json(serialize({ users, total, page, pageSize: PAGE_SIZE }));
}
