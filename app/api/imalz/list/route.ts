import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";

const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 50;

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function toAbsoluteUrl(path: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function isAvailable(trackStock: boolean, stock: number): boolean {
  return !trackStock || stock > 0;
}

function firstColorName(colors: unknown): string | undefined {
  if (!Array.isArray(colors) || colors.length === 0) return undefined;
  const first = colors[0];
  if (!first || typeof first !== "object") return undefined;
  const c = first as Record<string, unknown>;
  const name = c.name ?? c.title ?? c.label ?? c.value;
  return typeof name === "string" ? name : undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
  const perPage = Math.min(
    MAX_PER_PAGE,
    toInt(url.searchParams.get("item_per_page"), DEFAULT_PER_PAGE)
  );

  try {
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          salePrice: true,
          mainImage: true,
          warranty: true,
          colors: true,
          stock: true,
          trackStock: true,
          category: { select: { title: true } },
        },
      }),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    const countPages = Math.ceil(total / perPage);

    const items = products.map((p) => {
      const currentPrice = p.salePrice ?? p.price;
      const hasDiscount = p.salePrice !== null && p.salePrice < p.price;

      const item: Record<string, unknown> = {
        title: p.title,
        id: p.id,
        price: Number(currentPrice),
        category: p.category.title,
        image: toAbsoluteUrl(p.mainImage),
        available_is: isAvailable(p.trackStock, p.stock),
        url: `${SITE_URL}/products/${p.slug}`,
      };

      if (hasDiscount) item.price_old = Number(p.price);
      if (p.warranty) item.guarantee = p.warranty;

      const color = firstColorName(p.colors);
      if (color) item.color = color;

      return item;
    });

    return NextResponse.json({
      success: true,
      products: items,
      items_total: total,
      count_pages: countPages,
      page_per_item: perPage,
      num_page: page,
    });
  } catch {
    return NextResponse.json(
      { success: false, products: [], items_total: 0, count_pages: 0, page_per_item: perPage, num_page: page },
      { status: 500 }
    );
  }
}
