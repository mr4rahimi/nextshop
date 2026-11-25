import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { findReturnable } from "@/lib/accounting/pos/tickets";
import { customerPurchases, findCustomers } from "@/lib/accounting/pos/returns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * مرجوعی بیرون از صندوق — صفحه‌ی «فروش ← مرجوعی» و «برگشت از فروش» دستی
 * (webhesab-parity.md بخش ۳۴.۱). همان سه پرسش `pos/returnable`، با مجوز فروش:
 * GET ?find=  مشتری · ?partyId=  همه‌ی خریدها · ?q=  رسید یا فاکتور
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_SALES", "ACC_POS", "ACC_POS_MANAGE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const find = sp.get("find");
    if (find !== null) return NextResponse.json(serialize({ customers: await findCustomers(prisma, find.slice(0, 60)) }));
    const partyId = sp.get("partyId");
    if (partyId) return NextResponse.json(serialize(await customerPurchases(prisma, partyId)));
    return NextResponse.json(serialize(await findReturnable(sp.get("q") ?? "")));
  } catch (e) {
    return accErrorResponse(e, "[acc-returns]");
  }
}
