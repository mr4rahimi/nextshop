/**
 * فروش یک بازه — برای ابزار `report_sales` دستیار (docs/plans/admin-assistant.md فاز ۳).
 *
 * تعریف «فروش» همان داشبورد پنل است (`app/admin/page.tsx`): سفارشی که از «در انتظار پرداخت»
 * گذشته و لغو یا مسترد نشده. سفارش تلفنی (`createdByStaffId`) جدا شمرده می‌شود.
 * فروش بازارگاه‌ها در `IntegOrder` است و اینجا **نیست** (`report_marketplaces`).
 */
import { prisma } from "@/lib/prisma";

const NOT_SALE = ["PENDING_PAYMENT", "CANCELED", "REFUNDED"];

export interface SalesTotals {
  orders: number;
  revenue: number;
  avgBasket: number;
  online: { orders: number; revenue: number };
  phone: { orders: number; revenue: number };
  discount: number;
  shipping: number;
  canceled: number;
  pendingPayment: number;
}

export async function salesTotals(start: Date, end: Date): Promise<SalesTotals> {
  const [rows] = await prisma.$queryRaw<
    {
      orders: bigint; revenue: bigint | null; online: bigint; online_rev: bigint | null;
      discount: bigint | null; shipping: bigint | null; canceled: bigint; pending: bigint;
    }[]
  >`
    SELECT COUNT(*) FILTER (WHERE status::text <> ALL(${NOT_SALE})) AS orders,
           SUM("grandTotal") FILTER (WHERE status::text <> ALL(${NOT_SALE})) AS revenue,
           COUNT(*) FILTER (WHERE status::text <> ALL(${NOT_SALE}) AND "createdByStaffId" IS NULL) AS online,
           SUM("grandTotal") FILTER (WHERE status::text <> ALL(${NOT_SALE}) AND "createdByStaffId" IS NULL) AS online_rev,
           SUM("discountTotal") FILTER (WHERE status::text <> ALL(${NOT_SALE})) AS discount,
           SUM("shippingFee") FILTER (WHERE status::text <> ALL(${NOT_SALE})) AS shipping,
           COUNT(*) FILTER (WHERE status IN ('CANCELED','REFUNDED')) AS canceled,
           COUNT(*) FILTER (WHERE status = 'PENDING_PAYMENT') AS pending
      FROM "Order"
     WHERE "createdAt" >= ${start} AND "createdAt" < ${end}`;
  const orders = Number(rows?.orders ?? 0);
  const revenue = Number(rows?.revenue ?? 0);
  const online = Number(rows?.online ?? 0);
  const onlineRev = Number(rows?.online_rev ?? 0);
  return {
    orders,
    revenue,
    avgBasket: orders ? Math.round(revenue / orders) : 0,
    online: { orders: online, revenue: onlineRev },
    phone: { orders: orders - online, revenue: revenue - onlineRev },
    discount: Number(rows?.discount ?? 0),
    shipping: Number(rows?.shipping ?? 0),
    canceled: Number(rows?.canceled ?? 0),
    pendingPayment: Number(rows?.pending ?? 0),
  };
}

/** پرفروش‌ها به مبلغ — قیمت فروش واقعی ردیف (تخفیف‌خورده اگر بود) × تعداد */
export async function topProducts(start: Date, end: Date, limit = 10) {
  const rows = await prisma.$queryRaw<{ title: string; qty: bigint; revenue: bigint | null; orders: bigint }[]>`
    SELECT MAX(i."titleSnapshot") AS title,
           SUM(i.qty) AS qty,
           SUM(i.qty * COALESCE(NULLIF(i."unitSalePrice", 0), i."unitPrice")) AS revenue,
           COUNT(DISTINCT i."orderId") AS orders
      FROM "OrderItem" i
      JOIN "Order" o ON o.id = i."orderId"
     WHERE o."createdAt" >= ${start} AND o."createdAt" < ${end}
       AND o.status::text <> ALL(${NOT_SALE})
     GROUP BY i."productId"
     ORDER BY revenue DESC NULLS LAST
     LIMIT ${limit}`;
  return rows.map((r) => ({ title: r.title, qty: Number(r.qty), revenue: Number(r.revenue ?? 0), orders: Number(r.orders) }));
}

/** اولین سفارش فروشگاه — پیش از آن «صفر» افت نیست */
export async function firstOrderAt(): Promise<Date | null> {
  const o = await prisma.order.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  return o?.createdAt ?? null;
}
