import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { jalaliToday, fromJalali } from "@/lib/club/jalali";
import {
  getMonthAttendance,
  getMonthSummary,
  aggregateMonth,
  aggregateDay,
  dayBounds,
  formatMinutes,
  attendanceGate,
  jalaliKey,
} from "@/lib/worklist/attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** سقف منطقیِ یک روز — بیشتر از این ورودیِ اشتباه است نه اصلاح */
const MAX_EDIT_MIN = 24 * 60;

/**
 * تقویم ماهانه‌ی حضور.
 *
 * `userId` اختیاری است: بدون آن، حضورِ خودِ کاربر برمی‌گردد. دیدنِ حضورِ
 * دیگری `ATTENDANCE_VIEW_ALL` می‌خواهد — بدون این چک، هر کارمندی با عوض‌کردن
 * پارامتر ساعت کار بقیه را می‌دید.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ATTENDANCE_VIEW_OWN", "ATTENDANCE_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { access } = guard;
  const viewAll = can(access, "ATTENDANCE_VIEW_ALL");

  const url = new URL(req.url);
  const today = jalaliToday();
  const year = Number(url.searchParams.get("year")) || today.year;
  const month = Number(url.searchParams.get("month")) || today.month;
  const wanted = url.searchParams.get("userId") || access.userId;

  if (month < 1 || month > 12 || year < 1300 || year > 1500) {
    return NextResponse.json({ error: "ماه یا سال نامعتبر است" }, { status: 400 });
  }
  if (wanted !== access.userId && !viewAll) {
    return NextResponse.json({ error: "به حضور دیگران دسترسی ندارید" }, { status: 403 });
  }

  const [{ capMin }, calendar] = await Promise.all([
    attendanceGate(),
    getMonthAttendance(wanted, year, month),
  ]);

  // فهرست کارکنان و جمعِ ماهشان فقط برای کسی که مجوز دیدن همه را دارد
  let staff: unknown[] = [];
  if (viewAll) {
    const [users, summary] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true, role: { in: ["ADMIN", "SELLER"] } },
        orderBy: [{ firstName: "asc" }, { phone: "asc" }],
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      getMonthSummary(year, month),
    ]);
    staff = users.map((u) => {
      const s = summary.get(u.id);
      return {
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone || "بدون نام",
        phone: u.phone,
        isMe: u.id === access.userId,
        activeMin: s?.activeMin ?? 0,
        presentDays: s?.presentDays ?? 0,
      };
    });
  }

  return NextResponse.json({
    year,
    month,
    userId: wanted,
    days: calendar.days,
    totals: calendar.totals,
    staff,
    capMin,
    can: {
      viewAll,
      edit: can(access, "ATTENDANCE_EDIT"),
      manageSettings: can(access, "WORK_SETTINGS_MANAGE"),
    },
  });
}

/**
 * اصلاح دستی یک روز، یا بازسازی آن از روی نشست‌های خام.
 *
 * دو حالت:
 * - `{ userId, date, activeMin, note }` → اصلاح دستی با ثبت نام اصلاح‌کننده
 * - `{ userId, date, recompute: true }` → برگشت به عددِ محاسبه‌شده
 *
 * ⚠️ نشستِ خام هیچ‌وقت دست نمی‌خورد. اصلاح فقط روی `StaffWorkDay` می‌نشیند،
 * پس همیشه راهی برای دیدنِ اینکه واقعاً چه شده باقی می‌ماند.
 */
