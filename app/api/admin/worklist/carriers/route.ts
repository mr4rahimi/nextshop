import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { FALLBACK_CARRIERS } from "@/lib/worklist/types";
import { slaLabel } from "@/lib/shipping-methods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * باربری‌های قابل انتخاب در فرم کار — از `ShippingMethod`، نه از آرایه‌ی کد.
 *
 * فروشگاهی که هنوز روش ارسالی تعریف نکرده، فهرست پیش‌فرضِ `FALLBACK_CARRIERS`
 * را می‌گیرد تا فرم خالی نباشد. `fallback: true` به رابط کاربری می‌گوید
 * جمله‌ی راهنمای «این‌ها را در تنظیمات ارسال تعریف کنید» را نشان دهد.
 */
export async function GET() {
  const guard = await requirePermission(["WORK_VIEW_OWN", "WORK_VIEW_ALL", "WORK_CREATE"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const rows = await prisma.shippingMethod.findMany({
    where: { isActive: true, useInWorklist: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { title: true, slaMinutes: true, feePayer: true },
  });

  if (rows.length === 0) {
    return NextResponse.json({
      fallback: true,
      carriers: FALLBACK_CARRIERS.map((title) => ({ title, sla: null, feePayer: "COLLECT" })),
    });
  }

  return NextResponse.json({
    fallback: false,
    carriers: rows.map((r) => ({
      title: r.title,
      sla: slaLabel(r.slaMinutes),
      feePayer: r.feePayer,
    })),
  });
}
