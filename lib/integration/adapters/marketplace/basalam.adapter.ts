import { BaseAdapter } from "../base.adapter";
import { prisma } from "@/lib/prisma";
import type { FetchOrdersResult, OrderItemInfo } from "@/lib/integration/types";
import { applyDiscount, ORDERS_LOOKBACK_DAYS, parseTehranTime } from "@/lib/integration/types";
import { toTehranDate } from "@/lib/integration/core/discount";
import { patchConnectionCredentials } from "@/lib/integration/core/credentials";
import { loadVariantTargets, recordVariantPush, type VariantTarget } from "@/lib/integration/core/variant-links";

import type {
  ConnectionTestResult,
  PaginatedProducts,
  IntegProductInfo,
  StockUpdate,
  PriceUpdate,
  BatchResult,
  FetchChatsResult,
  FetchMessagesResult,
  SendMessageResult,
  ChatInfo,
  ChatMessageInfo,
  ChatFileInfo,
  DraftImage,
  ProductDraft,
  CreatedProduct,
  PlatformCategory,
} from "@/lib/integration/types";

const OPENAPI_BASE = "https://openapi.basalam.com";
const CORE_BASE    = "https://core.basalam.com";
const AUTH_BASE    = "https://auth.basalam.com";

// وضعیت مرسوله‌های باسلام (دیده‌شده روی داده‌ی زنده): 3739 جدید، 3238 ارسال شده،
// 3195 رضایت مشتری، 3067 لغو شده، 3233 بازگشت کامل وجه
const BASALAM_CANCELLED_STATUSES = new Set([3067, 3233]);

// ── Basalam API response shapes ──────────────────────────────────────

interface BasalamUserInfo {
  id:       number;
  hash_id:  string;
  username: string;
  name:     string;
  vendor: {
    id:         number;
    identifier: string;
    title:      string;
  } | null;
}

interface BasalamProduct {
  id:            number;
  title:         string;
  /** قیمت مؤثر (ریال) — همان چیزی که خریدار می‌پردازد */
  price:         number;
  /** قیمت پیش از تخفیف (ریال). null یعنی محصول تخفیف ندارد. */
  primary_price: number | null;
  photo:         { original: string; xs: string; sm: string } | null;
  status:        { name: string; value: number } | null;
  inventory:     number;
  is_wholesale:  boolean;
}

interface BasalamProductsResponse {
  data:        BasalamProduct[];
  total_count: number;
  result_count: number;
  total_page:  number;
  page:        number;
  per_page:    number;
}

// ── شکل پاسخ سرویس گفت‌وگو ────────────────────────────────────────────
// مرجع: openapi_data/chat.json در SDK رسمی باسلام. خلاصه‌اش در
// docs/plans/basalam-chat.md آمده است.

interface BasalamChatUser {
  id:      number;
  hash_id?: string;
  name?:   string | null;
  avatar?: string | null;
}

interface BasalamChatMessage {
  id:           number;
  chat_id:      number;
  seen_at:      string | null;
  created_at:   string;
  updated_at:   string;
  message_type: string;
  sender:       BasalamChatUser | null;
  content: {
    text?:      string | null;
    files?:     { url?: string; width?: number; height?: number; name?: string }[] | null;
    links?:     unknown[] | null;
    entity_id?: number | null;
  } | null;
}

interface BasalamChat {
  id:                   number;
  chat_type:            string;
  unseen_message_count: number;
  updated_at:           string;
  contact:              BasalamChatUser | null;
  contact_id:           number | null;
  last_message:         BasalamChatMessage | null;
  channel:              { title?: string; avatar?: string } | null;
  group:                { title?: string; avatar?: string } | null;
}

interface BasalamChatsResponse  { data: { chats: BasalamChat[] } }
interface BasalamMessagesResponse { data: { messages: BasalamChatMessage[] } }

// ── Adapter ───────────────────────────────────────────────────────────

/** یک شناسه را از فهرست موفق به ناموفق منتقل می‌کند، بدون تکرار. */
function failMove(result: BatchResult, id: string, error: string): void {
  result.success = result.success.filter((s) => s !== id);
  if (!result.failed.some((f) => f.id === id)) result.failed.push({ id, error });
}

export class BasalamAdapter extends BaseAdapter {
  readonly platformCode = "basalam";
  readonly platformName = "باسلام";

  private static readonly CHUNK_SIZE = 50;

  private headers(accessToken: string): HeadersInit {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  // ── تازه‌سازی خودکار Access Token ────────────────────────────────
  // توکن باسلام انقضا دارد (expires_in). تا پیش از این هیچ‌جا refresh نمی‌شد و
  // بعد از انقضا همه‌ی فراخوانی‌ها با
  //   HTTP 401 {"errors":[{"message":"authentication error"}], ...}
  // شکست می‌خوردند — FETCH_ORDERS، FETCH_PRODUCTS و به‌تبع آن ارسال قیمت.
  // فرم ادمین refreshToken را می‌گرفت ولی آداپتور هرگز استفاده‌اش نمی‌کرد.

  // refreshهای همزمان نباید هرکدام یک توکن جدید بگیرند — باسلام با هر refresh
  // توکن قبلی را باطل می‌کند، پس دو job همزمان می‌توانستند توکن هم را بسوزانند.
  // نتیجه‌ی refresh مشترک، «patch» است نه یک boolean: هر فراخوان باید آن را روی
  // شیء credentials خودش اعمال کند، وگرنه job دومی که منتظر مانده با توکن
  // منقضی دوباره تلاش می‌کند.
  private static refreshInFlight: Promise<Record<string, string> | null> | null = null;

  private async refreshAccessToken(
    credentials: Record<string, string>,
    persist = true,
  ): Promise<boolean> {
    const patch = await (BasalamAdapter.refreshInFlight ??= (async () => {
      try {
        const { refreshToken, clientId, clientSecret } = credentials;
        if (!refreshToken?.trim() || !clientId?.trim() || !clientSecret?.trim()) return null;

        const res = await fetch(`${AUTH_BASE}/oauth/token`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body:    JSON.stringify({
            grant_type:    "refresh_token",
            client_id:     clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
          }),
        }).catch(() => null);

        if (!res?.ok) return null;

        const body = await res.json().catch(() => null) as
          | { access_token?: string; refresh_token?: string }
          | null;
        if (!body?.access_token) return null;

        const next: Record<string, string> = { accessToken: body.access_token };
        if (body.refresh_token) next.refreshToken = body.refresh_token;

        // در «تست اتصال» اعتبارنامه از فرمِ ذخیره‌نشده می‌آید و ممکن است متعلق
        // به حساب دیگری باشد — نباید روی اتصال زنده نوشته شود.
        if (persist) await patchConnectionCredentials(this.platformCode, next).catch(() => {});
        return next;
      } finally {
        // آزادسازی در همین microtask تا refresh بعدی (انقضای بعدی) بلوکه نشود
        BasalamAdapter.refreshInFlight = null;
      }
    })());

    if (!patch) return false;

    // نسخه‌ی در حافظه‌ی همین فراخوان هم باید تازه شود، وگرنه تلاش دوباره‌اش
    // باز هم با توکن منقضی می‌رود.
    Object.assign(credentials, patch);
    return true;
  }

