import { prisma } from "@/lib/prisma";
import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import { decrementMappingStockForOrder, restoreMappingStockForCancel } from "./inventory";
import { writeLog } from "./log";
import { enrollMarketplaceCustomer } from "@/lib/club/marketplace";
import { emitAccEventSafe } from "@/lib/accounting/events";
import { LATE_ORDER_MS, type OrderItemInfo } from "@/lib/integration/types";

// تپسی‌شاپ هر سفارش را از دو راه می‌دهد: وب‌هوک با کلید `${orderId}:${orderItemId}` و
// polling با کلید `${orderId}:${sku}`. کلید یکتا این دو را یکی نمی‌بیند و هر سفارش دو بار
// ثبت می‌شد، پس اینجا دنبال ردیف وب‌هوکِ همان سفارش و همان محصول می‌گردیم.
// شماره‌ی سفارش (platformOrderNo) ملاک اصلی است: وب‌هوک‌های پیش از ۲.۹۲.۰ orderId را
// با گرد شدن عدد بزرگ JSON خراب ذخیره کرده‌اند. هم‌خوانی با mappingId امن است چون هر
// نگاشت در هر پلتفرم فقط یک شناسه دارد؛ ردیف بی‌نگاشت وب‌هوک، sku را به‌جای عنوان دارد.
async function findTapsiWebhookRow(
  platformCode: string,
  item: OrderItemInfo,
  mappingId: string | null,
) {
  if (platformCode !== "tapsi_shop") return null;
  const orderId = item.platformOrderId.split(":")[0];
  const sku     = item.platformOrderItemId ?? "";
  const sameProduct = [
    ...(mappingId ? [{ mappingId }] : []),
    ...(sku && !sku.startsWith("__noSku") ? [{ productTitle: sku }] : []),
  ];
  if (!sameProduct.length) return null;

  return prisma.integOrder.findFirst({
    where: {
      platformCode,
      AND: [
        {
          OR: [
            { platformOrderId: { startsWith: `${orderId}:` } },
            ...(item.platformOrderNo ? [{ platformOrderNo: item.platformOrderNo }] : []),
          ],
        },
        { OR: sameProduct },
      ],
    },
    select: { id: true, productTitle: true },
  });
}

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
  let pages = 0;
  const unmatched: string[] = [];
  const cancelledOrders = new Set<string>();
  const seenCursors = new Set<string>();

  // سقف سخت روی تعداد صفحه‌ها: اگر پلتفرم hasMore=true بدهد ولی مکان‌نما جلو
  // نرود، این حلقه تا ابد می‌چرخید و job در PROCESSING گیر می‌کرد.
  const MAX_PAGES = 200;

  while (hasMore) {
    if (pages >= MAX_PAGES) {
      await writeLog({
        jobId,
        platformCode,
        operationType: "FETCH_ORDERS",
        direction:     "INBOUND",
        entityType:    "ORDER",
        status:        "PARTIAL",
        errorMessage:  `دریافت سفارش‌ها پس از ${MAX_PAGES} صفحه متوقف شد — باقی سفارش‌ها در اجرای بعدی دریافت می‌شوند`,
      }).catch(() => {});
      break;
    }
    pages++;

    const result = await adapter.fetchOrders(credentials, cursor);

    for (const item of result.items) {
      const existing = await prisma.integOrder.findUnique({
        where: { platformCode_platformOrderId: { platformCode, platformOrderId: item.platformOrderId } },
      });
      if (existing) { skipped++; continue; }

      // پلتفرم ممکن است اصلاً شناسه‌ی محصول نداده باشد (رشته‌ی خالی) — آن‌وقت
      // جستجوی نگاشت بی‌معنی است ولی ردیف باید ثبت شود تا فروش نامرئی نماند.
      const hasProductId = !!item.platformProductId?.trim();
      const link = hasProductId
        ? await prisma.integMappingLink.findUnique({
            where: { platformCode_externalId: { platformCode, externalId: item.platformProductId } },
          })
        : null;
      if (!link) unmatched.push(item.platformProductId || "(بدون شناسه)");

      const webhookRow = await findTapsiWebhookRow(platformCode, item, link?.mappingId ?? null);
      if (webhookRow) {
        // وب‌هوک تپسی عنوان ندارد و شناسه‌ی محصول را جای عنوان می‌گذارد — عنوان واقعی را برسان
        if (item.title && webhookRow.productTitle === item.platformOrderItemId) {
          await prisma.integOrder.update({ where: { id: webhookRow.id }, data: { productTitle: item.title } }).catch(() => {});
        }
        skipped++;
        continue;
      }

      // سفارش دیررسیده (مثلاً بار اولی که سفارش‌های چند روز اخیر خوانده می‌شود)
      // احتمالاً ارسال شده و موجودی‌اش از حسابداری به‌روز شده است
      const late = !!item.orderedAt && Date.now() - item.orderedAt.getTime() > LATE_ORDER_MS;

      if (hasProductId && !late) {
        await decrementMappingStockForOrder(platformCode, item.platformProductId, item.qty).catch(() => {});
      }

      // بدون نگاشت، فاکتور ساخته نمی‌شود. به‌جای اینکه ردیف تا ابد PENDING بماند و
      // هر چرخه دوباره تلاش شود، صریحاً NEEDS_MAPPING می‌شود تا در ادمین دیده شود.
      const needsMapping = !link;

      const row = await prisma.integOrder.create({
        data: {
          mappingId:           link?.mappingId ?? null,
          platformCode,
          platformOrderId:     item.platformOrderId,
          platformOrderNo:     item.platformOrderNo ?? null,
          platformOrderItemId: item.platformOrderItemId ?? null,
          productTitle:        item.title ?? "(بدون عنوان)",
          qty:                 item.qty,
          unitPrice:           item.unitPrice ?? null,
          customerName:        item.customerName ?? null,
          customerPhone:       item.customerPhone ?? null,
          orderedAt:           item.orderedAt ?? null,
          autoInvoice:         !late,
          status:              needsMapping ? "NEEDS_MAPPING" : "PENDING",
          blockedReason:       !needsMapping
            ? null
            : hasProductId
              ? `محصول «${item.platformProductId}» در این پلتفرم به هیچ نگاشتی وصل نیست`
              : "پلتفرم برای این قلم شناسه‌ی محصول نفرستاد — نگاشت خودکار ممکن نیست، دستی رسیدگی کنید",
        },
      });

      // فاکتور فروش حسابداری داخلی — طرف حساب خود بازارگاه (docs/plans/accounting.md تصمیم ۹)
      await emitAccEventSafe({
        type: "SALE_ISSUED",
        aggregate: { type: "IntegOrder", id: row.id },
        dedupeKey: `integ:${row.id}:sale`,
        payload: { integOrderId: row.id },
      });

       void enrollMarketplaceCustomer({
        platformCode,
        phone: item.customerPhone,
        name:  item.customerName,
      });

      processed++;
    }

    for (const c of result.cancelledOrderIds ?? []) cancelledOrders.add(c);

    // سفارش‌های این صفحه ثبت شدند — حالا مکان‌نما را تثبیت کن.
    // فید اسنپ‌شاپ یک‌طرفه است: اگر مکان‌نما پیش از ثبت جلو می‌رفت، هر شکستی
    // وسط پردازش یعنی گم شدن دائمی همان سفارش‌ها.
    if (result.cursor && adapter.commitOrdersCursor) {
      await adapter.commitOrdersCursor(credentials, result.cursor).catch(() => {});
    }

    hasMore = result.hasMore;
    cursor = result.cursor;

    // مکان‌نما تکراری یا خالی در حالی که hasMore هنوز true است = حلقه‌ی بی‌پایان
    if (hasMore) {
      if (!cursor || seenCursors.has(cursor)) {
        hasMore = false;
      } else {
        seenCursors.add(cursor);
      }
    }
  }

  // لغو سفارش (فید رویدادی) — فقط ردیف‌های فاکتورنخورده، پس تکرار رویداد بی‌خطر است
  let cancelled = 0;
  for (const orderNo of cancelledOrders) {
    const rows = await prisma.integOrder.findMany({
      where: {
        platformCode,
        platformOrderId: { startsWith: `${orderNo}:` },
        status: { in: ["PENDING", "NEEDS_MAPPING"] },
      },
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
      await emitAccEventSafe({
        type: "SALE_VOIDED",
        aggregate: { type: "IntegOrder", id: row.id },
        dedupeKey: `integ:${row.id}:void`,
        payload: { integOrderId: row.id },
      });
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
    responseData:  { processed, skipped, cancelled, pages, unmatchedCount: unmatched.length, unmatched: unmatched.slice(0, 10) },
  }).catch(() => {});
}