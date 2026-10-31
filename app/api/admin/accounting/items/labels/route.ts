import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { itemCards } from "@/lib/accounting/inventory/items";
import { normalizeLabelConfig } from "@/lib/accounting/inventory/label-config";
import { storePrices } from "@/lib/accounting/inventory/price-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?ids=a,b — داده‌ی برچسب: عنوان، کد، قیمت فروشگاه (همان صندوق، نه قیمت آنلاین)، بارکد اول (نبود ← خود کد) + تنظیم چاپ */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 500);
  const [cards, prices, barcodes, settings] = await Promise.all([
    itemCards(ids),
    storePrices(prisma, ids),
    prisma.accItemBarcode.findMany({ where: { itemId: { in: ids } }, orderBy: { barcode: "asc" } }),
    prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { labelConfig: true } }),
  ]);
  const firstBc = new Map<string, string>();
  for (const b of barcodes) if (!firstBc.has(b.itemId)) firstBc.set(b.itemId, b.barcode);
  const items = ids
    .filter((id) => cards.has(id))
    .map((id) => {
      const c = cards.get(id)!;
      return { id, title: c.title, code: c.code, price: prices.get(id)?.price || c.price, barcode: firstBc.get(id) ?? c.code };
    });
  return NextResponse.json(serialize({ items, config: normalizeLabelConfig(settings?.labelConfig) }));
}
