import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getAiSettings } from "@/lib/ai/settings";
import { startImageEdit, runningCount } from "@/lib/ai/image-jobs";
import { buildImagePrompt, AI_IMAGE_QUALITIES, type AiImageQuality } from "@/lib/ai/image-presets";

export const runtime = "nodejs";

/**
 * استودیو تصویر هوش مصنوعی — docs/features/ai-product-image.md
 *
 * GET  → آماده بودن (کلید دارد یا نه) و حالت‌های آماده؛ کلید هرگز برنمی‌گردد.
 * POST → یک کار ویرایش تصویر شروع می‌کند و فوراً شناسه‌اش را می‌دهد.
 *        وضعیت از `/api/admin/ai-image/<id>` پرسیده می‌شود.
 */

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_RUNNING_PER_USER = 2;
const MAX_PROMPT_CHARS = 1500;

export async function GET() {
  const s = await getAiSettings();
  return NextResponse.json({
    ready: !!s.apiKey,
    model: s.imageModel,
    quality: s.imageQuality,
    presets: s.imagePresets,
    qualities: AI_IMAGE_QUALITIES,
  });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const s = await getAiSettings();
  if (!s.apiKey) {
    return NextResponse.json({
      error: "کلید GapGPT تنظیم نشده. از «تنظیمات ← تنظیمات هوش مصنوعی» کلید را وارد کنید.",
    }, { status: 400 });
  }

  let data: FormData;
  try { data = await req.formData(); } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const image = data.get("image");
  if (!(image instanceof Blob) || !image.size) {
    return NextResponse.json({ error: "تصویر محصول ارسال نشده است." }, { status: 400 });
  }
  if (!INPUT_TYPES.has(image.type)) {
    return NextResponse.json({ error: "فرمت تصویر باید JPG، PNG یا WebP باشد." }, { status: 400 });
  }
  if (image.size > MAX_INPUT_BYTES) {
    return NextResponse.json({ error: "حجم تصویر ارسالی بیش از ۸ مگابایت است." }, { status: 400 });
  }

  const presetId = String(data.get("presetId") || "");
  const custom = String(data.get("prompt") || "").trim().slice(0, MAX_PROMPT_CHARS);
  const preset = s.imagePresets.find(p => p.id === presetId);
  const basePrompt = custom || preset?.prompt;
  if (!basePrompt) {
    return NextResponse.json({ error: "یک حالت آماده انتخاب کنید یا پرامپت بنویسید." }, { status: 400 });
  }

  const q = String(data.get("quality") || "");
  const quality: AiImageQuality = (["low", "medium", "high"] as const).includes(q as AiImageQuality)
    ? (q as AiImageQuality) : s.imageQuality;

  if (runningCount(user.id) >= MAX_RUNNING_PER_USER) {
    return NextResponse.json({ error: "هنوز ساخت تصویر قبلی تمام نشده. کمی صبر کنید." }, { status: 429 });
  }

  const actorName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.phone || "بدون نام";
  const styleLabel = custom ? "پرامپت دلخواه" : preset!.label;

  const job = startImageEdit({
    userId: user.id,
    apiKey: s.apiKey,
    model: s.imageModel,
    prompt: buildImagePrompt(basePrompt),
    quality,
    image,
    // ثبت مصرف — کوکی در پس‌زمینه دیگر خوانده نمی‌شود، پس نام از همین‌جا
    onDone: (j) => {
      if (j.status !== "done") return;
      void logActivity({
        action: "CREATE",
        entity: "MEDIA",
        entityId: j.id,
        entityTitle: "تصویر هوش مصنوعی",
        summary: `تصویر با هوش مصنوعی ساخته شد — «${styleLabel}»، مدل ${s.imageModel}، کیفیت ${quality}، ` +
                 `هزینه‌ی تقریبی ${j.usage?.costUsd.toFixed(3)} دلار`,
        actor: { id: user.id, name: actorName, phone: user.phone ?? null },
      });
    },
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
