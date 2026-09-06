import { SmsApiError } from "../errors";
import {
  IranPayamakHttp,
  asRecord,
  num,
  maybeNum,
  truthy,
  type ApiResult,
} from "./http";
import type {
  SmsProvider,
  SendResult,
  SendRequestInfo,
  SendRequestStatus,
  Recipient,
  DeliveryItem,
  InboxMessage,
  Balance,
  BalanceDetail,
  AccountProfile,
  ProviderItemStatus,
} from "../types";

/**
 * درایور ایران پیامک
 *
 * ساختار پاسخ‌ها بر اساس خروجی واقعی پنل تنظیم شده است:
 *
 *   ارسال:      { status, message, data: { id, type, status, metadata, schedule } }
 *   اعتبار:     { data: { balance_amount: "995595", balance_count: "5410.84" } }  ← رشته‌اند
 *               مستند رسمی نام‌ها را camelCase (balanceAmount) می‌دهد؛ هر دو
 *               حالت پذیرفته می‌شود تا تغییر پنل بی‌صدا صفر برنگرداند.
 *   جزئیات:     { data: { sendRequest: { id, status, snapshot: {...} } } }
 *   آیتم‌ها:     { data: { data: [{ destination, status, text, error, pages }] } }  ← Laravel paginator
 *   ورودی:      { data: { data: [...] } }
 *
 * ⚠️ نکته حیاتی: روی خطوط خدماتی، ارسال متن آزاد وضعیت `pending-approval`
 *    می‌گیرد و تا تأیید دستی ارسال نمی‌شود. برای پیام‌های خودکار از
 *    `sendPattern` استفاده کنید.
 */

export class IranPayamakProvider implements SmsProvider {
  readonly name = "iranpayamak";

  private readonly http: IranPayamakHttp;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("کلید API پنل پیامک تنظیم نشده است");
    this.http = new IranPayamakHttp(apiKey);
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

  async getBalance(): Promise<Balance> {
    const res = await this.request("GET", "/ws/v1/account/balance");
    if (!res.ok) throw res.apiError;

    const d = asRecord(res.body?.data);
    if (!d) {
      throw new SmsApiError("BAD_RESPONSE", "پاسخ اعتبار از پنل ساختار شناخته‌شده‌ای نداشت");
    }

    // پنل امروز snake_case و رشته می‌دهد، مستند رسمی camelCase و عدد
    const amount = maybeNum(d.balance_amount ?? d.balanceAmount);
    const count = maybeNum(d.balance_count ?? d.balanceCount);

    if (amount === undefined && count === undefined) {
      throw new SmsApiError("BAD_RESPONSE", "پاسخ اعتبار از پنل ساختار شناخته‌شده‌ای نداشت");
    }

    const rawDetails = Array.isArray(d.details) ? d.details : [];
    const details: BalanceDetail[] = [];

    for (const raw of rawDetails) {
      const row = asRecord(raw);
      if (!row) continue;
      details.push({
        count: num(row.count),
        rate: num(row.rate),
        amount: num(row.amount),
      });
    }

    return {
      amount: amount ?? 0,
      // عمداً گِرد نمی‌شود؛ 0.29 پیامک نباید به «۰» تبدیل شود و مثل «بدون اعتبار» دیده شود
      count,
      ...(details.length > 0 ? { details } : {}),
    };
  }

  async getProfile(): Promise<AccountProfile> {
    const res = await this.request("GET", "/ws/v1/account/profile");
    if (!res.ok) throw res.apiError;

    const d = asRecord(res.body?.data);
    if (!d) {
      throw new SmsApiError("BAD_RESPONSE", "پاسخ مشخصات حساب ساختار شناخته‌شده‌ای نداشت");
    }

    const plan = asRecord(d.plan);

    return {
      displayName: String(d.displayName ?? d.display_name ?? ""),
      mobile: String(d.mobile ?? ""),
      // پنل گاهی "1"/"0" رشته‌ای می‌دهد نه boolean
      verified: truthy(d.verified),
      blocked: truthy(d.blocked),
      ...(plan?.title ? { planTitle: String(plan.title) } : {}),
      ...(plan?.expiryDate ? { planExpiryDate: String(plan.expiryDate) } : {}),
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

    const out: InboxMessage[] = [];

    for (const raw of rows) {
      const row = asRecord(raw);
      if (!row) continue;

      // نام فیلدها تا رسیدن اولین پیام واقعی قطعی نیست — چند حالت پوشش داده شده
      const from = String(
        row.sender ?? row.originator ?? row.from ?? row.mobile ?? row.source ?? ""
      );
      const id = num(row.id);

      if (!from || id <= 0) continue;

      const to = row.destination ?? row.receiver;
      const receivedAt = row.created_at ?? row.receivedAt;

      out.push({
        id,
        from,
        text: String(row.text ?? row.message ?? row.body ?? row.content ?? ""),
        ...(to ? { to: String(to) } : {}),
        ...(receivedAt ? { receivedAt: String(receivedAt) } : {}),
      });
    }

    return out;
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

  private request(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<ApiResult> {
    return this.http.request(method, path, body);
  }
}
