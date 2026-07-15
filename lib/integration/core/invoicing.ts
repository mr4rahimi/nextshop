import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "./adapter-registry";
import { decryptCredentials } from "./crypto";
import { writeLog } from "./log";
import type { HesabanAdapter } from "@/lib/integration/adapters/accounting/hesaban.adapter";

const ACCOUNTING_CODE = "hesaban";
const PLATFORM_SUFFIX: Record<string, string> = { shop: "سایت", basalam: "باسلام" };
const MAX_GROUPS_PER_CYCLE = 10;

// وب‌حسابان فیلد id فاکتور را GUID می‌خواهد.
// UUID v5 قطعی از کلید سفارش می‌سازیم تا retry همیشه همان GUID را تولید کند (idempotency).
const UUID_NAMESPACE = "9a7b3c1e-5d2f-4e8a-b6c4-1f0e2d3a4b5c";

function deterministicUuid(name: string): string {
  const ns = Buffer.from(UUID_NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(name, "utf8").digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // variant RFC 4122
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

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
    // قیمت صفر یعنی قیمت معتبر ثبت نشده — unitSalePrice صفر نباید جای قیمت اصلی را بگیرد
    const sale  = Number(item.unitSalePrice ?? 0);
    const base  = Number(item.unitPrice ?? 0);
    const priceToman = sale > 0 ? sale : base;
    await prisma.integOrder.create({
      data: {
        mappingId:           link?.mappingId ?? null,
        platformCode:        "shop",
        platformOrderId:     `${order.id}:${item.id}`,
        platformOrderItemId: item.id,
        productTitle:        item.titleSnapshot,
        qty:                 item.qty,
        unitPrice:           Number.isFinite(priceToman) && priceToman > 0 ? priceToman : null,
        customerName,
        customerPhone,
        status:              "PENDING",
      },
    }).catch((e: unknown) => {
      // P2002 = تکراری (طبیعی در گذار مجدد) — بقیه خطاها باید دیده شوند
      if ((e as { code?: string })?.code !== "P2002") {
        console.error("[integ-invoice] ساخت ردیف IntegOrder ناموفق:", e);
      }
    });
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
    const invoiceRef = `${platformCode}-${orderKey}`;
    const invoiceUniqueId = deterministicUuid(invoiceRef);

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
        let amountRial: number | null =
          row.unitPrice != null && row.unitPrice > 0 ? Math.round(row.unitPrice * 10) : null;
        if (amountRial == null) {
          const hp = await prisma.integPlatformProduct.findUnique({
            where:  { platformCode_platformProductId: { platformCode: ACCOUNTING_CODE, platformProductId: hesabanLink.externalId } },
            select: { price: true },
          });
          amountRial = hp?.price != null && hp.price > 0 ? Math.round(hp.price) : null;
        }
        if (amountRial == null || amountRial < 1) continue; // بدون قیمت معتبر — قلم حذف می‌شود

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
          description: `ثبت خودکار — ${suffix} — سفارش ${orderKey} — ${invoiceRef}`,
        });
      }

      await prisma.integOrder.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data:  { status: "INVOICED", invoicedAt: new Date() },
      });

      await writeLog({
        platformCode: ACCOUNTING_CODE, operationType: "FETCH_ORDERS", direction: "OUTBOUND",
        entityType: "ORDER", entityId: invoiceUniqueId, status: "SUCCESS",
        responseData: { articles: articles.length, platform: platformCode, ref: invoiceRef },
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
