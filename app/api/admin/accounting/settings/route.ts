import { NextResponse } from "next/server";
import type { AccMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { ACC_MODE_LABELS, SELECTABLE_MODES, getAccSettings } from "@/lib/accounting/settings";
import { canLeaveInternal } from "@/lib/accounting/setup";
import { currentYear } from "@/lib/accounting/ledger/fiscal-year";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * خانه‌ی حسابداری — حالت فعلی، وضعیت اتصال حسابان و شمارش صف رویداد.
 * docs/plans/accounting.md بخش ۴.۴
 */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const [settings, hesaban, counts, year] = await Promise.all([
    getAccSettings(),
    prisma.integConnection.findFirst({
      where: { platformCode: "hesaban" },
      select: { status: true, config: true, lastError: true },
    }),
    prisma.accEvent.groupBy({ by: ["status"], _count: { _all: true } }),
    currentYear(),
  ]);

  const cfg = (hesaban?.config ?? {}) as { autoInvoiceEnabled?: boolean; invoiceMode?: string };

  return NextResponse.json(
    serialize({
      mode: settings.mode,
      modeChangedAt: settings.modeChangedAt,
      modeChangedBy: settings.modeChangedBy,
      selectable: SELECTABLE_MODES,
      hesaban: hesaban
        ? {
            status: hesaban.status,
            autoInvoice: !!cfg.autoInvoiceEnabled,
            invoiceMode: cfg.invoiceMode === "MANUAL" ? "MANUAL" : "AUTO",
            lastError: hesaban.lastError,
          }
        : null,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      year: year ? { id: year.id, title: year.title, startDate: year.startDate, endDate: year.endDate, status: year.status } : null,
      canLeaveInternal: settings.mode === "INTERNAL" ? await canLeaveInternal() : true,
      can: { settings: can(guard.access, "ACC_SETTINGS") },
    }),
  );
}

/** تعویض حالت — فعلاً فقط بین «انتخاب نشده» و «حسابان»؛ داخلی با سال مالی باز می‌شود */
export async function PATCH(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json().catch(() => null)) as { mode?: AccMode } | null;
  const mode = body?.mode;
  if (!mode || !SELECTABLE_MODES.includes(mode)) {
    return NextResponse.json({ error: "این حالت فعلاً قابل انتخاب نیست" }, { status: 400 });
  }

  const before = await getAccSettings();
  if (before.mode === mode) return NextResponse.json({ ok: true, mode });

  // خروج از حالت داخلی فقط تا وقتی هیچ سندی ثبت نشده — بعد از آن فقط در
  // ابتدای سال مالی و با بستن سال (فاز ۹)
  if (before.mode === "INTERNAL" && !(await canLeaveInternal())) {
    return NextResponse.json(
      { error: "حسابداری داخلی سند ثبت‌شده دارد؛ خروج فقط در ابتدای سال مالی بعد ممکن است" },
      { status: 409 },
    );
  }

  await prisma.accSettings.update({
    where: { id: "singleton" },
    data: { mode, modeChangedAt: new Date(), modeChangedBy: guard.access.name },
  });

  await logActivity({
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "accounting",
    entityTitle: "حالت حسابداری",
    summary: `حالت حسابداری: ${ACC_MODE_LABELS[before.mode]} ← ${ACC_MODE_LABELS[mode]}`,
    changes: [{ field: "mode", label: "حالت حسابداری", before: ACC_MODE_LABELS[before.mode], after: ACC_MODE_LABELS[mode] }],
  });

  return NextResponse.json({ ok: true, mode });
}
