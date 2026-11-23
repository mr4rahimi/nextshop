import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { parseDay } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { orgGuard } from "@/lib/accounting/org-api";
import { sellOnInvoice } from "@/lib/accounting/org-installments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { invoiceId, orgId, amount, employeeCode, letterNo, date, note } — فروش اقساطی سازمانی روی فاکتور فروش صادرشده */
export async function POST(req: Request) {
  const g = await orgGuard(["ACC_SALES"]);
  if (!g.ok) return g.res;
  try {
    const b = await readJson<{ invoiceId?: string; orgId?: string; amount?: unknown; employeeCode?: string; letterNo?: string; date?: string; note?: string }>(req);
    const c = await prisma.$transaction(
      (tx) =>
        sellOnInvoice(
          tx,
          b.invoiceId ?? "",
          { orgId: b.orgId ?? "", amount: toAmount(b.amount, "مبلغ اقساطی"), employeeCode: b.employeeCode ?? null, letterNo: b.letterNo ?? null, note: b.note ?? null, date: parseDay(b.date) },
          actorOf(g.access),
        ),
      { timeout: 60_000 },
    );
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: c.id, entityTitle: `قرارداد اقساط ${c.number}`, summary: `فروش اقساطی سازمانی ${formatAmount(c.total)} تومان — ${c.customerName} (قرارداد ${faNum(c.number)})` });
    return NextResponse.json(serialize({ ok: true, contract: c }));
  } catch (e) {
    return accErrorResponse(e, "[acc-org-sell]");
  }
}
