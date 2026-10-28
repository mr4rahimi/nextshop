import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDemo } from "@/lib/demo";
import { DEMO_MARKETPLACES, forceDemoOrder, pick } from "@/lib/demo/marketplace";
import { getAdapter } from "@/lib/integration/core/adapter-registry";
import { fetchAndProcessOrders } from "@/lib/integration/core/orders";
import { dispatchAccEvents } from "@/lib/accounting/dispatcher";

export const runtime = "nodejs";

/**
 * «سفارش آزمایشی از بازارگاه» — فقط در دمو (docs/plans/demo.md مرحله‌ی ۲).
 *
 * همان مسیر worker را همین حالا اجرا می‌کند تا بازدیدکننده بی‌انتظار ببیند
 * سفارش وارد می‌شود، موجودی کم می‌شود و فاکتور فروش صادر می‌شود.
 */
export async function POST(req: Request) {
  if (!isDemo()) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { platform?: string };
  const platform = DEMO_MARKETPLACES.find((m) => m.code === body.platform) ?? pick(DEMO_MARKETPLACES);
  const adapter = getAdapter(platform.code);
  if (!adapter) return NextResponse.json({ error: "بازارگاه نمایشی پیدا نشد" }, { status: 404 });

  const job = await prisma.integJob.create({
    data: { type: "FETCH_ORDERS", platformCode: platform.code, payload: { demo: true }, status: "PROCESSING", startedAt: new Date(), attempts: 1 },
  });
  const before = new Date();
  try {
    forceDemoOrder(platform.code);
    await fetchAndProcessOrders(job.id, platform.code, adapter, {});
    await prisma.integJob.update({ where: { id: job.id }, data: { status: "DONE", completedAt: new Date() } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.integJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: message, completedAt: new Date() } });
    return NextResponse.json({ error: "ساخت سفارش آزمایشی ناموفق بود" }, { status: 500 });
  }
  // فاکتور فروش حسابداری داخلی همین حالا، نه در چرخه‌ی بعدی worker
  await dispatchAccEvents().catch(() => {});

  const order = await prisma.integOrder.findFirst({
    where: { platformCode: platform.code, createdAt: { gte: before } },
    orderBy: { createdAt: "desc" },
    select: { platformOrderNo: true, productTitle: true, qty: true, customerName: true },
  });
  if (!order) return NextResponse.json({ error: "کالای نگاشت‌شده‌ای با موجودی کافی پیدا نشد" }, { status: 409 });
  return NextResponse.json({ ok: true, platform: platform.name, ...order });
}
