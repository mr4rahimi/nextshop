import { constants, generateKeyPairSync, privateDecrypt } from "crypto";
import { BaseAdapter } from "../base.adapter";
import { prisma } from "@/lib/prisma";
import { patchConnectionCredentials } from "@/lib/integration/core/credentials";
import type {
  ConnectionTestResult,
  PaginatedProducts,
  IntegProductInfo,
  StockUpdate,
  PriceUpdate,
  BatchResult,
  FetchOrdersResult,
  OrderItemInfo,
} from "@/lib/integration/types";
import { applyDiscount, parseTehranTime } from "@/lib/integration/types";

// مستند: docs/integrations/vendors/digikala.md — مرجع کامل API در
// docs/integrations/vendors/digikala/spec.yml
const BASE = "https://seller.digikala.com/open-api/v1";

// هر درخواست Open API باید User-Agent با فرمت دیجی‌کالا داشته باشد، وگرنه ۴۰۱
// «Invalid User-Agent!» — حتی با توکن سالم؛ پیش‌فرض‌هایی مثل curl/node هم رد می‌شوند.
// توکن اختصاصی: `DigikalaTrustedBot/SelfToken/{کد فروشندگی}`
// (docs/integrations/vendors/digikala/servicehub/01-getting-started.md بخش «هدر الزامی»)
function baseHeaders(accessToken?: string, userAgent?: string): HeadersInit {
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(userAgent ? { "User-Agent": userAgent } : {}),
    Accept:         "application/json",
    "Content-Type": "application/json",
  };
}

/** کد فروشندگی: مقدار فرم، وگرنه claim `seller_id` توکن. */
export function sellerCodeOf(credentials: Record<string, string>): string | undefined {
  const manual = credentials.sellerCode?.trim();
  if (manual) return manual;
  const id = jwtClaims(credentials.accessToken ?? "").seller_id;
  return id != null ? String(id) : undefined;
}

/** User-Agent ارسالی: مقدار دستی فرم (اگر دیجی‌کالا فرمت را عوض کرد)، وگرنه فرمت توکن اختصاصی. */
export function userAgentOf(credentials: Record<string, string>): string | undefined {
  const custom = credentials.userAgent?.trim();
  if (custom) return custom;
  const seller = sellerCodeOf(credentials);
  return seller ? `DigikalaTrustedBot/SelfToken/${seller}` : undefined;
}

interface DkPager { page?: number; item_per_page?: number; total_pages?: number; total_rows?: number }
interface DkList<T> { status?: string; data?: { pager?: DkPager; items?: T[] } }

interface DkVariant {
  id: number;
  product_id?: number;
  product_variant_id?: number;
  supplier_code?: string | null;
  title?: string;
  product_title?: string;
  main_category_title?: string;
  image_src?: string;
  active?: boolean;
  is_archived?: boolean;
  price_list?: number | null;
  price_sale?: number | null;
  marketplace_seller_stock?: number | null;
}

interface DkOrderItem {
  product_variant_id?: number;
  product_variant_title?: string;
  supplier_code?: string | null;
  order_id?: number;
  order_created_at?: string;
  quantity?: number;
  selling_price?: number;
  total_price?: number;
}

interface DkTokenData {
  access_token?: string;
  refresh_token?: string;
  scopes?: string[];
}

// ── کلید RSA و فعال‌سازی توکن اختصاصی ─────────────────────────────
// دیجی‌کالا توکن را مستقیم نمی‌دهد: فروشنده کلید عمومی RSA-4096 را در
// «سرویس‌هاب ← توکن اختصاصی» ثبت می‌کند، دیجی‌کالا یک «کد اعتبارسنجی» رمزشده با
// همان کلید (Base64) نشان می‌دهد و ما با کلید خصوصی بازش می‌کنیم و به
// /auth/token می‌فرستیم. کلید خصوصی هرگز از سرور بیرون نمی‌رود.

