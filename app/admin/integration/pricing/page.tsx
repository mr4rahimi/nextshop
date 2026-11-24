import { prisma } from "@/lib/prisma";
import PricingClient from "./PricingClient";
import HelpButton from "@/components/admin/worklist/HelpButton";
import { getStockSource } from "@/lib/integration/core/config";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const where = { isActive: true };
  const [total, mappings, source] = await Promise.all([
    prisma.integMapping.count({ where }),
    prisma.integMapping.findMany({
      where, orderBy: { updatedAt: "desc" }, take: 30,
      include: { links: { where: { isActive: true } } },
    }),
    getStockSource(),
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
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">مدیریت قیمت خرید</h1>
          <HelpButton topic="integrationPricing" />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {source === "site"
            ? "قیمت خرید هر محصول را دستی وارد کنید؛ قیمت هر بازارگاه از آن و «قوانین قیمت» ساخته و همان لحظه ارسال می‌شود."
            : source === "internal"
              ? "قیمت خرید از آخرین بهای خرید کالا در حسابداری داخلی خوانده می‌شود، یا برای هر محصول دستی."
              : "قیمت خرید از حسابان وب خوانده می‌شود، یا برای هر محصول دستی."}
        </p>
      </div>
      <PricingClient initialItems={items} initialTotal={total} source={source} />
    </div>
  );
}