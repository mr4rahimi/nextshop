import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onlineRule } from "@/lib/accounting/inventory/online-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — قیمت این محصول از «قیمت آنلاین» حسابداری می‌آید؟ (docs/plans/inventory-items.md بخش ۱۴)
 * فرم محصول بالای قیمت هشدار می‌دهد که ویرایش دستی دفعه‌ی بعد بازنویسی می‌شود.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = await onlineRule();
  if (!rule.enabled) return NextResponse.json({ managed: false });
  const priced = { OR: [{ salePrice: { gt: 0n } }, { onlinePrice: { gt: 0n } }] };
  const [self, variants] = await Promise.all([
    prisma.accItem.count({ where: { id, ...priced } }),
    prisma.productVariant.findMany({ where: { productId: id, accItemId: { not: null } }, select: { accItemId: true } }),
  ]);
  const viaVariants = variants.length ? await prisma.accItem.count({ where: { id: { in: variants.map((v) => v.accItemId!) }, ...priced } }) : 0;
  const managed = variants.length ? viaVariants > 0 : self > 0;
  return NextResponse.json({ managed });
}
