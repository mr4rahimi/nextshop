import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * کارکنانی که می‌شود کار را به آن‌ها ارجاع داد.
 *
 * فقط حساب‌های فعالِ ادمین و فروشنده. مشتری‌ها هرگز اینجا نمی‌آیند، حتی اگر
 * شناسه‌شان دستی در بدنه‌ی ارجاع فرستاده شود — `referTask` هم دوباره چک می‌کند.
 */
export async function GET() {
  const guard = await requirePermission(["WORK_ASSIGN", "STAFF_VIEW", "WORK_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "SELLER"] } },
    orderBy: [{ firstName: "asc" }, { phone: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      staffRole: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({
    staff: users.map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone || "بدون نام",
      phone: u.phone,
      role: u.role,
      roleTitle: u.staffRole?.title ?? null,
      isMe: u.id === guard.access.userId,
    })),
  });
}
