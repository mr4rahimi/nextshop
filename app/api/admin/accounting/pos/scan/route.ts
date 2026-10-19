import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { posGuard } from "@/lib/accounting/pos/api";
import { scanCode } from "@/lib/accounting/pos/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?terminalId&q — اسکن یا جستجوی پیشخوان (کالا، پنجره‌ی رنگ/سایز، رسید، فهرست) */
export async function GET(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const url = new URL(req.url);
    const terminal = await prisma.accPosTerminal.findUnique({ where: { id: url.searchParams.get("terminalId") ?? "" }, select: { warehouseId: true } });
    if (!terminal) throw new AccError("صندوق پیدا نشد", 404);
    return NextResponse.json(serialize(await scanCode(url.searchParams.get("q") ?? "", terminal.warehouseId)));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-scan]");
  }
}
