import type {
  SmsProvider,
  SendResult,
  Recipient,
  DeliveryItem,
  InboxMessage,
  Balance,
  ProviderItemStatus,
} from "../types";

/**
 * درایور ایران پیامک
 *
 * مستندات: https://docs.iranpayamak.com — کپی محلی در پوشه `iranpayamak/`
 * احراز هویت: هدر `Api-Key`
 *
 * ساختار پاسخ مشترک: { status: "success" | "error", data: ..., messages: ... }
 */

const BASE = "https://api.iranpayamak.com";
const TIMEOUT_MS = 20_000;

interface ApiResult<T> {
  status?: string;
  data?: T;
  messages?: unknown;
}

export class IranPayamakProvider implements SmsProvider {
  readonly name = "iranpayamak";

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("IRANPAYAMAK_API_KEY تنظیم نشده است");
  }

  // ── ارسال ────────────────────────────────────────────────────────

  async sendSimple(
    lineNumber: string,
    text: string,
    recipients: string[],
    schedule?: string
  ): Promise<SendResult> {
    return this.send("/ws/v1/sms/simple", {
      line_number: lineNumber,
      number_format: "persian",
      text,
      recipients,
      ...(schedule ? { schedule } : {}),
    });
  }

  async sendKeywords(
    lineNumber: string,
    text: string,
    recipients: Recipient[],
    schedule?: string
  ): Promise<SendResult> {
    return this.send("/ws/v1/sms/keywords", {
      line_number: lineNumber,
      number_format: "persian",
      text,
      recipients: recipients.map((r) => ({
        mobile: r.mobile,
        ...(r.vars ?? {}),
      })),
      ...(schedule ? { schedule } : {}),
    });
  }

  async sendPattern(
    patternCode: string,
    mobile: string,
    vars: Record<string, string>
  ): Promise<SendResult> {
    return this.send("/ws/v1/sms/pattern", {
      pattern_code: patternCode,
      recipients: [{ mobile, ...vars }],
    });
  }

  async sendSample(lineNumber: string, text: string): Promise<SendResult> {
    return this.send("/ws/v1/sms/sample", {
      line_number: lineNumber,
      number_format: "persian",
      text,
    });
  }

  // ── خواندن ───────────────────────────────────────────────────────

  async getBalance(): Promise<Balance | null> {
    const res = await this.request<Record<string, unknown>>(
      "GET",
      "/ws/v1/account/balance"
    );
    if (!res.ok || !res.body?.data) return null;

    const d = res.body.data as Record<string, unknown>;
    const amount = Number(d.balanceAmount ?? d.balance_amount ?? d.amount ?? 0);
    const count = Number(d.balanceCount ?? d.balance_count ?? 0);

    return { amount, count: Number.isFinite(count) ? count : undefined };
  }

  async getDeliveryItems(requestId: number): Promise<DeliveryItem[]> {
    const out: DeliveryItem[] = [];
    let page = 1;

    // صفحه‌بندی تا پایان — سقف ایمن ۵۰ صفحه
    for (; page <= 50; page++) {
      const res = await this.request<Record<string, unknown>>(
        "GET",
        `/ws/v1/send_request/${requestId}/items?page=${page}&limit=200`
      );
      if (!res.ok) break;

      const rows = extractRows(res.body?.data);
      if (rows.length === 0) break;

      for (const row of rows) {
        const mobile = String(row.mobile ?? row.recipient ?? row.number ?? "");
        if (!mobile) continue;

        out.push({
          mobile,
          status: String(row.status ?? "not-started") as ProviderItemStatus,
          cost: numOrUndef(row.cost ?? row.price),
        });
      }

      if (rows.length < 200) break;
    }

    return out;
  }

  async getInbox(page = 1, limit = 100): Promise<InboxMessage[]> {
    const res = await this.request<Record<string, unknown>>(
      "GET",
      `/ws/v1/inbox?page=${page}&limit=${limit}`
    );
    if (!res.ok) return [];

    return extractRows(res.body?.data)
      .map((row) => ({
        id: Number(row.id ?? 0),
        from: String(row.sender ?? row.from ?? row.mobile ?? ""),
        to: row.receiver ? String(row.receiver) : undefined,
        text: String(row.text ?? row.message ?? row.body ?? ""),
        receivedAt: row.created_at
          ? String(row.created_at)
          : row.receivedAt
            ? String(row.receivedAt)
            : undefined,
      }))
      .filter((m) => m.id > 0 && m.from);
  }

  async estimateCost(
    lineNumber: string,
    text: string,
    recipientCount: number
  ): Promise<number | null> {
    // پنل هزینه را بر اساس ساختار peer محاسبه می‌کند؛ یک گیرنده نمونه کافی است
    const res = await this.request<Record<string, unknown>>(
      "POST",
      "/ws/v1/sms/calculate-cost/peer-to-peer",
      {
        line_number: lineNumber,
        peers: [{ text, recipients: Array(recipientCount).fill("09120000000") }],
      }
    );
    if (!res.ok) return null;

    const d = res.body?.data;
    const n = typeof d === "number" ? d : Number((d as Record<string, unknown>)?.cost ?? NaN);
    return Number.isFinite(n) ? n : null;
  }

  // ── لایه پایه ────────────────────────────────────────────────────

  private async send(path: string, body: unknown): Promise<SendResult> {
    const res = await this.request<number | number[]>("POST", path, body);

    if (!res.ok) {
      return { ok: false, error: res.error };
    }

    const d = res.body?.data;
    const requestId = Array.isArray(d) ? Number(d[0]) : Number(d);

    return {
      ok: true,
      requestId: Number.isFinite(requestId) ? requestId : undefined,
    };
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<{ ok: boolean; body?: ApiResult<T>; error?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          "Api-Key": this.apiKey,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      const raw = await res.text();
      let parsed: ApiResult<T> | undefined;
      try {
        parsed = raw ? (JSON.parse(raw) as ApiResult<T>) : undefined;
      } catch {
        // پاسخ JSON نبود
      }

      if (!res.ok || parsed?.status === "error") {
        return {
          ok: false,
          body: parsed,
          error: describeError(res.status, parsed, raw),
        };
      }

      return { ok: true, body: parsed };
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "پاسخ پنل پیامک در زمان مجاز دریافت نشد"
          : err instanceof Error
            ? err.message
            : "خطای نامشخص";
      return { ok: false, error: msg };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── کمکی‌ها ────────────────────────────────────────────────────────

/** پاسخ‌های صفحه‌بندی‌شده گاهی `data.items` و گاهی `data.data` هستند */
function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["items", "data", "rows", "results"]) {
      if (Array.isArray(d[key])) return d[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function numOrUndef(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function describeError(
  httpStatus: number,
  parsed: ApiResult<unknown> | undefined,
  raw: string
): string {
  const m = parsed?.messages;

  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(" — ");
  if (m && typeof m === "object") {
    return Object.values(m as Record<string, unknown>)
      .flat()
      .join(" — ");
  }

  return `HTTP ${httpStatus}: ${raw.slice(0, 200) || "(بدون بدنه)"}`;
}