import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { validateCoupon } from "@/lib/club/coupons";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * بررسی کد تخفیف پیش از ثبت سفارش
 *
 * ⚠️ این فقط برای نمایش به مشتری است. هنگام ثبت سفارش دوباره و به‌طور کامل
 *    سمت سرور اعتبارسنجی می‌شود — وگرنه می‌شود این مرحله را دور زد.
 */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const itemsTotal = BigInt(String(body?.itemsTotal ?? "0").replace(/\D/g, "") || "0");
  const shippingFee = BigInt(String(body?.shippingFee ?? "0").replace(/\D/g, "") || "0");

  if (!code.trim()) {
    return NextResponse.json({ error: "کد تخفیف را وارد کنید" }, { status: 400 });
  }

  const result = await validateCoupon({ code, userId: user.id, itemsTotal, shippingFee });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  }

  return NextResponse.json(
    serialize({
      valid: true,
      code: result.coupon!.code,
      title: result.coupon!.title,
      type: result.coupon!.type,
      discount: result.discount,
      freeShipping: result.freeShipping,
    })
  );
}
