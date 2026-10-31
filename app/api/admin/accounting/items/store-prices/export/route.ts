import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { filterWhere, MAX_ITEMS, storePrices } from "@/lib/accounting/inventory/store-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * GET ?q=&groupId=&supplierId=&valueId= — فهرست قیمت فروشگاه به CSV برای ویرایش در اکسل و
 * بازگرداندن با «ورود با اکسل» (ستون «قیمت تازه» خالی = بی‌تغییر). اکسل فارسی را با BOM باز می‌کند.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const where = await filterWhere(prisma, {
      q: sp.get("q"),
      groupId: sp.get("groupId"),
      supplierId: sp.get("supplierId"),
      valueId: sp.get("valueId"),
    });
    const items = await prisma.accItem.findMany({
      where,
      orderBy: { code: "asc" },
      take: MAX_ITEMS,
      select: { id: true, code: true, title: true, group: { select: { name: true } }, barcodes: { select: { barcode: true }, take: 1, orderBy: { barcode: "asc" } } },
    });
    const prices = await storePrices(prisma, items.map((i) => i.id));
    const head = ["کد", "کالا", "گروه", "بارکد", "قیمت فعلی", "قیمت تازه"];
    const lines = items.map((i) => [i.code, i.title, i.group?.name ?? "", i.barcodes[0]?.barcode ?? "", String(prices.get(i.id)?.price ?? 0n), ""].map(cell).join(","));
    const body = "﻿" + [head.join(","), ...lines].join("\r\n");
    return new NextResponse(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="store-prices.csv"` },
    });
  } catch (e) {
    return accErrorResponse(e, "[acc-price-export]");
  }
}
