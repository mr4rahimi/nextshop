import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { rangeFrom } from "@/lib/accounting/api";
import { todayKey } from "@/lib/accounting/dates";
import { posGuard } from "@/lib/accounting/pos/api";
import { posReport } from "@/lib/accounting/pos/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?from&to&terminalId&sellerId — فروش صندوق‌ها و فروشنده‌ها (پیش‌فرض: امروز) */
export async function GET(req: Request) {
  const g = await posGuard(["ACC_POS_MANAGE", "ACC_REPORTS"]);
  if (!g.ok) return g.res;
  try {
    const url = new URL(req.url);
    const { from, to } = rangeFrom(url);
    const today = todayKey();
    return NextResponse.json(
      serialize(
        await posReport({
          from: from ?? today,
          to: to ?? today,
          terminalId: url.searchParams.get("terminalId"),
          sellerId: url.searchParams.get("sellerId"),
        }),
      ),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-report]");
  }
}
