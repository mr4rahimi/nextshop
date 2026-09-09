import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RULE_SELECT = {
  id: true,
  typeId: true,
  title: true,
  ownerId: true,
  ownerName: true,
  schedule: true,
  daysOfWeek: true,
  dayOfMonth: true,
  timeOfDay: true,
  idleDays: true,
  maxPerRun: true,
  isActive: true,
  lastRunAt: true,
  lastRunCount: true,
  type: { select: { id: true, title: true, icon: true, domain: true } },
} as const;

export async function GET() {
  const guard = await requirePermission("WORK_SETTINGS_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const rules = await prisma.staffRecurringRule.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: RULE_SELECT,
  });
  return NextResponse.json({ rules });
}

/** ساخت قاعده‌ی تکرارشونده */
export async function POST(req: Request) {
  const guard = await requirePermission("WORK_SETTINGS_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const b = await req.json();
    if (!b?.typeId || !b?.title?.trim()) {
      return NextResponse.json({ error: "نوع کار و عنوان لازم است" }, { status: 400 });
    }
    if (!b?.ownerId) {
      // بدون مسئول، ردیف بی‌صاحب ساخته می‌شود و هیچ‌کس نمی‌بیندش
      return NextResponse.json({ error: "مسئول قاعده را انتخاب کنید" }, { status: 400 });
    }

    const owner = await prisma.user.findUnique({
      where: { id: b.ownerId },
      select: { id: true, firstName: true, lastName: true, phone: true, isActive: true },
    });
    if (!owner?.isActive) {
      return NextResponse.json({ error: "مسئول پیدا نشد یا غیرفعال است" }, { status: 400 });
    }

    const rule = await prisma.staffRecurringRule.create({
      data: {
        typeId: b.typeId,
        title: b.title.trim(),
        ownerId: owner.id,
        ownerName:
          [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() || owner.phone,
        schedule: b.schedule ?? "DAILY",
        daysOfWeek: Array.isArray(b.daysOfWeek)
          ? b.daysOfWeek.filter((d: unknown) => typeof d === "number" && d >= 0 && d <= 6)
          : [],
        dayOfMonth: b.dayOfMonth ?? null,
        timeOfDay: b.timeOfDay?.trim() || null,
        idleDays: b.idleDays ?? null,
        // سقف هرگز صفر یا منفی نمی‌شود، و بالای صد هم اجازه نداریم
        maxPerRun: Math.min(Math.max(Number(b.maxPerRun) || 20, 1), 100),
        isActive: b.isActive !== false,
      },
      select: RULE_SELECT,
    });

    logActivityAsync({
      action: "CREATE",
      entity: "SETTINGS",
      entityId: rule.id,
      entityTitle: rule.title,
      summary: `ساخت قاعده‌ی تکرارشونده «${rule.title}»`,
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
