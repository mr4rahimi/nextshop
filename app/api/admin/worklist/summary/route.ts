import { NextResponse } from "next/server";
import { requirePermission, can } from "@/lib/permissions";
import { parseRange } from "@/lib/reports";
import { teamReport } from "@/lib/worklist/team-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** گزارش عملکرد تیم — فاز ۶، بخش ۱۴ مستندات. منطق در `lib/worklist/team-report.ts` */
export async function GET(req: Request) {
  const guard = await requirePermission("WORK_REPORT_VIEW");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const report = await teamReport(parseRange(url.searchParams), url.searchParams.get("ownerId") || null);
  return NextResponse.json({ ...report, canExport: can(guard.access, "WORK_REPORT_EXPORT") });
}
