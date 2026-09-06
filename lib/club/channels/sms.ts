import { resolveApiKey } from "../sms";
import { loadSmsConfig, pickLine, dispatchBatch } from "../sms";
import type { MessageChannel, ChannelSendInput, ChannelSendResult } from "./types";

/**
 * کانال پیامک
 *
 * پوسته‌ی نازکی روی `dispatchBatch()` موجود. عمداً منطق ارسال را تکرار نمی‌کند:
 * نگهبان‌ها (لغو عضویت، سقف ماهانه، ساعت مجاز)، ثبت در `SmsMessage` و افزودن
 * متن لغو همه آنجا هستند و باید یک جا بمانند.
 */
export const smsChannel: MessageChannel = {
  channel: "SMS",
  title: "پیامک",

  async isAvailable() {
    const [key, config] = await Promise.all([resolveApiKey(), loadSmsConfig()]);
    return Boolean(key) && Boolean(config.serviceLine || config.marketingLine);
  },

  async estimateUnitCost() {
    // تعرفه‌ی واقعی به خط و طول متن بستگی دارد؛ تخمین دقیق از
    // `/api/admin/sms/cost` گرفته می‌شود. اینجا فقط «رایگان نیست» را می‌گوید.
    return 1;
  },

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const config = await loadSmsConfig();
    const line = pickLine(config, input.kind);

    if (!line) {
      return {
        ok: false,
        sentCount: 0,
        failedCount: input.recipients.length,
        error:
          input.kind === "MARKETING"
            ? "خط تبلیغاتی در تنظیمات ثبت نشده است"
            : "خط خدماتی تنظیم نشده است",
      };
    }

    try {
      const result = await dispatchBatch({
        kind: input.kind,
        text: input.text,
        recipients: input.recipients.map((r) => ({
          phone: r.destination,
          userId: r.userId ?? null,
          vars: r.vars,
        })),
        ...(typeof input.extra?.templateKey === "string"
          ? { templateKey: input.extra.templateKey }
          : {}),
        ...(typeof input.extra?.campaignId === "string"
          ? { campaignId: input.extra.campaignId }
          : {}),
        ...(typeof input.extra?.automationId === "string"
          ? { automationId: input.extra.automationId }
          : {}),
      });

      return {
        ok: true,
        ...(result.requestId !== undefined ? { requestId: result.requestId } : {}),
        sentCount: result.sentCount,
        failedCount: 0,
      };
    } catch (err) {
      return {
        ok: false,
        sentCount: 0,
        failedCount: input.recipients.length,
        error: err instanceof Error ? err.message : "ارسال ناموفق",
      };
    }
  },
};
