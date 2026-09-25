import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import {
  transitionContentTask,
  canSeeContentTask,
} from "@/lib/marketing/content-task-service";
import { CONTENT_ACTIONS, type ContentAction } from "@/lib/marketing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * اندپوینتِ **یکتای** انتقال وضعیت کار محتوا.
 *
 * ⚠️ عمداً یکی است، نه هشت روت: هر روت جدا یعنی یک جای دیگر که ممکن است
 * رویداد یا اعلانش جا بماند. نقش (نویسنده، محتواگذار، مدیر) را سرویس چک
 * می‌کند، نه اینجا.
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

  try {
    const body = await req.json();
    const action = body?.action;
    if (!CONTENT_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "کنش نامعتبر است" }, { status: 400 });
    }

    const task = await transitionContentTask(
      id,
      action as ContentAction,
      {
        note: typeof body?.note === "string" ? body.note : null,
        publishedUrl: typeof body?.publishedUrl === "string" ? body.publishedUrl : null,
        toWriter: body?.toWriter === true,
      },
      guard.access,
    );
    return NextResponse.json(serialize({ task }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
