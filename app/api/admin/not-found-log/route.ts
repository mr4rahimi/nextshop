import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const showIgnored = url.searchParams.get("ignored") === "1";

  const where = {
    ignored: showIgnored,
    ...(q ? { path: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.notFoundLog.findMany({
      where,
      orderBy: [{ hits: "desc" }, { lastSeen: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notFoundLog.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE });
}

/** علامت‌گذاری به‌عنوان نادیده‌گرفته‌شده — برای مسیرهایی که عمداً ۴۰۴ هستند. */
export async function PUT(req: Request) {
  const { id, ignored } = await req.json();
  if (!id) return NextResponse.json({ error: "id لازم است" }, { status: 400 });
  const row = await prisma.notFoundLog.update({
    where: { id },
    data: { ignored: !!ignored },
  });
  return NextResponse.json(row);
}

/** حذف یک ردیف، یا پاک‌سازی کامل با ?all=1 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("all") === "1") {
    const { count } = await prisma.notFoundLog.deleteMany({});
    return NextResponse.json({ ok: true, deleted: count });
  }
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id لازم است" }, { status: 400 });
  await prisma.notFoundLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
