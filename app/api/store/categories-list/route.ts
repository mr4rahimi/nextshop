import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// کش ۱۰ دقیقه‌ای — دسته‌بندی‌ها خیلی تغییر نمیکنن
export const revalidate = 600;

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: {
      title: true,
      slug: true,
      parentId: true,
      children: {
        where: { isActive: true },
        select: { title: true, slug: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // فقط دسته‌های اصلی (والد ندارن) با زیردسته‌هاشون
  const roots = categories.filter((c) => !c.parentId);

  return NextResponse.json(serialize(roots));
}