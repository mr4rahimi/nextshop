import type {
  SmsProvider,
  SendResult,
  SendRequestInfo,
  SendRequestStatus,
  Recipient,
  DeliveryItem,
  InboxMessage,
  Balance,
  ProviderItemStatus,
} from "../types";

/**
 * درایور ایران پیامک
 *
 * ساختار پاسخ‌ها بر اساس خروجی واقعی پنل تنظیم شده است:
 *
 *   ارسال:      { status, message, data: { id, type, status, metadata, schedule } }
 *   اعتبار:     { data: { balance_amount: "54230", balance_count: "361.53" } }   ← رشته‌اند
 *   جزئیات:     { data: { sendRequest: { id, status, snapshot: {...} } } }
 *   آیتم‌ها:     { data: { data: [{ destination, status, text, error, pages }] } }  ← Laravel paginator
 *   ورودی:      { data: { data: [...] } }
 *
 * ⚠️ نکته حیاتی: روی خطوط خدماتی، ارسال متن آزاد وضعیت `pending-approval`
 *    می‌گیرد و تا تأیید دستی ارسال نمی‌شود. برای پیام‌های خودکار از
 *    `sendPattern` استفاده کنید.
 */

const BASE = "https://api.iranpayamak.com";
const TIMEOUT_MS = 20_000;

