import { BaseAdapter } from "../base.adapter";
import type { FetchOrdersResult, OrderItemInfo } from "@/lib/integration/types";
import { applyDiscount } from "@/lib/integration/types";

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

  // ── تست اتصال + دریافت vendorId ──────────────────────────────────

  async testConnection(
    credentials: Record<string, string>,
  ): Promise<ConnectionTestResult> {
    const { accessToken } = credentials;
    if (!accessToken?.trim()) return { success: false, message: "Access Token وارد نشده" };

    try {
      const res = await fetch(`${OPENAPI_BASE}/v1/users/me`, {
        headers: this.headers(accessToken),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        return { success: false, message: body.message ?? `HTTP ${res.status}` };
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
    const { accessToken, vendorId } = credentials;

    if (!vendorId) throw new Error("vendorId تنظیم نشده — اتصال را دوباره تست کنید");

    const url = `${OPENAPI_BASE}/v1/vendors/${vendorId}/products?page=${page}&per_page=${pageSize}`;
    const res = await fetch(url, { headers: this.headers(accessToken) });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? `HTTP ${res.status}`);
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



  // باسلام در Batch Update فقط فیلد `price` را می‌پذیرد و آن «قیمت مؤثر» است —
  // یعنی همان مبلغی که خریدار می‌پردازد (primary_price فقط قیمت خط‌خورده است و
  // وقتی تخفیف فعال باشد پر می‌شود).
  //
  // قبلاً قیمت محاسبه‌شده مستقیم در `price` می‌نشست و تخفیف محصول از بین می‌رفت.
  // حالا درصد تخفیف قبلی روی قیمت پایه‌ی جدید اعمال می‌شود و «قیمت مؤثر» ارسال
  // می‌شود؛ پس نسبت تخفیف حفظ می‌ماند و مشتری همان درصد تخفیف را می‌بیند.
  //
  // بعد از آن تلاش می‌شود کمپین تخفیف هم بازسازی شود تا قیمت خط‌خورده تازه شود.
  // ⚠ مسیر REST سرویس تخفیف در مستندات باسلام نیامده (فقط متد SDK مستند است)،
  // پس این مرحله «تلاش بهترین‌کوشش» است و پیش‌فرض خاموش: با مقدار
  // `enableDiscountCampaign = "true"` در credentials فعال می‌شود. خاموش‌بودنش
  // ضرری ندارد چون قیمت مؤثر از قبل درست ارسال شده است.
  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdate[],
  ): Promise<BatchResult> {
    const result = await this.bulkUpdate(
      credentials,
      updates.map((u) => {
        const { effective } = applyDiscount(u.price, u.discount);
        return {
          id:    parseInt(u.platformProductId, 10),
          price: effective * 10,   // تومان → ریال
        };
      }),
      updates.map((u) => u.platformProductId),
    );

    if (credentials.enableDiscountCampaign === "true") {
      const successSet = new Set(result.success);
      for (const u of updates) {
        if (!successSet.has(u.platformProductId)) continue;
        if (!u.discount || !(u.discount.percent > 0)) continue;
        await this.applyDiscountCampaign(credentials, u.platformProductId, u.discount).catch((err) => {
          // شکست بازسازی کمپین نباید قیمت درست‌ارسال‌شده را باطل کند
          console.error("[basalam] بازسازی کمپین تخفیف ناموفق:", err instanceof Error ? err.message : err);
        });
      }
    }

    return result;
  }

  // ── بازسازی کمپین تخفیف (اختیاری — مسیر REST تأییدنشده) ──────────
  private async applyDiscountCampaign(
    credentials: Record<string, string>,
    platformProductId: string,
    discount: { percent: number; endsAt?: Date | null },
  ): Promise<void> {
    const { accessToken, vendorId } = credentials;
    if (!vendorId) return;

    const percent = Math.round(discount.percent);
    if (!(percent > 0) || percent >= 100) return;

    // باسلام تخفیف را زمان‌دار می‌گیرد؛ اگر پایان مشخص نبود ۳۰ روز در نظر می‌گیریم
    let activeDays = 30;
    if (discount.endsAt) {
      const days = Math.ceil((discount.endsAt.getTime() - Date.now()) / 86_400_000);
      if (days > 0) activeDays = days;
    }

    await this.rateLimit(200);
    const res = await fetch(`${CORE_BASE}/v3/vendors/${vendorId}/discounts`, {
      method:  "POST",
      headers: this.headers(accessToken),
      body:    JSON.stringify({
        product_filter:   { product_ids: [parseInt(platformProductId, 10)] },
        discount_percent: percent,
        active_days:      activeDays,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  }

  async fetchOrders(
  credentials: Record<string, string>,
  cursor?: string,
): Promise<FetchOrdersResult> {
  const { accessToken } = credentials;

  const params = new URLSearchParams({
    statuses: "3739", // فقط سفارش‌های جدید
    per_page: "30",
    // نکته: پارامتر sort توسط باسلام پذیرفته نمی‌شود (422: مرتب سازی معتبر نمی باشد)
  });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`${OPENAPI_BASE}/v1/vendor-parcels?${params}`, {
    headers: this.headers(accessToken),
  });

  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    // بدنه کامل خطا برای دیباگ — در لاگ ادمین دیده می‌شود
    throw new Error(`HTTP ${res.status}: ${rawText.slice(0, 400) || "(بدون بدنه)"}`);
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
    const { accessToken, vendorId } = credentials;
    if (!vendorId) throw new Error("vendorId تنظیم نشده");

    const success: string[] = [];
    const failed:  { id: string; error: string }[] = [];

    for (let i = 0; i < data.length; i += BasalamAdapter.CHUNK_SIZE) {
      const chunk    = data.slice(i, i + BasalamAdapter.CHUNK_SIZE);
      const chunkIds = ids.slice(i, i + BasalamAdapter.CHUNK_SIZE);

      try {
        await this.rateLimit(200);

        const res = await fetch(
          `${CORE_BASE}/v3/vendors/${vendorId}/products`,
          {
            method:  "PATCH",
            headers: this.headers(accessToken),
            body:    JSON.stringify({ data: chunk }),
          },
        );

         if (!res.ok) {
          const rawText = await res.text().catch(() => "");
          let detail = `HTTP ${res.status}`;
          try {
            const body = JSON.parse(rawText) as {
              message?: string;
              errors?: { message?: string; fields?: string[] }[];
            };
            if (body.errors?.length) {
              detail = body.errors
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
