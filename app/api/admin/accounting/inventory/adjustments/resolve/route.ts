import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { resolveRows } from "@/lib/accounting/inventory/adjust";
import { parseImportText } from "@/lib/accounting/inventory/counts";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { text } — متن چسبانده از اکسل (کد، تعداد اختیاری) ← ردیف‌های فرم */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ text?: string }>(req);
    const rows = parseImportText(String(b.text ?? ""));
    if (!rows.length) throw new AccError("ردیفی پیدا نشد — ستون اول کد کالا، ستون دوم تعداد (اختیاری)");
    return NextResponse.json(await resolveRows(prisma, rows));
  } catch (e) {
    return accErrorResponse(e, "[acc-adjust-resolve]");
  }
}
