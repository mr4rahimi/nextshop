/**
 * تنظیمات هوش مصنوعی فروشگاه — docs/features/ai-product-image.md
 *
 * هر فروشگاه کلید GapGPT خودش را دارد و روی `StoreSettings.aiSettings` ذخیره
 * می‌شود. کلید قدیمی چت (`chatSettings.gapgptApiKey`) هنوز به‌عنوان جایگزین
 * خوانده می‌شود تا سایت‌هایی که قبلاً فقط آنجا کلید گذاشته‌اند از کار نیفتند.
 *
 * ⚠️ کلید کامل هیچ‌وقت به مرورگر برنمی‌گردد — فقط `maskKey`.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PRESETS,
  type AiImagePreset, type AiImageQuality,
} from "@/lib/ai/image-presets";

export const GAPGPT_BASE_URL = "https://api.gapgpt.app/v1";

export interface AiSettings {
  apiKey: string;
  imageModel: string;
  imageQuality: AiImageQuality;
  imagePresets: AiImagePreset[];
}

const QUALITIES: AiImageQuality[] = ["low", "medium", "high"];

async function loadRaw() {
  const row = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { aiSettings: true, chatSettings: true },
  });
  return {
    ai: (row?.aiSettings as Partial<AiSettings> | null) ?? {},
    chat: (row?.chatSettings as { gapgptApiKey?: string } | null) ?? {},
  };
}

function normalize(ai: Partial<AiSettings>): Omit<AiSettings, "apiKey"> {
  const presets = Array.isArray(ai.imagePresets)
    ? ai.imagePresets.filter(p => p && p.id && p.label?.trim() && p.prompt?.trim())
    : [];
  return {
    imageModel: ai.imageModel?.trim() || DEFAULT_IMAGE_MODEL,
    imageQuality: QUALITIES.includes(ai.imageQuality as AiImageQuality)
      ? (ai.imageQuality as AiImageQuality) : "medium",
    imagePresets: presets.length ? presets : DEFAULT_IMAGE_PRESETS,
  };
}

/** کلید مؤثر: تنظیمات هوش مصنوعی ← کلید قدیمی چت ← متغیر محیطی */
function pickKey(ai: Partial<AiSettings>, chat: { gapgptApiKey?: string }) {
  return ai.apiKey?.trim() || chat.gapgptApiKey?.trim() || process.env.GAPGPT_API_KEY?.trim() || "";
}

export async function getAiSettings(): Promise<AiSettings> {
  const { ai, chat } = await loadRaw();
  return { apiKey: pickKey(ai, chat), ...normalize(ai) };
}

/** همان منطق کلید، برای مسیرهایی که chatSettings را خودشان خوانده‌اند (مثل چت) */
export async function resolveGapgptKey(): Promise<string> {
  const { ai, chat } = await loadRaw();
  return pickKey(ai, chat);
}

/** نسخه‌ی قابل‌نمایش برای پنل: کلید پوشیده + این‌که از کجا آمده */
export async function getAiSettingsForClient() {
  const { ai, chat } = await loadRaw();
  const source = ai.apiKey?.trim() ? "ai" : chat.gapgptApiKey?.trim() ? "chat"
    : process.env.GAPGPT_API_KEY?.trim() ? "env" : "none";
  return { ...normalize(ai), apiKeyMasked: maskKey(pickKey(ai, chat)), keySource: source };
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "••••";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

/**
 * ذخیره. `apiKey` فقط وقتی عوض می‌شود که مقدار تازه‌ای فرستاده شود؛
 * رشته‌ی خالی یا شکل پوشیده یعنی «دست نزن». برای پاک کردن `clearKey`.
 */
export async function saveAiSettings(input: Partial<AiSettings> & { clearKey?: boolean }) {
  const { ai } = await loadRaw();
  const incomingKey = input.apiKey?.trim() ?? "";
  const keyChanged = incomingKey && !incomingKey.includes("…") && !incomingKey.includes("•");
  const next = {
    ...normalize({ ...ai, ...input }),
    apiKey: input.clearKey ? "" : keyChanged ? incomingKey : ai.apiKey?.trim() ?? "",
  };
  await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: { aiSettings: next as unknown as Prisma.InputJsonValue },
    create: { id: "singleton", aiSettings: next as unknown as Prisma.InputJsonValue },
  });
}
