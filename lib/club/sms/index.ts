import { prisma } from "@/lib/prisma";
import { IranPayamakProvider } from "./providers/iranpayamak";
import { applyGuards, loadGuardSettings, type GuardCandidate } from "./guards";
import { appendOptOut, toProviderSyntax, renderTemplate } from "./render";
import type { SmsProvider, Recipient } from "./types";
import type { SmsKind } from "@prisma/client";

const DRY_RUN = process.env.CLUB_SMS_DRY_RUN === "1";

/**
 * نمای بیرونی موتور پیامک
 *
 * صفحات و Worker فقط با این فایل کار می‌کنند، نه مستقیم با درایور.
 */

let cached: SmsProvider | null = null;

export function getProvider(): SmsProvider {
  if (cached) return cached;

  const apiKey = process.env.IRANPAYAMAK_API_KEY ?? "";
  if (!apiKey) throw new Error("IRANPAYAMAK_API_KEY تنظیم نشده است");

  cached = new IranPayamakProvider(apiKey);
  return cached;
}

export interface SmsConfig {
  serviceLine: string;
  marketingLine: string;
  optOutText: string | null;
  storeName: string;
}

/** خواندن پیکربندی از StoreSettings با fallback به متغیرهای محیطی */
export async function loadSmsConfig(): Promise<SmsConfig> {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: {
      smsLineNumber: true,
      smsMarketingLine: true,
      smsOptOutText: true,
      storeName: true,
    },
  });

  const serviceLine =
    s?.smsLineNumber?.trim() || process.env.IRANPAYAMAK_LINE_NUMBER || "";

  return {
    serviceLine,
    // اگر خط تبلیغاتی تنظیم نشده، از خط خدماتی استفاده نکن — عمداً خالی می‌ماند
    marketingLine: s?.smsMarketingLine?.trim() || "",
    optOutText: s?.smsOptOutText ?? null,
    storeName: s?.storeName ?? "فروشگاه",
  };
}

/** انتخاب خط بر اساس نوع پیام */
export function pickLine(config: SmsConfig, kind: SmsKind): string {
  return kind === "MARKETING" ? config.marketingLine : config.serviceLine;
}

export interface DispatchInput {
  kind: SmsKind;
  /** متن با نحو {name} */
  text: string;
  recipients: { phone: string; userId?: string | null; vars?: Record<string, string> }[];
  templateKey?: string;
  campaignId?: string;
  automationId?: string;
  /** رد کردن نگهبان‌ها — فقط برای ارسال تست ادمین */
  skipGuards?: boolean;
}

export interface DispatchResult {
  requestId?: number;
  sentCount: number;
  skippedCount: number;
  failed?: string;
}

/**
 * ارسال یک دسته پیامک به‌همراه اعمال نگهبان‌ها و ثبت کامل در SmsMessage
 *
 * این تابع در Worker صدا زده می‌شود، نه در چرخه درخواست HTTP.
 */
export async function dispatchBatch(input: DispatchInput): Promise<DispatchResult> {
  const config = await loadSmsConfig();
  const line = pickLine(config, input.kind);

  if (!line) {
    throw new Error(
      input.kind === "MARKETING"
        ? "خط تبلیغاتی در تنظیمات فروشگاه ثبت نشده است"
        : "خط خدماتی تنظیم نشده است"
    );
  }

  // ── نگهبان‌ها ──────────────────────────────────────────────────
  const varsByPhone = new Map(
    input.recipients.map((r) => [r.phone, r.vars ?? {}])
  );

  let allowed: GuardCandidate[];
  let skipped: { phone: string; userId?: string | null; reason: string }[] = [];

  if (input.skipGuards) {
    allowed = input.recipients.map((r) => ({ phone: r.phone, userId: r.userId }));
  } else {
    const settings = await loadGuardSettings();
    const result = await applyGuards(
      input.recipients.map((r) => ({ phone: r.phone, userId: r.userId })),
      input.kind,
      settings
    );
    allowed = result.allowed;
    skipped = result.skipped;
  }

  // ── ثبت رد‌شده‌ها ──────────────────────────────────────────────
  if (skipped.length > 0) {
    await prisma.smsMessage.createMany({
      data: skipped.map((s) => ({
        userId: s.userId ?? null,
        phone: s.phone,
        campaignId: input.campaignId ?? null,
        automationId: input.automationId ?? null,
        templateKey: input.templateKey ?? null,
        kind: input.kind,
        lineNumber: line,
        status: "SKIPPED" as const,
        skipReason: s.reason,
      })),
    });
  }

  if (allowed.length === 0) {
    return { sentCount: 0, skippedCount: skipped.length };
  }

  // ── آماده‌سازی متن ─────────────────────────────────────────────
  const withStore = input.text.replace(/\{store\}/g, config.storeName);
  const finalText =
    input.kind === "MARKETING"
      ? appendOptOut(withStore, config.optOutText)
      : withStore;

  // ── ارسال ──────────────────────────────────────────────────────

  // ── حالت آزمایشی ───────────────────────────────────────────────
  if (DRY_RUN) {
    console.log(
      `[sms:dry-run] ${allowed.length} گیرنده — خط ${line} — «${finalText.slice(0, 60)}»`
    );

    await prisma.smsMessage.createMany({
      data: allowed.map((c) => ({
        userId: c.userId ?? null,
        phone: c.phone,
        campaignId: input.campaignId ?? null,
        automationId: input.automationId ?? null,
        templateKey: input.templateKey ?? null,
        kind: input.kind,
        lineNumber: line,
        body: renderTemplate(finalText, varsByPhone.get(c.phone) ?? {}),
        status: "SKIPPED" as const,
        skipReason: "DRY_RUN",
      })),
    });

    return { sentCount: 0, skippedCount: skipped.length + allowed.length };
  }

  const provider = getProvider();

  const recipients: Recipient[] = allowed.map((c) => ({
    mobile: c.phone,
    vars: varsByPhone.get(c.phone),
  }));

  const hasVars = /\{(\w+)\}/.test(finalText);

  const result = hasVars
    ? await provider.sendKeywords(line, toProviderSyntax(finalText), recipients)
    : await provider.sendSimple(
        line,
        finalText,
        recipients.map((r) => r.mobile)
      );

  // ── ثبت نتیجه ──────────────────────────────────────────────────
  const now = new Date();

  await prisma.smsMessage.createMany({
    data: allowed.map((c) => ({
      userId: c.userId ?? null,
      phone: c.phone,
      campaignId: input.campaignId ?? null,
      automationId: input.automationId ?? null,
      templateKey: input.templateKey ?? null,
      kind: input.kind,
      lineNumber: line,
      // متن نهایی هر گیرنده برای گزارش
      body: renderTemplate(finalText, varsByPhone.get(c.phone) ?? {}),
      providerRequestId: result.requestId ?? null,
      providerStatus: result.requestStatus ?? null, 
      status: result.ok ? ("SENT" as const) : ("FAILED" as const),
      errorMessage: result.ok ? null : result.error ?? "ارسال ناموفق",
      sentAt: result.ok ? now : null,
    })),
  });

  if (!result.ok) {
    // throw تا BullMQ دوباره تلاش کند
    throw new Error(result.error ?? "ارسال ناموفق");
  }

  return {
    requestId: result.requestId,
    sentCount: allowed.length,
    skippedCount: skipped.length,
  };
}

export { applyGuards, loadGuardSettings } from "./guards";
export * from "./render";
export type { SmsProvider } from "./types";