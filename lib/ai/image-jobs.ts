/**
 * کارهای ساخت تصویر با هوش مصنوعی — docs/features/ai-product-image.md
 *
 * چرا «کار پس‌زمینه» و نه یک درخواست ساده: gpt-image با کیفیت بالا تا ۲ دقیقه
 * طول می‌کشد، ولی nginx و CDN درخواست را حدود ۶۰ ثانیه قطع می‌کنند. پس درخواست
 * فوراً یک شناسه برمی‌گرداند و مرورگر هر چند ثانیه وضعیت را می‌پرسد.
 *
 * نگه‌داری در حافظه کافی است: وب فقط یک پروسه‌ی pm2 است (ecosystem.config.js،
 * `instances: 1`). با ری‌استارت کارهای نیمه‌کاره گم می‌شوند و کاربر دوباره
 * می‌زند — داده‌ای از دست نمی‌رود چون هنوز چیزی ذخیره نشده.
 *
 * خروجی عمداً روی سرور پردازش نمی‌شود (sharp روی production بالا نمی‌آید —
 * app/api/admin/upload/route.ts)؛ مرورگر مربع/سفید/فشرده می‌کند و از مسیر
 * آپلود معمولی ذخیره می‌کند.
 */
import { randomUUID } from "crypto";
import { GAPGPT_BASE_URL } from "@/lib/ai/settings";
import type { AiImageQuality } from "@/lib/ai/image-presets";

export interface AiImageJob {
  id: string;
  userId: string;
  status: "running" | "done" | "error";
  createdAt: number;
  finishedAt?: number;
  /** data URL خروجی — فقط وقتی done */
  image?: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number; costUsd: number };
}

/** بخش‌هایی از پاسخ images/edits که لازم داریم (خروجی واقعی: b64_json، نه url) */
interface GapImageResponse {
  output_format?: string;
  data?: { b64_json?: string; url?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

/** قیمت هر میلیون توکن gpt-image-2 در GapGPT (ورودی / خروجی) */
const PRICE_PER_M = { input: 8, output: 30 };

const JOB_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 180_000;

const g = globalThis as unknown as { __aiImageJobs?: Map<string, AiImageJob> };
const jobs = (g.__aiImageJobs ??= new Map());

function sweep() {
  const now = Date.now();
  for (const [id, j] of jobs) if (now - j.createdAt > JOB_TTL_MS) jobs.delete(id);
}

export function getJob(id: string, userId: string): AiImageJob | null {
  sweep();
  const j = jobs.get(id);
  return j && j.userId === userId ? j : null;
}

/** تعداد کارهای در جریان این کاربر — جلوی کلیک‌های پشت‌سرهم را می‌گیرد */
export function runningCount(userId: string) {
  let n = 0;
  for (const j of jobs.values()) if (j.userId === userId && j.status === "running") n++;
  return n;
}

export function startImageEdit(opts: {
  userId: string;
  apiKey: string;
  model: string;
  prompt: string;
  quality: AiImageQuality;
  image: Blob;
  onDone?: (job: AiImageJob) => void;
}): AiImageJob {
  sweep();
  const job: AiImageJob = { id: randomUUID(), userId: opts.userId, status: "running", createdAt: Date.now() };
  jobs.set(job.id, job);

  void (async () => {
    try {
      const fd = new FormData();
      fd.append("model", opts.model);
      fd.append("prompt", opts.prompt);
      fd.append("size", "1024x1024");
      fd.append("quality", opts.quality);
      fd.append("image", opts.image, "product.jpg");

      const res = await fetch(`${GAPGPT_BASE_URL}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        body: fd,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const raw = await res.text();
      let body: GapImageResponse | null = null;
      try { body = JSON.parse(raw); } catch {}

      if (!res.ok) throw new Error(explainError(res.status, body?.error?.message ?? raw.slice(0, 200)));

      const item = body?.data?.[0];
      let dataUrl: string | null = null;
      if (item?.b64_json) {
        dataUrl = `data:image/${body?.output_format || "png"};base64,${item.b64_json}`;
      } else if (item?.url) {
        // لینک‌های GapGPT موقتی‌اند — همین حالا دانلود
        const img = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
        if (!img.ok) throw new Error("دانلود تصویر ساخته‌شده ناموفق بود.");
        const buf = Buffer.from(await img.arrayBuffer());
        dataUrl = `data:${img.headers.get("content-type") || "image/png"};base64,${buf.toString("base64")}`;
      }
      if (!dataUrl) throw new Error("سرویس هوش مصنوعی تصویری برنگرداند.");

      const inT = Number(body?.usage?.input_tokens) || 0;
      const outT = Number(body?.usage?.output_tokens) || 0;
      job.usage = {
        inputTokens: inT, outputTokens: outT,
        costUsd: (inT * PRICE_PER_M.input + outT * PRICE_PER_M.output) / 1_000_000,
      };
      job.image = dataUrl;
      job.status = "done";
    } catch (e) {
      job.status = "error";
      job.error = e instanceof Error && e.name === "TimeoutError"
        ? "ساخت تصویر بیش از حد طول کشید. کیفیت پایین‌تری را امتحان کنید."
        : (e instanceof Error && e.message) || "خطای ناشناخته در ساخت تصویر.";
      console.error("[ai-image]", job.error);
    } finally {
      job.finishedAt = Date.now();
      opts.onDone?.(job);
    }
  })();

  return job;
}

function explainError(status: number, message: string): string {
  if (status === 401) return "کلید GapGPT نامعتبر است. در «تنظیمات هوش مصنوعی» کلید را بررسی کنید.";
  if (status === 402 || /quota|balance|credit|insufficient/i.test(message))
    return "اعتبار حساب GapGPT کافی نیست. حساب را شارژ کنید.";
  if (status === 429) return "تعداد درخواست‌ها زیاد است. یک دقیقه بعد دوباره امتحان کنید.";
  if (/safety|policy|moderation/i.test(message))
    return "سرویس هوش مصنوعی این تصویر یا پرامپت را به دلیل قوانین محتوا نپذیرفت.";
  return `خطای سرویس هوش مصنوعی (کد ${status}): ${message}`;
}
