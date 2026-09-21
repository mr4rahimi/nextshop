import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import { canSeeSeoTask } from "@/lib/marketing/seo-task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * چک‌لیست کار سئو.
 *
 * ⚠️ **تیک زدن رویداد نمی‌سازد و اعلان نمی‌دهد** — کاربر ده بار تیک می‌زند و
 * برمی‌دارد و تاریخچه پر از نویز می‌شود. ولی چه کسی و کِی تیک زد روی خودِ
 * بند می‌ماند، که همان چیزی است که مدیر موقع تأیید نگاه می‌کند.
 *
 * ⚠️ چک‌لیست ناتمام **جلوی ثبت گزارش را نمی‌گیرد**؛ گاهی بندی وسط کار
 * بی‌معنی می‌شود و بستنِ راهِ کارمند فقط باعث می‌شود بند الکی تیک بخورد.
 */
async function guardTask(id: string) {
  const guard = await requirePermission(["SEO_TASK_WORK", "SEO_TASK_MANAGE"]);
  if (!guard.ok) {
    return { error: NextResponse.json({ error: guard.error }, { status: guard.status }) };
  }
  if (!(await canSeeSeoTask(id, guard.access))) {
    return { error: NextResponse.json({ error: "به این کار دسترسی ندارید" }, { status: 403 }) };
  }

  const task = await prisma.seoTask.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!task) {
    return { error: NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 }) };
  }

  // روی کار بسته‌شده چک‌لیست قفل است، مگر برای مدیر که بازگشایی هم می‌تواند
  const closed = task.status === "DONE" || task.status === "CANCELED";
  if (closed && !can(guard.access, "SEO_TASK_MANAGE")) {
    return { error: NextResponse.json({ error: "کار بسته شده است" }, { status: 400 }) };
  }

  return { access: guard.access };
}

/** افزودن بند */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const g = await guardTask(id);
  if (g.error) return g.error;

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "متن بند لازم است" }, { status: 400 });

  const last = await prisma.seoTaskChecklistItem.findFirst({
    where: { taskId: id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const item = await prisma.seoTaskChecklistItem.create({
    data: { taskId: id, title, sortOrder: (last?.sortOrder ?? -1) + 1 },
    select: { id: true, title: true, sortOrder: true, doneAt: true, doneById: true, doneByName: true },
  });

  return NextResponse.json(serialize({ item }), { status: 201 });
}

/** تیک زدن یا برداشتن تیک */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const g = await guardTask(id);
  if (g.error) return g.error;

  const body = await req.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!itemId) return NextResponse.json({ error: "شناسه‌ی بند لازم است" }, { status: 400 });

  // ⚠️ `taskId` در شرط می‌ماند: بدون آن، شناسه‌ی بندِ کار دیگری هم پذیرفته می‌شد
  const existing = await prisma.seoTaskChecklistItem.findFirst({
    where: { id: itemId, taskId: id },
    select: { id: true, doneAt: true },
  });
  if (!existing) return NextResponse.json({ error: "بند پیدا نشد" }, { status: 404 });

  const done = existing.doneAt === null;
  const item = await prisma.seoTaskChecklistItem.update({
    where: { id: itemId },
    data: done
      ? { doneAt: new Date(), doneById: g.access.userId, doneByName: g.access.name }
      : { doneAt: null, doneById: null, doneByName: null },
    select: { id: true, title: true, sortOrder: true, doneAt: true, doneById: true, doneByName: true },
  });

  return NextResponse.json(serialize({ item }));
}

/** حذف بند — سخت است، چون بند تیک‌نخورده‌ی اشتباه فقط شلوغی است */
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const g = await guardTask(id);
  if (g.error) return g.error;

  const itemId = new URL(req.url).searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "شناسه‌ی بند لازم است" }, { status: 400 });

  const res = await prisma.seoTaskChecklistItem.deleteMany({
    where: { id: itemId, taskId: id },
  });
  if (res.count === 0) return NextResponse.json({ error: "بند پیدا نشد" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
