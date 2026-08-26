import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { logActivityAsync } from "@/lib/activity";

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

  logActivityAsync({
    action: "DELETE",
    entity: "MEDIA",
    entityId: null,
    entityTitle: `${items.length} فایل`,
    summary: `${items.length} فایل به‌صورت گروهی از کتابخانه رسانه حذف شد`,
    changes: items.slice(0, 50).map((item) => ({
      field: "url",
      label: item.originalName || item.fileName,
      kind: "image" as const,
      before: item.url,
      after: null,
    })),
  });

  return NextResponse.json({ success: true, count: items.length });
}
