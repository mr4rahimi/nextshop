import {
  IranPayamakHttp,
  asRecord,
  num,
  str,
  truthy,
  paginate,
  query,
  type Paginated,
} from "./providers/http";
import { SmsApiError } from "./errors";
import type {
  Line,
  Pattern,
  PatternInput,
  PatternStatus,
  PatternVar,
  PatternVarType,
  Phonebook,
  PhonebookAttribute,
  AttributeType,
  Contact,
  ContactInput,
  ContactPrefix,
  SendRequestRow,
  NumberBank,
  VoiceFile,
  Province,
  City,
  LbsRequest,
  LbsInput,
  ChargeResult,
  CostEstimate,
} from "./panel-types";

/**
 * پوسته‌ی مدیریتی پنل ایران‌پیامک
 *
 * هدف: کاربر کسب‌وکار برای کارهای روزمره لازم نباشد وارد پنل ایران‌پیامک شود.
 *
 * ⚠️ **هیچ‌کدام از این داده‌ها در دیتابیس ما ذخیره نمی‌شود.** منبع حقیقت
 *    موجودیت‌های پنل (خط، پترن، دفترچه، گزارش) خود پنل است. کپی کردنشان یعنی
 *    باید همگام نگه داشته شوند و آن کار پس‌زمینه‌ای است که ادمین را کند می‌کند.
 *    فقط خواندنِ درخواستی، آن هم از صفحه‌ای که ادمین باز کرده.
 *
 * ⚠️ همه‌ی متدها در خطا `SmsApiError` پرتاب می‌کنند. مسیرهای API آن را به کد
 *    HTTP درست ترجمه می‌کنند تا ادمین پیام قابل‌فهم ببیند.
 */
export class SmsPanel {
  private readonly http: IranPayamakHttp;

  constructor(apiKey: string) {
    this.http = new IranPayamakHttp(apiKey);
  }

  // ── خطوط ──────────────────────────────────────────────────────────

  async getLines(): Promise<Line[]> {
    const data = await this.http.call("GET", "/lines/accessible");
    const rows = Array.isArray(data) ? data : [];

    const out: Line[] = [];
    for (const raw of rows) {
      const r = asRecord(raw);
      if (!r?.number) continue;
      out.push({
        number: str(r.number),
        isDedicated: truthy(r.is_dedicated),
        smsCost: num(r.sms_cost),
        ...(r.desc ? { description: str(r.desc) } : {}),
        ...(r.service !== undefined ? { service: truthy(r.service) } : {}),
      });
    }
    return out;
  }

  // ── پترن ──────────────────────────────────────────────────────────

  async getPatterns(opts: {
    page?: number;
    limit?: number;
    search?: string;
    status?: PatternStatus;
  } = {}): Promise<Paginated<Pattern>> {
    const data = await this.http.call(
      "GET",
      `/patterns${query({
        page: opts.page ?? 1,
        limit: opts.limit ?? 20,
        search: opts.search,
        // ⚠️ نام پارامتر در خود پنل `staus` است (غلط املایی سمت آن‌ها)
        staus: opts.status,
      })}`
    );
    return paginate(data, mapPattern);
  }

  async getPattern(code: string): Promise<Pattern> {
    const data = await this.http.call("GET", `/patterns/${encodeURIComponent(code)}`);
    const r = asRecord(data);
    // بعضی پاسخ‌ها پترن را یک لایه تودرتو می‌دهند
    const p = mapPattern(asRecord(r?.pattern) ?? r ?? {});
    if (!p) throw new SmsApiError("BAD_RESPONSE", "پاسخ پترن ساختار شناخته‌شده‌ای نداشت");
    return p;
  }

  async createPattern(input: PatternInput): Promise<{ code: string | null }> {
    const data = await this.http.call("POST", "/patterns", patternBody(input));
    return { code: extractCode(data) };
  }

  async updatePattern(code: string, input: PatternInput): Promise<void> {
    await this.http.call("PUT", `/patterns/${encodeURIComponent(code)}`, patternBody(input));
  }

  // ── دفترچه تلفن ───────────────────────────────────────────────────

  async getPhonebooks(page = 1, limit = 30): Promise<Paginated<Phonebook>> {
    const data = await this.http.call("GET", `/phone_book${query({ page, limit })}`);
    return paginate(data, (r) => ({
      id: num(r.id),
      title: str(r.title),
      ...(r.phone_book_data_count !== undefined
        ? { contactCount: num(r.phone_book_data_count) }
        : r.data_count !== undefined
          ? { contactCount: num(r.data_count) }
          : {}),
      attributeIds: Array.isArray(r.attributes)
        ? (r.attributes as unknown[]).map((a) => num(asRecord(a)?.id ?? a))
        : [],
    }));
  }

