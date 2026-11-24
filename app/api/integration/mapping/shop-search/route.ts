import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const normFa = (s: string) =>
  s
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[​-‏؜]/g, " ")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, " ")
    .trim();

/**
 * GET ?q=  جستجوی محصول سایت برای نگاشت — پیش‌نویس‌ها هم، با SKU، موجودی، تنوع
 * و نگاشت فعلی (کدام سرویس‌ها را دارد) تا انتخابگر بگوید «به نگاشت موجود اضافه می‌شود».
 */
export async function GET(req: NextRequest) {
  const q = normFa(req.nextUrl.searchParams.get("q") ?? "");
  if (!q) return NextResponse.json({ items: [] });
  const words = q.split(" ").filter(Boolean).slice(0, 6);
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { sku: q },
        { gtin13: q },
        { AND: words.map((w) => ({ OR: [{ title: { contains: w, mode: "insensitive" as const } }, { sku: { contains: w, mode: "insensitive" as const } }] })) },
      ],
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: { id: true, title: true, sku: true, stock: true, price: true, mainImage: true, isActive: true, _count: { select: { variants: true } } },
  });
  const links = await prisma.integMappingLink.findMany({
    where: { platformCode: "shop", externalId: { in: products.map((p) => p.id) }, isActive: true, mapping: { isActive: true } },
    select: { externalId: true, mappingId: true, mapping: { select: { links: { where: { isActive: true }, select: { platformCode: true } } } } },
  });
  const linkOf = new Map(links.map((l) => [l.externalId, l]));
  return NextResponse.json({
    items: products.map((p) => {
      const l = linkOf.get(p.id);
      return {
        id: p.id,
        title: p.title,
        sku: p.sku,
        stock: p.stock,
        price: Number(p.price),
        image: p.mainImage,
        isActive: p.isActive,
        hasVariants: p._count.variants > 0,
        mappingId: l?.mappingId ?? null,
        mappedOn: l ? l.mapping.links.map((x) => x.platformCode).filter((c) => c !== "shop") : [],
      };
    }),
  });
}
