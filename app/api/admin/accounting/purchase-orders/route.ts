import { orderListRoutes } from "./handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * سفارش خرید — docs/plans/webhesab-parity.md بخش ۱۳ (کد مشترک با سفارش فروش در `handlers.ts`).
 * GET ?state=open|overdue|done|all&partyId&productId&q — فهرست با دریافت‌شده/سفارش
 * POST — سفارش تازه (ACC_PURCHASE)
 */
export const { GET, POST } = orderListRoutes("PURCHASE");
