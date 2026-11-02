import { NextResponse } from "next/server";
import { requirePermission, can } from "@/lib/permissions";
import { parseRange } from "@/lib/reports";
import { teamReport, teamReportDetail, DRILL_METRICS, type DrillMetric } from "@/lib/worklist/team-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * گزارش عملکرد تیم — فاز ۶، بخش ۱۴ مستندات. منطق در `lib/worklist/team-report.ts`
 *
 * با `?detail=<معیار>` به‌جای گزارش، کارهای پشت همان عدد برمی‌گردد (پنجره‌ی جزئیات).
 */
export async function GET(req: Request) {
  const guard = await requirePermission("WORK_REPORT_VIEW");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const range = parseRange(url.searchParams);
  const ownerId = url.searchParams.get("ownerId") || null;

  const detail = url.searchParams.get("detail");
  if (detail) {
    if (!(detail in DRILL_METRICS)) {
      return NextResponse.json({ error: "معیار نامعتبر است" }, { status: 400 });
    }
    return NextResponse.json(await teamReportDetail(range, detail as DrillMetric, ownerId));
  }

  const report = await teamReport(range, ownerId);
  return NextResponse.json({ ...report, canExport: can(guard.access, "WORK_REPORT_EXPORT") });
}
