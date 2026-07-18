import { prisma } from "@/lib/prisma";
import { getProvider } from "./index";
import { normalizePhone } from "../phone";
import type { ProviderItemStatus, SendRequestStatus } from "./types";

/**
 * همگام‌سازی وضعیت با پنل
 *
 * پنل ایران پیامک webhook ندارد، پس هم وضعیت تحویل و هم پیام‌های دریافتی
 * باید به‌صورت دوره‌ای خوانده شوند.
 */

// ─── وضعیت تحویل ────────────────────────────────────────────────────

/** نگاشت وضعیت گیرنده در پنل به وضعیت داخلی */
function mapItemStatus(s: ProviderItemStatus): {
  status: "SENT" | "DELIVERED" | "FAILED" | null;
  optOut: boolean;
  error?: string;
} {
  switch (s) {
    case "delivered":
      return { status: "DELIVERED", optOut: false };
    case "sent":
      return { status: "SENT", optOut: false };
    case "blacklist":
      // مهم: شماره در لیست سیاه تبلیغاتی است. اگر ثبت نکنیم، هر کمپین
      // دوباره برایش هزینه می‌کند بدون اینکه پیامی برسد.
      return { status: "FAILED", optOut: true, error: "شماره در لیست سیاه تبلیغاتی" };
    case "delivery-failure":
      return { status: "FAILED", optOut: false, error: "عدم تحویل" };
    case "send-failure":
      return { status: "FAILED", optOut: false, error: "خطای ارسال" };
    case "system-error":
      return { status: "FAILED", optOut: false, error: "خطای سیستم پنل" };
    case "delivery-undetermined":
      // نامشخص — همان SENT بماند تا بار بعد دوباره بررسی شود
      return { status: null, optOut: false };
    default:
      // not-started / in-queue — هنوز نهایی نشده
      return { status: null, optOut: false };
  }
}

export interface SyncResult {
  requestId: number;
  requestStatus: SendRequestStatus | null;
  updated: number;
  delivered: number;
  failed: number;
  optedOut: number;
  finished: boolean;
}

/** همگام‌سازی یک درخواست ارسال */
export async function syncSendRequest(requestId: number): Promise<SyncResult> {
  const provider = getProvider();
  const result: SyncResult = {
    requestId,
    requestStatus: null,
    updated: 0,
    delivered: 0,
    failed: 0,
    optedOut: 0,
    finished: false,
  };

  const info = await provider.getSendRequest(requestId);
  if (!info) return result;

  result.requestStatus = info.status;

  // ── درخواست رد یا لغو شده ─────────────────────────────────────
  if (info.status === "rejected" || info.status === "cancelled" || info.status === "insufficient-balance") {
    const reason =
      info.status === "rejected"
        ? `رد شده توسط اپراتور${info.rejectedDue ? `: ${info.rejectedDue}` : ""}`
        : info.status === "cancelled"
          ? "لغو شده"
          : "اعتبار ناکافی";

    const { count } = await prisma.smsMessage.updateMany({
      where: { providerRequestId: requestId, status: { in: ["QUEUED", "SENT"] } },
      data: { status: "FAILED", errorMessage: reason, providerStatus: info.status },
    });

    result.updated = count;
    result.failed = count;
    result.finished = true;
    return result;
  }

  // هنوز در انتظار تأیید — فقط وضعیت پنل را ثبت کن
  if (info.status === "pending-approval" || info.status === "init") {
    await prisma.smsMessage.updateMany({
      where: { providerRequestId: requestId },
      data: { providerStatus: info.status },
    });
    return result;
  }

  // ── وضعیت تک‌تک گیرنده‌ها ─────────────────────────────────────
  const items = await provider.getDeliveryItems(requestId);
  if (items.length === 0) return result;

  const now = new Date();
  const optOutPhones: string[] = [];

  for (const item of items) {
    const phone = normalizePhone(item.mobile);
    if (!phone) continue;

    const mapped = mapItemStatus(item.status);
    if (!mapped.status) continue;

    const { count } = await prisma.smsMessage.updateMany({
      where: {
        providerRequestId: requestId,
        phone,
        // پیام‌هایی که قبلاً تحویل شده‌اند دوباره به‌روز نمی‌شوند
        status: { in: ["QUEUED", "SENT"] },
      },
      data: {
        status: mapped.status,
        providerStatus: info.status,
        errorMessage: mapped.error ?? null,
        ...(mapped.status === "DELIVERED" ? { deliveredAt: now } : {}),
      },
    });

    if (count > 0) {
      result.updated += count;
      if (mapped.status === "DELIVERED") result.delivered += count;
      if (mapped.status === "FAILED") result.failed += count;
    }

    if (mapped.optOut) optOutPhones.push(phone);
  }

  // ── ثبت شماره‌های لیست سیاه ───────────────────────────────────
  for (const phone of [...new Set(optOutPhones)]) {
    const created = await addOptOut(phone, "blacklist", "لیست سیاه پنل پیامک");
    if (created) result.optedOut++;
  }

  // آیا همه گیرنده‌ها به وضعیت نهایی رسیده‌اند؟
  const counts = info.counts;
  if (counts) {
    const pending = counts.notStarted + counts.inQueue;
    result.finished = info.status === "sent" && pending === 0;
  }

  return result;
}

/**
 * همگام‌سازی همه درخواست‌های ناتمام
 *
 * فقط پیام‌هایی بررسی می‌شوند که هنوز به وضعیت نهایی نرسیده‌اند و
 * حداکثر ۷ روز از ارسالشان گذشته است.
 */
