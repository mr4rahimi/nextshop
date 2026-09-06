import { prisma } from "@/lib/prisma";
import { callBotApi, BotApiError, type BotApiConfig, type BotUser } from "./botapi";
import { sendViaSafir } from "./safir";
import { normalizePhone } from "../phone";
import type { MessageChannel, ChannelSendInput, ChannelSendResult } from "./types";

/**
 * کانال بله
 *
 * ⚠️ **بله متد ارسال دسته‌ای ندارد.** برخلاف پنل پیامک که یک درخواست برای صدها
 *    گیرنده می‌گیرد، اینجا هر پیام یک درخواست جداست. پس ارسال با محدودکننده‌ی
 *    نرخ و به‌صورت دسته‌های کوچک انجام می‌شود، نه همه با هم — وگرنه کمپین
 *    بزرگ با ۴۲۹ برمی‌گردد و نیمی از اعضا پیام نمی‌گیرند.
 *
 * ⚠️ توکن **اختصاصی هر کسب‌وکار** است و از دیتابیس خوانده می‌شود. متغیر محیطی
 *    فقط fallback توسعه‌ی لوکال است — دقیقاً الگوی `resolveApiKey()` پیامک.
 */

const API_BASE = "https://tapi.bale.ai";

/** سقف موازی‌کاری — محافظه‌کارانه، چون سهمیه‌ی API معمولی به تعامل کاربران بسته است */
const CONCURRENCY = 3;
/** فاصله‌ی بین دسته‌ها (میلی‌ثانیه) */
const BATCH_DELAY = 350;

export interface BaleConfig {
  token: string;
  username: string | null;
  webhookSecret: string | null;
  businessApi: boolean;
  /** کلید سفیر — ارسال با شماره تلفن بدون نیاز به `/start` */
  safirKey: string | null;
  safirEnabled: boolean;
  /** شناسه‌ی عددی ربات — بخش پیش از «:» در توکن */
  botId: number;
}

/**
 * خواندن تنظیمات ربات
 *
 * ⚠️ `?.trim() ||` و نه `??` — فیلدی که ادمین پر و بعد خالی کرده `""` است نه
 *    `null` و با `??` جلوی fallback را می‌گیرد. همان اشتباهی که یک بار روی
 *    `smsApiKey` تکرار شد.
 */
export async function loadBaleConfig(): Promise<BaleConfig | null> {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: {
      baleBotToken: true,
      baleBotUsername: true,
      baleWebhookSecret: true,
      baleBusinessApi: true,
      baleSafirKey: true,
      baleSafirEnabled: true,
    },
  });

  const token = s?.baleBotToken?.trim() || process.env.BALE_BOT_TOKEN?.trim() || "";
  if (!token) return null;

  const safirKey = s?.baleSafirKey?.trim() || process.env.BALE_SAFIR_KEY?.trim() || "";

  return {
    token,
    username: s?.baleBotUsername?.trim() || null,
    webhookSecret: s?.baleWebhookSecret?.trim() || null,
    businessApi: s?.baleBusinessApi ?? false,
    safirKey: safirKey || null,
    // بدون کلید، کلید روشن‌بودن هم بی‌معناست
    safirEnabled: Boolean(safirKey) && (s?.baleSafirEnabled ?? false),
    botId: Number(token.split(":")[0]) || 0,
  };
}

/**
 * آیا ارسال بدون `/start` ممکن است؟
 *
 * ⚠️ این تابع تعیین می‌کند چه کسانی «قابل دسترس در بله» حساب می‌شوند: با سفیر
 *    هر عضوی که شماره دارد، بدون آن فقط اعضای ربات.
 */
export async function isSafirActive(): Promise<boolean> {
  const cfg = await loadBaleConfig();
  return cfg?.safirEnabled ?? false;
}

export function apiConfigFor(cfg: BaleConfig): BotApiConfig {
  return {
    apiBase: API_BASE,
    token: cfg.token,
    // API کسب‌وکاری فقط مسیر `business` اضافه دارد؛ بقیه‌ی قرارداد یکسان است
    ...(cfg.businessApi ? { pathPrefix: "business" } : {}),
  };
}

/** تست توکن — نام و شناسه‌ی ربات */
export async function getBaleBotInfo(cfg: BaleConfig): Promise<BotUser> {
  return callBotApi<BotUser>(apiConfigFor(cfg), "getMe");
}

/** ارسال یک پیام مستقل از موتور کمپین — برای وب‌هوک و تست ادمین */
export async function sendBaleMessage(
  cfg: BaleConfig,
  chatId: string | number,
  text: string,
  extra?: Record<string, unknown>
) {
  return callBotApi(apiConfigFor(cfg), "sendMessage", {
    chat_id: chatId,
    text,
    ...extra,
  });
}

