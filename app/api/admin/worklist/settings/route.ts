import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { clearAttendanceGateCache } from "@/lib/worklist/attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** کمتر از این یعنی هر روزِ کاری بریده می‌شود؛ بیشتر یعنی سقف بی‌اثر است */
const MIN_CAP = 60;
const MAX_CAP = 24 * 60;

/**
 * تنظیمات کلیِ کارتابل که در `StoreSettings` می‌نشینند.
 *
 * تا فاز ۵ این دو مقدار فقط با دستکاری مستقیم دیتابیس عوض می‌شدند. سقف حضور
 * باید قابل تنظیم باشد (بخش ۱۱ مستندات) و کلیدِ روشن‌کردن کارتابل هم بدون
 * راهِ پنلی، روز دیپلوی دردسر می‌سازد.
 */
export async function GET() {
  const guard = await requirePermission("WORK_SETTINGS_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { worklistEnabled: true, worklistDailyCapMin: true },
  });

  return NextResponse.json({
    // رکورد singleton هنوز ساخته نشده: پیش‌فرض‌های اسکیما برمی‌گردند
    enabled: s?.worklistEnabled ?? false,
    dailyCapMin: s?.worklistDailyCapMin ?? 600,
    exists: Boolean(s),
  });
}

export async function PUT(req: Request) {
  const guard = await requirePermission("WORK_SETTINGS_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const data: { worklistEnabled?: boolean; worklistDailyCapMin?: number } = {};

    if (typeof body?.enabled === "boolean") data.worklistEnabled = body.enabled;

    if (body?.dailyCapMin !== undefined) {
      const cap = Number(body.dailyCapMin);
      if (!Number.isFinite(cap) || cap < MIN_CAP || cap > MAX_CAP) {
        return NextResponse.json(
          { error: "سقف روزانه باید بین یک تا ۲۴ ساعت باشد" },
          { status: 400 },
        );
      }
      data.worklistDailyCapMin = Math.round(cap);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "چیزی برای تغییر نیست" }, { status: 400 });
    }

    const saved = await prisma.storeSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
      select: { worklistEnabled: true, worklistDailyCapMin: true },
    });

    // بدون این، تا یک دقیقه ضربان و تجمیع با مقدار قدیمی کار می‌کردند
    clearAttendanceGateCache();

    logActivityAsync({
      action: "UPDATE",
      entity: "SETTINGS",
      entityTitle: "تنظیمات کارتابل",
      summary:
        `کارتابل ${saved.worklistEnabled ? "روشن" : "خاموش"}` +
        ` · سقف حضور روزانه ${Math.round(saved.worklistDailyCapMin / 60)} ساعت`,
    });

    return NextResponse.json({
      ok: true,
      enabled: saved.worklistEnabled,
      dailyCapMin: saved.worklistDailyCapMin,
    });
  } catch (e) {
    console.error("[worklist] ذخیره‌ی تنظیمات شکست خورد:", e);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
