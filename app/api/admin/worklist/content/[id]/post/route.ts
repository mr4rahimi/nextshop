import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { canSeeContentTask } from "@/lib/marketing/content-task-service";
import { updateContentPost } from "@/lib/marketing/content-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * مشخصات مقاله‌ی کار (عنوان، نامک، خلاصه، کاور، دسته، متای سئو).
 *
 * ⚠️ مسیر جدا از `/api/admin/blog` است چون آن مسیر `PANEL_CONTENT` می‌خواهد
 * و محتواگذار نباید برای انتشار کل مجله و سئوی سایت را هم ببیند (بخش ۴،
 * قاعده‌ی ۳). نقش را سرویس چک می‌کند.
 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission(["CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  if (!(await canSeeContentTask(id, guard.access))) {
    return NextResponse.json({ error: "به این کار دسترسی ندارید" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const post = await updateContentPost(id, body ?? {}, guard.access);
    return NextResponse.json(serialize({ post }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
