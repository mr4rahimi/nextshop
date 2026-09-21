import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import {
  transitionSeoTask,
  reviewSeoTask,
  canSeeSeoTask,
} from "@/lib/marketing/seo-task-service";
import { SEO_ACTIONS, type SeoAction } from "@/lib/marketing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const REVIEW_OUTCOMES = ["EFFECTIVE", "PARTIAL", "INEFFECTIVE"] as const;
type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

/**
 * اندپوینتِ **یکتای** انتقال وضعیت.
 *
 * ⚠️ عمداً یکی است، نه شش روت جدا. هر روت جدا یعنی یک جای دیگر که ممکن است
 * یادمان برود رویداد یا اعلان بسازیم — و همان‌جاست که گزارش‌ها دروغ می‌شوند.
 *
 * `action: "review"` استثناست: وضعیت را عوض نمی‌کند و فقط نتیجه‌ی بررسی را
 * ثبت می‌کند. اینجا نشسته چون از همان دکمه‌های کارت زده می‌شود و سرویسش هم
 * همان رویداد را می‌سازد.
 */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission(["SEO_TASK_WORK", "SEO_TASK_MANAGE"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  if (!(await canSeeSeoTask(id, guard.access))) {
    return NextResponse.json({ error: "به این کار دسترسی ندارید" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = body?.action;
    const note = typeof body?.note === "string" ? body.note : null;

    if (action === "review") {
      const outcome = body?.outcome;
      if (!REVIEW_OUTCOMES.includes(outcome)) {
        return NextResponse.json({ error: "نتیجه‌ی بررسی معتبر نیست" }, { status: 400 });
      }
      const task = await reviewSeoTask(id, outcome as ReviewOutcome, note, guard.access);
      return NextResponse.json(serialize({ task }));
    }

    if (!SEO_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "کنش نامعتبر است" }, { status: 400 });
    }

    const task = await transitionSeoTask(id, action as SeoAction, note, guard.access);
    return NextResponse.json(serialize({ task }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