export function generateDigikalaKeyPair(): { publicKey: string; privateKey: string } {
  return generateKeyPairSync("rsa", {
    modulusLength:      4096,
    publicKeyEncoding:  { type: "spki",  format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

/** کد اعتبارسنجی Base64 پنل دیجی‌کالا → authorization_code خام. */
export function decryptAuthorizationCode(privateKey: string, encoded: string): string {
  const cipher = Buffer.from(encoded.replace(/\s+/g, ""), "base64");
  if (!cipher.length) throw new Error("کد اعتبارسنجی خالی یا نامعتبر است");

  // نوع padding در مستند نیامده؛ پیش‌فرض openssl در PHP همان PKCS#1 v1.5 است.
  // OAEP هم امتحان می‌شود تا اگر دیجی‌کالا عوضش کرد اتصال نشکند.
  const attempts = [
    { padding: constants.RSA_PKCS1_PADDING },
    { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
    { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
  ];
  const valid = (s: string | null) => !!s && /^[\x21-\x7e]+$/.test(s);
  for (const a of attempts) {
    try {
      const plain = privateDecrypt({ key: privateKey, ...a }, cipher).toString("utf8").trim();
      // PKCS#1 در OpenSSL جدید به‌جای خطا داده‌ی تصادفی برمی‌گرداند (implicit rejection)
      if (valid(plain)) return plain;
    } catch { /* padding بعدی */ }
  }
  // Node روی OpenSSL 3.0 (سرورهای ما: Node 22.15) رمزگشایی PKCS#1 را به‌خاطر حمله‌ی
  // Marvin کلاً رد می‌کند. این‌جا اوراکلی بیرون نمی‌رود (فقط ادمین، یک‌بار)، پس RSA
  // خام و برداشتن دستی padding نوع ۲: 00 02 [PS غیرصفر ≥۸] 00 پیام
  try {
    const raw = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, cipher);
    const sep = raw.indexOf(0, 2);
    if (raw[0] === 0 && raw[1] === 2 && sep >= 10) {
      const plain = raw.subarray(sep + 1).toString("utf8").trim();
      if (valid(plain)) return plain;
    }
  } catch { /* کلید یا کد نامعتبر */ }
  throw new Error("رمزگشایی کد ممکن نشد — کد را از همان صفحه‌ای کپی کنید که کلید عمومی همین پنل در آن ثبت شده است");
}

/** claimهای توکن دسترسی: token_id, seller_id, client_code, exp */
function jwtClaims(token: string): { exp?: number; client_code?: string; seller_id?: number } {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

/** زمان انقضای JWT (میلی‌ثانیه)؛ اگر خوانده نشد یک ساعت از الان. */
function jwtExpiry(token: string): number {
  const { exp } = jwtClaims(token);
  return typeof exp === "number" ? exp * 1000 : Date.now() + 60 * 60_000;
}

function tokenPatch(data: DkTokenData): Record<string, string> {
  const patch: Record<string, string> = {
    accessToken:     data.access_token!,
    accessExpiresAt: String(jwtExpiry(data.access_token!)),
  };
  if (data.refresh_token) patch.refreshToken = data.refresh_token;
  if (data.scopes?.length) patch.scopes = data.scopes.join(",");
  return patch;
}

async function errorText(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const j = JSON.parse(body) as { message?: string; errors?: Record<string, string[]> | string[] };
    const details = j.errors ? Object.values(j.errors).flat().join(" | ") : "";
    return `HTTP ${res.status}: ${[j.message, details].filter(Boolean).join(" — ")}`;
  } catch {
    return `HTTP ${res.status}: ${body.slice(0, 300)}`;
  }
}

/** authorization_code → توکن‌ها (همان patch قابل ذخیره در credentials). */
export async function exchangeAuthorizationCode(code: string, userAgent?: string): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/auth/token`, {
    method:  "POST",
    headers: baseHeaders(undefined, userAgent),
    body:    JSON.stringify({ authorization_code: code }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  const json = await res.json() as { data?: DkTokenData };
  if (!json.data?.access_token) throw new Error("دیجی‌کالا توکنی برنگرداند");
  return tokenPatch(json.data);
}

// توکن دسترسی یک ساعته است؛ کمی زودتر تازه می‌کنیم تا وسط یک دسته منقضی نشود
const REFRESH_MARGIN_MS = 5 * 60_000;

export class DigikalaAdapter extends BaseAdapter {
  readonly platformCode = "digikala";
  readonly platformName = "دیجی‌کالا";

  private static readonly PAGE_SIZE = 50;

  // مثل باسلام: refreshهای همزمان باید یکی شوند — هر refresh توکن قبلی را
  // باطل می‌کند و دو job همزمان توکن هم را می‌سوزانند.
  private static refreshInFlight: Promise<Record<string, string> | null> | null = null;

  private async refreshAccessToken(credentials: Record<string, string>): Promise<boolean> {
    const patch = await (DigikalaAdapter.refreshInFlight ??= (async () => {
      try {
        const { accessToken, refreshToken } = credentials;
        if (!accessToken?.trim() || !refreshToken?.trim()) return null;

        const res = await fetch(`${BASE}/auth/refresh-token`, {
          method:  "POST",
          headers: baseHeaders(undefined, userAgentOf(credentials)),
          body:    JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
        }).catch(() => null);
        if (!res?.ok) return null;

        const json = await res.json().catch(() => null) as { data?: DkTokenData } | null;
        if (!json?.data?.access_token) return null;

        // مستند: «refresh_token تازه را همیشه بازنویسی کنید»
        const next = tokenPatch(json.data);
        await patchConnectionCredentials(this.platformCode, next).catch(() => {});
        return next;
      } finally {
        DigikalaAdapter.refreshInFlight = null;
      }
    })());

    if (!patch) return false;
    Object.assign(credentials, patch);
    return true;
  }

  /** fetch با توکن؛ پیش از انقضا و روی ۴۰۱ یک‌بار توکن را تازه می‌کند. */
  private async authedFetch(
    credentials: Record<string, string>,
    path: string,
    init: Omit<RequestInit, "headers"> = {},
  ): Promise<Response> {
    if (!credentials.accessToken?.trim()) {
      throw new Error("توکن دیجی‌کالا فعال نشده است — از صفحه‌ی اتصال، کد اعتبارسنجی را وارد کنید");
    }
    const exp = Number(credentials.accessExpiresAt);
    if (exp && exp - Date.now() < REFRESH_MARGIN_MS) await this.refreshAccessToken(credentials);

    const url  = `${BASE}${path}`;
    const send = () => fetch(url, { ...init, headers: baseHeaders(credentials.accessToken, userAgentOf(credentials)) });
    let res = await send();

    // ۴۰۱ همیشه یعنی توکن منقضی نیست: «Invalid User-Agent!» را refresh درست نمی‌کند و
    // فقط یک توکن تازه می‌سوزاند
    if (res.status === 401 && !(await DigikalaAdapter.isUserAgentError(res.clone()))
      && (await this.refreshAccessToken(credentials))) res = await send();

    // سقف درخواست هر مسیر جداست (مثلاً ۳۳ در ۳۰ ثانیه) و زمان آزاد شدنش در بدنه‌ی
    // پاسخ می‌آید؛ یک‌بار صبر و تلاش دوباره، نه شکست کل دسته
    if (res.status === 429) {
      const wait = await DigikalaAdapter.retryAfterMs(res.clone());
      if (wait != null) {
        await this.rateLimit(wait);
        res = await send();
      }
    }
    return res;
  }

  private static async isUserAgentError(res: Response): Promise<boolean> {
    const body = await res.text().catch(() => "");
    return /user-agent/i.test(body);
  }

  private static async retryAfterMs(res: Response): Promise<number | null> {
    // servicehub/03-rate-limits.md: هدر Retry-After (ثانیه) روی ۴۲۹؛ وگرنه resetTime بدنه
    const header = Number(res.headers.get("retry-after"));
    if (header > 0) return header <= 60 ? header * 1000 + 500 : null;
    const json = await res.json().catch(() => null) as
      | { rate_limit?: { resetTime?: { date?: string } } }
      | null;
    const at = parseTehranTime(json?.rate_limit?.resetTime?.date?.replace(/\.\d+$/, ""));
    const ms = at ? at.getTime() - Date.now() + 500 : 30_000;
    return ms > 0 && ms <= 60_000 ? ms : null;
  }

  // ── تست اتصال — پروفایل فروشنده ──────────────────────────────────
  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    try {
      const res = await this.authedFetch(credentials, "/profile");
      if (res.status === 401) {
        if (await DigikalaAdapter.isUserAgentError(res.clone())) {
          return { success: false, message: `دیجی‌کالا User-Agent را نپذیرفت (${userAgentOf(credentials) ?? "خالی"}) — «کد فروشندگی» را بررسی کنید` };
        }
        return { success: false, message: `توکن منقضی یا باطل شده — در پنل دیجی‌کالا توکن را دوباره فعال و کد تازه را وارد کنید (${await errorText(res)})` };
      }
      if (res.status === 403) return { success: false, message: "توکن به پروفایل فروشنده دسترسی ندارد (۴۰۳)" };
      if (!res.ok) return { success: false, message: await errorText(res) };

      const json = await res.json() as { data?: { seller_id?: number; seller_name?: string } };
      const d = json.data ?? {};
      return {
        success: true,
        message: `اتصال برقرار شد — فروشنده: ${d.seller_name ?? d.seller_id ?? "؟"}`,
        shopInfo: { vendorTitle: d.seller_name, identifier: d.seller_id != null ? String(d.seller_id) : undefined },
      };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "خطای شبکه" };
    }
  }

  // ── دریافت تنوع‌ها (DKPC) — واحد نگاشت در دیجی‌کالا تنوع است، نه محصول ──
  async fetchProducts(
    credentials: Record<string, string>,
    page = 1,
  ): Promise<PaginatedProducts> {
    const size = DigikalaAdapter.PAGE_SIZE;
    const res = await this.authedFetch(credentials, `/variants?page=${page}&size=${size}`);
    if (!res.ok) throw new Error(await errorText(res));

    const json  = await res.json() as DkList<DkVariant>;
    const raw   = json.data?.items ?? [];
    const pager = json.data?.pager ?? {};

    // قیمت‌های دیجی‌کالا ریالی است — داخلی همه‌جا تومان.
    // price_sale قیمت فروش فروشنده است؛ price_list «قیمت مرجع» دیجی‌کالاست و تخفیف
    // فروشنده نیست، پس به‌عنوان originalPrice ذخیره نمی‌شود. تخفیف‌ها (پروموشن) در
    // پنل دیجی‌کالا جدا مدیریت می‌شوند.
    const items: IntegProductInfo[] = raw
      .filter((v) => !v.is_archived)
      .map((v) => ({
        platformId:   String(v.id),
        title:        v.title ?? v.product_title ?? String(v.id),
        sku:          v.supplier_code ?? undefined,
        categoryName: v.main_category_title,
        salePrice:    v.price_sale != null ? Math.round(v.price_sale / 10) : undefined,
        stock:        v.marketplace_seller_stock ?? undefined,
        imageUrls:    v.image_src ? [v.image_src] : undefined,
        publicRefs: {
          ...(v.product_id != null ? { product: String(v.product_id) } : {}),
          ...(v.product_variant_id != null ? { variant: String(v.product_variant_id) } : {}),
        },
      }));

    const current = pager.page ?? page;
    const total   = pager.total_pages ?? current;
    return { items, total: pager.total_rows ?? items.length, page: current, hasMore: current < total };
  }

  // ── موجودی: فقط «موجودی نزد فروشنده»؛ موجودی انبار دیجی‌کالا دست ما نیست ──
  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdate[],
  ): Promise<BatchResult> {
    return this.runBatch(credentials, "/batch/variant/seller-stock/update", updates, (u) => ({
      seller_stock: Math.max(0, Math.floor(u.stock)),
    }));
  }

  // ── قیمت: selling_price به ریال ─────────────────────────────────────
  // دیجی‌کالا یک قیمت فروش دارد و فیلد تخفیف فروشنده ندارد (پروموشن‌ها جدا در
  // پنل دیجی‌کالا). مثل تپسی، تخفیف پنل ما با ارسال «قیمت نهایی» اعمال می‌شود.
  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdate[],
  ): Promise<BatchResult> {
    return this.runBatch(credentials, "/batch/variant/update", updates, (u) => ({
      selling_price: applyDiscount(u.price, u.discount).effective * 10,
    }));
  }

  // ── ارسال دسته‌ای ────────────────────────────────────────────────────
  // سقف نوشتن تنگ است: ۲۰۰ در ساعت برای هر مسیر و ۷۰ در ۳۰ دقیقه برای هر IP
  // (servicehub/03-rate-limits.md). ارسال تک‌تنوعی با چند صد محصول همان دور اول
  // به ۴۲۹ می‌خورد؛ API دسته‌ای کل دسته را یک درخواست حساب می‌کند. کار ناهمگام است:
  // batch_id برمی‌گردد و نتیجه‌ی هر قلم با /batch/inquiry خوانده می‌شود.
  private static readonly BATCH_SIZE    = 100;
  private static readonly BATCH_WAIT_MS = 120_000;

  private async runBatch<T extends { platformProductId: string }>(
    credentials: Record<string, string>,
    path: string,
    updates: T[],
    payload: (u: T) => Record<string, unknown>,
  ): Promise<BatchResult> {
    const success: string[] = [];
    const failed:  { id: string; error: string }[] = [];

    const valid = updates.filter((u) => {
      if (/^\d+$/.test(u.platformProductId)) return true;
      failed.push({ id: u.platformProductId, error: "شناسه‌ی تنوع دیجی‌کالا باید عدد باشد" });
      return false;
    });

    for (let i = 0; i < valid.length; i += DigikalaAdapter.BATCH_SIZE) {
      const chunk = valid.slice(i, i + DigikalaAdapter.BATCH_SIZE);
      const ids   = chunk.map((u) => u.platformProductId);
      try {
        const res = await this.authedFetch(credentials, path, {
          method: "POST",
          body:   JSON.stringify({
            deadline: 600,
            items:    chunk.map((u) => ({ variant_id: Number(u.platformProductId), payload: payload(u) })),
          }),
        });
        if (!res.ok) {
          const error = await errorText(res);
          failed.push(...ids.map((id) => ({ id, error })));
          continue;
        }
        const json = await res.json() as { data?: { batch_id?: number } };
        const batchId = json.data?.batch_id;
        if (batchId == null) {
          failed.push(...ids.map((id) => ({ id, error: "دیجی‌کالا شناسه‌ی دسته را برنگرداند" })));
          continue;
        }
        const outcome = await this.waitForBatch(credentials, batchId);
        for (const id of ids) {
          const r = outcome.get(id);
          // تا پایان مهلت تمام نشد: ثبت شده و در دیجی‌کالا ادامه دارد — شکست حسابش نمی‌کنیم
          // چون ارسال دوباره همان دسته را تکرار می‌کند
          if (!r || r.ok) success.push(id);
          else failed.push({ id, error: r.error });
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : "خطای شبکه";
        failed.push(...ids.map((id) => ({ id, error })));
      }
    }
    return { success, failed };
  }

  /** نتیجه‌ی هر قلم دسته (کلید = variant_id)؛ اگر تا مهلت تمام نشد، نقشه‌ی خالی. */
  private async waitForBatch(
    credentials: Record<string, string>,
    batchId: number,
  ): Promise<Map<string, { ok: boolean; error: string }>> {
    const result = new Map<string, { ok: boolean; error: string }>();
    const until  = Date.now() + DigikalaAdapter.BATCH_WAIT_MS;
    let delay = 2000;
    while (Date.now() < until) {
      await this.rateLimit(delay);
      delay = Math.min(delay * 1.5, 10_000);
      const res = await this.authedFetch(credentials, "/batch/inquiry", {
        method: "POST",
        body:   JSON.stringify({ batch_id: batchId }),
      }).catch(() => null);
      if (!res?.ok) continue;
      const json = await res.json().catch(() => null) as
        | { data?: { status?: string; items?: { key?: number | string; status?: string; errors?: unknown }[] } }
        | null;
      if (json?.data?.status === "processing" || !json?.data?.items) continue;
      for (const it of json.data.items) {
        if (it.key == null) continue;
        const ok = it.status === "success";
        result.set(String(it.key), {
          ok,
          error: ok ? "" : typeof it.errors === "string" ? it.errors : JSON.stringify(it.errors ?? it.status),
        });
      }
      return result;
    }
    return result;
  }

  // ── سفارش‌ها: اقلام سفارش «فعال» ─────────────────────────────────
  // /orders فقط اقلامی را می‌دهد که هنوز باید به انبار دیجی‌کالا ارسال شوند؛
  // مشتری دیجی‌کالاست، پس نام و تلفن خریدار نمی‌آید. هر دور همه‌ی صفحه‌ها خوانده
  // می‌شود و تکرار با کلید یکتای قلم (سفارش:تنوع) بی‌اثر است.
  async fetchOrders(
    credentials: Record<string, string>,
    cursor?: string,
  ): Promise<FetchOrdersResult> {
    const page = Number(cursor) || 1;
    const res  = await this.authedFetch(credentials, `/orders?page=${page}&size=${DigikalaAdapter.PAGE_SIZE}`);
    if (!res.ok) throw new Error(await errorText(res));

    const json  = await res.json() as DkList<DkOrderItem>;
    const rows  = json.data?.items ?? [];
    const pager = json.data?.pager ?? {};

    const variantMap = rows.length ? await this.variantIdMap() : new Map<string, string>();

    const items: OrderItemInfo[] = rows.map((r, idx) => {
      const orderNo = String(r.order_id ?? "");
      const pvid    = r.product_variant_id != null ? String(r.product_variant_id) : "";
      const key     = pvid || `__noId:${idx}`;
      const qty     = r.quantity && r.quantity > 0 ? r.quantity : 1;
      // total_price = قیمت × تعداد منهای تخفیف مدیر — ریال
      const total   = typeof r.total_price === "number" ? r.total_price : (r.selling_price ?? 0) * qty;
      return {
        platformOrderId:     `${orderNo}:${key}`,
        platformOrderNo:     orderNo,
        platformOrderItemId: key,
        platformProductId:   (pvid && variantMap.get(pvid)) || pvid,
        qty,
        title:               r.product_variant_title,
        unitPrice:           total > 0 ? Math.round(total / qty / 10) : undefined, // تومان
        orderedAt:           r.order_created_at ? new Date(r.order_created_at) : undefined,
      };
    });

    const totalPages = pager.total_pages ?? page;
    const hasMore    = page < totalPages;
    return { items, hasMore, cursor: hasMore ? String(page + 1) : undefined };
  }

  /**
   * سفارش‌ها product_variant_id می‌دهند ولی کلید نگاشت `id` فهرست تنوع‌هاست؛
   * اگر این دو متفاوت باشند، از refs ذخیره‌شده در «دریافت محصولات» ترجمه می‌شود.
   */
  private async variantIdMap(): Promise<Map<string, string>> {
    const rows = await prisma.integPlatformProduct.findMany({
      where:  { platformCode: this.platformCode },
      select: { platformProductId: true, rawData: true },
    });
    const map = new Map<string, string>();
    for (const r of rows) {
      const variant = (r.rawData as { refs?: { variant?: string } } | null)?.refs?.variant;
      if (variant) map.set(variant, r.platformProductId);
    }
    return map;
  }
}
