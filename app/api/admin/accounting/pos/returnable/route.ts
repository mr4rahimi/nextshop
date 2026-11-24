import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { posGuard } from "@/lib/accounting/pos/api";
import { findReturnable } from "@/lib/accounting/pos/tickets";
import { customerPurchases, findCustomers } from "@/lib/accounting/pos/returns";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?q — رسید صندوق (`POS12`) یا شماره‌ی فاکتور فروش برای مرجوعی
 * GET ?find — مشتری با موبایل/نام/کد/کارت اشتراک، با تعداد و تاریخ آخرین خرید
 * GET ?partyId — همه‌ی خریدهای مشتری با ردیف‌های قابل برگشت (lib/accounting/pos/returns.ts)
 */
export async function GET(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const sp = new URL(req.url).searchParams;
    const partyId = sp.get("partyId");
    const find = sp.get("find");
    if (find !== null) return NextResponse.json(serialize({ customers: await findCustomers(prisma, find.slice(0, 60)) }));
    if (partyId) return NextResponse.json(serialize(await customerPurchases(prisma, partyId)));
    return NextResponse.json(serialize(await findReturnable(sp.get("q") ?? "")));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-returnable]");
  }
}
