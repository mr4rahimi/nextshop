import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { logActivityAsync } from "@/lib/activity";
import type { AiImagePreset, AiImageQuality } from "@/lib/ai/image-presets";
import { getAiSettings, getAiSettingsForClient, saveAiSettings, GAPGPT_BASE_URL } from "@/lib/ai/settings";

export const runtime = "nodejs";

/**
 * تنظیمات هوش مصنوعی — docs/features/ai-product-image.md
 * کلید فقط پوشیده برمی‌گردد؛ PUT کلید را فقط با مقدار تازه عوض می‌کند.
 * POST یعنی «تست اتصال»: فهرست مدل‌ها را می‌گیرد و هزینه‌ای ندارد.
 */

export async function GET() {
  return NextResponse.json(await getAiSettingsForClient(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }
  await saveAiSettings({
    apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
    clearKey: body.clearKey === true,
    imageModel: typeof body.imageModel === "string" ? body.imageModel : undefined,
    imageQuality: body.imageQuality as AiImageQuality | undefined,
    imagePresets: Array.isArray(body.imagePresets) ? (body.imagePresets as AiImagePreset[]) : undefined,
  });
  logActivityAsync({
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "ai-settings",
    entityTitle: "تنظیمات هوش مصنوعی",
    summary: "تنظیمات هوش مصنوعی ذخیره شد",
  });
  return NextResponse.json(await getAiSettingsForClient());
}

export async function POST() {
  const s = await getAiSettings();
  if (!s.apiKey) return NextResponse.json({ ok: false, error: "کلیدی تنظیم نشده است." });
  try {
    const res = await fetch(`${GAPGPT_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${s.apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401) return NextResponse.json({ ok: false, error: "کلید نامعتبر است." });
    if (!res.ok) return NextResponse.json({ ok: false, error: `پاسخ GapGPT: کد ${res.status}` });
    const ids: string[] = ((await res.json())?.data ?? []).map((m: { id: string }) => m.id);
    return NextResponse.json({ ok: true, imageModelAvailable: ids.includes(s.imageModel) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `اتصال به GapGPT برقرار نشد (${e instanceof Error ? e.message : "خطا"})` });
  }
}
