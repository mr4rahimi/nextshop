import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * وصل‌کردن طرح پورسانت به کارمند. `{ userId, planId }` — `planId: null` یعنی بدون پورسانت.
 * معامله‌های قطعی‌شده‌ی قبلی دست نمی‌خورند.
 */
export async function POST(req: Request) {
  const guard = await requirePermission("COMMISSION_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  if (typeof body?.userId !== "string") return NextResponse.json({ error: "کارمند لازم است" }, { status: 400 });
  const planId = typeof body.planId === "string" && body.planId ? body.planId : null;

  try {
    const user = await prisma.user.update({
      where: { id: body.userId },
      data: { commissionPlanId: planId },
      select: { firstName: true, lastName: true, phone: true, commissionPlan: { select: { title: true } } },
    });
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.phone;
    logActivityAsync({
      action: "UPDATE",
      entity: "USER",
      entityId: body.userId,
      entityTitle: name,
      summary: `طرح پورسانت ${name}: ${user.commissionPlan?.title ?? "بدون پورسانت"}`,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "کارمند یا طرح پیدا نشد" }, { status: 404 });
  }
}
