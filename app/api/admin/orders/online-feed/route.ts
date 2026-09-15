import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** چند سفارش آخر کافی است؛ کلاینت فقط شناسه‌های تازه را با قبلی مقایسه می‌کند */
const TAKE = 10;

/**
 * خوراک صدای «سفارش آنلاین ثبت شد» — `components/admin/orders/OnlineOrderSound.tsx`.
 *
 * هر بیست ثانیه از همه‌ی تب‌های باز پنل صدا زده می‌شود، پس باید سبک بماند:
 * یک کوئری روی ایندکس `createdAt` و فقط سه ستون، بدون join.
 *
 * سفارش آنلاین یعنی `createdByStaffId = null` (تعریف در schema.prisma)؛
 * سفارش تلفنی را خود کارمند ثبت کرده و صدا لازم ندارد.
 *
 * دسترسی را proxy با بخش «سفارش‌ها» (PANEL_ORDERS) می‌بندد — بدون مجوز ۴۰۳
 * برمی‌گردد و کلاینت دکمه‌ی صدا را نشان نمی‌دهد.
 */
export async function GET() {
  const orders = await prisma.order.findMany({
    where: { createdByStaffId: null },
    orderBy: { createdAt: "desc" },
    take: TAKE,
    select: { id: true, orderNumber: true, createdAt: true },
  });

  return NextResponse.json({ orders });
}
