import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import { updateTask, listNotes, TASK_SELECT } from "@/lib/worklist/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** یک کار با یادداشت‌هایش */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["WORK_VIEW_OWN", "WORK_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const task = await prisma.staffTask.findUnique({ where: { id }, select: TASK_SELECT });
  if (!task) return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });

  if (!can(guard.access, "WORK_VIEW_ALL") && task.ownerId !== guard.access.userId) {
    return NextResponse.json({ error: "به این کار دسترسی ندارید" }, { status: 403 });
  }

  const notes = await listNotes(id);
  return NextResponse.json(serialize({ task, notes }));
}

/** ویرایش کار، ثبت نتیجه یا تغییر وضعیت */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission(["WORK_EDIT_OWN", "WORK_EDIT_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const existing = await prisma.staffTask.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });
  if (!existing) return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });

  const canEditAll = can(guard.access, "WORK_EDIT_ALL");
  if (!canEditAll && existing.ownerId !== guard.access.userId) {
    return NextResponse.json({ error: "این کار مال شما نیست" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (body.ownerId !== undefined && body.ownerId !== existing.ownerId) {
      if (!can(guard.access, "WORK_ASSIGN")) {
        return NextResponse.json(
          { error: "اجازه‌ی ارجاع کار به دیگران را ندارید" },
          { status: 403 },
        );
      }
    }

    const task = await updateTask(id, body, guard.access);
    return NextResponse.json(serialize({ task }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** حذف کار — مجوز جدا دارد چون تاریخچه‌ی عملکرد را پاک می‌کند */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requirePermission("WORK_DELETE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  try {
    await prisma.staffTask.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });
  }
}