  async createPhonebook(title: string, attributeIds: number[] = []): Promise<{ id: number | null }> {
    const data = await this.http.call("POST", "/phone_book", {
      title,
      ...(attributeIds.length > 0 ? { attributes: attributeIds } : {}),
    });
    const id = typeof data === "number" ? data : num(asRecord(data)?.id);
    return { id: id > 0 ? id : null };
  }

  async updatePhonebook(id: number, title: string, attributeIds?: number[]): Promise<void> {
    await this.http.call("PUT", `/phone_book/${id}`, {
      title,
      ...(attributeIds ? { attributes: attributeIds } : {}),
    });
  }

  // ── ویژگی‌های دفترچه ──────────────────────────────────────────────

  async getAttributes(page = 1, limit = 50): Promise<Paginated<PhonebookAttribute>> {
    const data = await this.http.call("GET", `/phone_book_attribute${query({ page, limit })}`);
    return paginate(data, (r) => ({
      id: num(r.id),
      title: str(r.title),
      type: (str(r.type) || "string") as AttributeType,
    }));
  }

  async createAttribute(title: string, type: AttributeType): Promise<{ id: number | null }> {
    const data = await this.http.call("POST", "/phone_book_attribute", { title, type });
    const id = typeof data === "number" ? data : num(asRecord(data)?.id);
    return { id: id > 0 ? id : null };
  }

  // ── مخاطبان ───────────────────────────────────────────────────────

