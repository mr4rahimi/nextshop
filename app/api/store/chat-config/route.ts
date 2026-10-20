import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatSuggestions } from "@/lib/shop-chat/suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تنظیمات ویجت چت. `?path=` صفحه‌ی فعلی است تا دکمه‌های پیشنهادی خودکار همان صفحه
 * ساخته شوند (docs/plans/storefront-chat.md فاز ۲). `buttonsMode`: «auto» پیش‌فرض است؛
 * «custom» یعنی منوی دستی تنظیمات چت (`flow`).
 */
export async function GET(req: Request) {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { chatSettings: true },
  });

  const cfg = (settings?.chatSettings as Record<string, unknown>) ?? {};
  const flow = Array.isArray(cfg.flow) ? cfg.flow : [];
  const buttonsMode = cfg.buttonsMode === "custom" && flow.length > 0 ? "custom" : "auto";
  const path = new URL(req.url).searchParams.get("path")?.slice(0, 300) ?? null;

  return NextResponse.json({
    isEnabled: cfg.isEnabled ?? true,
    welcomeMessage:
      cfg.welcomeMessage ?? "سلام! من دستیار خرید این فروشگاه هستم. چطور می‌تونم کمکت کنم؟",
    buttonsMode,
    flow: buttonsMode === "custom" ? flow : [],
    suggestions: buttonsMode === "auto" ? await chatSuggestions(path).catch(() => []) : [],
  });
}
