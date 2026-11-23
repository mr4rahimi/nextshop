import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { parseDay } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { orgGuard, SETTLE_ORG } from "@/lib/accounting/org-api";
import { createSettlement, periodLabel } from "@/lib/accounting/org-installments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — ثبت دریافت ماهانه از سازمان: { period, treasuryId, date, trackingCode, note, fileName, rows: [{partyId, amount}] } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await orgGuard(SETTLE_ORG);
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const b = await readJson<{ period?: string; treasuryId?: string; date?: string; trackingCode?: string; note?: string; fileName?: string; rows?: { partyId?: string; amount?: unknown }[] }>(req);
    const st = await prisma.$transaction(
      (tx) =>
        createSettlement(
          tx,
          {
            orgId: id,
            period: b.period ?? "",
            treasuryId: b.treasuryId ?? "",
            date: parseDay(b.date),
            trackingCode: b.trackingCode ?? null,
            note: b.note ?? null,
            fileName: b.fileName ?? null,
            rows: (b.rows ?? []).slice(0, 5000).map((r, i) => ({ partyId: String(r.partyId ?? ""), amount: toAmount(r.amount, `ردیف ${faNum(i + 1)}`) })),
          },
          actorOf(g.access),
        ),
      { timeout: 120_000 },
    );
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: st.id, entityTitle: `دریافت اقساط ${st.number}`, summary: `دریافت اقساط ${periodLabel(st.period)} — ${formatAmount(st.amount)} تومان` });
    return NextResponse.json(serialize({ ok: true, settlement: st }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-settle]");
  }
}
