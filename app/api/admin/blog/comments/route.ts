import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url    = new URL(req.url);
  const status = url.searchParams.get("status") ?? "PENDING";
  const page   = parseInt(url.searchParams.get("page") ?? "1");
  const PAGE   = 20;

  const [comments, total] = await Promise.all([
    prisma.blogComment.findMany({
      where: { status: status as any },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE, take: PAGE,
      include: {
        post: { select: { title: true, slug: true } },
        user: { select: { firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.blogComment.count({ where: { status: status as any } }),
  ]);

  return NextResponse.json(serialize({ comments, total }));
}
