import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission("WORK_SETTINGS_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const existing = await prisma.staffRecurringRule.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!existing) return NextResponse.json({ error: "قاعده پیدا نشد" }, { status: 404 });

  try {
    const b = await req.json();
    const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
    const data: Record<string, unknown> = {};

    if (has("title") && b.title?.trim()) data.title = b.title.trim();
    if (has("schedule")) data.schedule = b.schedule;
    if (has("daysOfWeek") && Array.isArray(b.daysOfWeek)) {
      data.daysOfWeek = b.daysOfWeek.filter(
        (d: unknown) => typeof d === "number" && d >= 0 && d <= 6,
      );
    }
    if (has("dayOfMonth")) data.dayOfMonth = b.dayOfMonth ?? null;
    if (has("timeOfDay")) data.timeOfDay = b.timeOfDay?.trim() || null;
    if (has("idleDays")) data.idleDays = b.idleDays ?? null;
    if (has("maxPerRun")) {
      data.maxPerRun = Math.min(Math.max(Number(b.maxPerRun) || 20, 1), 100);
    }
    if (has("isActive")) data.isActive = b.isActive === true;

    if (has("ownerId") && b.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: b.ownerId },
        select: { id: true, firstName: true, lastName: true, phone: true, isActive: true },
      });
      if (!owner?.isActive) {
        return NextResponse.json({ error: "مسئول پیدا نشد یا غیرفعال است" }, { status: 400 });
      }
      data.ownerId = owner.id;
      data.ownerName =
        [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() || owner.phone;
    }

    const rule = await prisma.staffRecurringRule.update({
      where: { id },
      data,
      select: {
        id: true, typeId: true, title: true, ownerId: true, ownerName: true,
        schedule: true, daysOfWeek: true, dayOfMonth: true, timeOfDay: true,
        idleDays: true, maxPerRun: true, isActive: true, lastRunAt: true, lastRunCount: true,
        type: { select: { id: true, title: true, icon: true, domain: true } },
      },
    });

    logActivityAsync({
      action: "UPDATE",
      entity: "SETTINGS",
      entityId: rule.id,
      entityTitle: rule.title,
      summary: `ویرایش قاعده‌ی تکرارشونده «${rule.title}»`,
    });

    return NextResponse.json({ rule });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * حذف قاعده.
 *
 * کارهایی که این قاعده ساخته **پاک نمی‌شوند** — `StaffTask.ruleId` رابطه‌ی
 * واقعی نیست و ردیف‌های گذشته سر جایشان می‌مانند. تاریخچه‌ی عملکرد نباید با
 * حذف یک تنظیم از بین برود.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requirePermission("WORK_SETTINGS_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  try {
    const rule = await prisma.staffRecurringRule.delete({ where: { id } });
    logActivityAsync({
      action: "DELETE",
      entity: "SETTINGS",
      entityId: id,
      entityTitle: rule.title,
      summary: `حذف قاعده‌ی تکرارشونده «${rule.title}»`,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "قاعده پیدا نشد" }, { status: 404 });
  }
}
