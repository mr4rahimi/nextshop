import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q       = url.searchParams.get("q")?.trim() ?? "";
  const status  = url.searchParams.get("status") ?? "";
  const page    = parseInt(url.searchParams.get("page") ?? "1");
  const PAGE_SIZE = 20;

  const where: any = {};

  if (status) where.status = status;

  if (q) {
    where.OR = [
      { orderNumber: { contains: q } },
      { user: { phone:     { contains: q } } },
      { user: { firstName: { contains: q, mode: "insensitive" } } },
      { user: { lastName:  { contains: q, mode: "insensitive" } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true } },
        address: { select: { province: true, city: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json(serialize({ orders, total, page, pageSize: PAGE_SIZE }));
}
