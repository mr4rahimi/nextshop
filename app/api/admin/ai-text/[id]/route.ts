import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getTextJob, cancelTextJob } from "@/lib/ai/text-jobs";

export const runtime = "nodejs";

/** وضعیت کار نوشتن متن (تکی یا گروهی) — docs/features/ai-product-text.md */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;
  const job = getTextJob(id, user.id);
  if (!job) return NextResponse.json({ error: "کار پیدا نشد (شاید سرور ری‌استارت شده). دوباره امتحان کنید." }, { status: 404 });
  const { userId: _u, ...rest } = job;
  return NextResponse.json(rest, { headers: { "Cache-Control": "no-store" } });
}

/** لغو تولید گروهی — محصولِ در حال نوشتن تمام می‌شود، بقیه رد می‌شوند */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ ok: cancelTextJob(id, user.id) });
}
