import { BaseAdapter } from "../base.adapter";
import type {
  ConnectionTestResult,
  PaginatedProducts,
  IntegProductInfo,
  StockUpdate,
  PriceUpdate,
  BatchResult,
  FetchOrdersResult,
} from "@/lib/integration/types";

const BASE = "https://vendorgw.tapsi.shop/Web/Hub/vendors/v1";

// هدرهای ثابت طبق مستندات تپسی‌شاپ
function baseHeaders(token: string): HeadersInit {
  return {
    "accept":                    "application/json",
    "client-name":               "mymonta-integration",
    "client-version":            "1.0.0.0",
    "Content-Type":              "application/json",
    "TapsiShop.Hub.Authorization": token,
  };
}

// ── شکل پاسخ‌های API تپسی ─────────────────────────────────────────
interface TapsiVendorInfo {
  data?: { vendorId?: string; vendorName?: string; storeName?: string; storeLink?: string; storeNumber?: string };
  success: boolean;
  messages?: { message?: string }[];
}

interface TapsiProduct {
  id:             string;
  hsin:           string | null;
  sku:            string | null;
  originalPrice:  number | null;
  finalPrice:     number | null;
  minimalPerOrder: number | null;
  maximalPerOrder: number | null;
  onHandQuantity: number | null;
}

interface TapsiProductsResponse {
  data?: { page: number; pageSize: number; totalCount: number; items: TapsiProduct[] };
  success: boolean;
  messages?: { message?: string }[];
}

interface TapsiOrderListResponse {
  data?: { pageNumber: number; pageSize: number; totalItems: number; items: { id: string; orderNumber: string; stateCode: string; finalPrice: number; createdOn: string }[] };
  success: boolean;
}

interface TapsiOrderDetail {
  data?: {
    order?: { orderNumber?: string; originalAmount?: string; amountAfterDiscount?: string; status?: string };
    items?: { name?: string; sku?: string; price?: string; finalPrice?: string; state?: string; cancelReason?: string }[];
  };
  success: boolean;
}

export class TapsiAdapter extends BaseAdapter {
  readonly platformCode = "tapsi_shop";
  readonly platformName = "تپسی‌شاپ";

  private static readonly CHUNK_SIZE = 50;

