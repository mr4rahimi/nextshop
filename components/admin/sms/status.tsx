/**
 * ترجمه‌ی وضعیت‌های پنل به فارسی
 *
 * ⚠️ وضعیت‌های پنل انگلیسی و فنی‌اند (`insufficient-balance`,
 *    `pending-approval`, ...). نمایش خامشان به ادمین یعنی او باید حدس بزند
 *    ارسالش چه شد. فهرست از خروجی واقعی پنل جمع شده؛ ناشناخته‌ها خام می‌مانند.
 */

const LABELS: Record<string, string> = {
  init: "در انتظار شروع",
  queued: "در صف",
  "in-queue": "در صف",
  sending: "در حال ارسال",
  sent: "ارسال شد",
  delivered: "تحویل شد",
  done: "تمام‌شده",
  finished: "تمام‌شده",
  canceled: "لغو شد",
  cancelled: "لغو شد",
  rejected: "رد شد",
  failed: "ناموفق",
  "send-failure": "ارسال ناموفق",
  "delivery-failure": "تحویل نشد",
  "delivery-undetermined": "تحویل نامشخص",
  "not-started": "شروع نشده",
  "pending-approval": "منتظر تأیید اپراتور",
  "insufficient-balance": "اعتبار کافی نبود",
  blacklist: "در لیست سیاه",
  "system-error": "خطای سامانه",
  active: "فعال",
  pending: "در انتظار بررسی",
};

const BAD = new Set([
  "failed",
  "rejected",
  "send-failure",
  "delivery-failure",
  "insufficient-balance",
  "blacklist",
  "system-error",
  "canceled",
  "cancelled",
]);

const WARN = new Set([
  "pending-approval",
  "pending",
  "delivery-undetermined",
  "not-started",
  "init",
]);

const OK = new Set(["sent", "delivered", "done", "finished", "active"]);

export function statusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function statusTone(status: string): "ok" | "warn" | "bad" | "muted" {
  if (BAD.has(status)) return "bad";
  if (WARN.has(status)) return "warn";
  if (OK.has(status)) return "ok";
  return "muted";
}