  /**
   * ⚠️ `phonebookId` اجباری است — پنل بدون آن ۴۲۲ می‌دهد. اینجا جلویش گرفته
   *    می‌شود تا پیام «تکمیل گزینه phone book id الزامی است» به ادمین نرسد.
   */
  async getContacts(opts: {
    phonebookId: number;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<Paginated<Contact>> {
    if (!opts.phonebookId) {
      throw new SmsApiError("VALIDATION", "برای دیدن مخاطبان، اول یک دفترچه انتخاب کنید");
    }

    const data = await this.http.call(
      "GET",
      `/phone_book_data${query({
        page: opts.page ?? 1,
        limit: opts.limit ?? 30,
        phone_book_id: opts.phonebookId,
        search: opts.search,
      })}`
    );

    return paginate(data, (r) => ({
      id: num(r.id),
      mobile: str(r.mobile),
      name: str(r.name),
      prefix: (r.prefix ? str(r.prefix) : null) as ContactPrefix | null,
      phonebookId: r.phone_book_id !== undefined ? num(r.phone_book_id) : null,
      attributes: Array.isArray(r.attributes)
        ? (r.attributes as unknown[]).flatMap((a) => {
            const x = asRecord(a);
            if (!x) return [];
            return [{ attributeId: num(x.attribute_id ?? x.id), value: str(x.value) }];
          })
        : [],
    }));
  }

  async addContact(phonebookId: number, contact: ContactInput): Promise<void> {
    await this.http.call("POST", "/phone_book_data", {
      phone_book_id: phonebookId,
      mobile: contact.mobile,
      ...(contact.name ? { name: contact.name } : {}),
      ...(contact.prefix ? { prefix: contact.prefix } : {}),
      ...(contact.attributes?.length ? { attributes: contact.attributes } : {}),
    });
  }

  /**
   * افزودن دسته‌ای
   *
   * ⚠️ در دسته‌های بزرگ خودِ پنل کند می‌شود. فراخوان باید تکه‌تکه بفرستد؛
   *    سقف امن در `MAX_BULK_CONTACTS` است.
   */
  async addContactsBulk(phonebookId: number, contacts: ContactInput[]): Promise<void> {
    if (contacts.length === 0) return;
    if (contacts.length > MAX_BULK_CONTACTS) {
      throw new SmsApiError(
        "VALIDATION",
        `حداکثر ${MAX_BULK_CONTACTS} مخاطب در هر درخواست — ورودی را تکه‌تکه بفرستید`
      );
    }

    await this.http.call("POST", "/phone_book_data/bulk-upsert", {
      phone_book_id: phonebookId,
      items: contacts.map((c) => ({
        mobile: c.mobile,
        ...(c.name ? { name: c.name } : {}),
        ...(c.prefix ? { prefix: c.prefix } : {}),
        ...(c.attributes?.length ? { attributes: c.attributes } : {}),
      })),
    });
  }

  async deleteContact(id: number): Promise<void> {
    await this.http.call("DELETE", `/phone_book_data/${id}`);
  }

  // ── گزارش ارسال ───────────────────────────────────────────────────

  async getSendRequests(page = 1, limit = 20): Promise<Paginated<SendRequestRow>> {
    const data = await this.http.call("GET", `/send_request${query({ page, limit })}`);

    return paginate(data, (r) => {
      // snapshot در ردیف‌های بدون آمار، آرایه‌ی خالی است نه شیء
      const snap = asRecord(r.snapshot);
      const line = asRecord(r.line);

      return {
        id: num(r.id),
        status: str(r.status) || "init",
        type: str(r.type),
        lineNumber: line?.number ? str(line.number) : null,
        text: r.pattern_text ? str(r.pattern_text) : r.text ? str(r.text) : null,
        schedule: r.schedule ? str(r.schedule) : null,
        rejectedDue: r.rejected_due ? str(r.rejected_due) : null,
        createdAt: r.created_at ? str(r.created_at) : null,
        counts: snap
          ? {
              total: num(snap.total_count),
              sent: num(snap.sent_count),
              delivered: num(snap.delivered_count),
              failed: num(snap.delivery_failure_count) + num(snap.send_failure_count),
            }
          : null,
      };
    });
  }

  // ── بانک شماره ────────────────────────────────────────────────────

  async getNumberBanks(page = 1, limit = 30): Promise<Paginated<NumberBank>> {
    const data = await this.http.call("GET", `/number_bank${query({ page, limit })}`);
    return paginate(data, (r) => ({
      id: num(r.id),
      title: str(r.title ?? r.name),
      count: num(r.count ?? r.numbers_count),
    }));
  }

  async sendToNumberBank(
    lineNumber: string,
    text: string,
    targets: { bankId: number; offset: number; limit: number }[]
  ): Promise<{ requestId?: number }> {
    const data = await this.http.call("POST", "/sms/bank", {
      line_number: lineNumber,
      number_format: "persian",
      text,
      recipients: targets.map((t) => ({
        bank_id: t.bankId,
        offset: t.offset,
        limit: t.limit,
      })),
    });
    return { requestId: extractRequestId(data) };
  }

  // ── ارسال از دفترچه ───────────────────────────────────────────────

  async sendFromPhonebooks(
    lineNumber: string,
    text: string,
    books: { id: number; offset: number; limit: number }[]
  ): Promise<{ requestId?: number }> {
    const data = await this.http.call("POST", "/sms/simple", {
      line_number: lineNumber,
      number_format: "persian",
      text,
      selectedPhoneBooks: books,
    });
    return { requestId: extractRequestId(data) };
  }

  // ── هزینه ─────────────────────────────────────────────────────────

  async estimateCost(
    lineNumber: string,
    text: string,
    receiverCount: number
  ): Promise<CostEstimate> {
    const data = await this.http.call("POST", "/sms/calculate-cost", {
      line_number: lineNumber,
      number_format: "persian",
      text,
      receiver_count: receiverCount,
    });

    if (typeof data === "number") return { total: data, receiverCount };

    // پاسخ واقعی پنل: { text_length, price_amount } — price_amount هزینه‌ی کل است
    const r = asRecord(data);
    return {
      total: num(r?.price_amount ?? r?.cost ?? r?.total ?? r?.amount ?? 0),
      ...(r?.text_length !== undefined ? { textLength: num(r.text_length) } : {}),
      ...(r?.pages !== undefined ? { pages: num(r.pages) } : {}),
      receiverCount,
    };
  }

  // ── پیام صوتی ─────────────────────────────────────────────────────

  async uploadVoice(file: Blob, filename: string): Promise<VoiceFile> {
    const form = new FormData();
    form.append("file", file, filename);

    const data = await this.http.call("POST", "/sms/voice/upload-file", undefined, {
      formData: form,
    });

    const r = asRecord(data);
    const id = typeof data === "number" ? data : num(r?.id ?? r?.file_id);
    if (!id) throw new SmsApiError("BAD_RESPONSE", "شناسه‌ی فایل صوتی از پنل برنگشت");

    return {
      id,
      ...(r?.title ? { title: str(r.title) } : { title: filename }),
      ...(r?.duration !== undefined ? { duration: num(r.duration) } : {}),
    };
  }

  async sendVoice(
    fileId: number,
    recipients: string[],
    lineNumber?: string
  ): Promise<{ requestId?: number }> {
    const data = await this.http.call("POST", "/sms/voice/send", {
      file_id: fileId,
      recipients,
      ...(lineNumber ? { line_number: lineNumber } : {}),
    });
    return { requestId: extractRequestId(data) };
  }

  // ── موقعیت جغرافیایی ──────────────────────────────────────────────
  // ⚠️ این دو بیرون از /ws/v1 هستند — مسیر مطلق داده می‌شود

  async getProvinces(): Promise<Province[]> {
    const data = await this.http.call("GET", "/provinces");
    return (Array.isArray(data) ? data : []).flatMap((raw) => {
      const r = asRecord(raw);
      return r ? [{ id: num(r.id), title: str(r.title) }] : [];
    });
  }

  async getCities(provinceId: number): Promise<City[]> {
    const data = await this.http.call("GET", `/cities${query({ province_id: provinceId })}`);
    return (Array.isArray(data) ? data : []).flatMap((raw) => {
      const r = asRecord(raw);
      return r
        ? [{ id: num(r.id), title: str(r.title), provinceId: num(r.province_id) || provinceId }]
        : [];
    });
  }

  // ── ارسال موقعیت‌محور (LBS) ───────────────────────────────────────

  async getLbsRequests(page = 1, limit = 20): Promise<Paginated<LbsRequest>> {
    const data = await this.http.call("GET", `/lbs${query({ page, limit })}`);
    return paginate(data, (r) => ({
      id: num(r.id),
      status: str(r.status),
      text: r.text ? str(r.text) : null,
      address: r.address ? str(r.address) : null,
      receiverCount: num(r.receiver_count),
      createdAt: r.created_at ? str(r.created_at) : null,
    }));
  }

  async createLbs(input: LbsInput): Promise<{ id: number | null }> {
    const data = await this.http.call("POST", "/lbs", {
      text: input.text,
      start_time: input.startTime,
      end_time: input.endTime,
      receiver_count: input.receiverCount,
      latitude: input.latitude,
      longitude: input.longitude,
      radius: input.radius,
      ...(input.address ? { address: input.address } : {}),
      ...(input.dispatchMoment ? { dispatch_moment: input.dispatchMoment } : {}),
      ...(input.receiverGender ? { receiver_gender: input.receiverGender } : {}),
      ...(input.receiverAgeFrom ? { receiver_age_from: input.receiverAgeFrom } : {}),
      ...(input.receiverAgeTo ? { receiver_age_to: input.receiverAgeTo } : {}),
      ...(input.device ? { device: input.device } : {}),
    });
    const id = typeof data === "number" ? data : num(asRecord(data)?.id);
    return { id: id > 0 ? id : null };
  }

  async cancelLbs(id: number): Promise<void> {
    await this.http.call("PATCH", `/lbs/${id}/cancel`);
  }

  // ── کیف پول ───────────────────────────────────────────────────────

  /**
   * شارژ کیف پول پنل
   *
   * با `Api-Key` کار می‌کند (بدون ورود به پنل) و آدرس درگاه را برمی‌گرداند.
   * در مقابل `/ws/v1/orders/*` با bearer کار می‌کند و از اینجا در دسترس نیست.
   */
  async chargeWallet(amount: number, redirectUrl: string): Promise<ChargeResult> {
    const data = await this.http.call("POST", "/account/wallet/charge", {
      amount,
      redirectUrl,
    });

    const r = asRecord(data);
    const url =
      firstString(r?.url, r?.payUrl, r?.pay_url, r?.link, r?.redirect_url, r?.gateway_url) ??
      (typeof data === "string" ? data : null);

    return { payUrl: url, raw: data };
  }
}

/** سقف مخاطب در هر درخواست دسته‌ای — بالاتر از این خود پنل کند می‌شود */
export const MAX_BULK_CONTACTS = 500;

// ─── کمکی‌ها ────────────────────────────────────────────────────────

function mapPattern(r: Record<string, unknown>): Pattern | null {
  const code = str(r.code);
  if (!code) return null;

  return {
    id: num(r.id),
    code,
    text: str(r.text),
    description: r.description ? str(r.description) : null,
    website: r.website ? str(r.website) : null,
    status: (str(r.status) || "pending") as PatternStatus,
    shared: truthy(r.share ?? r.shared),
    adminMessage: r.admin_message ? str(r.admin_message) : null,
    reviewedAt: r.reviewed_at ? str(r.reviewed_at) : null,
    vars: Array.isArray(r.attributes)
      ? (r.attributes as unknown[]).flatMap((a) => {
          const x = asRecord(a);
          if (!x?.var) return [];
          return [
            {
              var: str(x.var),
              length: num(x.length),
              type: (str(x.type) || "str") as PatternVarType,
            },
          ];
        })
      : [],
  };
}

function patternBody(input: PatternInput) {
  return {
    text: input.text,
    ...(input.description ? { description: input.description } : {}),
    ...(input.website ? { website: input.website } : {}),
    share: input.shared ? 1 : 0,
    ...(input.category ? { category: input.category } : {}),
    vars: input.vars.map((v: PatternVar) => ({
      var: v.var,
      length: v.length,
      type: v.type,
    })),
  };
}

function extractCode(data: unknown): string | null {
  if (typeof data === "string") return data;
  const r = asRecord(data);
  return r?.code ? str(r.code) : null;
}

function extractRequestId(data: unknown): number | undefined {
  if (typeof data === "number") return data > 0 ? data : undefined;
  const id = num(asRecord(data)?.id);
  return id > 0 ? id : undefined;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}
