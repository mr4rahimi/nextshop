import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { awardMonth, listAwards, parseMonth, removeAward } from "@/lib/worklist/score";
import { isScoreGroup, SCORE_GROUP_LABELS } from "@/lib/worklist/score-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** برنده‌های ماه‌های گذشته — فقط نام و دلیل، بدون امتیاز بقیه */
export async function GET() {
  const guard = await requirePermission(["SCORE_VIEW_OWN", "SCORE_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ awards: await listAwards() });
}

/** ثبت برنده = قفل ماه برای آن گروه، با وزن‌های همین لحظه */
export async function POST(req: Request) {
  const guard = await requirePermission("SCORE_SETTINGS_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const month = parseMonth(typeof body?.month === "string" ? body.month : "");
  if (!month) return NextResponse.json({ error: "ماه نامعتبر است" }, { status: 400 });
  if (!isScoreGroup(body?.group)) return NextResponse.json({ error: "گروه نامعتبر است" }, { status: 400 });
  if (typeof body?.userId !== "string" || !body.userId) {
    return NextResponse.json({ error: "برنده را انتخاب کنید" }, { status: 400 });
  }
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  try {
    const award = await awardMonth({
      month,
      group: body.group,
      userId: body.userId,
      note,
      by: { userId: guard.access.userId, name: guard.access.name },
    });
    logActivityAsync({
      action: "CREATE",
      entity: "SETTINGS",
      entityTitle: "امتیاز عملکرد",
      summary: `برنده‌ی ${SCORE_GROUP_LABELS[body.group as keyof typeof SCORE_GROUP_LABELS]} ${month.label}: ${award.userName}`,
    });
    return NextResponse.json({ ok: true, award });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "ثبت ناموفق بود" }, { status: 400 });
  }
}

/** برداشتن قفل — اشتباه در ثبت برنده باید قابل برگشت باشد */
export async function DELETE(req: Request) {
  const guard = await requirePermission("SCORE_SETTINGS_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const month = parseMonth(url.searchParams.get("month") ?? "");
  const group = url.searchParams.get("group");
  if (!month || !isScoreGroup(group)) return NextResponse.json({ error: "ورودی نامعتبر است" }, { status: 400 });

  const removed = await removeAward(month.key, group);
  if (!removed) return NextResponse.json({ error: "برنده‌ای ثبت نشده بود" }, { status: 404 });
  logActivityAsync({
    action: "DELETE",
    entity: "SETTINGS",
    entityTitle: "امتیاز عملکرد",
    summary: `برداشتن برنده‌ی ${SCORE_GROUP_LABELS[group]} ${month.label}`,
  });
  return NextResponse.json({ ok: true });
}
