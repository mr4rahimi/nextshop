import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import {
  updateContentTask,
  deleteContentTask,
  canSeeContentTask,
  CONTENT_TASK_DETAIL_SELECT,
} from "@/lib/marketing/content-task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const VIEW = ["CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE", "MARKETING_VIEW_ALL"];

/**
 * یک کار با متن، مقاله، پیوست‌ها و تاریخچه.
 *
 * `text` همیشه متن جاری است: اگر مقاله ساخته شده از `BlogPost.content`،
 * وگرنه از پیش‌نویس کار. کلاینت نباید بداند متن کجا نشسته (بخش ۶.۲).
 */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(VIEW);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  if (!(await canSeeContentTask(id, guard.access))) {
    return NextResponse.json({ error: "به این کار دسترسی ندارید" }, { status: 403 });
  }

  const task = await prisma.contentTask.findFirst({
    where: { id, deletedAt: null },
    select: CONTENT_TASK_DETAIL_SELECT,
  });
  if (!task) return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });

  const { body, blogPost, ...rest } = task;
  const text = blogPost ? blogPost.content : (body ?? "");
  const post = blogPost ? { ...blogPost, content: undefined } : null;

  return NextResponse.json(serialize({ task: { ...rest, text, blogPost: post } }));
}

/** ویرایش فیلدهای کار — مدیر. وضعیت و متن از مسیر خودشان عوض می‌شوند. */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission("CONTENT_TASK_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const task = await updateContentTask(id, body, guard.access);
    return NextResponse.json(serialize({ task }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** حذف نرم — مدیر. مقاله‌ی ساخته‌شده دست نمی‌خورد. */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requirePermission("CONTENT_TASK_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  try {
    await deleteContentTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
