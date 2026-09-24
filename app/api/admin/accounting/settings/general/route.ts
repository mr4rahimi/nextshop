import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { getAccSettings } from "@/lib/accounting/settings";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { parseDay } from "@/lib/accounting/dates";
import { formatJalali } from "@/lib/club/jalali";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXT_FIELDS = [
  "sellerName", "sellerNationalId", "sellerEconomicCode", "sellerRegNo", "sellerPostalCode",
  "sellerAddress", "sellerPhone", "stampImage", "signatureImage", "invoiceFooterNote",
] as const;

/** تنظیمات عمومی حسابداری — مالیات، تاریخ قفل، سال جاری، اطلاعات فروشنده */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [s, years] = await Promise.all([
    getAccSettings(),
    prisma.accFiscalYear.findMany({ orderBy: { startDate: "desc" }, include: { _count: { select: { vouchers: true } } } }),
  ]);
  return NextResponse.json(serialize({ settings: s, years, can: { settings: can(guard.access, "ACC_SETTINGS") } }));
}

export async function PATCH(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const body = await readJson<Record<string, unknown>>(req);
    const before = await getAccSettings();
    const data: Prisma.AccSettingsUpdateInput = {};

    for (const k of TEXT_FIELDS) {
      if (k in body) data[k] = typeof body[k] === "string" && (body[k] as string).trim() ? (body[k] as string).trim() : null;
    }
    if ("vatRateBp" in body) {
      const v = Number(body.vatRateBp);
      if (!Number.isInteger(v) || v < 0 || v > 5000) throw new AccError("نرخ مالیات باید بین ۰ تا ۵۰ درصد باشد");
      data.vatRateBp = v;
    }
    if ("pricesIncludeVat" in body) data.pricesIncludeVat = !!body.pricesIncludeVat;
    if ("vatEnabled" in body) data.vatEnabled = !!body.vatEnabled;
    if ("currentYearId" in body) {
      const y = await prisma.accFiscalYear.findUnique({ where: { id: String(body.currentYearId) } });
      if (!y) throw new AccError("سال مالی پیدا نشد");
      data.currentYearId = y.id;
    }
    if ("lockDate" in body) {
      const d = body.lockDate ? parseDay(body.lockDate) : null;
      if (body.lockDate && !d) throw new AccError("تاریخ قفل نامعتبر است");
      data.lockDate = d;
    }

    await prisma.accSettings.update({ where: { id: "singleton" }, data });

    if ("lockDate" in body && (before.lockDate?.getTime() ?? null) !== ((data.lockDate as Date | null)?.getTime() ?? null)) {
      await logActivity({
        action: "UPDATE",
        entity: "SETTINGS",
        entityId: "accounting",
        entityTitle: "تاریخ قفل دفاتر",
        summary: `تاریخ قفل دفاتر: ${before.lockDate ? formatJalali(before.lockDate) : "ندارد"} ← ${data.lockDate ? formatJalali(data.lockDate as Date) : "ندارد"}`,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-settings]");
  }
}
