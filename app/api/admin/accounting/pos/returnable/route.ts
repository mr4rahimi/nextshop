import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { posGuard } from "@/lib/accounting/pos/api";
import { findReturnable } from "@/lib/accounting/pos/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q — رسید صندوق (`POS12`) یا شماره‌ی فاکتور فروش برای مرجوعی */
export async function GET(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    return NextResponse.json(serialize(await findReturnable(new URL(req.url).searchParams.get("q") ?? "")));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-returnable]");
  }
}
