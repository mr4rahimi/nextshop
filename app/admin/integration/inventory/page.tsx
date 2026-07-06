import { prisma } from "@/lib/prisma";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const where = { isActive: true };

  const [total, mappings] = await Promise.all([
    prisma.integMapping.count({ where }),
    prisma.integMapping.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { links: { where: { isActive: true } } },
    }),
  ]);

  const shopIds = mappings.flatMap((m) => m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId));
  const shopProducts = shopIds.length
    ? await prisma.product.findMany({
        where: { id: { in: shopIds } },
        select: { id: true, title: true, mainImage: true, stock: true },
      })
    : [];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));

  const items = mappings.map((m) => ({
    id: m.id,
    stock: m.stock,
    syncStockEnabled: m.syncStockEnabled,
    lastStockSyncAt: m.lastStockSyncAt?.toISOString() ?? null,
    lastHesabanStock: m.lastHesabanStock,
    links: m.links.map((l) => ({
      platformCode: l.platformCode,
      externalId: l.externalId,
      externalTitle: l.externalTitle,
      shopProduct: l.platformCode === "shop" ? shopMap.get(l.externalId) ?? null : null,
    })),
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">مدیریت موجودی</h1>
        <p className="text-sm text-gray-500 mt-1">
          فعال/غیرفعال کردن سینک موجودی برای هر محصول نگاشت‌شده و بروزرسانی دستی از حسابداری
        </p>
      </div>
      <InventoryClient initialItems={items} initialTotal={total} />
    </div>
  );
}