import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page     = Math.max(1, toInt(url.searchParams.get("page"), 1));
  const pageSize = Math.min(100, Math.max(1, toInt(url.searchParams.get("pageSize"), 20)));
  const status   = url.searchParams.get("status")?.trim();
  const search   = url.searchParams.get("search")?.trim();

  const where: any = {};
  if (status && status !== "ALL") where.status = status;
  if (search) {
    where.guaranty = {
      OR: [
        { serialNumber: { contains: search, mode: "insensitive" } },
        { productTitle: { contains: search, mode: "insensitive" } },
        { user: { phone: { contains: search } } },
      ],
    };
  }

  const [items, total] = await Promise.all([
    prisma.guarantyRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        guaranty: {
          select: {
            serialNumber: true, productTitle: true, endDate: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    }),
    prisma.guarantyRequest.count({ where }),
  ]);

  return NextResponse.json(serialize({ items, total, page, pageSize }));
}