import { NextResponse } from "next/server";
import { loadBaleConfig } from "@/lib/club/channels/bale";
import { handleBaleUpdate } from "@/lib/club/channels/bale-webhook";
import type { BotUpdate } from "@/lib/club/channels/botapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * وب‌هوک ربات بله
 *
 * ⚠️ **بله `secret_token` ندارد** (برخلاف تلگرام). تنها راه محافظت، غیرقابل
 *    حدس بودن خودِ آدرس است — رشته‌ی تصادفی در مسیر که در
 *    `StoreSettings.baleWebhookSecret` ذخیره می‌شود و فقط بله آن را می‌داند.
 *
 * ⚠️ همیشه ۲۰۰ برمی‌گرداند، حتی وقتی آپدیت را نمی‌فهمد. وب‌هوکی که خطا
 *    برگرداند باعث می‌شود ارائه‌دهنده همان آپدیت را بارها بفرستد.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ secret: string }> }
) {
  const { secret } = await params;
  const cfg = await loadBaleConfig();

  if (!cfg?.webhookSecret || secret !== cfg.webhookSecret) {
    // ۴۰۴ و نه ۴۰۳ — وجود داشتن یا نداشتن مسیر نباید لو برود
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const update = (await req.json().catch(() => null)) as BotUpdate | null;
  if (!update) return NextResponse.json({ ok: true });

  await handleBaleUpdate(update);

  return NextResponse.json({ ok: true });
}
