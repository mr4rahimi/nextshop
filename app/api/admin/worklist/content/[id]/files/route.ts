import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission, can } from "@/lib/permissions";
import { canSeeContentTask } from "@/lib/marketing/content-task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * پیوست کار محتوا — فایل Word یا PDF متن، عکس‌های خام، منبع.
 *
 * همان قرارداد پیوست کار سئو: فایل از `/api/admin/upload` می‌گذرد و اینجا
 * فقط آدرسش می‌چسبد. رویداد نمی‌سازد. حذف نرم است.
 */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission(["CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  if (!(await canSeeContentTask(id, guard.access))) {
    return NextResponse.json({ error: "به این کار دسترسی ندارید" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
  if (!url || !fileName) {
    return NextResponse.json({ error: "آدرس و نام فایل لازم است" }, { status: 400 });
  }
  if (!url.startsWith("/uploads/")) {
    return NextResponse.json({ error: "فایل باید از مسیر آپلود پنل بیاید" }, { status: 400 });
  }

  const task = await prisma.contentTask.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });

  const file = await prisma.contentTaskFile.create({
    data: {
      taskId: id,
      url,
      fileName,
      mimeType: typeof body?.mimeType === "string" ? body.mimeType : null,
      size: Number.isFinite(body?.size) ? Number(body.size) : null,
      uploadedById: guard.access.userId,
      uploadedByName: guard.access.name,
    },
    select: {
      id: true,
      url: true,
      fileName: true,
      mimeType: true,
      size: true,
      uploadedByName: true,
      createdAt: true,
    },
  });

  return NextResponse.json(serialize({ file }), { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const guard = await requirePermission(["CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const fileId = new URL(req.url).searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "شناسه‌ی فایل لازم است" }, { status: 400 });

  const file = await prisma.contentTaskFile.findFirst({
    where: { id: fileId, taskId: id, deletedAt: null },
    select: { id: true, uploadedById: true },
  });
  if (!file) return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });

  if (file.uploadedById !== guard.access.userId && !can(guard.access, "CONTENT_TASK_MANAGE")) {
    return NextResponse.json({ error: "فقط آپلودکننده یا مدیر" }, { status: 403 });
  }

  await prisma.contentTaskFile.update({
    where: { id: fileId },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
