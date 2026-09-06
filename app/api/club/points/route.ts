import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { quoteRedeem, loadPointRules } from "@/lib/club/points";
import { getPointsBalance } from "@/lib/club/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * موجودی امتیاز و سقف استفاده روی یک مبلغ
 *
 * صفحه‌ی تسویه‌حساب پیش از ثبت سفارش این را می‌پرسد تا به مشتری نشان دهد چقدر
 * می‌تواند با امتیاز پرداخت کند. سقف واقعی هنگام ثبت سفارش دوباره سمت سرور
 * محاسبه می‌شود — این فقط برای نمایش است.
 */
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const profile = await prisma.clubProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, smsConsent: true },
  });

  const rules = await loadPointRules();

  if (!profile) {
    return NextResponse.json({
      balance: 0,
      enabled: rules.redeemEnabled,
      rate: rules.redeemRate,
      quote: null,
      consent: { given: false, points: rules.onConsent },
    });
  }

  const balance = await getPointsBalance(profile.id);

  const totalParam = new URL(req.url).searchParams.get("total");
  const total = totalParam ? BigInt(totalParam.replace(/\D/g, "") || "0") : 0n;

  const quote = total > 0n ? await quoteRedeem(profile.id, total) : null;

  return NextResponse.json({
    balance,
    enabled: rules.redeemEnabled,
    rate: rules.redeemRate,
    min: rules.redeemMin,
    maxPct: rules.redeemMaxPct,
    quote,
    // وضعیت رضایت + امتیاز تشویقی — تیک تسویه‌حساب فقط وقتی نشان داده
    // می‌شود که مشتری هنوز رضایت نداده باشد
    consent: { given: profile.smsConsent, points: rules.onConsent },
  });
}
