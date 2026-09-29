import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getJob } from "@/lib/ai/image-jobs";

export const runtime = "nodejs";

/** وضعیت یک کار ساخت تصویر — docs/features/ai-product-image.md */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const { id } = await params;
  const job = getJob(id, user.id);
  if (!job) {
    return NextResponse.json({
      error: "این کار پیدا نشد — احتمالاً سرور ری‌استارت شده. دوباره بسازید.",
    }, { status: 404 });
  }

  return NextResponse.json(
    { status: job.status, image: job.image, error: job.error, usage: job.usage },
    { headers: { "Cache-Control": "no-store" } },
  );
}
