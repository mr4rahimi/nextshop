import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, sanitizePermissions, PERMISSION_GROUPS } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * فهرست نقش‌های کارتابل + کاتالوگ مجوزها.
 *
 * صفحه‌ی «مدیریت ادمین‌ها» با همین، ستون نقش را می‌سازد. اگر ماژول روشن
 * نباشد یا کاربر دسترسی نداشته باشد، آن صفحه فهرست خالی می‌گیرد و ستون را
 * اصلاً نشان نمی‌دهد — پس بدون کارتابل هم صفحه سالم کار می‌کند.
 */
export async function GET() {
  const guard = await requirePermission(["ROLE_MANAGE", "STAFF_VIEW", "STAFF_MANAGE"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const roles = await prisma.staffRole.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      permissions: true,
      isSystem: true,
      isActive: true,
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({ roles, permissionGroups: PERMISSION_GROUPS });
}

/** ساخت نقش تازه */
export async function POST(req: Request) {
  const guard = await requirePermission("ROLE_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const b = await req.json();
    const title = b?.title?.trim();
    if (!title) {
      return NextResponse.json({ error: "عنوان نقش لازم است" }, { status: 400 });
    }

    // slug از عنوان ساخته می‌شود؛ اگر فارسی بود و چیزی نماند، از زمان
    const base = slugify(title) || `role-${Date.now().toString(36)}`;
    let slug = base;
    for (let i = 2; await prisma.staffRole.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${i}`;
    }

    const role = await prisma.staffRole.create({
      data: {
        slug,
        title,
        description: b.description?.trim() || null,
        permissions: sanitizePermissions(b.permissions),
        isSystem: false,
        sortOrder: 100,
      },
      select: {
        id: true, slug: true, title: true, description: true,
        permissions: true, isSystem: true, isActive: true,
        _count: { select: { users: true } },
      },
    });

    logActivityAsync({
      action: "CREATE",
      entity: "STAFF_ROLE",
      entityId: role.id,
      entityTitle: role.title,
      summary: `ساخت نقش «${role.title}»`,
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
