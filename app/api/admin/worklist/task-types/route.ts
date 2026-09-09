import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * انواع کارِ فعال — خوراک چیپ‌های فرم ثبت سریع.
 *
 * انواع `SYSTEM` بیرون گذاشته می‌شوند: آن‌ها از نوشتنِ واقعی در پنل استخراج
 * می‌شوند و ثبت دستی‌شان یعنی همان کار دو بار شمرده شود.
 */
export async function GET() {
  const guard = await requirePermission([
    "WORK_VIEW_OWN",
    "WORK_VIEW_ALL",
    "WORK_CREATE",
  ]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const types = await prisma.staffTaskType.findMany({
    where: { isActive: true, source: { not: "SYSTEM" } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      domain: true,
      channel: true,
      source: true,
      icon: true,
      outcomes: true,
      needsCustomer: true,
      needsAmount: true,
      needsLink: true,
      needsCarrier: true,
      slaMinutes: true,
    },
  });

  return NextResponse.json({ types });
}
