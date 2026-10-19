import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { posGuard } from "@/lib/accounting/pos/api";
import { ticketView } from "@/lib/accounting/pos/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — رسید صندوق برای چاپ */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard(["ACC_POS", "ACC_POS_MANAGE", "ACC_SALES", "ACC_VIEW"]);
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    return NextResponse.json(serialize(await ticketView(id)));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-ticket]");
  }
}
