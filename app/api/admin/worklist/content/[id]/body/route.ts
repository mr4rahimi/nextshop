import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { canSeeContentTask } from "@/lib/marketing/content-task-service";
import { saveContentBody } from "@/lib/marketing/content-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** سقف متن — جلوی چسباندن تصادفیِ فایل base64 عظیم را می‌گیرد */
const MAX_HTML = 2_000_000;

/**
 * ذخیره‌ی متن — دستی و خودکار **از همین یک مسیر** (بخش ۶.۳).
 *
 * ⚠️ رویداد نمی‌سازد و اعلان نمی‌دهد (تله‌ی ۱۰). `keepalive` کلاینت هنگام
 * بستن تب هم همین را صدا می‌زند، پس پاسخ باید سبک بماند.
 */
export async function PUT(req: Request, { params }: Params) {
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
    const html = typeof body?.html === "string" ? body.html : null;
    if (html === null) return NextResponse.json({ error: "متن نیامد" }, { status: 400 });
    if (html.length > MAX_HTML) {
      return NextResponse.json(
        { error: "متن بیش از حد بزرگ است — عکس را آپلود کنید، نه اینکه در متن بچسبانید" },
        { status: 413 },
      );
    }
    const result = await saveContentBody(id, html, guard.access);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
