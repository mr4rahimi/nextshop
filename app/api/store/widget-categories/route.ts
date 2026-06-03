import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// دریافت دسته‌بندی‌های انتخاب‌شده بر اساس ids
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, title: true, slug: true, imageUrl: true },
  });

  // مرتب کردن بر اساس ترتیب ids (ترتیب انتخاب ادمین)
  const sorted = ids
    .map(id => categories.find(c => c.id === id))
    .filter(Boolean);

  return NextResponse.json(serialize(sorted));
}
