import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { commissionStaff, computeStatement, recordPayout, statementJson } from "@/lib/worklist/commission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * مانده‌ی پورسانت. «محاسبه» همین GET است و هیچ‌چیز ذخیره نمی‌کند.
 *
 * بدون `COMMISSION_VIEW_ALL` فقط مانده و تاریخچه‌ی خودِ کاربر.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["COMMISSION_VIEW_OWN", "COMMISSION_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { access } = guard;
  const viewAll = can(access, "COMMISSION_VIEW_ALL");

  const wanted = new URL(req.url).searchParams.get("userId") || access.userId;
  if (wanted !== access.userId && !viewAll) {
    return NextResponse.json({ error: "به پورسانت دیگران دسترسی ندارید" }, { status: 403 });
  }

  const ids = viewAll ? await commissionStaff() : [];
  const [mine, team, history] = await Promise.all([
    computeStatement(wanted),
    Promise.all(ids.map((id) => computeStatement(id))),
    prisma.staffPayout.findMany({
      where: viewAll && !new URL(req.url).searchParams.get("userId") ? {} : { userId: wanted },
      orderBy: { paidAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json(
    serialize({
      statement: statementJson(mine),
      team: team.map(statementJson).sort((a, b) => Number(BigInt(b.due) - BigInt(a.due))),
      history,
      can: { viewAll, manage: can(access, "COMMISSION_MANAGE") },
    }),
  );
}

/**
 * «پرداخت شد» — برگشت‌ناپذیر.
 *
 * `{ userId, amount, expectedDue, note }`: `expectedDue` همان عددی است که مدیر
 * دید؛ اگر وسط کار معامله‌ای عوض شده باشد، پرداخت رد می‌شود.
 */
export async function POST(req: Request) {
  const guard = await requirePermission("COMMISSION_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const amount = /^\d{1,15}$/.test(String(body?.amount ?? "")) ? BigInt(body.amount) : null;
  const expectedDue = /^-?\d{1,15}$/.test(String(body?.expectedDue ?? "")) ? BigInt(body.expectedDue) : null;
  if (!userId || amount === null || expectedDue === null) {
    return NextResponse.json({ error: "کارمند، مبلغ و عدد محاسبه‌شده لازم است" }, { status: 400 });
  }

  try {
    const payout = await recordPayout({ userId, amount, expectedDue, note: body.note }, guard.access);
    logActivityAsync({
      action: "CREATE",
      entity: "USER",
      entityId: userId,
      entityTitle: payout.userName,
      summary:
        `ثبت پرداخت پورسانت ${payout.userName}: ${payout.amount.toLocaleString("en-US")} از ${payout.due.toLocaleString("en-US")}` +
        (payout.remaining !== 0n ? ` (مانده ${payout.remaining.toLocaleString("en-US")})` : ""),
    });
    return NextResponse.json(serialize({ payout }), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطای سرور";
    // خطای سریال‌سازی پستگرس یعنی هم‌زمانی — همان پیام کاربرپسند
    const conflict = (e as { code?: string }).code === "P2034";
    return NextResponse.json(
      { error: conflict ? "هم‌زمان تسویه‌ی دیگری ثبت شد. دوباره محاسبه کنید." : msg },
      { status: conflict ? 409 : 400 },
    );
  }
}
