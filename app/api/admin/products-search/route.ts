import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

/**
 * یکسان‌سازی نوشتار فارسی برای جستجو: ی/ک عربی، نیم‌فاصله و ارقام.
 * بدون این، کپی‌کردنِ کاملِ نام کالا هم گاهی هیچ نتیجه‌ای نمی‌داد.
 */
function normalizeFa(s: string) {
  return s
    .replace(/[\u064A\u0649]/g, "\u06CC")   // ي/ى → ی
    .replace(/\u0643/g, "\u06A9")           // ك → ک
    .replace(/[\u200B-\u200F\u061C]/g, " ") // نیم‌فاصله و کنترل‌های راست‌به‌چپ
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/\s+/g, " ")
    .trim();
}

// GET /api/admin/products-search?q=text&ids=id1,id2
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

  // هر واژه جداگانه AND می‌شود تا تفاوت فاصله/نیم‌فاصله نتیجه را خالی نکند
  const words = normalizeFa(q).split(" ").filter((w) => w.length > 0).slice(0, 6);

  const categoryId = url.searchParams.get("categoryId") ?? "";
  const brandId = url.searchParams.get("brandId") ?? "";

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(ids.length > 0
        ? { id: { in: ids } }
        : {
            ...(words.length > 0
              ? {
                  AND: words.map((w) => ({
                    OR: [
                      { title: { contains: w, mode: "insensitive" as const } },
                      { slug: { contains: w, mode: "insensitive" as const } },
                      { sku: { contains: w, mode: "insensitive" as const } },
                    ],
                  })),
                }
              : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(brandId ? { brandId } : {}),
          }),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      salePrice: true,
      mainImage: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: ids.length > 0 ? ids.length + 5 : 20,
  });

  const result = products.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: p.price,
    salePrice: p.salePrice,
    image: p.mainImage ?? p.images[0]?.url ?? null,
  }));

  return NextResponse.json(serialize(result));
}
