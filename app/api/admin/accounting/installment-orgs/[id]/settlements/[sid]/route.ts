import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { orgGuard, SETTLE_ORG } from "@/lib/accounting/org-api";
import { periodLabel, voidSettlement } from "@/lib/accounting/org-installments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { reason } — ابطال دریافت ماهانه (قسط‌ها دوباره باز می‌شوند) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const g = await orgGuard(SETTLE_ORG);
  if (!g.ok) return g.res;
  try {
    const { sid } = await params;
    const b = await readJson<{ reason?: string }>(req);
    const st = await prisma.$transaction((tx) => voidSettlement(tx, sid, b.reason ?? "", actorOf(g.access)), { timeout: 60_000 });
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: st.id, entityTitle: `دریافت اقساط ${st.number}`, summary: `ابطال دریافت اقساط ${periodLabel(st.period)}: ${b.reason ?? ""}` });
    return NextResponse.json(serialize({ ok: true }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-settle]");
  }
}
