import { orderListRoutes } from "../purchase-orders/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * سفارش فروش — docs/plans/webhesab-parity.md بخش ۳۱ (همان کد سفارش خرید با نوع SALES).
 * GET ?state&partyId&productId&q — فهرست با تحویل‌شده/سفارش؛ POST — سفارش تازه (ACC_SALES)
 */
export const { GET, POST } = orderListRoutes("SALES");
