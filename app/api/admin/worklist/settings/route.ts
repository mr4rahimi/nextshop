import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { clearAttendanceGateCache } from "@/lib/worklist/attendance";
import { clearWorklistConfigCache } from "@/lib/worklist/settings";
import { normalizeWorkHours, validateWorkHours } from "@/lib/worklist/work-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** کمتر از این یعنی هر روزِ کاری بریده می‌شود؛ بیشتر یعنی سقف بی‌اثر است */
const MIN_CAP = 60;
const MAX_CAP = 24 * 60;

/** سقف منطقیِ حداقل خرید «مشتری ثابت» — بیشتر از این یعنی قاعده هیچ‌وقت کسی را نمی‌گیرد */
const MAX_LOYAL_ORDERS = 1000;

const SELECT = {
  worklistEnabled: true,
  worklistDailyCapMin: true,
  worklistWorkHours: true,
  worklistLoyalMinOrders: true,
  worklistLoyalMinSpent: true,
} as const;

type Row = {
  worklistEnabled: boolean;
  worklistDailyCapMin: number;
  worklistWorkHours: unknown;
  worklistLoyalMinOrders: number;
  worklistLoyalMinSpent: bigint;
};

function toJson(s: Row | null) {
  return {
    // رکورد singleton هنوز ساخته نشده: پیش‌فرض‌های اسکیما برمی‌گردند
    enabled: s?.worklistEnabled ?? false,
    dailyCapMin: s?.worklistDailyCapMin ?? 600,
    workHours: normalizeWorkHours(s?.worklistWorkHours),
    loyalMinOrders: s?.worklistLoyalMinOrders ?? 2,
    // BigInt در JSON نمی‌نشیند؛ ریال تا ۲^۵۳ جا می‌شود ولی رشته امن‌تر است
    loyalMinSpent: String(s?.worklistLoyalMinSpent ?? 0n),
  };
}

/**
 * تنظیمات کلیِ کارتابل که در `StoreSettings` می‌نشینند.
 *
 * از بخش ۱۹ مستندات: ساعت کاری برای هر روز هفته و تعریف «مشتری ثابت» هم
 * اینجا ویرایش می‌شوند، چون کسب‌وکارهای دیگر هم روی همین کد می‌آیند.
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
    select: SELECT,
  });

  return NextResponse.json({ ...toJson(s), exists: Boolean(s) });
}

export async function PUT(req: Request) {
  const guard = await requirePermission("WORK_SETTINGS_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const data: {
      worklistEnabled?: boolean;
      worklistDailyCapMin?: number;
      worklistWorkHours?: object[];
      worklistLoyalMinOrders?: number;
      worklistLoyalMinSpent?: bigint;
    } = {};

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

    if (body?.workHours !== undefined) {
      const v = validateWorkHours(body.workHours);
      if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
      data.worklistWorkHours = v.hours.map((h) => ({ ...h }));
    }

    if (body?.loyalMinOrders !== undefined) {
      const n = Number(body.loyalMinOrders);
      if (!Number.isInteger(n) || n < 1 || n > MAX_LOYAL_ORDERS) {
        return NextResponse.json(
          { error: "حداقل تعداد خرید مشتری ثابت باید عددی بین ۱ و ۱۰۰۰ باشد" },
          { status: 400 },
        );
      }
      data.worklistLoyalMinOrders = n;
    }

    if (body?.loyalMinSpent !== undefined) {
      const raw = String(body.loyalMinSpent).trim();
      if (!/^\d{1,15}$/.test(raw)) {
        return NextResponse.json({ error: "حداقل مبلغ خرید نامعتبر است" }, { status: 400 });
      }
      data.worklistLoyalMinSpent = BigInt(raw);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "چیزی برای تغییر نیست" }, { status: 400 });
    }

    const saved = await prisma.storeSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
      select: SELECT,
    });

    // بدون این، تا یک دقیقه ضربان و تجمیع با مقدار قدیمی کار می‌کردند
    clearAttendanceGateCache();
    clearWorklistConfigCache();

    logActivityAsync({
      action: "UPDATE",
      entity: "SETTINGS",
      entityTitle: "تنظیمات کارتابل",
      summary:
        `کارتابل ${saved.worklistEnabled ? "روشن" : "خاموش"}` +
        ` · سقف حضور روزانه ${Math.round(saved.worklistDailyCapMin / 60)} ساعت`,
    });

    return NextResponse.json({ ok: true, ...toJson(saved) });
  } catch (e) {
    console.error("[worklist] ذخیره‌ی تنظیمات شکست خورد:", e);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
