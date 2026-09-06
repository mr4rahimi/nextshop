import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { deductStockForOrderItems } from "@/lib/order-stock";
import { quoteRedeem, loadPointRules, redeemPointsForOrder } from "@/lib/club/points";
import { validateCoupon, consumeCoupon } from "@/lib/club/coupons";
import { setClubConsent } from "@/lib/club/consent";
import { ensureClubProfile } from "@/lib/club/profile";

export const runtime = "nodejs";

function generateOrderNumber(): string {
  const prefix = "MN";
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${num}`;
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { addressId, shippingMethodId, paymentMethod, items, useWallet, usePoints, couponCode, smsConsent } =
    await req.json();

  if (!addressId || !shippingMethodId || !items?.length)
    return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });

  const address = await prisma.address.findFirst({ where: { id: addressId, userId: user.id } });
  if (!address) return NextResponse.json({ error: "آدرس نامعتبر است" }, { status: 400 });

  const shipping = await prisma.shippingMethod.findUnique({ where: { id: shippingMethodId } });
  if (!shipping || !shipping.isActive) return NextResponse.json({ error: "روش ارسال نامعتبر است" }, { status: 400 });

  const productIds = items.map((i: any) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, title: true, price: true, salePrice: true },
  });

  if (products.length !== productIds.length)
    return NextResponse.json({ error: "یک یا چند محصول در دسترس نیست" }, { status: 400 });

  let itemsTotal = BigInt(0);
  const orderItems = items.map((i: any) => {
    const p = products.find(pr => pr.id === i.productId)!;
    const unitPrice = p.price;
    const unitSalePrice = p.salePrice;
    const linePrice = (unitSalePrice ?? unitPrice) * BigInt(i.qty);
    itemsTotal += linePrice;
    return {
      productId: p.id,
      qty: i.qty,
      unitPrice,
      unitSalePrice,
      titleSnapshot: p.title,
    };
  });

  let shippingFee = shipping.fee;

  // ── کد تخفیف ────────────────────────────────────────────────────
  // ⚠️ فقط خودِ کد از کلاینت گرفته می‌شود؛ مبلغ تخفیف همیشه اینجا محاسبه
  //    می‌شود. اعتماد به مبلغ ارسالی کلاینت یعنی هر کسی هر تخفیفی بگیرد.
  let couponDiscount = BigInt(0);
  let appliedCoupon: { id: string; code: string } | null = null;

  if (typeof couponCode === "string" && couponCode.trim()) {
    const result = await validateCoupon({
      code: couponCode,
      userId: user.id,
      itemsTotal,
      shippingFee,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (result.freeShipping) shippingFee = 0n;
    couponDiscount = result.discount;
    appliedCoupon = { id: result.coupon!.id, code: result.coupon!.code };
  }

  const grandTotal = itemsTotal + shippingFee - couponDiscount;

  let finalGrandTotal = grandTotal;

  // ── امتیاز باشگاه ───────────────────────────────────────────────
  // ⚠️ پیش از کیف پول اعمال می‌شود: امتیاز اعتبار سوختنی است ولی کیف پول پول
  //    واقعی مشتری است. برعکسش یعنی پول مشتری خرج شود و امتیازش بسوزد.
  //
  // ⚠️ مقدار درخواستی کلاینت اینجا فقط یک «درخواست» است؛ سقف واقعی را
  //    redeemPointsForOrder از روی موجودی و تنظیمات تعیین می‌کند.
  let pointsDiscount = BigInt(0);
  let pointsSpent = 0;
  let clubProfileId: string | null = null;

  if (usePoints) {
    const profile = await prisma.clubProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (profile) {
      clubProfileId = profile.id;
      const quote = await quoteRedeem(profile.id, grandTotal);

      if (quote.allowed) {
        const wanted =
          usePoints === true ? quote.maxPoints : Math.floor(Number(usePoints) || 0);
        pointsSpent = Math.min(Math.max(wanted, 0), quote.maxPoints);
        // مبلغ واقعی بعد از ثبت سفارش قطعی می‌شود؛ اینجا فقط برای محاسبه‌ی جمع
        const rules = await loadPointRules();
        pointsDiscount = BigInt(Math.floor(pointsSpent * rules.redeemRate));
        if (pointsDiscount > finalGrandTotal) pointsDiscount = finalGrandTotal;
        finalGrandTotal -= pointsDiscount;
      }
    }
  }

  let walletDiscount = BigInt(0);
  const afterPoints = finalGrandTotal;

  if (useWallet) {
    const settings = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { walletEnabled: true },
    });

    if (settings?.walletEnabled) {
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { walletBalance: true },
      });
      const balance = userData?.walletBalance ?? 0n;
      if (balance > 0n) {
        walletDiscount = balance >= afterPoints ? afterPoints : balance;
        finalGrandTotal = afterPoints - walletDiscount;
      }
    }
  }

 
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        addressId,
        orderNumber: generateOrderNumber(),
        status:
          finalGrandTotal === 0n && (walletDiscount > 0n || pointsDiscount > 0n)
            ? "PAID"
            : "PENDING_PAYMENT",
        itemsTotal,
        shippingFee,
        discountTotal: walletDiscount + pointsDiscount + couponDiscount,
        couponCode: appliedCoupon?.code ?? null,
        grandTotal: finalGrandTotal,
        items: { create: orderItems },
        payments: {
          create: [
           
            ...(finalGrandTotal > 0n ? [{
              amount: finalGrandTotal,
              status: "PENDING" as const,
              provider: paymentMethod === "online" ? "gateway" : "card_transfer",
            }] : []),
        
            ...(walletDiscount > 0n ? [{
              amount: walletDiscount,
              status: "SUCCEEDED" as const,
              provider: "WALLET",
              providerRef: `wallet-${Date.now()}`,
            }] : []),
          ],
        },
      },
    });

  
  if (walletDiscount > 0n) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { walletBalance: { decrement: walletDiscount } },
      }),
      prisma.walletTransaction.create({
        data: {
          userId: user.id,
          amount: -walletDiscount,
          reason: `پرداخت سفارش ${order.orderNumber}`,
          meta: { orderId: order.id },
        },
      }),
    ]);
  }

  if (appliedCoupon) {
    await consumeCoupon({
      couponId: appliedCoupon.id,
      userId: user.id,
      orderId: order.id,
      discount: couponDiscount,
    });
  }

  // برداشت امتیاز بعد از ساخت سفارش — تراکنش باید به سفارش گره بخورد تا اگر
  // سفارش لغو شد بتوان امتیاز را برگرداند
  if (clubProfileId && pointsSpent > 0) {
    await redeemPointsForOrder({
      profileId: clubProfileId,
      orderId: order.id,
      orderTotal: grandTotal,
      requested: pointsSpent,
    }).catch((e: unknown) => console.error("[club] برداشت امتیاز ناموفق:", e));
  }

  // ── رضایت دریافت پیام ───────────────────────────────────────────
  // ⚠️ فقط «دادن» رضایت از اینجا پذیرفته می‌شود، نه پس گرفتن آن: نبودِ تیک
  //    یعنی مشتری کاری نکرده، نه اینکه لغو کرده. لغو مسیر خودش را دارد.
  if (smsConsent === true) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      null;

    // خریدار اولی هنوز پروفایل باشگاه ندارد (در گذار وضعیت سفارش ساخته
    // می‌شود). بدون این، رضایتش بی‌صدا گم می‌شود.
    await ensureClubProfile(user.id, { source: "ONLINE" }).catch(() => {});

    await setClubConsent({
      userId: user.id,
      granted: true,
      source: "CHECKOUT",
      ip,
      userAgent: req.headers.get("user-agent"),
      note: `سفارش ${order.orderNumber}`,
    });
  }

  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  // کسر موجودی فقط وقتی سفارش همین لحظه پرداخت‌شده ساخته شده (پرداخت کامل با کیف پول)
  // سایر سفارش‌ها بعد از پرداخت موفق (callback درگاه یا تأیید ادمین) کسر می‌شوند
  if (order.status === "PAID") {
    await deductStockForOrderItems(orderItems).catch((e: unknown) =>
      console.error("[order-stock] کسر موجودی سفارش کیف‌پولی ناموفق:", e)
    );
  }

  return NextResponse.json(serialize({ orderId: order.id, orderNumber: order.orderNumber }));
}