// ─── پیاده‌سازی قرارداد کانال ──────────────────────────────────────

export const baleChannel: MessageChannel = {
  channel: "BALE",
  title: "بله",

  async isAvailable() {
    return (await loadBaleConfig()) !== null;
  },

  async estimateUnitCost() {
    // API معمولی رایگان است؛ API کسب‌وکاری از اعتبار حساب کم می‌کند ولی
    // تعرفه‌اش را نمی‌دانیم. ۰ یعنی «برای مقایسه، ارزان‌ترین گزینه است».
    return 0;
  },

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const cfg = await loadBaleConfig();

    if (!cfg) {
      return {
        ok: false,
        sentCount: 0,
        failedCount: input.recipients.length,
        error: "توکن ربات بله در تنظیمات ثبت نشده است",
      };
    }

    const api = apiConfigFor(cfg);
    const reply_markup = input.extra?.replyMarkup;

    let sentCount = 0;
    let failedCount = 0;
    const dead: string[] = [];
    const permanentlyFailed: { profileId: string; reason: string }[] = [];
    let lastError: string | undefined;

    for (let i = 0; i < input.recipients.length; i += CONCURRENCY) {
      const batch = input.recipients.slice(i, i + CONCURRENCY);

      await Promise.all(
        batch.map(async (r) => {
          const text = renderVars(input.text, r.vars);

          // ⚠️ مقصد یا `chat_id` ربات است یا شماره‌ی موبایل. تشخیص از روی خودِ
          //    مقدار انجام می‌شود: `chat_id` هرگز شکل موبایل ایرانی ندارد.
          //    عضوی که `/start` زده از ربات (رایگان) پیام می‌گیرد، بقیه از
          //    سفیر (هزینه‌دار) — پس هرگز بی‌دلیل هزینه نمی‌دهیم.
          const asPhone = normalizePhone(r.destination);

          if (asPhone) {
            if (!cfg.safirEnabled) {
              failedCount++;
              lastError = "سفیر فعال نیست";
              permanentlyFailed.push({ profileId: r.profileId, reason: "سفیر فعال نیست" });
              return;
            }

            const result = await sendViaSafir({
              apiKey: cfg.safirKey!,
              botId: cfg.botId,
              phone: asPhone,
              text,
              ...(reply_markup ? { replyMarkup: reply_markup } : {}),
              // ⚠️ شناسه‌ی تکرارناپذیر بر پایه‌ی کمپین و عضو: اجرای دوباره‌ی
              //    همان دسته، پیام تکراری و هزینه‌ی دوباره نمی‌سازد.
              ...(typeof input.extra?.campaignId === "string"
                ? { requestId: `${input.extra.campaignId}:${r.profileId}` }
                : {}),
            });

            if (result.ok) {
              sentCount++;
              return;
            }

            failedCount++;
            lastError = result.error;
            if (result.permanent) {
              permanentlyFailed.push({ profileId: r.profileId, reason: result.error ?? "خطای دائمی" });
            }
            return;
          }

          try {
            await callBotApi(api, "sendMessage", {
              chat_id: r.destination,
              text,
              ...(reply_markup ? { reply_markup } : {}),
            });
            sentCount++;
          } catch (err) {
            failedCount++;

            if (err instanceof BotApiError) {
              lastError = err.message;
              // ⚠️ فقط «کاربر خارج شده» شناسه را می‌سوزاند. خطای شبکه یا سقف
              //    نرخ گذراست و نباید عضو سالم را از دسترس خارج کند.
              if (err.code === "BLOCKED") {
                dead.push(r.destination);
                permanentlyFailed.push({ profileId: r.profileId, reason: "کاربر از ربات خارج شده" });
              }
            } else {
              lastError = "ارسال ناموفق";
            }
          }
        })
      );

      if (i + CONCURRENCY < input.recipients.length) {
        await sleep(BATCH_DELAY);
      }
    }

    if (dead.length > 0) {
      await prisma.clubChannelIdentity
        .updateMany({
          where: { channel: "BALE", externalId: { in: dead } },
          data: { isActive: false },
        })
        .catch(() => {});
    }

    return {
      ok: sentCount > 0,
      sentCount,
      failedCount,
      ...(failedCount > 0 && lastError ? { error: lastError } : {}),
      ...(permanentlyFailed.length > 0 ? { permanentlyFailed } : {}),
    };
  },
};

// ─── کمکی‌ها ───────────────────────────────────────────────────────

/** جایگزینی `{name}` — همان نحوی که قالب‌های پیامک دارند */
function renderVars(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, key) => vars[key] ?? m);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
