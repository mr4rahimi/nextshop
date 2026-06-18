import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// کش سبک — تنظیمات زیاد تغییر نمی‌کند
export const revalidate = 60;

// فقط داده‌های لازم برای رندر ویجت را برمی‌گرداند (نه اطلاعات حساس کامل)
export async function GET() {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { chatSettings: true },
  });

  const cfg = (settings?.chatSettings as Record<string, unknown>) ?? {};

  return NextResponse.json({
    isEnabled: cfg.isEnabled ?? true,
    welcomeMessage:
      cfg.welcomeMessage ?? "سلام! من دستیار خرید این فروشگاه هستم. چطور می‌تونم کمکت کنم؟",
    flow: cfg.flow ?? [],
  });
}