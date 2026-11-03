import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { posGuard } from "@/lib/accounting/pos/api";
import { availableSerials } from "@/lib/accounting/inventory/serials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?terminalId&itemId — سریال‌های در انبار همین صندوق (پنجره‌ی انتخاب سریال) */
export async function GET(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const url = new URL(req.url);
    const terminal = await prisma.accPosTerminal.findUnique({ where: { id: url.searchParams.get("terminalId") ?? "" }, select: { warehouseId: true } });
    if (!terminal) throw new AccError("صندوق پیدا نشد", 404);
    return NextResponse.json({ serials: await availableSerials(prisma, url.searchParams.get("itemId") ?? "", terminal.warehouseId) });
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-serials]");
  }
}
