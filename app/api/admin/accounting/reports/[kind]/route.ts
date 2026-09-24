import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { rangeFrom } from "@/lib/accounting/api";
import { parseDay, previousRange, todayKey } from "@/lib/accounting/dates";
import { trialBalance, type TrialLevel } from "@/lib/accounting/reports/trial";
import { balanceSheet, profitLoss } from "@/lib/accounting/reports/statements";
import { aging } from "@/lib/accounting/reports/aging";
import { profitBy, type ProfitDim } from "@/lib/accounting/reports/profit";
import { expenseReport, inventoryValue, treasuryFlow, vatReport } from "@/lib/accounting/reports/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** گزارش‌هایی که بها یا سود نشان می‌دهند — `ACC_COST_VIEW` هم لازم است */
const COST_REPORTS = ["pl", "balance", "trial", "profit", "inventory"];
const KINDS = [...COST_REPORTS, "aging", "vat", "expenses", "treasury"];

/**
 * GET /reports/<kind>?from&to&… — docs/plans/accounting.md بخش ۱۱.
 *   pl        ?compare=1                 سود و زیان (مقایسه با دوره‌ی هم‌طولِ قبل)
 *   balance   ?asOf                      ترازنامه
 *   trial     ?level=GROUP|LEDGER|SUBLEDGER|DETAIL
 *   aging     ?side=sales|purchase
 *   profit    ?by=product|category|channel
 *   vat       ارزش افزوده‌ی بازه
 *   expenses  ?compare=1
 *   treasury  گردش صندوق و بانک
 *   inventory ?by=category|product|warehouse&warehouseId
 */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "گزارش پیدا نشد" }, { status: 404 });
  const guard = await requirePermission("ACC_REPORTS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (COST_REPORTS.includes(kind) && !can(guard.access, "ACC_COST_VIEW")) {
    return NextResponse.json({ error: "این گزارش بهای تمام‌شده دارد؛ مجوز «دیدن بهای تمام‌شده» لازم است" }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const q = (k: string) => url.searchParams.get(k);
    const range = rangeFrom(url);
    const compare = q("compare") === "1" && range.from ? previousRange(range.from, range.to ?? todayKey()) : null;

    let data: unknown;
    switch (kind) {
      case "pl":
        data = await profitLoss(prisma, range, compare);
        break;
      case "balance":
        data = await balanceSheet(prisma, parseDay(q("asOf")) ?? todayKey());
        break;
      case "trial": {
        const level = (["GROUP", "LEDGER", "SUBLEDGER", "DETAIL"].includes(q("level") ?? "") ? q("level") : "SUBLEDGER") as TrialLevel;
        data = await trialBalance(prisma, range, level);
        break;
      }
      case "aging":
        data = await aging(prisma, q("side") === "purchase" ? "purchase" : "sales");
        break;
      case "profit": {
        const by = (["product", "category", "channel"].includes(q("by") ?? "") ? q("by") : "product") as ProfitDim;
        data = await profitBy(prisma, range, by);
        break;
      }
      case "vat":
        data = await vatReport(prisma, range);
        break;
      case "expenses":
        data = await expenseReport(prisma, range, compare);
        break;
      case "treasury":
        data = await treasuryFlow(prisma, range);
        break;
      case "inventory": {
        const by = q("by") === "product" ? "product" : q("by") === "warehouse" ? "warehouse" : "category";
        data = await inventoryValue(prisma, { warehouseId: q("warehouseId") || null, by });
        break;
      }
    }
    return NextResponse.json(serialize({ data, compare, can: { cost: can(guard.access, "ACC_COST_VIEW") } }));
  } catch (e) {
    return accErrorResponse(e, `[acc-report:${kind}]`);
  }
}
