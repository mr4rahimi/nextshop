import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { rangeFrom } from "@/lib/accounting/api";
import { docLogReport } from "@/lib/accounting/doc-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * اسناد باطل‌شده و ویرایش‌شده — docs/plans/webhesab-parity.md بخش ۱۵.
 * GET ?action=VOID|EDIT&from&to&docType&actor&q — بازه روی زمان ابطال/ویرایش است، نه تاریخ سند
 */
export async function GET(req: Request) {
  const guard = await requirePermission("ACC_REPORTS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;
    const range = rangeFrom(url);
    const data = await docLogReport(prisma, {
      action: sp.get("action") === "EDIT" ? "EDIT" : "VOID",
      from: range.from,
      to: range.to,
      docType: sp.get("docType") || null,
      actor: sp.get("actor") || null,
      q: sp.get("q"),
    });
    return NextResponse.json(serialize(data));
  } catch (e) {
    return accErrorResponse(e, "[acc-doc-log]");
  }
}