  /** fetch با هدر احراز هویت؛ روی ۴۰۱ یک‌بار توکن را تازه می‌کند و دوباره تلاش می‌کند. */
  private async authedFetch(
    credentials: Record<string, string>,
    url: string,
    init: Omit<RequestInit, "headers"> = {},
    persistRefresh = true,
  ): Promise<Response> {
    // بدنه‌ی multipart (آپلود عکس) مرز خودش را در Content-Type می‌گذارد؛ هدر JSON خرابش می‌کند
    const multipart = typeof FormData !== "undefined" && init.body instanceof FormData;
    const headersFor = (token: string): HeadersInit =>
      multipart ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : this.headers(token);

    const res = await fetch(url, { ...init, headers: headersFor(credentials.accessToken) });
    if (res.status !== 401) return res;

    if (!(await this.refreshAccessToken(credentials, persistRefresh))) return res;
    return fetch(url, { ...init, headers: headersFor(credentials.accessToken) });
  }

  /** متن خطای باسلام از بدنه‌ی پاسخ — errors، messages یا detail */
  private static async errorText(res: Response): Promise<string> {
    const raw = await res.text().catch(() => "");
    try {
      const body = JSON.parse(raw) as {
        message?: string;
        detail?: unknown;
        errors?: { message?: string; fields?: string[] }[];
        messages?: { message?: string; fields?: string[] }[];
      };
      const list = body.errors?.length ? body.errors : body.messages;
      if (list?.length) {
        return list.map((e) => `${e.message ?? ""}${e.fields?.length ? ` [${e.fields.join(", ")}]` : ""}`).join(" | ");
      }
      if (Array.isArray(body.detail)) {
        return (body.detail as { msg?: string; loc?: unknown[] }[])
          .map((d) => `${d.msg ?? ""}${d.loc ? ` [${d.loc.join(".")}]` : ""}`)
          .join(" | ");
      }
      if (typeof body.detail === "string") return body.detail;
      if (body.message) return body.message;
    } catch {
      /* JSON نبود */
    }
    return `HTTP ${res.status}${raw ? `: ${raw.slice(0, 300)}` : ""}`;
  }

  /**
   * شناسه‌ی محصول‌هایی که باسلام در متن خطا مقصر معرفی کرده.
   * نمونه: «... قابل ویرایش نیستند. شناسه: 13088017»
   */
  private static blamedIds(detail: string): string[] {
    const ids = new Set<string>();
    for (const m of detail.matchAll(/شناسه\s*:?\s*(\d+)/g)) ids.add(m[1]);
    return [...ids];
  }

  /** پیام خطای ۴۰۱ با راهنمای عملی — نه فقط بدنه‌ی خام باسلام. */
  private static authErrorHint(credentials: Record<string, string>): string {
    const missing: string[] = [];
    if (!credentials.refreshToken?.trim()) missing.push("Refresh Token");
    if (!credentials.clientId?.trim())     missing.push("Client ID");
    if (!credentials.clientSecret?.trim()) missing.push("Client Secret");
    return missing.length
      ? ` — توکن باسلام منقضی شده و تجدید خودکار ممکن نیست چون ${missing.join("، ")} در فرم اتصال باسلام وارد نشده است`
      : " — توکن منقضی شده و تجدید خودکار هم ناموفق بود؛ Refresh Token را در فرم اتصال باسلام دوباره وارد کنید";
  }

  // ── تست اتصال + دریافت vendorId ──────────────────────────────────

