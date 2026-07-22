import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrementMappingStockForOrder, restoreMappingStockForCancel } from "@/lib/integration/core/inventory";
import { writeLog } from "@/lib/integration/core/log";
import { decryptCredentials } from "@/lib/integration/core/crypto";
import { enrollMarketplaceCustomer } from "@/lib/club/marketplace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PLATFORM = "tapsi_shop";

// ساختار payload وب‌هوک تپسی‌شاپ
interface TapsiWebhookBody {
  orderDetail?: {
    orderId?: number | string;
    orderNumber?: string;
    changeType?: number;
    customerFullName?: string;
    customerFirstName?: string;
    customerLastName?: string;
    customerMobile?: string;
    receiverFullName?: string;
    receiverMobile?: string;
  };
  items?: {
    orderItemId?: number | string;
    productId?: string;   // sku سمت فروشنده = externalId نگاشت تپسی
    quantity?: number;
    changeType?: number;  // 1=خرید (کاهش) ، 2=لغو (افزایش)
    finalPrice?: number;  // ریال
  }[];
}

// تپسی توکن را با این هدر می‌فرستد
const AUTH_HEADER = "tapsishop.hub.webhook-authorization";

// تپسی در وب‌هوک، productId را به‌صورت SKU می‌فرستد؛ نگاشت با شناسه محصول ذخیره شده
async function resolveExternalId(skuOrId: string): Promise<string> {
  const row = await prisma.integPlatformProduct.findFirst({
    where:  { platformCode: PLATFORM, OR: [{ platformProductId: skuOrId }, { sku: skuOrId }] },
    select: { platformProductId: true },
  });
  return row?.platformProductId ?? skuOrId;
}

export async function POST(req: NextRequest) {
  // ── اعتبارسنجی توکن ────────────────────────────────────────────
  const sentToken = req.headers.get(AUTH_HEADER) ?? req.headers.get("TapsiShop.Hub.Webhook-Authorization");

  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: PLATFORM, status: { in: ["CONNECTED", "SYNCING"] } },
  });

  if (!connection) {
    return NextResponse.json({ succeed: false, message: "اتصال تپسی‌شاپ برقرار نیست" }, { status: 200 });
  }

  // توکن ذخیره‌شده را با توکن ارسالی مقایسه می‌کنیم
  let expectedToken = "";
  try { expectedToken = decryptCredentials(connection.credentials).token ?? ""; } catch { /* ignore */ }

  if (!sentToken || sentToken !== expectedToken) {
    await writeLog({
      platformCode: PLATFORM, operationType: "FETCH_ORDERS", direction: "INBOUND",
      entityType: "ORDER", status: "ERROR", errorMessage: "توکن وب‌هوک نامعتبر",
    }).catch(() => {});
    // پاسخ 200 با succeed:false تا تپسی retry بی‌مورد نکند، ولی پردازش نمی‌کنیم
    return NextResponse.json({ succeed: false, message: "unauthorized" }, { status: 200 });
  }

  // ── پردازش payload ─────────────────────────────────────────────
  let body: TapsiWebhookBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ succeed: false, message: "bad json" }, { status: 200 }); }

  const orderId = String(body.orderDetail?.orderId ?? "");
  const items   = body.items ?? [];
  if (!orderId || items.length === 0) {
    return NextResponse.json({ succeed: true, message: "no items" }, { status: 200 });
  }

  const customerName =
    body.orderDetail?.customerFullName ||
    [body.orderDetail?.customerFirstName, body.orderDetail?.customerLastName].filter(Boolean).join(" ") ||
    null;
  const customerPhone = body.orderDetail?.customerMobile ?? null;

  let purchased = 0, cancelled = 0, skipped = 0;
  const unmatched: string[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const sku  = item.productId ?? "";
    const qty  = Math.abs(item.quantity ?? 0) || 1;
    // changeType آیتم اولویت دارد، وگرنه از orderDetail
    const changeType = item.changeType ?? body.orderDetail?.changeType ?? 1;

    if (!sku) { skipped++; continue; }

    const externalId = await resolveExternalId(sku);

    try {
      if (changeType === 2) {
        // ── لغو: برگرداندن موجودی + علامت‌گذاری سفارش ────────────
        await restoreMappingStockForCancel(PLATFORM, externalId, qty).catch(() => {});
        // ردیف سفارش مرتبط را کنسل‌شده علامت بزن (اگر هنوز فاکتور نخورده)
        await prisma.integOrder.updateMany({
          where: { platformCode: PLATFORM, platformOrderId: `${orderId}:${idx}`, status: "PENDING" },
          data:  { status: "CANCELLED" },
        }).catch(() => {});
        cancelled++;
      } else {
        // ── خرید: dedup، کسر موجودی، ساخت IntegOrder (فاکتور خودکار توسط worker) ──
        const platformOrderId = `${orderId}:${idx}`;
        const existing = await prisma.integOrder.findUnique({
          where: { platformCode_platformOrderId: { platformCode: PLATFORM, platformOrderId } },
        });
        if (existing) { skipped++; continue; }

        const link = await prisma.integMappingLink.findUnique({
          where: { platformCode_externalId: { platformCode: PLATFORM, externalId } },
        });
        if (!link) unmatched.push(sku);

        await decrementMappingStockForOrder(PLATFORM, externalId, qty).catch(() => {});

        await prisma.integOrder.create({
          data: {
            mappingId:           link?.mappingId ?? null,
            platformCode:        PLATFORM,
            platformOrderId,
            platformOrderItemId: String(item.orderItemId ?? idx),
            productTitle:        link?.externalTitle ?? sku,
            qty,
            unitPrice:           typeof item.finalPrice === "number" ? Math.round(item.finalPrice / 10) : null, // ریال→تومان
            customerName,
            customerPhone,
            status:              "PENDING",
          },
        });
        purchased++;
      }
    } catch {
      skipped++;
    }
  }

  if (purchased > 0) {
    void enrollMarketplaceCustomer({
      platformCode: PLATFORM,
      phone: customerPhone,
      name:  customerName,
    });
  }

  await writeLog({
    platformCode: PLATFORM, operationType: "FETCH_ORDERS", direction: "INBOUND",
    entityType: "ORDER", entityId: orderId, status: "SUCCESS",
    responseData: { purchased, cancelled, skipped, unmatched: unmatched.slice(0, 10), via: "webhook" },
  }).catch(() => {});

  // تپسی انتظار succeed:true دارد وگرنه ارسال را غیرفعال می‌کند
  return NextResponse.json({ succeed: true, message: "processed" }, { status: 200 });
}
