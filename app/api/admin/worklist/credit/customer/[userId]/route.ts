import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { openDebtOf } from "@/lib/worklist/credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

/**
 * بدهی باز یک مشتری — برای پرونده‌ی مشتری (بخش ۲۴.۴).
 *
 * بدون `CREDIT_VIEW_ALL` فقط برای مشتری خودِ کارمند (صاحب پروفایل یا ثبت‌کننده‌ی
 * یکی از سفارش‌هایش)؛ در غیر این صورت `null` برمی‌گردد، نه خطا — پرونده باید
 * بی‌صدا بدون این بخش باز شود.
 */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["CREDIT_VIEW_OWN", "CREDIT_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ debt: null });

  const { userId } = await params;
  if (!can(guard.access, "CREDIT_VIEW_ALL")) {
    const mine = await prisma.user.count({
      where: {
        id: userId,
        OR: [
          { clubProfile: { ownerId: guard.access.userId } },
          { orders: { some: { createdByStaffId: guard.access.userId } } },
        ],
      },
    });
    if (!mine) return NextResponse.json({ debt: null });
  }

  const debt = await openDebtOf(userId);
  return NextResponse.json(serialize({ debt: debt.count > 0 ? { ...debt, rows: undefined } : null }));
}
