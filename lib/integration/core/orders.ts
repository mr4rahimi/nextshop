import { prisma } from "@/lib/prisma";
import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import { decrementMappingStockForOrder, restoreMappingStockForCancel } from "./inventory";
import { writeLog } from "./log";
import { enrollMarketplaceCustomer } from "@/lib/club/marketplace";

export async function fetchAndProcessOrders(
  jobId: string,
  platformCode: string,
  adapter: BaseAdapter,
  credentials: Record<string, string>,
): Promise<void> {
  if (!adapter.fetchOrders) {
    throw new Error(`${platformCode} از دریافت سفارش پشتیبانی نمی‌کند`);
  }

  let cursor: string | undefined;
  let hasMore = true;
  let processed = 0;
  let skipped = 0;
  const unmatched: string[] = [];
  const cancelledOrders = new Set<string>();

  while (hasMore) {
    const result = await adapter.fetchOrders(credentials, cursor);

    for (const item of result.items) {
      const existing = await prisma.integOrder.findUnique({
        where: { platformCode_platformOrderId: { platformCode, platformOrderId: item.platformOrderId } },
      });
      if (existing) { skipped++; continue; }

      const link = await prisma.integMappingLink.findUnique({
        where: { platformCode_externalId: { platformCode, externalId: item.platformProductId } },
      });
      if (!link) unmatched.push(item.platformProductId);

      await decrementMappingStockForOrder(platformCode, item.platformProductId, item.qty).catch(() => {});

      await prisma.integOrder.create({
        data: {
          mappingId:           link?.mappingId ?? null,
          platformCode,
          platformOrderId:     item.platformOrderId,
          platformOrderItemId: item.platformOrderItemId ?? null,
          productTitle:        item.title ?? "(بدون عنوان)",
          qty:                 item.qty,
          unitPrice:           item.unitPrice ?? null,
          customerName:        item.customerName ?? null,
          customerPhone:       item.customerPhone ?? null,
          status:              "PENDING", 
        },
      });

       void enrollMarketplaceCustomer({
        platformCode,
        phone: item.customerPhone,
        name:  item.customerName,
      });

      processed++;
    }

    for (const c of result.cancelledOrderIds ?? []) cancelledOrders.add(c);

    hasMore = result.hasMore;
    cursor = result.cursor;
  }

  // لغو سفارش (فید رویدادی) — فقط ردیف‌های PENDING، پس تکرار رویداد بی‌خطر است
  let cancelled = 0;
  for (const orderNo of cancelledOrders) {
    const rows = await prisma.integOrder.findMany({
      where: { platformCode, platformOrderId: { startsWith: `${orderNo}:` }, status: "PENDING" },
    });
    for (const row of rows) {
      if (row.mappingId) {
        const link = await prisma.integMappingLink.findUnique({
          where: { mappingId_platformCode: { mappingId: row.mappingId, platformCode } },
        });
        if (link) {
          await restoreMappingStockForCancel(platformCode, link.externalId, row.qty).catch(() => {});
        }
      }
      await prisma.integOrder.update({ where: { id: row.id }, data: { status: "CANCELLED" } }).catch(() => {});
      cancelled++;
    }
  }

  await writeLog({
    jobId,
    platformCode,
    operationType: "FETCH_ORDERS",
    direction:     "INBOUND",
    entityType:    "ORDER",
    status:        "SUCCESS",
    responseData:  { processed, skipped, cancelled, unmatchedCount: unmatched.length, unmatched: unmatched.slice(0, 10) },
  }).catch(() => {});
}