import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { loadFamilies, searchFamilies } from "@/lib/accounting/inventory/price-families";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «تغییر سریع» قیمت فروشگاه — lib/accounting/inventory/price-families.ts
 * GET ?q=        — خانواده‌های کد/بارکد/نام (همه‌ی رنگ و سایزهای مدل، با قیمت و موجودی)
 * GET ?keys=a,b  — همان خانواده‌ها دوباره (بعد از اعمال قیمت)
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const keys = (sp.get("keys") ?? "").split(",").filter((k) => /^[mi]:[\w-]+$/.test(k)).slice(0, 60);
    const families = keys.length ? await loadFamilies(prisma, keys) : await searchFamilies(prisma, (sp.get("q") ?? "").slice(0, 100));
    return NextResponse.json(serialize({ families }));
  } catch (e) {
    return accErrorResponse(e, "[acc-price-lookup]");
  }
}
