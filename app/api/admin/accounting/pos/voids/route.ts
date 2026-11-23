import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { posGuard } from "@/lib/accounting/pos/api";
import { pendingVoids } from "@/lib/accounting/pos/void";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — درخواست‌های ابطال رسید منتظر تأیید (فقط مدیر صندوق) */
export async function GET() {
  const g = await posGuard(["ACC_POS_MANAGE"]);
  if (!g.ok) return g.res;
  try {
    return NextResponse.json(serialize({ requests: await pendingVoids(prisma) }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-voids]");
  }
}