  async testConnection(
    credentials: Record<string, string>,
  ): Promise<ConnectionTestResult> {
    const { accessToken } = credentials;
    if (!accessToken?.trim()) return { success: false, message: "Access Token وارد نشده" };

    try {
      const res = await this.authedFetch(credentials, `${OPENAPI_BASE}/v1/users/me`, {}, false);

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        const hint = res.status === 401 ? BasalamAdapter.authErrorHint(credentials) : "";
        return { success: false, message: `${body.message ?? `HTTP ${res.status}`}${hint}` };
      }

      const info: BasalamUserInfo = await res.json();

      return {
        success: true,
        message: `اتصال برقرار شد — فروشگاه: ${info.vendor?.title ?? info.name}`,
        shopInfo: {
          userId:      info.id,
          name:        info.name,
          vendorId:    info.vendor?.id,
          vendorTitle: info.vendor?.title,
          identifier:  info.vendor?.identifier,
        },
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "خطای شبکه",
      };
    }
  }

  // ── دریافت محصولات باسلام (برای mapping + auto-match) ────────────

  async fetchProducts(
    credentials: Record<string, string>,
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedProducts> {
    const { vendorId } = credentials;

    if (!vendorId) throw new Error("vendorId تنظیم نشده — اتصال را دوباره تست کنید");

    const url = `${OPENAPI_BASE}/v1/vendors/${vendorId}/products?page=${page}&per_page=${pageSize}`;
    const res = await this.authedFetch(credentials, url);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      const hint = res.status === 401 ? BasalamAdapter.authErrorHint(credentials) : "";
      throw new Error(`${body.message ?? `HTTP ${res.status}`}${hint}`);
    }

    const data: BasalamProductsResponse = await res.json();

    // باسلام قیمت را به ریال می‌دهد؛ داخلی همه‌جا تومان است.
    // primary_price فقط وقتی پر است که محصول تخفیف داشته باشد.
    const items: IntegProductInfo[] = data.data.map((p) => {
      const effective = typeof p.price === "number" ? Math.round(p.price / 10) : undefined;
      const original  = typeof p.primary_price === "number" ? Math.round(p.primary_price / 10) : undefined;
      const hasDiscount = original != null && effective != null && original > 0 && effective < original;
      return {
        platformId: String(p.id),
        title:      p.title,
        salePrice:  effective,
        originalPrice:   hasDiscount ? original : undefined,
        discountPercent: hasDiscount ? Math.round(((original! - effective!) / original!) * 10000) / 100 : undefined,
        stock:      p.inventory,
        imageUrls:  p.photo?.sm ? [p.photo.sm] : undefined,
      };
    });

    return {
      items,
      total:   data.total_count,
      page:    data.page,
      hasMore: data.page < data.total_page,
    };
  }

  // ── ارسال موجودی از فروشگاه به باسلام ───────────────────────────

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdate[],
  ): Promise<BatchResult> {
    // محصول تنوع‌دار: موجودی کلی معنی ندارد؛ موجودی هر تنوع از سایت می‌رود
    const targets = await loadVariantTargets(this.platformCode, updates.map((u) => u.platformProductId));
    const plain = updates.filter((u) => !targets.has(u.platformProductId));

    const result = plain.length
      ? await this.bulkUpdate(
          credentials,
          plain.map((u) => ({ id: parseInt(u.platformProductId, 10), stock: u.stock })),
          plain.map((u) => u.platformProductId),
        )
      : { success: [], failed: [] };

    for (const [productId, target] of targets) {
      const r = await this.pushVariantTarget(credentials, productId, target, { stock: true, price: false, force: true });
      if (r.errors.length) result.failed.push({ id: productId, error: r.errors.join(" | ") });
      else result.success.push(productId);
    }
    return result;
  }

  // ── تنوع‌ها ──────────────────────────────────────────────────────
  // PATCH /v3/products/{id}/variations/{variationId}  { stock, price }
  // روی غرفه‌ی واقعی آزمایش شد (۱۴۰۵/۰۸/۲۰): پاسخ ۲۰۰ و اثر فوری. بچ‌آپدیت
  // `variants` در PATCH /v3/vendors/{id}/products پاسخ ۲۰۲ داد ولی روی محصولِ
  // در حال بازبینی اثری نگذاشت — پس هر تنوع جدا ارسال می‌شود.

  private async patchVariation(
    credentials: Record<string, string>,
    productId: string,
    variationId: string,
    body: { stock?: number; price?: number },
  ): Promise<string | null> {
    const payload: Record<string, number> = {};
    if (body.stock !== undefined) payload.stock = Math.max(0, Math.floor(body.stock));
    // فیلد قیمت تنوع `price` است (ریال). `primary_price` با پاسخ ۲۰۰ پذیرفته می‌شود
    // ولی قیمت را عوض نمی‌کند — روی غرفه‌ی واقعی آزموده شد (۱۴۰۵/۰۸/۲۰).
    if (body.price !== undefined) payload.price = Math.round(body.price) * 10;   // تومان → ریال
    if (!Object.keys(payload).length) return null;

    await this.rateLimit(150);
    const res = await this.authedFetch(
      credentials,
      `${CORE_BASE}/v3/products/${productId}/variations/${variationId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    ).catch((e: unknown) => e as Error);
    if (res instanceof Error) return res.message;
    if (res.ok) return null;
    const hint = res.status === 401 ? BasalamAdapter.authErrorHint(credentials) : "";
    return `${await BasalamAdapter.errorText(res)}${hint}`;
  }

  /**
   * ارسال موجودی و/یا قیمت تنوع‌های یک محصول. بدون `force` فقط مقدارهایی که با
   * آخرین ارسال فرق دارند می‌روند (دور خودکار)؛ با `force` همه (همگام‌سازی دستی).
   */
  private async pushVariantTarget(
    credentials: Record<string, string>,
    productId: string,
    target: VariantTarget,
    opts: { stock: boolean; price: boolean; force: boolean },
  ): Promise<{ pushed: number; errors: string[] }> {
    const errors: string[] = [];
    const done: Record<string, { stock?: number; price?: number }> = {};
    let pushed = 0;
    for (const item of target.items) {
      const prev = target.pushed[item.platformVariantId] ?? {};
      const body: { stock?: number; price?: number } = {};
      if (opts.stock && (opts.force || prev.stock !== item.stock)) body.stock = item.stock;
      if (opts.price && (opts.force || prev.price !== item.price)) body.price = item.price;
      if (body.stock === undefined && body.price === undefined) continue;
      const err = await this.patchVariation(credentials, productId, item.platformVariantId, body);
      if (err) errors.push(`تنوع ${item.platformVariantId}: ${err}`);
      else {
        done[item.platformVariantId] = body;
        pushed++;
      }
    }
    await recordVariantPush(target.linkId, done).catch(() => {});
    if (opts.stock && Object.values(done).some((d) => d.stock !== undefined)) {
      const total = target.items.reduce((t, i) => t + i.stock, 0);
      await prisma.integPlatformProduct.updateMany({
        where: { platformCode: this.platformCode, platformProductId: productId },
        data:  { stock: total },
      }).catch(() => {});
    }
    return { pushed, errors };
  }

  /**
   * دور خودکار تنوع‌ها — همه‌ی محصولات تنوع‌دارِ نگاشت‌شده، فقط مقدارهای تغییرکرده.
   * قیمتِ محصولی که کمپین تخفیف فعال دارد اینجا نمی‌رود (باسلام ویرایشش را رد
   * می‌کند)؛ آن مسیر «همگام‌سازی قیمت» است که کمپین را برمی‌دارد و دوباره می‌سازد.
   */
  async syncVariantProducts(
    credentials: Record<string, string>,
    opts: { stock: boolean; price: boolean; force?: boolean },
  ): Promise<{ products: number; pushed: number; failed: { id: string; error: string }[] }> {
    const targets = await loadVariantTargets(this.platformCode);
    const withCampaign = new Set(
      (await prisma.integPlatformProduct.findMany({
        where:  { platformCode: this.platformCode, platformProductId: { in: [...targets.keys()] }, discountPercent: { gt: 0 } },
        select: { platformProductId: true },
      })).map((p) => p.platformProductId),
    );
    let pushed = 0;
    const failed: { id: string; error: string }[] = [];
    for (const [productId, target] of targets) {
      const r = await this.pushVariantTarget(credentials, productId, target, {
        stock: opts.stock,
        price: opts.price && !withCampaign.has(productId),
        force: !!opts.force,
      });
      pushed += r.pushed;
      if (r.errors.length) failed.push({ id: productId, error: r.errors.join(" | ") });
    }
    return { products: targets.size, pushed, failed };
  }

  // ── ساخت محصول — docs/integrations/create-products.md ─────────────

  /** آپلود یک عکس؛ شناسه‌ی فایل باسلام را برمی‌گرداند */
  private async uploadPhoto(credentials: Record<string, string>, img: DraftImage): Promise<number> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(img.buffer)], { type: img.type }), img.name);
    form.append("file_type", "product.photo");
    await this.rateLimit(150);
    const res = await this.authedFetch(credentials, `${OPENAPI_BASE}/v1/files`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`آپلود عکس «${img.name}» ناموفق بود: ${await BasalamAdapter.errorText(res)}`);
    const body = await res.json() as { id?: number | string };
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) throw new Error(`آپلود عکس «${img.name}» شناسه برنگرداند`);
    return id;
  }

  async createProduct(credentials: Record<string, string>, draft: ProductDraft): Promise<CreatedProduct> {
    const { vendorId } = credentials;
    if (!vendorId) throw new Error("vendorId تنظیم نشده — اتصال باسلام را تست و ذخیره کنید");

    // عکس خراب یکی را نباید کل محصول را بخواباند؛ ولی بی‌عکس، باسلام محصول را نمی‌پذیرد
    const photoIds: number[] = [];
    const photoErrors: string[] = [];
    for (const img of draft.images) {
      try { photoIds.push(await this.uploadPhoto(credentials, img)); }
      catch (e) { photoErrors.push(e instanceof Error ? e.message : String(e)); }
    }
    if (!photoIds.length) {
      throw new Error(photoErrors[0] ?? "محصول هیچ عکسی ندارد — باسلام محصول بی‌عکس را نمی‌پذیرد");
    }

    const rial = (toman: number) => Math.round(toman) * 10;
    const body: Record<string, unknown> = {
      name:             draft.title.slice(0, 120),
      photo:            photoIds[0],
      photos:           photoIds,
      description:      draft.description || draft.title,
      category_id:      draft.categoryId,
      // 2976 منتشرشده، 3790 منتشرنشده. باسلام محصول تازه را در هر حال اول «در انتظار تأیید» می‌گذارد.
      status:           draft.publish ? 2976 : 3790,
      preparation_days: draft.preparationDays,
      weight:           draft.weight,
      package_weight:   draft.packageWeight,
      primary_price:    rial(draft.price),
      stock:            Math.max(0, Math.floor(draft.stock)),
      unit_type:        6304,   // عددی
      unit_quantity:    1,
      shipping_data:    { illegal_for_iran: false, illegal_for_same_city: false },
      ...(draft.sku ? { sku: draft.sku } : {}),
    };
    if (draft.variants.length) {
      body.variants = draft.variants.map((v) => ({
        primary_price: rial(v.price),
        stock:         Math.max(0, Math.floor(v.stock)),
        ...(v.sku ? { sku: v.sku } : {}),
        properties:    v.properties,
      }));
    }

    await this.rateLimit(200);
    const res = await this.authedFetch(credentials, `${CORE_BASE}/v4/vendors/${vendorId}/products`, {
      method: "POST",
      body:   JSON.stringify(body),
    });
    if (!res.ok) {
      const hint = res.status === 401 ? BasalamAdapter.authErrorHint(credentials) : "";
      throw new Error(`باسلام محصول را نپذیرفت: ${await BasalamAdapter.errorText(res)}${hint}`);
    }

    const created = await res.json() as {
      id: number;
      title?: string;
      status?: { name?: string } | null;
      variants?: { id: number; sku?: string | null; properties?: { property?: { title?: string }; value?: { value?: string; title?: string } }[] }[] | null;
    };
    if (!created?.id) throw new Error("باسلام شناسه‌ی محصول ساخته‌شده را برنگرداند");

    // تنوع‌های پاسخ ← تنوع‌های سایت: اول با ترکیب مقدارها، بعد SKU، آخر ترتیب
    const norm = (s?: string | null) => (s ?? "").trim().replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
    const keyOf = (props: { property: string; value: string }[]) =>
      props.map((p) => `${norm(p.property)}=${norm(p.value)}`).sort().join("|");
    const returned = (created.variants ?? []).map((v) => ({
      id:  String(v.id),
      sku: v.sku ?? null,
      key: keyOf((v.properties ?? []).map((p) => ({ property: p.property?.title ?? "", value: p.value?.value ?? p.value?.title ?? "" }))),
    }));
    const used = new Set<string>();
    const variants: Record<string, string> = {};
    draft.variants.forEach((dv, i) => {
      const k = keyOf(dv.properties);
      const hit =
        returned.find((r) => !used.has(r.id) && r.key === k) ??
        (dv.sku ? returned.find((r) => !used.has(r.id) && r.sku === dv.sku) : undefined) ??
        (returned[i] && !used.has(returned[i].id) ? returned[i] : undefined);
      if (hit) { used.add(hit.id); variants[dv.shopVariantId] = hit.id; }
    });
    if (draft.variants.length && Object.keys(variants).length !== draft.variants.length) {
      throw new Error(
        `محصول ${created.id} در باسلام ساخته شد ولی همه‌ی تنوع‌هایش شناسایی نشد ` +
        `(${Object.keys(variants).length} از ${draft.variants.length}) — نگاشت را دستی کامل کنید`,
      );
    }

    return {
      platformProductId: String(created.id),
      title:             created.title ?? draft.title,
      variants,
      statusTitle:       created.status?.name ?? undefined,
    };
  }

  async fetchCategories(credentials: Record<string, string>): Promise<PlatformCategory[]> {
    const res = await this.authedFetch(credentials, `${OPENAPI_BASE}/v1/categories`);
    if (!res.ok) throw new Error(`دریافت دسته‌های باسلام ناموفق بود: ${await BasalamAdapter.errorText(res)}`);
    type Node = { id: number; title: string; max_preparation_days?: number | null; children?: Node[] | null };
    const body = await res.json() as { data?: Node[] };
    const out: PlatformCategory[] = [];
    const walk = (n: Node, trail: string[]) => {
      const path = [...trail, n.title];
      if (n.children?.length) n.children.forEach((c) => walk(c, path));
      else out.push({ id: n.id, title: n.title, path: path.join(" › "), maxPreparationDays: n.max_preparation_days ?? null });
    };
    (body.data ?? []).forEach((n) => walk(n, []));
    return out;
  }

  async requiredCategoryAttributes(credentials: Record<string, string>, categoryId: number): Promise<string[]> {
    const res = await this.authedFetch(credentials, `${OPENAPI_BASE}/v1/categories/${categoryId}/attributes`);
    if (!res.ok) return [];
    const body = await res.json().catch(() => null) as
      | { data?: { attributes?: { title?: string; required?: boolean }[] }[] }
      | null;
    return (body?.data ?? []).flatMap((g) => (g.attributes ?? []).filter((a) => a.required).map((a) => a.title ?? "?"));
  }



  // ── قیمت و تخفیف ─────────────────────────────────────────────────
  //
  // باسلام تخفیف را نه به‌صورت فیلد روی محصول، بلکه به‌صورت «کمپین» نگه می‌دارد:
  //   POST   /v1/vendors/{vendorId}/discounts  { product_filter, discount_percent, active_days }
  //   DELETE /v1/vendors/{vendorId}/discounts  { product_filter }
  //
  // هر دو روی حساب واقعی آزمایش شده‌اند. رفتار تأییدشده روی محصول ۱۲۶۶۳۳۲۵:
  //   قبل   → price = primary_price = 29,860,000
  //   POST ۱۰٪ → price = 26,874,000 و primary_price = 29,860,000 (زیر ۵ ثانیه)
  //   DELETE  → هر دو دوباره 29,860,000
  //
  // یعنی باسلام قیمتِ ارسالی را به عنوان **قیمت اصلی** نگه می‌دارد و قیمت
  // تخفیف‌خورده را خودش حساب می‌کند. پس باید قیمت اصلی بفرستیم؛ فرستادن قیمت
  // مؤثر به‌علاوه‌ی کمپین، تخفیف را دو بار اعمال می‌کرد.
  //
  // ترتیب سه مرحله عمدی است: حذف کمپین → ارسال قیمت → ساخت کمپین.
  // باسلام ویرایش قیمت محصولی که «تخفیف زمانمند» دارد را رد می‌کند
  // («... قابل ویرایش نیستند. شناسه: ۱۳۰۸۸۰۱۷» در لاگ پروداکشن)، پس کمپین
  // باید اول برداشته شود. ضمناً اگر ساخت کمپین شکست بخورد محصول با قیمت کامل
  // می‌ماند که خطای بی‌خطری است — عکسش فروش زیر قیمت تمام‌شده بود.
  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdate[],
  ): Promise<BatchResult> {
    // کدام محصول‌ها همین حالا کمپین فعال دارند؟ فقط برای آن‌ها حذف لازم است.
    const cached = await prisma.integPlatformProduct.findMany({
      where: {
        platformCode:      this.platformCode,
        platformProductId: { in: updates.map((u) => u.platformProductId) },
        discountPercent:   { gt: 0 },
      },
      select: { platformProductId: true },
    });
    const hasCampaign = new Set(cached.map((c) => c.platformProductId));

    const clearFailed = new Map<string, string>();
    await this.removeCampaigns(credentials, updates.map((u) => u.platformProductId).filter((id) => hasCampaign.has(id)), clearFailed);

    // محصول تنوع‌دار: قیمت هر تنوع از قیمت همان تنوع در سایت (با تنظیم قیمت
    // بازارگاه) می‌آید، نه قیمت واحدِ قانون قیمت — docs/integrations/create-products.md
    const targets = await loadVariantTargets(this.platformCode, updates.map((u) => u.platformProductId));
    const plain = updates.filter((u) => !targets.has(u.platformProductId));

    const result = plain.length
      ? await this.bulkUpdate(
          credentials,
          plain.map((u) => {
            const { original } = applyDiscount(u.price, u.discount);
            return {
              id:    parseInt(u.platformProductId, 10),
              price: original * 10,   // تومان → ریال؛ باسلام خودش تخفیف را حساب می‌کند
            };
          }),
          plain.map((u) => u.platformProductId),
        )
      : { success: [] as string[], failed: [] as { id: string; error: string }[] };

    // کش از کمپین خبر نداشت (مثلاً تخفیف را کسی در پنل باسلام گذاشته) و باسلام
    // ارسال قیمت را با «تخفیف زمانمند» رد کرد: کمپین را برمی‌داریم و دوباره می‌فرستیم.
    // پیش از این، محصول با قیمت قدیمی می‌ماند و تخفیف تازه هم هرگز ساخته نمی‌شد.
    const timed = result.failed.filter((f) => BasalamAdapter.isTimedDiscountError(f.error)).map((f) => f.id);
    if (timed.length) {
      const removeErr = new Map<string, string>();
      await this.removeCampaigns(credentials, timed, removeErr);
      const retryIds = timed.filter((id) => !removeErr.has(id));
      if (retryIds.length) {
        await this.rateLimit(BasalamAdapter.CAMPAIGN_SETTLE_MS);   // حذف کمپین ۲۰۲ است و چند ثانیه بعد می‌نشیند
        const byId = new Map(plain.map((u) => [u.platformProductId, u]));
        const retry = await this.bulkUpdate(
          credentials,
          retryIds.map((id) => ({ id: parseInt(id, 10), price: applyDiscount(byId.get(id)!.price, byId.get(id)!.discount).original * 10 })),
          retryIds,
        );
        result.failed = result.failed.filter((f) => !retry.success.includes(f.id) && !retry.failed.some((r) => r.id === f.id));
        result.success.push(...retry.success);
        result.failed.push(...retry.failed);
      }
    }

    for (const [productId, target] of targets) {
      const r = await this.pushVariantTarget(credentials, productId, target, { stock: false, price: true, force: true });
      if (r.errors.length) result.failed.push({ id: productId, error: r.errors.join(" | ") });
      else result.success.push(productId);
    }

    // ساخت دوباره‌ی کمپین با همان درصد — باسلام همان درصد را روی قیمت تازه حساب
    // می‌کند (رفتار اسنپ‌شاپ). باسلام بین دو درخواست تخفیف یک محصول دست‌کم ۳۰ ثانیه
    // فاصله می‌خواهد («فاصله بین هر دو درخواست، میبایست حداقل 30 ثانیه باشد» — لاگ
    // پروداکشن ۱۴۰۵/۰۸/۱۹). بدون تلاش دوباره، محصول بی‌تخفیف و با قیمت کامل می‌ماند.
    const successSet = new Set(result.success);
    const withDiscount = updates.filter((u) => successSet.has(u.platformProductId) && u.discount && u.discount.percent > 0);
    const later: PriceUpdate[] = [];
    for (const u of withDiscount) {
      try {
        await this.applyDiscountCampaign(credentials, u.platformProductId, u.discount!);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (BasalamAdapter.isIntervalError(msg)) later.push(u);
        else failMove(result, u.platformProductId, `قیمت ارسال شد ولی ساخت کمپین تخفیف ناموفق بود: ${msg}`);
      }
    }
    if (later.length) {
      await this.rateLimit(BasalamAdapter.DISCOUNT_GAP_MS);
      for (const u of later) {
        try {
          await this.applyDiscountCampaign(credentials, u.platformProductId, u.discount!);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failMove(result, u.platformProductId, `قیمت ارسال شد ولی ساخت کمپین تخفیف ناموفق بود: ${msg}`);
        }
      }
    }

    for (const [id, msg] of clearFailed) {
      if (!successSet.has(id)) continue;
      failMove(result, id, `حذف کمپین تخفیف قبلی ناموفق بود: ${msg}`);
    }

    return result;
  }

  /** فاصله‌ی لازم باسلام بین دو درخواست تخفیف یک محصول (۳۰ ثانیه + حاشیه) */
  private static readonly DISCOUNT_GAP_MS = 31_000;
  /** زمان نشستن حذف کمپین (پاسخ ۲۰۲) پیش از ارسال دوباره‌ی قیمت */
  private static readonly CAMPAIGN_SETTLE_MS = 5_000;

  private static isIntervalError(msg: string): boolean {
    return /فاصله بین هر دو درخواست|حداقل\s*30\s*ثانیه/.test(msg);
  }

  private static isTimedDiscountError(msg: string): boolean {
    return /تخفیف زمانمند/.test(msg);
  }

  /** حذف کمپین چند محصول؛ اگر باسلام «۳۰ ثانیه» گفت، یک بار صبر و دوباره. خطاها در `failed`. */
  private async removeCampaigns(credentials: Record<string, string>, ids: string[], failed: Map<string, string>): Promise<void> {
    const later: string[] = [];
    for (const id of ids) {
      try {
        await this.removeDiscountCampaign(credentials, id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // ادامه می‌دهیم: اگر کمپین واقعاً مانده باشد، خود باسلام ارسال قیمت را
        // رد می‌کند و پیامش در نتیجه دیده می‌شود.
        if (BasalamAdapter.isIntervalError(msg)) later.push(id);
        else failed.set(id, msg);
      }
    }
    if (!later.length) return;
    await this.rateLimit(BasalamAdapter.DISCOUNT_GAP_MS);
    for (const id of later) {
      try { await this.removeDiscountCampaign(credentials, id); }
      catch (err) { failed.set(id, err instanceof Error ? err.message : String(err)); }
    }
  }

  /** بدنه‌ی مشترک فراخوانی‌های کمپین تخفیف. پاسخ ۲۰۲ است و اثرش چند ثانیه بعد می‌نشیند. */
  private async discountRequest(
    credentials: Record<string, string>,
    method: "POST" | "DELETE",
    body: Record<string, unknown>,
  ): Promise<void> {
    const { vendorId } = credentials;
    if (!vendorId) throw new Error("vendorId تنظیم نشده");

    await this.rateLimit(200);
    const res = await this.authedFetch(
      credentials,
      `${OPENAPI_BASE}/v1/vendors/${vendorId}/discounts`,
      { method, body: JSON.stringify(body) },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  private async applyDiscountCampaign(
    credentials: Record<string, string>,
    platformProductId: string,
    discount: { percent: number; endsAt?: Date | null },
  ): Promise<void> {
    const percent = Math.round(discount.percent);
    if (!(percent > 0) || percent >= 100) return;

    await this.discountRequest(credentials, "POST", {
      product_filter:   { product_ids: [parseInt(platformProductId, 10)] },
      discount_percent: percent,
      active_days:      BasalamAdapter.activeDays(discount.endsAt),
    });
  }

  private async removeDiscountCampaign(
    credentials: Record<string, string>,
    platformProductId: string,
  ): Promise<void> {
    await this.discountRequest(credentials, "DELETE", {
      product_filter: { product_ids: [parseInt(platformProductId, 10)] },
    });
  }

  /**
   * تاریخ پایان ما → `active_days` باسلام.
   *
   * باسلام تاریخ پایان نمی‌گیرد و `active_days` را به «آخرِ روزِ N روز بعد»
   * ترجمه می‌کند: در آزمایش، کمپینی که ۲۰ شهریور ساعت ۲۰:۴۴ با `active_days: 1`
   * ساخته شد `rollback_at` برابر ۲۱ شهریور ۲۳:۵۹ گرفت. پس ملاک، اختلاف
   * **روز تقویمی** به وقت تهران است، نه اختلاف ساعت — وگرنه تخفیفی که فردا
   * شب تمام می‌شود یک روز اضافه فعال می‌ماند.
   *
   * تاریخ شروع را باسلام نمی‌فهمد (کمپین همان لحظه شروع می‌شود)؛ اجرای شروع
   * با بازه‌ی پنل ماست و تا باز نشدنش اصلاً تخفیفی به اینجا نمی‌رسد.
   */
  private static activeDays(endsAt?: Date | null): number {
    if (!endsAt) return 365;
    const today = toTehranDate(new Date());
    const end   = toTehranDate(endsAt);
    if (!today || !end) return 365;
    const diff = Math.round((Date.parse(end) - Date.parse(today)) / 86_400_000);
    return Math.max(1, Math.min(365, diff));
  }

  async fetchOrders(
  credentials: Record<string, string>,
  cursor?: string,
): Promise<FetchOrdersResult> {
  // همه‌ی وضعیت‌ها خوانده می‌شوند. قبلاً فقط «جدید» (3739) خوانده می‌شد و چون
  // مرسوله تا دور بعدی polling به «ارسال شده» می‌رفت، تقریباً هیچ سفارشی نمی‌رسید.
  const params = new URLSearchParams({
    per_page: "30",
    // نکته: پارامتر sort توسط باسلام پذیرفته نمی‌شود (422: مرتب سازی معتبر نمی باشد)
  });
  if (cursor) params.set("cursor", cursor);

  const res = await this.authedFetch(credentials, `${OPENAPI_BASE}/v1/vendor-parcels?${params}`);

  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    // بدنه کامل خطا برای دیباگ — در لاگ ادمین دیده می‌شود
    const hint = res.status === 401 ? BasalamAdapter.authErrorHint(credentials) : "";
    throw new Error(`HTTP ${res.status}: ${rawText.slice(0, 400) || "(بدون بدنه)"}${hint}`);
  }

  const data = await res.json() as {
    data: {
      id: number;
      created_at?: string;
      status?: { id?: number; title?: string } | null;
      // ساختار واقعی (تأییدشده روی داده‌ی زنده): گیرنده زیر order.customer است،
      // نه روی خود parcel — خواندن از parcel.recipient همیشه undefined می‌داد و
      // نام مشتری در فاکتور حسابداری به «مشتری باسلام» سقوط می‌کرد.
      order?: {
        id?: number;
        hash_id?: string;
        customer?: {
          recipient?: { name?: string; mobile?: string } | null;
          user?:      { name?: string; mobile?: string; hash_id?: string } | null;
        } | null;
      } | null;
      recipient?: { name?: string; mobile?: string } | null;
      customer?:  { name?: string; mobile?: string } | null;
      // variation: تنوع خریده‌شده (SDK رسمی: order_processing/models.py → ParcelItem.variation)
      items: { id: number; quantity: number; title: string; price?: number; product: { id: number; price?: number }; variation?: { id?: number } | null }[];
    }[];
    next_cursor?: string;
  };

  const cutoff = Date.now() - ORDERS_LOOKBACK_DAYS * 86_400_000;
  const cancelledOrderIds: string[] = [];
  // فهرست تقریباً از جدید به قدیم است ولی کاملاً مرتب نیست — وقتی کل صفحه
  // قدیمی‌تر از بازه بود، صفحه‌های بعدی لازم نیستند
  let anyRecent = false;

  const items: OrderItemInfo[] = data.data.flatMap((parcel) => {
    const orderedAt = parseTehranTime(parcel.created_at);
    if (orderedAt && orderedAt.getTime() < cutoff) return [];
    anyRecent = true;
    // لغو شده / بازگشت کامل وجه — ردیف ثبت‌شده‌ی فاکتورنخورده لغو می‌شود (کلید با parcel.id شروع می‌شود)
    if (parcel.status?.id != null && BASALAM_CANCELLED_STATUSES.has(parcel.status.id)) {
      cancelledOrderIds.push(String(parcel.id));
      return [];
    }

    const cust      = parcel.order?.customer ?? null;
    const recipient = cust?.recipient ?? parcel.recipient ?? parcel.customer ?? null;
    const account   = cust?.user ?? null;
    const name   = recipient?.name   ?? account?.name   ?? undefined;
    const mobile = recipient?.mobile ?? account?.mobile ?? undefined;
    // شماره سفارش قابل نمایش برای کاربر، نه شناسه‌ی مرسوله
    const orderNo = parcel.order?.hash_id ?? (parcel.order?.id != null ? String(parcel.order.id) : String(parcel.id));

    return parcel.items.map((item) => {
      // قیمت باسلام به ریال است — داخلی به تومان نگه می‌داریم.
      // نکته: مستندات باسلام مشخص نمی‌کند item.price قیمت واحد است یا مجموع قلم؛
      // همه‌ی سفارش‌های واقعی تاکنون qty=1 داشته‌اند، پس نمی‌شد تجربی تشخیص داد.
      // فرض «قیمت واحد» گرفته شده (هم‌راستا با قیمت محصول در فهرست محصولات).
      // اولین سفارش با تعداد بیش از یک را باید با فاکتور باسلام مقایسه کرد.
      const rawPrice = item.price ?? item.product?.price;
      const qty      = item.quantity > 0 ? item.quantity : 1;
      return {
        platformOrderId:     `${parcel.id}:${item.id}`, // یکتا در سطح آیتم
        platformOrderNo:     orderNo,
        platformOrderItemId: String(item.id),
        platformProductId:   String(item.product.id),
        ...(item.variation?.id != null ? { platformVariantId: String(item.variation.id) } : {}),
        qty,
        title:               item.title,
        unitPrice:           typeof rawPrice === "number" ? Math.round(rawPrice / 10) : undefined,
        customerName:        name,
        customerPhone:       mobile,
        orderedAt,
      };
    });
  });

  const hasMore = !!data.next_cursor && anyRecent;
  return { items, hasMore, cursor: hasMore ? data.next_cursor : undefined, cancelledOrderIds };
}

  // ── bulk update به core.basalam.com ──────────────────────────────
  // endpoint: PATCH /v3/vendors/{vendor_id}/products
  // body: { "data": [{ "id": number, "stock"?: number, "primary_price"?: number }] }

   private async bulkUpdate(
    credentials: Record<string, string>,
    data: Record<string, unknown>[],
    ids: string[],
  ): Promise<BatchResult> {
    const { vendorId } = credentials;
    if (!vendorId) throw new Error("vendorId تنظیم نشده");

    const success: string[] = [];
    const failed:  { id: string; error: string }[] = [];

    for (let i = 0; i < data.length; i += BasalamAdapter.CHUNK_SIZE) {
      const chunk    = data.slice(i, i + BasalamAdapter.CHUNK_SIZE);
      const chunkIds = ids.slice(i, i + BasalamAdapter.CHUNK_SIZE);

      try {
        await this.rateLimit(200);

        const res = await this.authedFetch(
          credentials,
          `${CORE_BASE}/v3/vendors/${vendorId}/products`,
          {
            method:  "PATCH",
            body:    JSON.stringify({ data: chunk }),
          },
        );

         if (!res.ok) {
          const rawText = await res.text().catch(() => "");
          let detail = `HTTP ${res.status}`;
          try {
            const body = JSON.parse(rawText) as {
              message?:  string;
              errors?:   { message?: string; fields?: string[] }[];
              // ۴۲۲ باسلام پیام‌ها را زیر `messages` می‌فرستد نه `errors`
              messages?: { message?: string; fields?: string[] }[];
            };
            const list = body.errors?.length ? body.errors : body.messages;
            if (list?.length) {
              detail = list
                .map((e) => `${e.message ?? ""}${e.fields?.length ? ` [${e.fields.join(", ")}]` : ""}`)
                .join(" | ");
            } else if (body.message) {
              detail = body.message;
            }
          } catch {
            /* JSON نبود */
          }
          // اگر پیام قابل‌استخراج نبود، بدنه خام را کامل بگذار
          if (detail === `HTTP ${res.status}` && rawText) {
            detail = `HTTP ${res.status}: ${rawText.slice(0, 400)}`;
          }
          if (res.status === 401) detail += BasalamAdapter.authErrorHint(credentials);

          // باسلام کل دسته را به‌خاطر یک قلم رد می‌کند و پیام، شناسه‌ی همان قلم را
          // نام می‌برد (مثلاً محصولی که «تخفیف زمانمند» دارد و با این نسخه‌ی API
          // قابل ویرایش نیست). بدون جداسازی، ۴۹ محصول سالم هم قربانی می‌شدند.
          const blamed = BasalamAdapter.blamedIds(detail).filter((id) => chunkIds.includes(id));
          const rest   = chunkIds.filter((id) => !blamed.includes(id));

          if (blamed.length && rest.length) {
            failed.push(...blamed.map((id) => ({ id, error: detail })));
            const restData = rest.map((id) => chunk[chunkIds.indexOf(id)]);
            const retry = await this.bulkUpdate(credentials, restData, rest);
            success.push(...retry.success);
            failed.push(...retry.failed);
            continue;
          }

          failed.push(...chunkIds.map((id) => ({ id, error: detail })));
          continue;
        }

        // باسلام حتی با HTTP 200 ممکن است هر آیتم را جداگانه رد کند (has_error)
        const results = await res.json().catch(() => null) as
          | { id: number; has_error?: boolean; error_message?: string }[]
          | null;

        if (Array.isArray(results)) {
          const resultMap = new Map(results.map((r) => [String(r.id), r]));
          for (const id of chunkIds) {
            const r = resultMap.get(id);
            if (r?.has_error) {
              failed.push({ id, error: r.error_message ?? "رد شد توسط باسلام (has_error)" });
            } else {
              success.push(id);
            }
          }
        } else {
          success.push(...chunkIds);
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        failed.push(...chunkIds.map((id) => ({ id, error })));
      }
    }

    return { success, failed };
  }

  // ── سرویس گفت‌وگو ─────────────────────────────────────────────────
  // اسکوپ‌های لازم روی توکن: customer.chat.read و customer.chat.write.
  // نقشه راه و جزئیات endpointها: docs/plans/basalam-chat.md

  /**
   * باسلام زمان‌ها را بدون منطقه زمانی می‌دهد («2026-07-22 10:28:23»).
   * بدون Z، `new Date` آن را به وقت محلی سرور می‌خواند و روی سروری که
   * منطقه‌اش تهران نیست تاریخ‌ها ۳:۳۰ جابه‌جا می‌شوند. پس صریح UTC می‌خوانیم.
   */
  private static parseTs(raw: string | null | undefined): Date | null {
    if (!raw) return null;
    const normalized = /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw)
      ? raw
      : `${raw.trim().replace(" ", "T")}Z`;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /**
   * شناسه کاربر غرفه — برای تشخیص اینکه فرستنده هر پیام خودمان بودیم یا مشتری.
   * یک بار از /v1/users/me گرفته و کنار بقیه credentials ذخیره می‌شود.
   */
  private async resolveUserId(credentials: Record<string, string>): Promise<string | null> {
    if (credentials.userId?.trim()) return credentials.userId.trim();

    const res = await this.authedFetch(credentials, `${OPENAPI_BASE}/v1/users/me`);
    if (!res.ok) return null;

    const info: BasalamUserInfo = await res.json();
    const userId = String(info.id);
    credentials.userId = userId;
    await patchConnectionCredentials(this.platformCode, { userId }).catch(() => {});
    return userId;
  }

  private static toFiles(msg: BasalamChatMessage): ChatFileInfo[] {
    const files = msg.content?.files;
    if (!Array.isArray(files)) return [];
    return files
      .filter((f): f is { url: string; width?: number; height?: number; name?: string } =>
        typeof f?.url === "string" && f.url.length > 0)
      .map((f) => ({ url: f.url, width: f.width, height: f.height, name: f.name }));
  }

  private static toMessageInfo(msg: BasalamChatMessage): ChatMessageInfo {
    return {
      externalId:  String(msg.id),
      senderId:    msg.sender?.id != null ? String(msg.sender.id) : undefined,
      senderName:  msg.sender?.name ?? undefined,
      messageType: msg.message_type ?? "text",
      text:        msg.content?.text ?? undefined,
      files:       BasalamAdapter.toFiles(msg),
      seenAt:      BasalamAdapter.parseTs(msg.seen_at),
      sentAt:      BasalamAdapter.parseTs(msg.created_at) ?? new Date(),
      raw:         msg,
    };
  }

  /** پیام خطای خوانا برای پاسخ‌های ناموفق سرویس گفت‌وگو. */
  private async chatError(res: Response, credentials: Record<string, string>): Promise<string> {
    const body = await res.text().catch(() => "");
    if (res.status === 401) return `HTTP 401${BasalamAdapter.authErrorHint(credentials)}`;
    if (res.status === 403) {
      return "HTTP 403 — توکن باسلام اسکوپ customer.chat.read یا customer.chat.write را ندارد";
    }
    return `HTTP ${res.status} ${body.slice(0, 300)}`;
  }

  async fetchChats(
    credentials: Record<string, string>,
    opts: { updatedFrom?: Date | null; limit?: number },
  ): Promise<FetchChatsResult> {
    const params = new URLSearchParams({
      limit:    String(opts.limit ?? 50),
      order_by: "updated_at",
    });
    // باسلام زمان را بدون منطقه می‌خواهد؛ همان قالبی که خودش برمی‌گرداند.
    if (opts.updatedFrom) {
      params.set("updated_from", opts.updatedFrom.toISOString().slice(0, 19).replace("T", " "));
    }

    const res = await this.authedFetch(credentials, `${OPENAPI_BASE}/v1/chats?${params}`);
    if (!res.ok) throw new Error(await this.chatError(res, credentials));

    const json: BasalamChatsResponse = await res.json();
    const raw = json.data?.chats ?? [];

    let maxUpdatedAt: Date | null = null;
    const chats: ChatInfo[] = raw.map((c) => {
      const updatedAt = BasalamAdapter.parseTs(c.updated_at);
      if (updatedAt && (!maxUpdatedAt || updatedAt > maxUpdatedAt)) maxUpdatedAt = updatedAt;

      // کانال‌ها و گروه‌ها مخاطب ندارند؛ عنوانشان جای نام مخاطب می‌نشیند.
      const title  = c.contact?.name ?? c.channel?.title ?? c.group?.title ?? undefined;
      const avatar = c.contact?.avatar ?? c.channel?.avatar ?? c.group?.avatar ?? undefined;

      return {
        externalId:      String(c.id),
        chatType:        c.chat_type ?? "private",
        contactId:       c.contact_id != null ? String(c.contact_id) : undefined,
        contactName:     title,
        contactAvatar:   avatar ?? undefined,
        unseenCount:     c.unseen_message_count ?? 0,
        updatedAt,
        lastMessageAt:   BasalamAdapter.parseTs(c.last_message?.created_at),
        lastMessageText: c.last_message?.content?.text ?? undefined,
        raw:             c,
      };
    });

    return { chats, maxUpdatedAt };
  }

  async fetchMessages(
    credentials: Record<string, string>,
    opts: { chatId: string; sinceMessageId?: string | null; limit?: number },
  ): Promise<FetchMessagesResult> {
    const limit = opts.limit ?? 50;
    const params = new URLSearchParams({ limit: String(limit), order: "desc" });

    // با message_id + cmp=gt فقط پیام‌های تازه‌تر از آخرین چیزی که داریم می‌آید.
    if (opts.sinceMessageId) {
      params.set("message_id", opts.sinceMessageId);
      params.set("cmp", "gt");
    }

    const res = await this.authedFetch(
      credentials,
      `${OPENAPI_BASE}/v1/chats/${encodeURIComponent(opts.chatId)}/messages?${params}`,
    );
    if (!res.ok) throw new Error(await this.chatError(res, credentials));

    const json: BasalamMessagesResponse = await res.json();
    const raw = json.data?.messages ?? [];

    return {
      messages: raw.map(BasalamAdapter.toMessageInfo),
      hasMore:  raw.length >= limit,
    };
  }

  async sendMessage(
    credentials: Record<string, string>,
    opts: { chatId: string; text: string; repliedMessageId?: string | null },
  ): Promise<SendMessageResult> {
    const res = await this.authedFetch(
      credentials,
      `${OPENAPI_BASE}/v1/chats/${encodeURIComponent(opts.chatId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content:      { text: opts.text },
          message_type: "text",
          ...(opts.repliedMessageId ? { replied_message_id: Number(opts.repliedMessageId) } : {}),
        }),
      },
    );
    if (!res.ok) throw new Error(await this.chatError(res, credentials));

    const json = await res.json() as { data?: BasalamChatMessage } & Partial<BasalamChatMessage>;
    const msg  = json.data ?? (json as BasalamChatMessage);

    return {
      externalId: String(msg.id),
      sentAt:     BasalamAdapter.parseTs(msg.created_at) ?? new Date(),
    };
  }

  /** شناسه کاربر غرفه، برای اینکه هسته جهت هر پیام را تشخیص دهد. */
  async resolveSelfId(credentials: Record<string, string>): Promise<string | null> {
    return this.resolveUserId(credentials);
  }
}
