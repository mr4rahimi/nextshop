import { BaseAdapter } from "../base.adapter";
import { prisma } from "@/lib/prisma";
import type { FetchOrdersResult, OrderItemInfo } from "@/lib/integration/types";
import { applyDiscount } from "@/lib/integration/types";
import { toTehranDate } from "@/lib/integration/core/discount";
import { patchConnectionCredentials } from "@/lib/integration/core/credentials";

import type {
  ConnectionTestResult,
  PaginatedProducts,
  IntegProductInfo,
  StockUpdate,
  PriceUpdate,
  BatchResult,
} from "@/lib/integration/types";

const OPENAPI_BASE = "https://openapi.basalam.com";
const CORE_BASE    = "https://core.basalam.com";
const AUTH_BASE    = "https://auth.basalam.com";

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
    const res = await fetch(url, { ...init, headers: this.headers(credentials.accessToken) });
    if (res.status !== 401) return res;

    if (!(await this.refreshAccessToken(credentials, persistRefresh))) return res;
    return fetch(url, { ...init, headers: this.headers(credentials.accessToken) });
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
    return this.bulkUpdate(
      credentials,
      updates.map((u) => ({
        id:    parseInt(u.platformProductId, 10),
        stock: u.stock,
      })),
      updates.map((u) => u.platformProductId),
    );
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
    for (const u of updates) {
      if (!hasCampaign.has(u.platformProductId)) continue;
      try {
        await this.removeDiscountCampaign(credentials, u.platformProductId);
      } catch (err) {
        // ادامه می‌دهیم: اگر کمپین واقعاً مانده باشد، خود باسلام ارسال قیمت را
        // رد می‌کند و پیامش در نتیجه دیده می‌شود.
        clearFailed.set(u.platformProductId, err instanceof Error ? err.message : String(err));
      }
    }

    const result = await this.bulkUpdate(
      credentials,
      updates.map((u) => {
        const { original } = applyDiscount(u.price, u.discount);
        return {
          id:    parseInt(u.platformProductId, 10),
          price: original * 10,   // تومان → ریال؛ باسلام خودش تخفیف را حساب می‌کند
        };
      }),
      updates.map((u) => u.platformProductId),
    );

    const successSet = new Set(result.success);
    for (const u of updates) {
      if (!successSet.has(u.platformProductId)) continue;
      if (!u.discount || !(u.discount.percent > 0)) continue;
      try {
        await this.applyDiscountCampaign(credentials, u.platformProductId, u.discount);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failMove(result, u.platformProductId, `قیمت ارسال شد ولی ساخت کمپین تخفیف ناموفق بود: ${msg}`);
      }
    }

    for (const [id, msg] of clearFailed) {
      if (!successSet.has(id)) continue;
      failMove(result, id, `حذف کمپین تخفیف قبلی ناموفق بود: ${msg}`);
    }

    return result;
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
  const params = new URLSearchParams({
    statuses: "3739", // فقط سفارش‌های جدید
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
      items: { id: number; quantity: number; title: string; price?: number; product: { id: number; price?: number } }[];
    }[];
    next_cursor?: string;
  };

  const items: OrderItemInfo[] = data.data.flatMap((parcel) => {
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
        qty,
        title:               item.title,
        unitPrice:           typeof rawPrice === "number" ? Math.round(rawPrice / 10) : undefined,
        customerName:        name,
        customerPhone:       mobile,
      };
    });
  });

  return { items, hasMore: !!data.next_cursor, cursor: data.next_cursor };
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
}
