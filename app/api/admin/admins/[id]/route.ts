import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffAccess } from "@/lib/permissions";
import { clearAdminGateCache } from "@/lib/admin-gate";
import { seatError } from "@/lib/plan/license";
import { isDemo, DEMO_BLOCKED } from "@/lib/demo";

export const runtime = "nodejs";

/**
 * غیرفعال‌کردن و حذف ادمین — فقط برای کسی که **دسترسی کامل** دارد (ادمین بی‌نقش).
 *
 * ⚠️ سه محافظ:
 *  - هیچ‌کس خودش را غیرفعال یا حذف نمی‌کند (قفل شدن بیرون پنل)
 *  - آخرین ادمینِ فعالِ با دسترسی کامل دست نمی‌خورد، وگرنه کسی نمی‌ماند که برگرداند
 *  - حسابی که سابقه دارد (سفارش، فاکتور و…) حذف واقعی نمی‌شود؛ از ادمین‌ها
 *    برداشته و کاربر عادی می‌شود تا سوابق نشکند
 */
async function guard(id: string) {
  // دموی عمومی یک حساب مدیر مشترک دارد؛ بازدیدکننده نباید بقیه را بیرون کند
  if (isDemo()) return { error: DEMO_BLOCKED, status: 403 } as const;
  const access = await getStaffAccess();
  if (!access) return { error: "وارد نشده‌اید", status: 401 } as const;
  if (!access.isUnrestricted) {
    return { error: "فقط ادمین با دسترسی کامل می‌تواند ادمین‌ها را غیرفعال یا حذف کند", status: 403 } as const;
  }
  if (access.userId === id) return { error: "نمی‌توانید حساب خودتان را غیرفعال یا حذف کنید", status: 400 } as const;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true, staffRoleId: true, firstName: true, lastName: true, phone: true },
  });
  if (!target || target.role !== "ADMIN") return { error: "ادمین پیدا نشد", status: 404 } as const;
  return { access, target } as const;
}

/** آیا بعد از کنار رفتن این نفر، دست‌کم یک ادمینِ فعالِ با دسترسی کامل می‌ماند */
async function leavesFullAdmin(id: string) {
  const others = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, staffRoleId: null, id: { not: id } },
  });
  return others > 0;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const { isActive } = (await req.json().catch(() => ({}))) as { isActive?: boolean };
  if (typeof isActive !== "boolean") return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });

  if (!isActive && !(await leavesFullAdmin(id))) {
    return NextResponse.json({ error: "این آخرین ادمین فعال با دسترسی کامل است و غیرفعال نمی‌شود" }, { status: 400 });
  }
  // سقف کاربر پنل در بسته‌ی گردانوس — فعال‌کردن دوباره صندلی می‌گیرد
  if (isActive && !g.target.isActive) {
    const err = await seatError();
    if (err) return NextResponse.json({ error: err }, { status: 403 });
  }

  await prisma.user.update({ where: { id }, data: { isActive } });
  clearAdminGateCache(id);
  return NextResponse.json({ ok: true, isActive });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard(id);
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  if (g.target.isActive && !(await leavesFullAdmin(id))) {
    return NextResponse.json({ error: "این آخرین ادمین فعال با دسترسی کامل است و حذف نمی‌شود" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    clearAdminGateCache(id);
    return NextResponse.json({ ok: true, mode: "deleted" });
  } catch (e) {
    // سابقه دارد (کلید خارجی) — از ادمین‌ها برداشته می‌شود، حساب و سوابقش می‌ماند
    if ((e as { code?: string }).code !== "P2003") {
      return NextResponse.json({ error: e instanceof Error ? e.message : "حذف نشد" }, { status: 500 });
    }
    await prisma.user.update({ where: { id }, data: { role: "CUSTOMER", staffRoleId: null } });
    clearAdminGateCache(id);
    return NextResponse.json({ ok: true, mode: "demoted" });
  }
}
