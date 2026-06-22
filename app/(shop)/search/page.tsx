import SearchPageClient from "@/components/store/SearchPageClient";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import type { Metadata } from "next";

interface Props { searchParams: Promise<{ q?: string; page?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  return {
    title: q ? `جستجو: ${q}` : "جستجو",
    description: q ? `نتایج جستجو برای "${q}" در فروشگاه` : "جستجو در محصولات فروشگاه",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp   = await searchParams;
  const q    = sp.q?.trim() ?? "";
  const page = Number(sp.page ?? 1);
  const PAGE_SIZE = 24;

  let initialData = { products: [] as any[], total: 0 };

  if (q.length >= 2) {
    try {
      const where = {
        isActive: true,
        OR: [
          { title:    { contains: q, mode: "insensitive" as const } },
          { brand:    { title: { contains: q, mode: "insensitive" as const } } },
          { category: { title: { contains: q, mode: "insensitive" as const } } },
        ],
      };
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true, title: true, slug: true,
            price: true, salePrice: true, mainImage: true,
            stock: true,
            trackStock: true,
            lowStockThreshold: true,
            images:   { take: 1, select: { url: true } },
            brand:    { select: { title: true } },
            category: { select: { title: true, slug: true } },
          },
        }),
        prisma.product.count({ where }),
      ]);
      initialData = serialize({ products, total });
    } catch (e) {
      console.error("Search error:", e);
    }
  }

  return <SearchPageClient initialQ={q} initialPage={page} initialData={initialData} />;
}
