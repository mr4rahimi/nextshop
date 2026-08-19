import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "./adapter-registry";
import { decryptCredentials } from "./crypto";
import { writeLog } from "./log";
import type { HesabanAdapter } from "@/lib/integration/adapters/accounting/hesaban.adapter";

const ACCOUNTING_CODE = "hesaban";
const PLATFORM_SUFFIX: Record<string, string> = { shop: "سایت", basalam: "باسلام", tapsi_shop: "تپسی‌شاپ", snappshop: "اسنپ‌شاپ" };
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

export type InvoiceMode = "AUTO" | "MANUAL";

interface InvoiceConfig {
  autoInvoiceEnabled?: boolean;
  invoiceStorageId?:   number;
  autoInvoiceSince?:   string; // ISO — فقط سفارش‌های بعد از فعال‌سازی فاکتور می‌خورند
  /**
   * AUTO   = worker خودش ردیف‌های آماده را فاکتور می‌کند (پیش‌فرض، رفتار قبلی)
   * MANUAL = فاکتور فقط با انتخاب ادمین در «سفارش‌های بازارگاه» ثبت می‌شود
   */
  invoiceMode?: InvoiceMode;
}

function readMode(config: InvoiceConfig): InvoiceMode {
  return config.invoiceMode === "MANUAL" ? "MANUAL" : "AUTO";
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
        platformOrderNo:     order.orderNumber ?? order.id,
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

/**
 * ردیف‌هایی که قبلاً به‌خاطر نبود نگاشت کنار گذاشته شده‌اند را دوباره می‌سنجد و
 * آن‌هایی که حالا نگاشت حسابداری دارند به صف فاکتور برمی‌گرداند.
 * بدون این، ادمین بعد از نگاشت کردن محصول باید دستی «تلاش دوباره» می‌زد.
 */
export async function requeueNewlyMappedOrders(): Promise<number> {
  const blocked = await prisma.integOrder.findMany({
    where:   { status: "NEEDS_MAPPING", mappingId: { not: null } },
    select:  { id: true, mappingId: true },
    take:    200,
  });
  if (!blocked.length) return 0;

  const mappingIds = [...new Set(blocked.map((r) => r.mappingId!))];
  const links = await prisma.integMappingLink.findMany({
    where:  { mappingId: { in: mappingIds }, platformCode: ACCOUNTING_CODE, isActive: true },
    select: { mappingId: true },
  });
  const ready = new Set(links.map((l) => l.mappingId));

  const ids = blocked.filter((r) => ready.has(r.mappingId!)).map((r) => r.id);
  if (!ids.length) return 0;

  await prisma.integOrder.updateMany({
    where: { id: { in: ids } },
    data:  { status: "PENDING", blockedReason: null },
  });
  return ids.length;
}

// در هر چرخه worker: ردیف‌های PENDING را گروهی (هر سفارش = یک فاکتور) به حسابداری می‌زند.
// `onlyIds` برای اجرای دستی از صفحه‌ی «سفارش‌های بازارگاه» است — در آن حالت
// حتی اگر حالت MANUAL باشد هم فاکتور زده می‌شود، چون ادمین صریحاً خواسته.
export async function processPendingInvoices(
  onlyIds?: string[],
): Promise<{ invoiced: number; skipped: string | null }> {
  const manualRun = Array.isArray(onlyIds);

  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: ACCOUNTING_CODE, status: { in: ["CONNECTED", "SYNCING"] } },
  });
  if (!connection) return { invoiced: 0, skipped: "اتصال حسابان برقرار نیست" };

  const config = (connection.config ?? {}) as InvoiceConfig;
  if (!config.autoInvoiceEnabled) return { invoiced: 0, skipped: "ثبت فاکتور فروش غیرفعال است" };
  if (!config.invoiceStorageId)   return { invoiced: 0, skipped: "انبار فاکتور انتخاب نشده است" };

  // در حالت دستی، worker خودش چیزی فاکتور نمی‌کند — فقط ادمین
  if (!manualRun && readMode(config) === "MANUAL") {
    await requeueNewlyMappedOrders().catch(() => {});
    return { invoiced: 0, skipped: null };
  }

  const adapter = getAdapter(ACCOUNTING_CODE) as HesabanAdapter | null;
  if (!adapter?.createSalesInvoice) return { invoiced: 0, skipped: "آداپتور حسابان فاکتور نمی‌سازد" };
  const credentials = decryptCredentials(connection.credentials);

  if (!manualRun) await requeueNewlyMappedOrders().catch(() => {});

  const since = config.autoInvoiceSince ? new Date(config.autoInvoiceSince) : new Date(0);
  // فقط PENDING — ردیف‌های NEEDS_MAPPING عمداً کنار گذاشته می‌شوند تا چرخه‌ی
  // تلاش بی‌نتیجه‌ی هر ۳۰ ثانیه (و سیل لاگ خطا) تکرار نشود.
  const pending = await prisma.integOrder.findMany({
    where: manualRun
      // اجرای دستی: دقیقاً همان ردیف‌های انتخاب‌شده، بدون فیلتر تاریخ
      ? { id: { in: onlyIds }, status: { in: ["PENDING", "NEEDS_MAPPING"] } }
      : { status: "PENDING", platformCode: { not: ACCOUNTING_CODE }, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take:    200,
  });
  if (!pending.length) return { invoiced: 0, skipped: manualRun ? "ردیف قابل فاکتوری انتخاب نشد" : null };

  const groups = new Map<string, typeof pending>();
  for (const row of pending) {
    const orderKey = row.platformOrderId.split(":")[0];
    const key = `${row.platformCode}|${orderKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  let handled = 0;
  let invoicedCount = 0;
  for (const [key, rows] of groups) {
    if (handled >= MAX_GROUPS_PER_CYCLE) break;
    handled++;
    const [platformCode, orderKey] = key.split("|");
    const invoiceRef = `${platformCode}-${orderKey}`;
    const invoiceUniqueId = deterministicUuid(invoiceRef);

    try {
      // اقلام فاکتور — هر ردیف باید نگاشت حسابداری و قیمت معتبر داشته باشد.
      // ردیف‌هایی که شرط را ندارند دلیلشان ثبت می‌شود تا در ادمین قابل رفع باشد.
      const articles: { storageId: number; productCode: string; count: number; amount: number; taxable: boolean; description?: string }[] = [];
      const blocked: { id: string; reason: string }[] = [];

      for (const row of rows) {
        if (!row.mappingId) {
          blocked.push({ id: row.id, reason: "محصول این قلم به هیچ نگاشتی وصل نیست" });
          continue;
        }
        const hesabanLink = await prisma.integMappingLink.findUnique({
          where: { mappingId_platformCode: { mappingId: row.mappingId, platformCode: ACCOUNTING_CODE } },
        });
        if (!hesabanLink?.isActive) {
          blocked.push({ id: row.id, reason: "نگاشت این محصول به کالای حسابداری (حسابان) وصل نیست یا غیرفعال است" });
          continue;
        }

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
        if (amountRial == null) {
          // fallback سوم: قیمت خود کالا در پلتفرم مبدأ سفارش (مثلاً قیمت درج‌شده در باسلام — ریال)
          const srcLink = await prisma.integMappingLink.findUnique({
            where: { mappingId_platformCode: { mappingId: row.mappingId, platformCode } },
          });
          if (srcLink) {
            const sp = await prisma.integPlatformProduct.findUnique({
              where:  { platformCode_platformProductId: { platformCode, platformProductId: srcLink.externalId } },
              select: { price: true },
            });
            amountRial = sp?.price != null && sp.price > 0 ? Math.round(sp.price) : null;
          }
        }
        if (amountRial == null || amountRial < 1) {
          blocked.push({ id: row.id, reason: "قیمت معتبری برای این قلم پیدا نشد (نه در سفارش، نه در حسابداری، نه در پلتفرم مبدأ)" });
          continue;
        }

        articles.push({
          storageId:   config.invoiceStorageId,
          productCode: hesabanLink.externalId,
          count:       row.qty,
          amount:      amountRial,
          taxable:     false,
          description: row.productTitle,
        });
      }

      // ردیف‌های مشکل‌دار را از حالت PENDING خارج می‌کنیم تا هر ۳۰ ثانیه دوباره
      // تلاش نشود؛ دلیلش ذخیره می‌شود و در «سفارش‌های بازارگاه» قابل رفع است.
      if (blocked.length) {
        for (const b of blocked) {
          await prisma.integOrder.update({
            where: { id: b.id },
            data:  { status: "NEEDS_MAPPING", blockedReason: b.reason },
          }).catch(() => {});
        }
        await writeLog({
          platformCode: ACCOUNTING_CODE, operationType: "CREATE_INVOICE", direction: "OUTBOUND",
          entityType: "ORDER", entityId: invoiceRef, status: articles.length ? "PARTIAL" : "ERROR",
          errorMessage: `${blocked.length} قلم فاکتور نشد — ${blocked[0].reason}`,
          responseData: { blocked: blocked.length, invoiced: articles.length, ref: invoiceRef },
        }).catch(() => {});
      }

      if (!articles.length) continue;

      const exists = await adapter.salesInvoiceExists(credentials, invoiceUniqueId);
      if (!exists) {
        const suffix = PLATFORM_SUFFIX[platformCode] ?? platformCode;
        // شماره سفارشِ قابل نمایش (چیزی که در پنل فروشنده دیده می‌شود)، نه شناسه داخلی
        const orderNo = rows.find((r) => r.platformOrderNo)?.platformOrderNo ?? orderKey;
        const realName = rows.find((r) => r.customerName?.trim())?.customerName?.trim();
        const phone    = rows.find((r) => r.customerPhone?.trim())?.customerPhone?.trim();
        // نام واقعی خریدار در دسترس نبود؟ دست‌کم شماره سفارش را در نام بگذار تا
        // فاکتورها در حسابداری از هم قابل تفکیک باشند — نه همه «مشتری باسلام».
        const name = realName
          ? `${realName} - ${suffix}`
          : `مشتری ${suffix} - سفارش ${orderNo}`;

        await adapter.createSalesInvoice(credentials, {
          id: invoiceUniqueId,
          customer: {
            isRealPerson: true,
            title:        "مشتری",
            name,
            phoneNumber:  phone || undefined,
          },
          articles,
          description: `ثبت خودکار — ${suffix} — شماره سفارش ${orderNo} — ${invoiceRef}`,
        });
      }

      // فقط ردیف‌هایی که واقعاً در فاکتور آمدند INVOICED می‌شوند؛
      // ردیف‌های blocked قبلاً NEEDS_MAPPING شده‌اند و نباید فاکتورشده علامت بخورند
      const blockedIds = new Set(blocked.map((b) => b.id));
      const invoicedIds = rows.map((r) => r.id).filter((id) => !blockedIds.has(id));
      await prisma.integOrder.updateMany({
        where: { id: { in: invoicedIds } },
        data:  { status: "INVOICED", invoicedAt: new Date() },
      });
      invoicedCount += invoicedIds.length;

      await writeLog({
        platformCode: ACCOUNTING_CODE, operationType: "CREATE_INVOICE", direction: "OUTBOUND",
        entityType: "ORDER", entityId: invoiceUniqueId, status: "SUCCESS",
        responseData: { articles: articles.length, platform: platformCode, ref: invoiceRef },
      }).catch(() => {});
    } catch (err) {
      await writeLog({
        platformCode: ACCOUNTING_CODE, operationType: "CREATE_INVOICE", direction: "OUTBOUND",
        entityType: "ORDER", entityId: invoiceUniqueId, status: "ERROR",
        errorMessage: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }
  }

  return { invoiced: invoicedCount, skipped: null };
}
