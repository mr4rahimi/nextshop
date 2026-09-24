import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { productSearchWhere, stockRows } from "@/lib/accounting/inventory/query";
import { toLatinDigits } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?q — انتخابگر کالا. بارکد یا کد کالای دقیق اول می‌آید (بارکدخوان
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
  const lat = toLatinDigits(q);

  const exact = lat
    ? await prisma.product.findFirst({ where: { OR: [{ gtin13: lat }, { sku: lat }] }, select: { id: true } })
    : null;
  const products = await prisma.product.findMany({
    where: productSearchWhere(q),
    orderBy: { title: "asc" },
    take: 15,
    select: { id: true, title: true, sku: true, mainImage: true, stock: true, price: true, salePrice: true },
  });
  const ids = products.map((p) => p.id);
  const rows = await stockRows(ids, can(guard.access, "ACC_COST_VIEW"));
  const prices = forType === "sales" || forType === "purchase" ? await defaultPrices(ids, forType, partyId, guard.access) : null;
  const items = products
    .map((p) => ({
      id: p.id,
      title: p.title,
      sku: p.sku,
      image: p.mainImage,
      siteStock: p.stock,
      ...rows.get(p.id)!,
      ...(prices ? { price: prices.get(p.id)?.price ?? (p.salePrice && p.salePrice > 0n ? p.salePrice : p.price), vatRateBp: prices.get(p.id)?.vatRateBp ?? null, taxCode: prices.get(p.id)?.taxCode ?? null } : {}),
    }))
    .sort((a, b) => (a.id === exact?.id ? -1 : b.id === exact?.id ? 1 : 0));
  return NextResponse.json(serialize({ items, exactId: exact?.id ?? null }));
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
