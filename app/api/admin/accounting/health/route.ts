import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson, rangeFrom } from "@/lib/accounting/api";
import { todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import { fixHealth, ledgerHealth } from "@/lib/accounting/reports/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * سلامت دفتر — docs/plans/webhesab-parity.md بخش ۱۵.
 * GET ?from&to — همه‌ی آزمون‌ها (بازه فقط برای «منفی شده در بازه» و «بهای صفر»؛ پیش‌فرض ۹۰ روز اخیر)
 * POST `{fix: "stock" | "paid"}` — یکی کردن کش با منبع؛ مجوز تنظیمات حسابداری
 */
export async function GET(req: Request) {
  const guard = await requirePermission("ACC_REPORTS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const range = rangeFrom(new URL(req.url));
    const to = range.to ?? todayKey();
    const from = range.from ?? new Date(to.getTime() - 89 * 86_400_000);
    const data = await ledgerHealth(prisma, { from, to });
    return NextResponse.json(serialize({ ...data, from, to, can: { fix: can(guard.access, "ACC_SETTINGS") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-health]");
  }
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ fix?: string }>(req);
    if (b.fix !== "stock" && b.fix !== "paid") throw new AccError("اصلاح نامعتبر است");
    const kind = b.fix;
    const n = await prisma.$transaction((tx) => fixHealth(tx, kind), { timeout: 120_000 });
    await logActivity({
      action: "UPDATE",
      entity: "SETTINGS",
      entityTitle: "سلامت دفتر",
      summary: `اصلاح ${kind === "stock" ? "موجودی انبارها از کاردکس" : "دریافت‌شده‌ی فاکتورها از تخصیص‌ها"}: ${faNum(n)} مورد`,
    });
    return NextResponse.json({ fixed: n });
  } catch (e) {
    return accErrorResponse(e, "[acc-health]");
  }
}
