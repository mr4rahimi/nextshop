import { Queue, JobsOptions } from "bullmq";
import { redis } from "../redis";


export const QUEUE_NAMES = {
  SMS_SEND:   "sms-send",
  SMS_STATUS: "sms-status",
  CLUB_CRON:  "cron",
} as const;

export const QUEUE_PREFIX = "club";

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * ساخت jobId یکتا و قابل بازتولید
 *
 * BullMQ کاراکتر `:` را در jobId نمی‌پذیرد، پس جداکننده `-` است.
 * بخش‌های نامعتبر خودکار پاک‌سازی می‌شوند.
 *
 * makeJobId("birthday", "1405-05-02", userId) → "birthday-1405-05-02-cm3x9..."
 */
export function makeJobId(...parts: (string | number)[]): string {
  return parts
    .map((p) => String(p).replace(/[:\s]/g, "-"))
    .filter(Boolean)
    .join("-");
}

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
    prefix: QUEUE_PREFIX,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
  registry.set(name, q);
  return q;
}

export const smsSendQueue = () => getQueue(QUEUE_NAMES.SMS_SEND);
export const smsStatusQueue = () => getQueue(QUEUE_NAMES.SMS_STATUS);
export const clubCronQueue = () => getQueue(QUEUE_NAMES.CLUB_CRON);

export interface SmsBatchJob {
  templateKey?: string;
  text: string;
  lineNumber?: string;                  
  kind: "TRANSACTIONAL" | "MARKETING";
  recipients: {
    mobile: string;
    userId?: string | null;               
    vars?: Record<string, string>;
  }[];
  campaignId?: string;
  automationId?: string;
}

export interface SmsStatusJob {
  providerRequestIds: number[];
}

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

export async function closeQueues() {
  await Promise.all([...registry.values()].map((q) => q.close()));
  registry.clear();
}
