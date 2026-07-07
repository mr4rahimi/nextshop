// page.tsx
import { prisma } from "@/lib/prisma";
import PricingClient from "./PricingClient";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const where = { isActive: true };
  const [total, mappings] = await Promise.all([
    prisma.integMapping.count({ where }),
    prisma.integMapping.findMany({
      where, orderBy: { updatedAt: "desc" }, take: 30,
      include: { links: { where: { isActive: true } } },
    }),
  ]);

  const shopIds = mappings.flatMap((m) => m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId));
  const shopProducts = shopIds.length
    ? await prisma.product.findMany({ where: { id: { in: shopIds } }, select: { id: true, title: true } })
    : [];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));

  const items = mappings.map((m) => ({
    id: m.id,
    stock: m.stock,
    purchasePriceSource: m.purchasePriceSource,
    purchasePrice: m.purchasePrice,
    syncPriceEnabled: m.syncPriceEnabled,
    lastPriceSyncAt: m.lastPriceSyncAt?.toISOString() ?? null,
    links: m.links.map((l) => ({
      platformCode: l.platformCode,
      shopProduct: l.platformCode === "shop" ? shopMap.get(l.externalId) ?? null : null,
      externalTitle: l.externalTitle,
    })),
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">مدیریت قیمت خرید</h1>
        <p className="text-sm text-gray-500 mt-1">منبع قیمت خرید هر محصول (حسابداری یا دستی) و بروزرسانی قیمت پلتفرم‌ها</p>
      </div>
      <PricingClient initialItems={items} initialTotal={total} />
    </div>
  );
}