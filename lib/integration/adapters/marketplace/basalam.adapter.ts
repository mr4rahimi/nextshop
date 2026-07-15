import { BaseAdapter } from "../base.adapter";
import type { FetchOrdersResult } from "@/lib/integration/types";

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
  id:           number;
  title:        string;
  price:        number;
  photo:        { original: string; xs: string; sm: string } | null;
  status:       { name: string; value: number } | null;
  inventory:    number;
  is_wholesale: boolean;
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

    const items: IntegProductInfo[] = data.data.map((p) => ({
      platformId: String(p.id),
      title:      p.title,
      salePrice:  p.price,
      stock:      p.inventory,
      imageUrls:  p.photo?.sm ? [p.photo.sm] : undefined,
    }));

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



  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdate[],
  ): Promise<BatchResult> {
    return this.bulkUpdate(
      credentials,
      updates.map((u) => ({
        id:    parseInt(u.platformProductId, 10),
        price: (u.salePrice ?? u.price) * 10,  
      })),
      updates.map((u) => u.platformProductId),
    );
  }

  async fetchOrders(
  credentials: Record<string, string>,
  cursor?: string,
): Promise<FetchOrdersResult> {
  const { accessToken } = credentials;

  const params = new URLSearchParams({
    statuses: "3739", // فقط سفارش‌های جدید
    per_page: "30",
    sort:     "created_at:asc",
  });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`${OPENAPI_BASE}/v1/vendor-parcels?${params}`, {
    headers: this.headers(accessToken),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json() as {
    data: {
      id: number;
      recipient?: { name?: string; mobile?: string } | null;
      customer?:  { name?: string; mobile?: string } | null;
      items: { id: number; quantity: number; title: string; price?: number; product: { id: number; price?: number } }[];
    }[];
    next_cursor?: string;
  };

  const items = data.data.flatMap((parcel) => {
    const person = parcel.recipient ?? parcel.customer ?? null;
    return parcel.items.map((item) => {
      // قیمت باسلام به ریال است — داخلی به تومان نگه می‌داریم
      const rawPrice = item.price ?? item.product?.price;
      return {
        platformOrderId:     `${parcel.id}:${item.id}`, // یکتا در سطح آیتم
        platformOrderItemId: String(item.id),
        platformProductId:   String(item.product.id),
        qty:                 item.quantity,
        title:               item.title,
        unitPrice:           typeof rawPrice === "number" ? Math.round(rawPrice / 10) : undefined,
        customerName:        person?.name ?? undefined,
        customerPhone:       person?.mobile ?? undefined,
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
            if (rawText) detail = `HTTP ${res.status}: ${rawText.slice(0, 200)}`;
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
