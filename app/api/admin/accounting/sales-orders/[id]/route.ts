import { orderItemRoutes } from "../../purchase-orders/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** یک سفارش فروش — GET/PUT/POST(invoice|close|cancel|reopen)/DELETE؛ «invoice» = فاکتور فروش (تحویل) از روی سفارش */
export const { GET, PUT, POST, DELETE } = orderItemRoutes("SALES");
