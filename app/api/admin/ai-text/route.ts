import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getAiSettings } from "@/lib/ai/settings";
import { imageToDataUrl } from "@/lib/ai/product-text";
import { startTextJob, runningTextJobs } from "@/lib/ai/text-jobs";
import { AI_TEXT_SECTIONS, type AiTextSection } from "@/lib/ai/text-presets";

export const runtime = "nodejs";

/**
 * نوشتن متن محصول با هوش مصنوعی — docs/features/ai-product-text.md
 *
 * GET  → آماده بودن و مدل؛ کلید هرگز برنمی‌گردد.
 * POST → (multipart) یک کار شروع می‌کند و فوراً شناسه‌اش را می‌دهد؛
 *        وضعیت از `/api/admin/ai-text/<id>` پرسیده می‌شود.
 */

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SECTION_VALUES = new Set(AI_TEXT_SECTIONS.map(s => s.value));

export async function GET() {
  const s = await getAiSettings();
  return NextResponse.json({ ready: !!s.apiKey, model: s.textModel });
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
  const text = (k: string, max: number) => String(data.get(k) ?? "").trim().slice(0, max);

  // عکس: فایل تازه یا نشانی یکی از تصاویر فعلی محصول
  let image: string | null = null;
  const file = data.get("image");
  if (file instanceof Blob && file.size) {
    if (!INPUT_TYPES.has(file.type)) return NextResponse.json({ error: "فرمت تصویر باید JPG، PNG یا WebP باشد." }, { status: 400 });
    if (file.size > MAX_INPUT_BYTES) return NextResponse.json({ error: "حجم تصویر بیش از ۸ مگابایت است." }, { status: 400 });
    image = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  } else if (text("imageUrl", 1000)) {
    image = await imageToDataUrl(text("imageUrl", 1000));
  }

  let sections: AiTextSection[] = [];
  let specItems: { id: string; title: string; value?: string }[] = [];
  try {
    sections = (JSON.parse(text("sections", 500) || "[]") as string[]).filter((x): x is AiTextSection => SECTION_VALUES.has(x as AiTextSection));
    specItems = (JSON.parse(text("specItems", 20000) || "[]") as { id: string; title: string; value?: string }[])
      .filter(x => x && typeof x.id === "string" && typeof x.title === "string").slice(0, 80);
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  if (!sections.length) return NextResponse.json({ error: "دست‌کم یک بخش را انتخاب کنید." }, { status: 400 });

  const notes = text("notes", 3000);
  const title = text("title", 200);
  if (!image && !notes && !title) {
    return NextResponse.json({ error: "عکس یا چند مشخصه از محصول بدهید تا هوش مصنوعی چیزی برای نوشتن داشته باشد." }, { status: 400 });
  }

  if (runningTextJobs(user.id, "single") >= 2) {
    return NextResponse.json({ error: "هنوز نوشتن متن قبلی تمام نشده. کمی صبر کنید." }, { status: 429 });
  }

  const job = startTextJob({
    userId: user.id,
    actor: { id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.phone || "بدون نام", phone: user.phone ?? null },
    input: {
      title, notes, image, sections, specItems,
      categoryId: text("categoryId", 50) || null,
      brandId: text("brandId", 50) || null,
    },
  });
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
