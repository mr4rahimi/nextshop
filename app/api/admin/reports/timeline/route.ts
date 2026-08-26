import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تاریخچه‌ی کامل یک آیتم — پاسخ مستقیم به «من این محصول را گذاشتم، کجاست؟».
 *
 * برای محصول، وضعیت فعلی هم برگردانده می‌شود تا معلوم شود آیتم هنوز هست،
 * غیرفعال شده یا حذف شده است.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const entity = sp.get("entity") ?? "PRODUCT";
  const entityId = sp.get("entityId");

  if (!entityId) {
    return NextResponse.json({ error: "entityId الزامی است" }, { status: 400 });
  }

  const logs = await prisma.activityLog.findMany({
    where: { entity: entity as never, entityId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  let current: unknown = null;
  let status: "exists" | "missing" = "missing";

  if (entity === "PRODUCT") {
    const product = await prisma.product.findUnique({
      where: { id: entityId },
      select: {
        id: true, title: true, slug: true, isActive: true, mainImage: true,
        price: true, stock: true, createdAt: true, updatedAt: true,
        images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
      },
    });
    if (product) {
      status = "exists";
      current = serialize(product);
    }
  }

  return NextResponse.json({ status, current, logs });
}
