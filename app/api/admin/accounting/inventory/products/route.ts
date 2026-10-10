import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { stockRows } from "@/lib/accounting/inventory/query";
import { exactItem, itemCards, itemSearchWhere } from "@/lib/accounting/inventory/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?q — انتخابگر کالا (`AccItem`). بارکد، کد یا کد قبلی دقیق اول می‌آید (بارکدخوان
 * مثل کیبورد تایپ می‌کند و Enter می‌زند؛ `exact` یعنی همین را بی‌پرسش اضافه کن).
 *
 * `for=sales|purchase&partyId` — قیمت پیش‌فرض فرم فاکتور (بخش ۱۰): فروش از
 * قیمت سایت، خرید از آخرین خرید از همین تأمین‌کننده (وگرنه آخرین بهای ورود).
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_VOUCHER", "ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const forType = url.searchParams.get("for");
  const partyId = url.searchParams.get("partyId");
  const exact = q ? await exactItem(q) : null;
  const found = await prisma.accItem.findMany({
    where: { ...(await itemSearchWhere(q)), isActive: true },
    orderBy: { title: "asc" },
    take: 15,
    select: { id: true },
  });
  const ids = [...new Set([...(exact ? [exact] : []), ...found.map((i) => i.id)])];
  const [cards, rows] = await Promise.all([itemCards(ids), stockRows(ids, can(guard.access, "ACC_COST_VIEW"))]);
  const prices = forType === "sales" || forType === "purchase" ? await defaultPrices(ids, forType, partyId, guard.access) : null;
  const items = ids
    .filter((id) => cards.has(id))
    .map((id) => {
      const c = cards.get(id)!;
      return {
        id,
        title: c.title,
        sku: c.code,
        code: c.code,
        unit: c.unit,
        image: c.image,
        siteStock: c.siteStock ?? 0,
        hasProduct: c.hasProduct,
        ...rows.get(id)!,
        ...(prices ? { price: prices.get(id)?.price ?? c.price ?? 0n, vatRateBp: prices.get(id)?.vatRateBp ?? null, taxCode: prices.get(id)?.taxCode ?? null } : {}),
      };
    });
  return NextResponse.json(serialize({ items, exactId: exact ?? null }));
}

async function defaultPrices(ids: string[], forType: "sales" | "purchase", partyId: string | null, access: Parameters<typeof can>[0]) {
  const costs = await prisma.accProductCost.findMany({ where: { productId: { in: ids } } });
  const out = new Map<string, { price?: bigint; vatRateBp: number | null; taxCode: string | null }>();
  for (const c of costs) out.set(c.productId, { vatRateBp: c.vatRateBp, taxCode: c.taxCode });
  if (forType === "purchase") {
    const seeCost = can(access, "ACC_PURCHASE") || can(access, "ACC_COST_VIEW");
    const last = partyId
      ? await prisma.accInvoiceLine.findMany({
          where: { productId: { in: ids }, invoice: { type: "PURCHASE", status: "ISSUED", partyId } },
          orderBy: { invoice: { date: "desc" } },
          select: { productId: true, unitPrice: true },
        })
      : [];
    for (const id of ids) {
      const hit = last.find((l) => l.productId === id)?.unitPrice;
      const fallback = seeCost ? costs.find((c) => c.productId === id)?.lastCost : undefined;
      const row = out.get(id) ?? { vatRateBp: null, taxCode: null };
      out.set(id, { ...row, price: hit ?? (fallback && fallback > 0n ? fallback : 0n) });
    }
  }
  return out;
}
