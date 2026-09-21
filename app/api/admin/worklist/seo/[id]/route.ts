import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import {
  updateSeoTask,
  deleteSeoTask,
  canSeeSeoTask,
  SEO_TASK_DETAIL_SELECT,
} from "@/lib/marketing/seo-task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** یک کار با چک‌لیست، پیوست‌ها و تاریخچه */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["SEO_TASK_WORK", "SEO_TASK_MANAGE", "MARKETING_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const task = await prisma.seoTask.findFirst({
    where: { id, deletedAt: null },
    select: SEO_TASK_DETAIL_SELECT,
  });
  if (!task) return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });

  if (!(await canSeeSeoTask(id, guard.access))) {
    return NextResponse.json({ error: "به این کار دسترسی ندارید" }, { status: 403 });
  }

  return NextResponse.json(serialize({ task }));
}

/** ویرایش فیلدهای کار — وضعیت از اینجا عوض نمی‌شود (مسیر `transition`) */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission(["SEO_TASK_WORK", "SEO_TASK_MANAGE"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const task = await updateSeoTask(id, body, guard.access);
    return NextResponse.json(serialize({ task }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** حذف نرم — فقط مدیر */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requirePermission("SEO_TASK_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  if (!can(guard.access, "SEO_TASK_MANAGE")) {
    return NextResponse.json({ error: "حذف کار با مدیر سئو است" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteSeoTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
