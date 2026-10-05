import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadLandingProducts } from "@/lib/tools/landings";
import { toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/**
 * انتخاب محصول برای بلوک «محصولات» لندینگ.
 * جدا از `/api/admin/products-search` است چون آن مسیر مجوز کاتالوگ می‌خواهد.
 *
 * `?q=` جستجو · `?ids=a,b` همان محصولات انتخاب‌شده (برای نمایش در ویرایشگر)
 */
export async function GET(req: Request) {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  if (ids.length) return NextResponse.json({ items: Object.values(await loadLandingProducts(ids)) });

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ items: [] });
  const rows = await prisma.product.findMany({
    where: { isActive: true, OR: [{ title: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });
  const map = await loadLandingProducts(rows.map((r) => r.id));
  return NextResponse.json({ items: rows.map((r) => map[r.id]).filter(Boolean) });
}
