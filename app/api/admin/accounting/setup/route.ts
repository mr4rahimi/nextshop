import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { activateInternal } from "@/lib/accounting/setup";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { getAccMode, ACC_MODE_LABELS } from "@/lib/accounting/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { jalaliYear } — راه‌اندازی حسابداری داخلی (docs/plans/accounting.md بخش ۱۷) */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const body = await readJson<{ jalaliYear?: number }>(req);
    const before = await getAccMode();
    const year = await activateInternal({ jalaliYear: Number(body.jalaliYear), actor: actorOf(guard.access) });
    await logActivity({
      action: "UPDATE",
      entity: "SETTINGS",
      entityId: "accounting",
      entityTitle: "حالت حسابداری",
      summary: `راه‌اندازی حسابداری داخلی — سال مالی ${year.title}`,
      changes: [{ field: "mode", label: "حالت حسابداری", before: ACC_MODE_LABELS[before], after: ACC_MODE_LABELS.INTERNAL }],
    });
    return NextResponse.json({ ok: true, yearId: year.id });
  } catch (e) {
    return accErrorResponse(e, "[acc-setup]");
  }
}
