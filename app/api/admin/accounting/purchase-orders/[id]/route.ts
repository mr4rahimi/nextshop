import { orderItemRoutes } from "../handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** یک سفارش خرید — GET/PUT/POST(invoice|close|cancel|reopen)/DELETE؛ کد در `../handlers.ts` */
export const { GET, PUT, POST, DELETE } = orderItemRoutes("PURCHASE");
