import { prisma } from "@/lib/prisma";
import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import { decrementMappingStockForOrder } from "./inventory";
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

    hasMore = result.hasMore;
    cursor = result.cursor;
  }

  await writeLog({
    jobId,
    platformCode,
    operationType: "FETCH_ORDERS",
    direction:     "INBOUND",
    entityType:    "ORDER",
    status:        "SUCCESS",
    responseData:  { processed, skipped, unmatchedCount: unmatched.length, unmatched: unmatched.slice(0, 10) },
  }).catch(() => {});
}