  // ── تست اتصال — سرویس اطلاعات فروشگاه ────────────────────────────
  async testConnection(
    credentials: Record<string, string>,
  ): Promise<ConnectionTestResult> {
    const { token } = credentials;
    if (!token?.trim()) return { success: false, message: "توکن وارد نشده" };

    try {
      const res = await fetch(`${BASE}/vendor-information`, { headers: baseHeaders(token) });
      if (res.status === 401) return { success: false, message: "توکن نامعتبر است (۴۰۱)" };
      if (!res.ok) return { success: false, message: `HTTP ${res.status}` };

      const info = await res.json() as TapsiVendorInfo;
      if (!info.success || !info.data) {
        return { success: false, message: info.messages?.[0]?.message ?? "پاسخ نامعتبر" };
      }

      return {
        success: true,
        message: `اتصال برقرار شد — فروشگاه: ${info.data.storeName ?? info.data.vendorName ?? ""}`,
        shopInfo: {
          vendorId:    info.data.vendorId ? Number(info.data.vendorId) : undefined,
          vendorTitle: info.data.storeName ?? info.data.vendorName,
          identifier:  info.data.storeLink,
        },
      };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "خطای شبکه" };
    }
  }

  // ── دریافت محصولات (برای mapping + auto-match) ───────────────────
  async fetchProducts(
    credentials: Record<string, string>,
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedProducts> {
    const { token } = credentials;
    const res = await fetch(`${BASE}/products/${page}/${pageSize}`, { headers: baseHeaders(token) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as TapsiProductsResponse;
    if (!data.success || !data.data) throw new Error(data.messages?.[0]?.message ?? "پاسخ نامعتبر");

    const { items: rawItems, totalCount, pageSize: ps } = data.data;

    const items: IntegProductInfo[] = rawItems.map((p) => ({
      platformId: p.id,                          // شناسه تپسی — کلید نگاشت
      title:      p.sku ?? p.hsin ?? p.id,        // تپسی عنوان ندارد؛ sku/hsin نمایش داده می‌شود
      salePrice:  p.finalPrice != null ? Math.round(p.finalPrice / 10) : undefined, // ریال→تومان
      stock:      p.onHandQuantity ?? undefined,
      sku:        p.sku ?? undefined,
    }));

    return {
      items,
      total:   totalCount,
      page,
      hasMore: page * ps < totalCount,
    };
  }

  // ── ارسال موجودی ─────────────────────────────────────────────────
  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdate[],
  ): Promise<BatchResult> {
    return this.bulkUpdate(
      credentials,
      updates.map((u) => ({ id: u.platformProductId, stock: u.stock })),
      updates.map((u) => u.platformProductId),
    );
  }

  // ── ارسال قیمت (تومان×۱۰ = ریال) ─────────────────────────────────
  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdate[],
  ): Promise<BatchResult> {
    return this.bulkUpdate(
      credentials,
      updates.map((u) => {
        const toman = u.salePrice ?? u.price;
        return { id: u.platformProductId, price: toman * 10, specialPrice: toman * 10 };
      }),
      updates.map((u) => u.platformProductId),
    );
  }

  // ── bulk update: PUT /products ───────────────────────────────────
  private async bulkUpdate(
    credentials: Record<string, string>,
    products: Record<string, unknown>[],
    ids: string[],
  ): Promise<BatchResult> {
    const { token } = credentials;
    const success: string[] = [];
    const failed:  { id: string; error: string }[] = [];

    for (let i = 0; i < products.length; i += TapsiAdapter.CHUNK_SIZE) {
      const chunk    = products.slice(i, i + TapsiAdapter.CHUNK_SIZE);
      const chunkIds = ids.slice(i, i + TapsiAdapter.CHUNK_SIZE);

      // referenceCode برای ردیابی هر آیتم در پاسخ
      const payload = chunk.map((c, idx) => ({ ...c, referenceCode: chunkIds[idx] }));

      try {
        await this.rateLimit(200);
        const res = await fetch(`${BASE}/products`, {
          method:  "PUT",
          headers: baseHeaders(token),
          body:    JSON.stringify({ products: payload }),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          failed.push(...chunkIds.map((id) => ({ id, error: `HTTP ${res.status}: ${txt.slice(0, 150)}` })));
          continue;
        }

        const body = await res.json().catch(() => null) as
          | { data?: { data?: { sku?: string; referenceCode?: string; status?: boolean; messages?: string[] }[] } }
          | null;

        const results = body?.data?.data;
        if (Array.isArray(results)) {
          const map = new Map(results.map((r) => [r.referenceCode ?? r.sku ?? "", r]));
          for (const id of chunkIds) {
            const r = map.get(id);
            if (r && r.status === false) {
              failed.push({ id, error: r.messages?.join(" | ") ?? "رد شد توسط تپسی" });
            } else {
              success.push(id);
            }
          }
        } else {
          success.push(...chunkIds);
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : "خطای شبکه";
        failed.push(...chunkIds.map((id) => ({ id, error })));
      }
    }

    return { success, failed };
  }

  // ── دریافت سفارش‌ها (polling — پشتیبان وب‌هوک) ───────────────────
  // فقط سفارش‌های «تأیید شده» (orderStatusId=4)
  async fetchOrders(
    credentials: Record<string, string>,
    cursor?: string,
  ): Promise<FetchOrdersResult> {
    const { token } = credentials;
    const pageNumber = cursor ? Number(cursor) : 0;

    const listRes = await fetch(`${BASE}/orders`, {
      method:  "POST",
      headers: baseHeaders(token),
      body:    JSON.stringify({ pageNumber, pageSize: 20, orderStatusId: ["4"] }),
    });
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

    const list = await listRes.json() as TapsiOrderListResponse;
    const orders = list.data?.items ?? [];

    const items: {
      platformOrderId: string;
      platformOrderItemId: string;
      platformProductId: string;
      qty: number;
      title: string;
      unitPrice?: number;
    }[] = [];
    for (const o of orders) {
      // جزئیات هر سفارش برای گرفتن اقلام و sku
      const detRes = await fetch(`${BASE}/orders/${o.id}`, { headers: baseHeaders(token) });
      if (!detRes.ok) continue;
      const det = await detRes.json() as TapsiOrderDetail;
      const detItems = det.data?.items ?? [];

      detItems.forEach((it, idx) => {
        if (it.state === "لغو" || it.cancelReason) return; // اقلام لغوشده رد می‌شوند
        const priceRial = it.finalPrice ? Number(it.finalPrice) : it.price ? Number(it.price) : NaN;
        items.push({
          platformOrderId:     `${o.id}:${idx}`,
          platformOrderItemId: String(idx),
          platformProductId:   it.sku ?? "",   // تپسی محصول را با sku می‌شناسد
          qty:                 1,
          title:               it.name ?? "",
          unitPrice:           Number.isFinite(priceRial) ? Math.round(priceRial / 10) : undefined,
        });
      });
      await this.rateLimit(150);
    }

    const hasMore = (list.data?.totalItems ?? 0) > (pageNumber + 1) * 20;
    return { items, hasMore, cursor: hasMore ? String(pageNumber + 1) : undefined };
  }
}
