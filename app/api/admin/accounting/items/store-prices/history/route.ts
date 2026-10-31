import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { parseDay } from "@/lib/accounting/dates";
import { itemPriceLog, priceHistory, type PriceSource } from "@/lib/accounting/inventory/store-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES: PriceSource[] = ["FORM", "BULK", "EXCEL", "UNDO"];

/** «YYYY-MM-DD» + «HH:MM» به وقت تهران ← لحظه */
function instant(day: string | null, time: string | null): Date | null {
  const d = parseDay(day);
  if (!d) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  const minutes = m ? Math.min(Number(m[1]), 23) * 60 + Math.min(Number(m[2]), 59) : 0;
  return new Date(d.getTime() + minutes * 60_000 - 3.5 * 3_600_000);
}

/**
 * GET ?since=&sinceTime=&until=&source=&batch= — کالاهای با تغییر قیمت (هر کالا یک ردیف)
 * GET ?item=<id> — تاریخچه‌ی یک کالا. docs/plans/webhesab-parity.md بخش ۱۰.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const item = sp.get("item");
    if (item) return NextResponse.json(serialize({ log: await itemPriceLog(prisma, item) }));
    const until = parseDay(sp.get("until"));
    const source = sp.get("source");
    const res = await priceHistory(prisma, {
      since: instant(sp.get("since"), sp.get("sinceTime")),
      until: until ? new Date(until.getTime() + 86_400_000 - 3.5 * 3_600_000) : null,
      source: (SOURCES as string[]).includes(source ?? "") ? (source as PriceSource) : null,
      batchId: sp.get("batch") || null,
    });
    // موجودی کل هر کالا برای «برچسب به تعداد موجودی»
    const stocks = await prisma.accStock.groupBy({ by: ["productId"], where: { productId: { in: res.items.map((i) => i.itemId) } }, _sum: { qty: true } });
    const qty = new Map(stocks.map((s) => [s.productId, s._sum.qty ?? 0]));
    return NextResponse.json(serialize({ ...res, items: res.items.map((i) => ({ ...i, stock: qty.get(i.itemId) ?? 0 })) }));
  } catch (e) {
    return accErrorResponse(e, "[acc-price-history]");
  }
}
