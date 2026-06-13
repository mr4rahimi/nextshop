import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids الزامی است" }, { status: 400 });
  }

  const items = await prisma.mediaFile.findMany({ where: { id: { in: ids } } });

  for (const item of items) {
    try {
      await unlink(path.join(process.cwd(), "public", item.url));
    } catch {}
  }

  await prisma.mediaFile.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ success: true, count: items.length });
}
