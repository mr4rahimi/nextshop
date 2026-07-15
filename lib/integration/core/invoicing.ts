import { prisma } from "@/lib/prisma";
import { getAdapter } from "./adapter-registry";
import { decryptCredentials } from "./crypto";
import { writeLog } from "./log";
import type { HesabanAdapter } from "@/lib/integration/adapters/accounting/hesaban.adapter";

const ACCOUNTING_CODE = "hesaban";
const PLATFORM_SUFFIX: Record<string, string> = { shop: "سایت", basalam: "باسلام" };
const MAX_GROUPS_PER_CYCLE = 10;

interface InvoiceConfig {
  autoInvoiceEnabled?: boolean;
  invoiceStorageId?:   number;
  autoInvoiceSince?:   string; // ISO — فقط سفارش‌های بعد از فعال‌سازی فاکتور می‌خورند
}

// ثبت ردیف‌های فاکتور برای سفارش سایت (در اولین گذار به CONFIRMED صدا زده می‌شود)
export async function queueShopOrderForInvoicing(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items:   { select: { id: true, productId: true, qty: true, unitPrice: true, unitSalePrice: true, titleSnapshot: true } },
      user:    { select: { firstName: true, lastName: true, phone: true } },
      address: { select: { receiver: true, phone: true } },
    },
  });
  if (!order) return;

  const customerName =
    order.address?.receiver ||
    [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") ||
    null;
  const customerPhone = order.address?.phone ?? order.user.phone ?? null;

  for (const item of order.items) {
    const link = await prisma.integMappingLink.findUnique({
      where: { platformCode_externalId: { platformCode: "shop", externalId: item.productId } },
    });
    const priceToman = Number(item.unitSalePrice ?? item.unitPrice);
    await prisma.integOrder.create({
      data: {
        mappingId:           link?.mappingId ?? null,
        platformCode:        "shop",
        platformOrderId:     `${order.id}:${item.id}`,
        platformOrderItemId: item.id,
        productTitle:        item.titleSnapshot,
        qty:                 item.qty,
        unitPrice:           Number.isFinite(priceToman) ? priceToman : null,
        customerName,
        customerPhone,
        status:              "PENDING",
      },
    }).catch(() => {}); // unique constraint → گذار تکراری ردیف تکراری نمی‌سازد
  }
}

// در هر چرخه worker: ردیف‌های PENDING را گروهی (هر سفارش = یک فاکتور) به حسابداری می‌زند
export async function processPendingInvoices(): Promise<void> {
  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: ACCOUNTING_CODE, status: { in: ["CONNECTED", "SYNCING"] } },
  });
  if (!connection) return;

  const config = (connection.config ?? {}) as InvoiceConfig;
  if (!config.autoInvoiceEnabled || !config.invoiceStorageId) return;

  const adapter = getAdapter(ACCOUNTING_CODE) as HesabanAdapter | null;
  if (!adapter?.createSalesInvoice) return;
  const credentials = decryptCredentials(connection.credentials);

  const since = config.autoInvoiceSince ? new Date(config.autoInvoiceSince) : new Date(0);
  const pending = await prisma.integOrder.findMany({
    where:   { status: "PENDING", platformCode: { not: ACCOUNTING_CODE }, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take:    200,
  });
  if (!pending.length) return;

  const groups = new Map<string, typeof pending>();
  for (const row of pending) {
    const orderKey = row.platformOrderId.split(":")[0];
    const key = `${row.platformCode}|${orderKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  let handled = 0;
  for (const [key, rows] of groups) {
    if (handled >= MAX_GROUPS_PER_CYCLE) break;
    handled++;
    const [platformCode, orderKey] = key.split("|");
    const invoiceUniqueId = `${platformCode}-${orderKey}`;

    try {
      // اقلام فاکتور — فقط ردیف‌هایی که به کالای حسابداری نگاشت دارند
      const articles: { storageId: number; productCode: string; count: number; amount: number; taxable: boolean; description?: string }[] = [];
      for (const row of rows) {
        if (!row.mappingId) continue;
        const hesabanLink = await prisma.integMappingLink.findUnique({
          where: { mappingId_platformCode: { mappingId: row.mappingId, platformCode: ACCOUNTING_CODE } },
        });
        if (!hesabanLink?.isActive) continue;

        // مبلغ به ریال: قیمت داخلی (تومان)×۱۰ — وگرنه قیمت خود کالای حسابداری (ریال)
        let amountRial: number | null = row.unitPrice != null ? Math.round(row.unitPrice * 10) : null;
        if (amountRial == null) {
          const hp = await prisma.integPlatformProduct.findUnique({
            where:  { platformCode_platformProductId: { platformCode: ACCOUNTING_CODE, platformProductId: hesabanLink.externalId } },
            select: { price: true },
          });
          amountRial = hp?.price != null ? Math.round(hp.price) : null;
        }
        if (amountRial == null) continue;

        articles.push({
          storageId:   config.invoiceStorageId,
          productCode: hesabanLink.externalId,
          count:       row.qty,
          amount:      amountRial,
          taxable:     false,
          description: row.productTitle,
        });
      }
      if (!articles.length) continue; // هنوز نگاشت حسابداری ندارد — PENDING می‌ماند

      const exists = await adapter.salesInvoiceExists(credentials, invoiceUniqueId);
      if (!exists) {
        const suffix  = PLATFORM_SUFFIX[platformCode] ?? platformCode;
        const rawName = rows.find((r) => r.customerName)?.customerName ?? `مشتری ${suffix}`;
        await adapter.createSalesInvoice(credentials, {
          id: invoiceUniqueId,
          customer: {
            isRealPerson: true,
            title:        "مشتری",
            name:         `${rawName} -${suffix}`,
            phoneNumber:  rows.find((r) => r.customerPhone)?.customerPhone ?? undefined,
          },
          articles,
          description: `ثبت خودکار — ${suffix} — سفارش ${orderKey}`,
        });
      }

      await prisma.integOrder.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data:  { status: "INVOICED", invoicedAt: new Date() },
      });

      await writeLog({
        platformCode: ACCOUNTING_CODE, operationType: "FETCH_ORDERS", direction: "OUTBOUND",
        entityType: "ORDER", entityId: invoiceUniqueId, status: "SUCCESS",
        responseData: { articles: articles.length, platform: platformCode },
      }).catch(() => {});
    } catch (err) {
      await writeLog({
        platformCode: ACCOUNTING_CODE, operationType: "FETCH_ORDERS", direction: "OUTBOUND",
        entityType: "ORDER", entityId: invoiceUniqueId, status: "ERROR",
        errorMessage: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }
  }
}
