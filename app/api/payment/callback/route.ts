import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deductStockForOrderItems } from "@/lib/order-stock";

export const runtime = "nodejs";

interface CallbackParams {
  transid:        string | null;
  status:         string | null;
  orderId:        string | null;
  trackingNumber: string | null;
}

// آقای پرداخت بسته به تنظیمات (و در sandbox) ممکن است GET یا POST بزند — هر دو پشتیبانی می‌شود
export async function GET(req: Request) {
  const url = new URL(req.url);
  return handleCallback(req, {
    transid:        url.searchParams.get("transid"),
    status:         url.searchParams.get("status"),
    orderId:        url.searchParams.get("invoice_id"),
    trackingNumber: url.searchParams.get("tracking_number"),
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let form: FormData | null = null;
  try { form = await req.formData(); } catch { /* body ممکن است فرم نباشد */ }
  const pick = (k: string) => form?.get(k)?.toString() ?? url.searchParams.get(k);
  return handleCallback(req, {
    transid:        pick("transid"),
    status:         pick("status"),
    orderId:        pick("invoice_id"),
    trackingNumber: pick("tracking_number"),
  });
}

async function handleCallback(req: Request, p: CallbackParams) {
  const url  = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  // 303: بعد از POST هم مرورگر با GET ری‌دایرکت می‌شود
  const redirect = (path: string) => NextResponse.redirect(`${base}${path}`, 303);

  const { transid, status, orderId, trackingNumber } = p;

  if (!orderId) return redirect("/");
  if (status !== "1") return redirect(`/checkout/failed/${orderId}`);
  if (!transid)       return redirect(`/checkout/failed/${orderId}`);

  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, grandTotal: true, status: true, items: { select: { productId: true, qty: true } } },
  });

  if (!order) return redirect(`/checkout/failed/${orderId}`);

  // قبلاً پردازش شده (idempotent)
  if (order.status !== "PENDING_PAYMENT") {
    return redirect(`/checkout/success/${orderId}`);
  }

  const settings = await prisma.storeSettings.findUnique({
    where:  { id: "singleton" },
    select: { paymentGatewayMerchant: true, paymentGatewaySandbox: true },
  });

  const isSandbox = settings?.paymentGatewaySandbox ?? false;
  const pin = isSandbox ? "sandbox" : settings?.paymentGatewayMerchant;

  if (!pin) return redirect(`/checkout/failed/${orderId}`);

  try {
    const verifyRes = await fetch("https://panel.aqayepardakht.ir/api/v2/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ pin, amount: Number(order.grandTotal), transid }),
    });

    const verifyData = await verifyRes.json();
    const code = String(verifyData.code);

    if (verifyData.status === "success" && code === "1") {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data:  { status: "PAID" },
        }),
        prisma.payment.updateMany({
          where: { orderId, status: "PENDING" },
          data:  { status: "SUCCEEDED", providerRef: trackingNumber ?? transid },
        }),
      ]);

      // کسر موجودی سایت و نگاشت — دقیقاً یک بار (گارد PENDING_PAYMENT بالا)
      await deductStockForOrderItems(order.items).catch((e: unknown) =>
        console.error("[order-stock] کسر موجودی بعد از پرداخت ناموفق:", e)
      );

      return redirect(`/checkout/success/${orderId}`);
    }

    // code "2" = قبلاً verify شده (موفق در نظر بگیر)
    if (code === "2") {
      return redirect(`/checkout/success/${orderId}`);
    }
  } catch (err) {
    console.error("[payment-callback] خطا در verify:", err);
  }

  return redirect(`/checkout/failed/${orderId}`);
}
