import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, sanitizePermissions } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * ویرایش نقش.
 *
 * ⚠️ نقش سیستمیِ «مدیر» مجوزهایش کم نمی‌شود و غیرفعال نمی‌شود. بدون این
 * قاعده، با یک اشتباه هیچ‌کس دیگر به تنظیمات نقش‌ها دسترسی ندارد و راه
 * برگشتی جز دستکاری مستقیم دیتابیس نمی‌ماند.
 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission("ROLE_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const role = await prisma.staffRole.findUnique({
    where: { id },
    select: { id: true, title: true, isSystem: true },
  });
  if (!role) return NextResponse.json({ error: "نقش پیدا نشد" }, { status: 404 });

  try {
    const b = await req.json();
    const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
    const data: Record<string, unknown> = {};

    if (has("title") && b.title?.trim()) data.title = b.title.trim();
    if (has("description")) data.description = b.description?.trim() || null;

    if (has("permissions")) {
      if (role.isSystem) {
        return NextResponse.json(
          { error: "مجوزهای نقش مدیر قابل تغییر نیست" },
          { status: 400 },
        );
      }
      // فقط کلیدهای شناخته‌شده — مجوزی که هیچ کدی چکش نمی‌کند توهم امنیت است
      data.permissions = sanitizePermissions(b.permissions);
    }

    if (has("isActive")) {
      if (role.isSystem && b.isActive === false) {
        return NextResponse.json(
          { error: "نقش مدیر غیرفعال نمی‌شود" },
          { status: 400 },
        );
      }
      data.isActive = b.isActive === true;
    }

    const updated = await prisma.staffRole.update({
      where: { id },
      data,
      select: {
        id: true, slug: true, title: true, description: true,
        permissions: true, isSystem: true, isActive: true,
        _count: { select: { users: true } },
      },
    });

    logActivityAsync({
      action: "UPDATE",
      entity: "STAFF_ROLE",
      entityId: updated.id,
      entityTitle: updated.title,
      summary: `ویرایش نقش «${updated.title}»`,
    });

    return NextResponse.json({ role: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * حذف نقش.
 *
 * نقشی که به کسی داده شده حذف نمی‌شود — اول باید از آن افراد برداشته شود.
 * وگرنه آن‌ها بی‌صدا به حالت «بدون نقش» یعنی **دسترسی کامل** برمی‌گشتند،
 * که دقیقاً برعکس چیزی است که مدیر با حذف نقش می‌خواهد.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requirePermission("ROLE_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const role = await prisma.staffRole.findUnique({
    where: { id },
    select: { id: true, title: true, isSystem: true, _count: { select: { users: true } } },
  });
  if (!role) return NextResponse.json({ error: "نقش پیدا نشد" }, { status: 404 });

  if (role.isSystem) {
    return NextResponse.json({ error: "نقش سیستمی حذف نمی‌شود" }, { status: 400 });
  }
  if (role._count.users > 0) {
    return NextResponse.json(
      {
        error: `این نقش به ${role._count.users.toLocaleString("fa-IR")} نفر داده شده. اول نقششان را عوض کنید.`,
      },
      { status: 400 },
    );
  }

  await prisma.staffRole.delete({ where: { id } });

  logActivityAsync({
    action: "DELETE",
    entity: "STAFF_ROLE",
    entityId: id,
    entityTitle: role.title,
    summary: `حذف نقش «${role.title}»`,
  });

  return NextResponse.json({ ok: true });
}