export async function syncPendingDeliveries(limit = 30): Promise<SyncResult[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const pending = await prisma.smsMessage.groupBy({
    by: ["providerRequestId"],
    where: {
      providerRequestId: { not: null },
      status: { in: ["QUEUED", "SENT"] },
      queuedAt: { gte: weekAgo },
    },
    _min: { queuedAt: true },
    orderBy: { _min: { queuedAt: "asc" } },
    take: limit,
  });

  const results: SyncResult[] = [];

  for (const row of pending) {
    if (!row.providerRequestId) continue;
    try {
      results.push(await syncSendRequest(row.providerRequestId));
    } catch (err) {
      console.error(`[sms:sync] خطا در درخواست ${row.providerRequestId}:`, err);
    }
  }

  return results;
}

// ─── صندوق ورودی و لغو عضویت ────────────────────────────────────────

/** آیا این متن درخواست لغو است؟ */
export function isOptOutMessage(text: string, optOutText?: string | null): boolean {
  const normalized = text
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, "")
    .trim();

  if (!normalized) return false;

  // کلمه «لغو» در هر جای پیام
  if (normalized.includes("لغو")) return true;

  // عدد خالص مطابق با متن لغو تنظیم‌شده — مثلاً «11» برای «لغو۱۱»
  const configuredDigits = optOutText
    ?.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");

  if (configuredDigits && normalized === configuredDigits) return true;

  // عبارت‌های رایج انگلیسی
  if (/^(stop|off|unsubscribe|cancel)$/i.test(normalized)) return true;

  return false;
}

export interface InboxResult {
  scanned: number;
  optedOut: number;
  lastId: number | null;
}

/**
 * خواندن صندوق ورودی و پردازش درخواست‌های لغو
 *
 * از `smsInboxCursor` در تنظیمات استفاده می‌شود تا پیام‌های قبلی دوباره
 * پردازش نشوند.
 */
export async function pollInbox(maxPages = 5): Promise<InboxResult> {
  const provider = getProvider();

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { smsInboxCursor: true, smsOptOutText: true },
  });

  const cursor = settings?.smsInboxCursor ?? 0;
  const result: InboxResult = { scanned: 0, optedOut: 0, lastId: null };

  let highestId = cursor;

  for (let page = 1; page <= maxPages; page++) {
    const messages = await provider.getInbox(page, 100);
    if (messages.length === 0) break;

    let reachedCursor = false;

    for (const msg of messages) {
      // پیام‌ها از جدید به قدیم می‌آیند — به محض رسیدن به نشانگر، توقف
      if (msg.id <= cursor) {
        reachedCursor = true;
        break;
      }

      result.scanned++;
      if (msg.id > highestId) highestId = msg.id;

      if (!isOptOutMessage(msg.text, settings?.smsOptOutText)) continue;

      const phone = normalizePhone(msg.from);
      if (!phone) continue;

      const created = await addOptOut(phone, "sms_reply", msg.text.slice(0, 100));
      if (created) {
        result.optedOut++;
        console.log(`[sms:inbox] لغو عضویت: ${maskPhone(phone)}`);
      }
    }

    if (reachedCursor) break;
  }

  if (highestId > cursor) {
    await prisma.storeSettings.update({
      where: { id: "singleton" },
      data: { smsInboxCursor: highestId },
    });
    result.lastId = highestId;
  }

  return result;
}

/**
 * افزودن شماره به لیست لغو
 *
 * علاوه بر ثبت در `SmsOptOut`، رضایت پیامک در پروفایل باشگاه هم خاموش
 * می‌شود تا در پنل مشتری وضعیت درست دیده شود.
 */
export async function addOptOut(
  phone: string,
  source: "sms_reply" | "blacklist" | "admin" | "panel",
  reason?: string
): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  const existing = await prisma.smsOptOut.findUnique({ where: { phone: normalized } });
  if (existing) return false;

  await prisma.smsOptOut.create({
    data: { phone: normalized, source, reason: reason ?? null },
  });

  await prisma.clubProfile
    .updateMany({
      where: { user: { phone: normalized } },
      data: { smsConsent: false, consentAt: null },
    })
    .catch(() => {});

  return true;
}

/** حذف از لیست لغو — فقط توسط ادمین و با درخواست خود مشتری */
export async function removeOptOut(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  const { count } = await prisma.smsOptOut.deleteMany({ where: { phone: normalized } });
  return count > 0;
}

// ─── نهایی کردن کمپین‌ها ────────────────────────────────────────────

/** کمپین‌هایی که همه پیام‌هایشان پردازش شده را تمام‌شده علامت بزن */
export async function finalizeCampaigns(): Promise<number> {
  const running = await prisma.smsCampaign.findMany({
    where: { status: "RUNNING" },
    select: { id: true, totalCount: true, startedAt: true },
  });

  let finished = 0;

  for (const c of running) {
    const pending = await prisma.smsMessage.count({
      where: { campaignId: c.id, status: { in: ["QUEUED"] } },
    });

    const processed = await prisma.smsMessage.count({ where: { campaignId: c.id } });

    // تمام‌شده وقتی هیچ پیام در صفی نمانده و حداقل به تعداد گیرندگان ثبت شده
    const done = pending === 0 && processed >= c.totalCount;

    // یا اگر بیش از ۶ ساعت از شروع گذشته و چیزی در صف نیست
    const stale =
      pending === 0 &&
      c.startedAt !== null &&
      Date.now() - c.startedAt.getTime() > 6 * 3600 * 1000;

    if (done || stale) {
      await prisma.smsCampaign.update({
        where: { id: c.id },
        data: { status: "DONE", finishedAt: new Date() },
      });
      finished++;
    }
  }

  return finished;
}

function maskPhone(p: string): string {
  return `${p.slice(0, 4)}***${p.slice(7)}`;
}