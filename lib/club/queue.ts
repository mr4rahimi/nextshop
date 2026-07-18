import { Queue, JobsOptions } from "bullmq";
import { redis } from "@/lib/redis";

/**
 * تعریف صف‌های باشگاه مشتریان
 *
 * این فایل فقط «تولیدکننده» است — از سمت Next.js برای افزودن کار به صف
 * استفاده می‌شود. مصرف‌کننده‌ها (Worker) در پوشه `workers/` قرار دارند و
 * در پروسه‌ای جدا اجرا می‌شوند.
 */

export const QUEUE_NAMES = {
  SMS_SEND: "club:sms-send",
  SMS_STATUS: "club:sms-status",
  CLUB_CRON: "club:cron",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 5_000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

const globalForQueues = globalThis as unknown as {
  __clubQueues?: Map<string, Queue>;
};

const registry = globalForQueues.__clubQueues ?? new Map<string, Queue>();
if (process.env.NODE_ENV !== "production") globalForQueues.__clubQueues = registry;

function getQueue(name: QueueName): Queue {
  const existing = registry.get(name);
  if (existing) return existing;

  const q = new Queue(name, {
    connection: redis,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
  registry.set(name, q);
  return q;
}

export const smsSendQueue = () => getQueue(QUEUE_NAMES.SMS_SEND);
export const smsStatusQueue = () => getQueue(QUEUE_NAMES.SMS_STATUS);
export const clubCronQueue = () => getQueue(QUEUE_NAMES.CLUB_CRON);

// ─── انواع داده‌ی کارها ──────────────────────────────────────────────

/**
 * یک «دسته» پیامک — نه یک پیام تکی.
 * پنل ایران پیامک با `/ws/v1/sms/keywords` می‌تواند در یک درخواست
 * چند گیرنده با متغیرهای متفاوت را بفرستد، پس واحد کار «دسته» است.
 */
export interface SmsBatchJob {
  /** کلید قالب — برای لاگ و ردیابی */
  templateKey?: string;
  /** متن با متغیرهای %var% */
  text: string;
  /** خط ارسال — خدماتی یا تبلیغاتی */
  lineNumber: string;
  /** نوع پیام؛ روی نگهبان‌ها و انتخاب خط اثر می‌گذارد */
  kind: "TRANSACTIONAL" | "MARKETING";
  /** گیرنده‌ها به همراه متغیرهای شخصی هرکدام */
  recipients: { mobile: string; vars?: Record<string, string> }[];
  /** شناسه کمپین در صورت وجود */
  campaignId?: string;
  /** شناسه اتوماسیون در صورت وجود */
  automationId?: string;
}

export interface SmsStatusJob {
  /** شناسه درخواست ارسال که پنل برگردانده (فیلد data در پاسخ) */
  providerRequestIds: number[];
}

// ─── هلپرهای افزودن کار ─────────────────────────────────────────────

/**
 * افزودن یک دسته پیامک به صف.
 * `jobId` را همیشه یکتا و قابل بازتولید بدهید تا ارسال تکراری رخ ندهد.
 * مثال: `campaign:{campaignId}:{batchIndex}` یا `birthday:{1405-05-02}:{userId}`
 */
export async function enqueueSmsBatch(
  data: SmsBatchJob,
  opts: { jobId?: string; delay?: number } = {}
) {
  return smsSendQueue().add("send-batch", data, {
    jobId: opts.jobId,
    delay: opts.delay,
  });
}

export async function enqueueStatusCheck(data: SmsStatusJob, delayMs = 60_000) {
  return smsStatusQueue().add("check-status", data, { delay: delayMs });
}

/** بستن اتصال صف‌ها — در تست‌ها و اسکریپت‌ها لازم است */
export async function closeQueues() {
  await Promise.all([...registry.values()].map((q) => q.close()));
  registry.clear();
}
