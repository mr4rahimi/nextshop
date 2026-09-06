import { SmsApiError } from "../errors";

/**
 * لایه‌ی HTTP مشترک ایران‌پیامک
 *
 * هم درایور ارسال (`IranPayamakProvider`) و هم پوسته‌ی مدیریتی پنل
 * (`SmsPanel`) از همین کلاینت استفاده می‌کنند تا احراز هویت، تایم‌اوت،
 * ترجمه‌ی خطا و باز کردن صفحه‌بندی فقط یک جا نوشته شود.
 */

const BASE = "https://api.iranpayamak.com";
const TIMEOUT_MS = 20_000;

export interface ApiEnvelope {
  status?: string;
  message?: unknown;
  data?: unknown;
}

export interface ApiResult {
  ok: boolean;
  body?: ApiEnvelope;
  error?: string;
  apiError?: SmsApiError;
}

/** صفحه‌بندی استاندارد Laravel که این پنل همه‌جا برمی‌گرداند */
export interface Paginated<T> {
  items: T[];
  page: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class IranPayamakHttp {
  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("کلید API پنل پیامک خالی است");
  }

  /**
   * @param path مسیر نسبی به `/ws/v1` — یا مسیر مطلقِ شروع‌شده با `/` برای
   *        endpointهایی که بیرون از `/ws/v1` هستند (مثل `/provinces`)
   */
  async request(
    method: HttpMethod,
    path: string,
    body?: unknown,
    opts?: { formData?: FormData }
  ): Promise<ApiResult> {
    const url = path.startsWith("/ws/") || path.startsWith("/provinces") || path.startsWith("/cities")
      ? `${BASE}${path}`
      : `${BASE}/ws/v1${path.startsWith("/") ? path : `/${path}`}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const form = opts?.formData;

      const res = await fetch(url, {
        method,
        headers: {
          "Api-Key": this.apiKey,
          Accept: "application/json",
          // با FormData هرگز Content-Type دستی ست نکنید — boundary از بین می‌رود
          ...(body && !form ? { "Content-Type": "application/json" } : {}),
        },
        ...(form ? { body: form } : body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      const raw = await res.text();
      let parsed: ApiEnvelope | undefined;
      try {
        parsed = raw ? (JSON.parse(raw) as ApiEnvelope) : undefined;
      } catch {
        // پاسخ JSON نبود
      }

      if (!res.ok || parsed?.status === "error") {
        const error = describeError(res.status, parsed, raw);
        return { ok: false, body: parsed, error, apiError: mapError(res.status, error) };
      }

      return { ok: true, body: parsed };
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "پاسخ پنل پیامک در زمان مجاز دریافت نشد"
          : err instanceof Error
            ? err.message
            : "خطای نامشخص";
      return { ok: false, error: msg, apiError: new SmsApiError("UNREACHABLE", msg) };
    } finally {
      clearTimeout(timer);
    }
  }

  /** مثل request ولی در خطا پرتاب می‌کند — برای مسیرهایی که ادمین منتظر پاسخ است */
  async call(
    method: HttpMethod,
    path: string,
    body?: unknown,
    opts?: { formData?: FormData }
  ): Promise<unknown> {
    const res = await this.request(method, path, body, opts);
    if (!res.ok) throw res.apiError ?? new SmsApiError("BAD_RESPONSE", res.error ?? "خطای نامشخص");
    return res.body?.data;
  }
}

// ─── کمکی‌ها ────────────────────────────────────────────────────────

function mapError(httpStatus: number, message: string): SmsApiError {
  // ۴۰۱ یعنی کلید غلط است، ۴۰۳ یعنی کلید درست است ولی این قابلیت روی پکیج
  // حساب فعال نیست. یکی کردنشان ادمین را دنبال نخود سیاه می‌فرستد.
  if (httpStatus === 401) {
    return new SmsApiError(
      "UNAUTHORIZED",
      "کلید API را پنل پیامک نپذیرفت. کلید ثبت‌شده در تنظیمات پیامکی را بررسی کنید.",
      "/admin/site-settings"
    );
  }

  if (httpStatus === 403) {
    return new SmsApiError(
      "FORBIDDEN",
      "این قابلیت روی حساب پنل شما فعال نیست. برای فعال‌سازی با ایران‌پیامک تماس بگیرید."
    );
  }

  if (httpStatus === 422) return new SmsApiError("VALIDATION", message);
  if (httpStatus === 404) return new SmsApiError("NOT_FOUND", message);

  return new SmsApiError("BAD_RESPONSE", message);
}

export function describeError(
  httpStatus: number,
  parsed: ApiEnvelope | undefined,
  raw: string
): string {
  const candidates = [
    parsed?.message,
    (parsed as Record<string, unknown> | undefined)?.messages,
    (parsed as Record<string, unknown> | undefined)?.errors,
  ];

  for (const m of candidates) {
    if (typeof m === "string" && m.trim()) return m;
    if (Array.isArray(m)) return m.join(" — ");
    if (m && typeof m === "object") {
      // { code: ["تکمیل گزینه code الزامی است"], recipient: [...] }
      return Object.entries(m as Record<string, unknown>)
        .map(([field, msgs]) => {
          const t = Array.isArray(msgs) ? msgs.join("، ") : String(msgs);
          return `${field}: ${t}`;
        })
        .join(" | ");
    }
  }

  return `HTTP ${httpStatus}: ${raw.slice(0, 200) || "(بدون بدنه)"}`;
}

export function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** مثل num ولی «نبود مقدار» را از «صفر» جدا نگه می‌دارد */
export function maybeNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** پنل برای فیلدهای boolean گاهی "1"/"0" یا 1/0 می‌دهد */
export function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

export function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/** باز کردن صفحه‌بند Laravel به شکلی که UI با آن کار کند */
export function paginate<T>(data: unknown, map: (row: Record<string, unknown>) => T | null): Paginated<T> {
  const p = asRecord(data);
  const rows = Array.isArray(p?.data) ? (p.data as unknown[]) : [];

  const items: T[] = [];
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    const mapped = map(row);
    if (mapped !== null) items.push(mapped);
  }

  return {
    items,
    page: num(p?.current_page) || 1,
    lastPage: num(p?.last_page) || 1,
    perPage: num(p?.per_page) || items.length,
    total: num(p?.total) || items.length,
  };
}

export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