interface ApiEnvelope {
  status?: string;
  message?: string;
  data?: unknown;
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
      recipients: recipients.map((r) => ({ mobile: r.mobile, ...(r.vars ?? {}) })),
      ...(schedule ? { schedule } : {}),
    });
  }

  async sendPattern(
    patternCode: string,
    mobile: string,
    vars: Record<string, string>,
    lineNumber?: string
  ): Promise<SendResult> {
    return this.send("/ws/v1/sms/pattern", {
      code: patternCode,
      recipient: mobile,
      attributes: vars,
      line_number: lineNumber ?? "",
      number_format: "english",
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
    const res = await this.request("GET", "/ws/v1/account/balance");
    if (!res.ok) return null;

    const d = asRecord(res.body?.data);
    if (!d) return null;

    // مقادیر به‌صورت رشته برمی‌گردند
    const amount = Number(d.balance_amount ?? 0);
    const count = Number(d.balance_count ?? NaN);

    return {
      amount: Number.isFinite(amount) ? amount : 0,
      count: Number.isFinite(count) ? Math.floor(count) : undefined,
    };
  }

  async getSendRequest(requestId: number): Promise<SendRequestInfo | null> {
    const res = await this.request("GET", `/ws/v1/send_request/${requestId}`);
    if (!res.ok) return null;

    const outer = asRecord(res.body?.data);
    // پاسخ داخل کلید sendRequest قرار دارد
    const sr = asRecord(outer?.sendRequest) ?? outer;
    if (!sr) return null;

    const line = asRecord(sr.line);
    const snap = asRecord(sr.snapshot);

    return {
      id: Number(sr.id ?? requestId),
      status: String(sr.status ?? "init") as SendRequestStatus,
      type: String(sr.type ?? ""),
      lineNumber: line?.number ? String(line.number) : undefined,
      rejectedDue: sr.rejected_due ? String(sr.rejected_due) : null,
      counts: snap
        ? {
            total: num(snap.total_count),
            notStarted: num(snap.not_started_count),
            inQueue: num(snap.in_queue_count),
            sent: num(snap.sent_count),
            delivered: num(snap.delivered_count),
            deliveryFailure: num(snap.delivery_failure_count),
            deliveryUndetermined: num(snap.delivery_undetermined_count),
            sendFailure: num(snap.send_failure_count),
            systemError: num(snap.system_error_count),
            blacklist: num(snap.blacklist_count),
          }
        : undefined,
    };
  }

  async getDeliveryItems(requestId: number): Promise<DeliveryItem[]> {
    const out: DeliveryItem[] = [];

    // صفحه‌بندی استاندارد Laravel — سقف ایمن ۵۰ صفحه
    for (let page = 1; page <= 50; page++) {
      const res = await this.request(
        "GET",
        `/ws/v1/send_request/${requestId}/items?page=${page}&limit=200`
      );
      if (!res.ok) break;

      const paginator = asRecord(res.body?.data);
      const rows = Array.isArray(paginator?.data)
        ? (paginator.data as unknown[])
        : [];

      for (const raw of rows) {
        const row = asRecord(raw);
        if (!row) continue;

        // ⚠️ نام فیلد در این پنل `destination` است، نه `mobile`
        const mobile = String(row.destination ?? "");
        if (!mobile) continue;

        out.push({
          mobile,
          status: String(row.status ?? "not-started") as ProviderItemStatus,
          text: row.text ? String(row.text) : undefined,
          error: row.error ? String(row.error) : null,
          pages: Number(row.pages ?? 1) || 1,
        });
      }

      const lastPage = num(paginator?.last_page) || 1;
      if (page >= lastPage || rows.length === 0) break;
    }

    return out;
  }

  async getInbox(page = 1, limit = 100): Promise<InboxMessage[]> {
    const res = await this.request("GET", `/ws/v1/inbox?page=${page}&limit=${limit}`);
    if (!res.ok) return [];

    const paginator = asRecord(res.body?.data);
    const rows = Array.isArray(paginator?.data) ? (paginator.data as unknown[]) : [];

    return rows
      .map((raw) => {
        const row = asRecord(raw);
        if (!row) return null;

        // نام فیلدها تا رسیدن اولین پیام واقعی قطعی نیست — چند حالت پوشش داده شده
        const from = String(
          row.sender ?? row.originator ?? row.from ?? row.mobile ?? row.source ?? ""
        );
        const text = String(row.text ?? row.message ?? row.body ?? row.content ?? "");

        return {
          id: num(row.id),
          from,
          to: row.destination ? String(row.destination) : row.receiver ? String(row.receiver) : undefined,
          text,
          receivedAt: row.created_at ? String(row.created_at) : undefined,
        };
      })
      .filter((m): m is InboxMessage => !!m && m.id > 0 && !!m.from);
  }

  async estimateCost(
    lineNumber: string,
    text: string,
    recipientCount: number
  ): Promise<number | null> {
    const res = await this.request("POST", "/ws/v1/sms/calculate-cost/peer-to-peer", {
      line_number: lineNumber,
      peers: [{ text, recipients: Array(recipientCount).fill("09120000000") }],
    });
    if (!res.ok) return null;

    const d = res.body?.data;
    if (typeof d === "number") return d;

    const rec = asRecord(d);
    const n = Number(rec?.cost ?? rec?.total ?? rec?.amount ?? NaN);
    return Number.isFinite(n) ? n : null;
  }

  // ── لایه پایه ────────────────────────────────────────────────────

  private async send(path: string, body: unknown): Promise<SendResult> {
    const res = await this.request("POST", path, body);
    if (!res.ok) return { ok: false, error: res.error };

    const raw = res.body?.data;

    // پترن → data یک عدد است. بقیه → data یک شیء { id, status, ... }
    if (typeof raw === "number") {
      return { ok: true, requestId: raw > 0 ? raw : undefined };
    }

    const d = asRecord(raw);
    const requestId = num(d?.id);

    return {
      ok: true,
      requestId: requestId > 0 ? requestId : undefined,
      requestStatus: d?.status ? (String(d.status) as SendRequestStatus) : undefined,
    };
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<{ ok: boolean; body?: ApiEnvelope; error?: string }> {
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
      let parsed: ApiEnvelope | undefined;
      try {
        parsed = raw ? (JSON.parse(raw) as ApiEnvelope) : undefined;
      } catch {
        // پاسخ JSON نبود
      }

      if (!res.ok || parsed?.status === "error") {
        return { ok: false, body: parsed, error: describeError(res.status, parsed, raw) };
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

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function describeError(
  httpStatus: number,
  parsed: ApiEnvelope | undefined,
  raw: string
): string {
  const candidates = [
    parsed?.message,
    (parsed as Record<string, unknown> | undefined)?.messages,
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