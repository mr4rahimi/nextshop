import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { magListWhere, magListOrder, MAG_LIST_SELECT, MAG_PAGE_SIZE } from "@/lib/mag-list";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url  = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
  const where = magListWhere({
    cat: url.searchParams.get("cat") ?? "",
    tag: url.searchParams.get("tag") ?? "",
    q:   url.searchParams.get("q") ?? "",
  });

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where, orderBy: magListOrder(url.searchParams.get("sort")),
      skip: (page - 1) * MAG_PAGE_SIZE, take: MAG_PAGE_SIZE,
      select: MAG_LIST_SELECT,
    }),
    prisma.blogPost.count({ where }),
  ]);

  return NextResponse.json(serialize({ posts, total, page, pageSize: MAG_PAGE_SIZE }));
}
