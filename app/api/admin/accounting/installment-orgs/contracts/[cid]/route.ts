import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";
import { orgGuard } from "@/lib/accounting/org-api";
import { contractDetail, voidContract } from "@/lib/accounting/org-installments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ cid: string }> };

/** GET — قرارداد با جدول اقساط و دریافت هر قسط (برای پنجره و چاپ) */
export async function GET(_req: Request, { params }: P) {
  const g = await orgGuard();
  if (!g.ok) return g.res;
  try {
    const { cid } = await params;
    return NextResponse.json(serialize({ contract: await contractDetail(prisma, cid), can: g.can }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-contract]");
  }
}

/** POST { reason } — ابطال قرارداد فاکتوری بی قسط دریافت‌شده (فاکتور دوباره باز می‌شود) */
export async function POST(req: Request, { params }: P) {
  const g = await orgGuard(["ACC_SALES", "ACC_TREASURY"]);
  if (!g.ok) return g.res;
  try {
    const { cid } = await params;
    const b = await readJson<{ reason?: string }>(req);
    const c = await prisma.$transaction((tx) => voidContract(tx, cid, b.reason ?? "", actorOf(g.access)), { timeout: 60_000 });
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: c.id, entityTitle: `قرارداد اقساط ${c.number}`, summary: `ابطال قرارداد اقساط سازمانی ${faNum(c.number)} — ${c.customerName}: ${b.reason ?? ""}` });
    return NextResponse.json(serialize({ ok: true }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-contract]");
  }
}
