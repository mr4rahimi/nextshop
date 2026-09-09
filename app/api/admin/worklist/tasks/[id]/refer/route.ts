import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { referTask, listReferrals, markReferralsSeen } from "@/lib/worklist/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * تاریخچه‌ی ارجاع + **پاک‌کردن نشان «جدید» برای بیننده**.
 *
 * ⚠️ نشان دقیقاً همین‌جا پاک می‌شود، یعنی وقتی کاربر ردیف را باز کرد. اگر در
 * رندر فهرست علامت می‌زدیم، اولین refetch آن را پیش از دیده‌شدن پاک می‌کرد.
 */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["WORK_VIEW_OWN", "WORK_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const referrals = await listReferrals(id);
  await markReferralsSeen(guard.access.userId, { taskId: id });

  return NextResponse.json(serialize({ referrals }));
}

/** ارجاع کار به کارمند دیگر */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission("WORK_ASSIGN");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    if (!body?.toId) {
      return NextResponse.json({ error: "گیرنده‌ی ارجاع انتخاب نشده است" }, { status: 400 });
    }
    const referral = await referTask(id, body, guard.access);
    return NextResponse.json(serialize({ referral }), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