export async function PATCH(req: Request) {
  const guard = await requirePermission("ATTENDANCE_EDIT");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه‌ی نامعتبر" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : null;
  const date = typeof body.date === "string" ? body.date : null;
  if (!userId || !date) {
    return NextResponse.json({ error: "کارمند و تاریخ لازم است" }, { status: 400 });
  }

  const m = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const day = m ? fromJalali(Number(m[1]), Number(m[2]), Number(m[3])) : null;
  if (!day) {
    return NextResponse.json({ error: "تاریخ نامعتبر است" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, phone: true, role: true },
  });
  if (!target || (target.role !== "ADMIN" && target.role !== "SELLER")) {
    return NextResponse.json({ error: "کارمند پیدا نشد" }, { status: 404 });
  }
  const targetName =
    [target.firstName, target.lastName].filter(Boolean).join(" ").trim() || target.phone;

  // بازسازی: اصلاح قبلی کنار می‌رود و عددِ نشست‌های خام برمی‌گردد
  if (body.recompute === true) {
    await aggregateDay(userId, day, { force: true });
    const row = await prisma.staffWorkDay.findUnique({
      where: { userId_day: { userId, day } },
    });
    logActivityAsync({
      action: "UPDATE",
      entity: "USER",
      entityId: userId,
      entityTitle: targetName,
      summary: `بازسازی حضور ${jalaliKey(day)} از روی نشست‌های خام`,
    });
    return NextResponse.json({ ok: true, recomputed: true, activeMin: row?.activeMin ?? 0 });
  }

  const activeMin = Number(body.activeMin);
  if (!Number.isFinite(activeMin) || activeMin < 0 || activeMin > MAX_EDIT_MIN) {
    return NextResponse.json(
      { error: "دقیقه‌ی حضور باید بین صفر و ۱۴۴۰ باشد" },
      { status: 400 },
    );
  }
  const minutes = Math.round(activeMin);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  const existing = await prisma.staffWorkDay.findUnique({
    where: { userId_day: { userId, day } },
    select: { id: true, firstIn: true, lastOut: true, grossMin: true, activeMin: true },
  });

  // روزی که هیچ نشستی نداشته هم اصلاح می‌شود (کارمند بدون لپ‌تاپ سر کار بوده).
  // بازه‌ی ساختگی از نیمه‌شبِ همان روز شروع می‌شود تا با روزِ دیگری قاطی نشود.
  const { start } = dayBounds(day);
  const firstIn = existing?.firstIn ?? start;
  const lastOut = existing?.lastOut ?? new Date(start.getTime() + minutes * 60_000);

  const saved = await prisma.staffWorkDay.upsert({
    where: { userId_day: { userId, day } },
    create: {
      userId,
      day,
      firstIn,
      lastOut,
      activeMin: minutes,
      grossMin: existing?.grossMin ?? minutes,
      note,
      editedById: guard.access.userId,
      editedByName: guard.access.name,
      editedAt: new Date(),
    },
    update: {
      activeMin: minutes,
      note,
      editedById: guard.access.userId,
      editedByName: guard.access.name,
      editedAt: new Date(),
    },
  });

  logActivityAsync({
    action: "UPDATE",
    entity: "USER",
    entityId: userId,
    entityTitle: targetName,
    summary:
      `اصلاح دستی حضور ${jalaliKey(day)}: ` +
      `${formatMinutes(existing?.activeMin ?? 0)} ← ${formatMinutes(minutes)}` +
      (note ? ` (${note})` : ""),
  });

  return NextResponse.json({ ok: true, activeMin: saved.activeMin });
}

/**
 * بازسازی کل ماهِ یک کارمند.
 *
 * راهِ برگشت وقتی نشستی دیر بسته شده یا سقف روزانه عوض شده است. روزهای
 * اصلاح‌شده‌ی دستی دست‌نخورده می‌مانند — `aggregateDay` بدون `force` ردشان می‌کند.
 */
export async function POST(req: Request) {
  const guard = await requirePermission("ATTENDANCE_EDIT");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const userId = typeof body?.userId === "string" ? body.userId : null;
    const today = jalaliToday();
    const year = Number(body?.year) || today.year;
    const month = Number(body?.month) || today.month;

    if (!userId) return NextResponse.json({ error: "کارمند لازم است" }, { status: 400 });
    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "ماه نامعتبر است" }, { status: 400 });
    }

    const count = await aggregateMonth(userId, year, month);
    return NextResponse.json({ ok: true, days: count });
  } catch (e) {
    console.error("[worklist] بازسازی ماه حضور شکست خورد:", e);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
