import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { ensureFiscalYear } from "@/lib/accounting/ledger/fiscal-year";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { jalaliYear } — تعریف سال مالی تازه (معمولاً سال بعد) */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { jalaliYear } = await readJson<{ jalaliYear?: number }>(req);
    const y = await ensureFiscalYear(prisma, Number(jalaliYear));
    return NextResponse.json(serialize({ ok: true, year: y }));
  } catch (e) {
    return accErrorResponse(e, "[acc-years]");
  }
}
