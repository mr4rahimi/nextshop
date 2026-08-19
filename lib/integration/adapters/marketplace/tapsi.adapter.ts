import { BaseAdapter } from "../base.adapter";
import { prisma } from "@/lib/prisma";
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
import { applyDiscount } from "@/lib/integration/types";

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

    // تپسی هر دو قیمت را می‌دهد: originalPrice = قیمت اصلی، finalPrice = بعد از تخفیف.
    // هر دو را نگه می‌داریم وگرنه موقع ارسال قیمت جدید، تخفیف قابل بازسازی نیست.
    const items: IntegProductInfo[] = rawItems.map((p) => {
      const original = p.originalPrice != null ? Math.round(p.originalPrice / 10) : undefined; // ریال→تومان
      const final    = p.finalPrice    != null ? Math.round(p.finalPrice / 10)    : undefined;
      const hasDiscount = original != null && final != null && original > 0 && final < original;
      return {
        platformId: p.id,                          // شناسه تپسی — کلید نگاشت
        title:      p.sku ?? p.hsin ?? p.id,        // تپسی عنوان ندارد؛ sku/hsin نمایش داده می‌شود
        salePrice:  final ?? original,
        originalPrice:   hasDiscount ? original : undefined,
        discountPercent: hasDiscount ? Math.round(((original! - final!) / original!) * 10000) / 100 : undefined,
        stock:      p.onHandQuantity ?? undefined,
        sku:        p.sku ?? undefined,
      };
    });

    return {
      items,
      total:   totalCount,
      page,
      hasMore: page * ps < totalCount,
    };
  }

  // تپسی در سرویس بروزرسانی، فیلد id را «SKU فروشنده» می‌خواهد نه شناسه محصول
  private async resolveSkus(platformProductIds: string[]): Promise<Map<string, string>> {
    const rows = await prisma.integPlatformProduct.findMany({
      where:  { platformCode: this.platformCode, platformProductId: { in: platformProductIds } },
      select: { platformProductId: true, sku: true },
    });
    return new Map(
      rows.filter((r) => r.sku).map((r) => [r.platformProductId, r.sku as string]),
    );
  }

  // ── ارسال موجودی ─────────────────────────────────────────────────
  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdate[],
  ): Promise<BatchResult> {
    const ids    = updates.map((u) => u.platformProductId);
    const skuMap = await this.resolveSkus(ids);
    return this.bulkUpdate(
      credentials,
      updates.map((u) => ({
        id:    skuMap.get(u.platformProductId) ?? u.platformProductId,
        stock: u.stock,
      })),
      ids, // referenceCode برای گزارش نتیجه — شناسه داخلی نگاشت
    );
  }

  // ── ارسال قیمت (تومان×۱۰ = ریال) ─────────────────────────────────
  // تپسی دو قیمت مجزا می‌گیرد: price = قیمت اصلی، specialPrice = قیمت نهایی.
  // برابر گذاشتن این دو، تخفیف محصول را پاک می‌کند — پس درصد تخفیف قبلی را
  // روی قیمت اصلیِ جدید بازسازی می‌کنیم.
  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdate[],
  ): Promise<BatchResult> {
    const ids    = updates.map((u) => u.platformProductId);
    const skuMap = await this.resolveSkus(ids);
    return this.bulkUpdate(
      credentials,
      updates.map((u) => {
        const { original, effective } = applyDiscount(u.price, u.discount);
        return {
          id:           skuMap.get(u.platformProductId) ?? u.platformProductId,
          price:        original  * 10,
          specialPrice: effective * 10,
        };
      }),
      ids,
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
          failed.push(...chunkIds.map((id) => ({ id, error: `HTTP ${res.status}: ${txt.slice(0, 400)}` })));
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

    const items: OrderItemInfo[] = [];
    const failedDetails: string[] = [];

    for (const o of orders) {
      // جزئیات هر سفارش برای گرفتن اقلام و sku
      const detRes = await fetch(`${BASE}/orders/${o.id}`, { headers: baseHeaders(token) });
      if (!detRes.ok) {
        // سکوت اینجا یعنی سفارش هرگز در پنل دیده نمی‌شود — پس ثبت می‌شود و بالادست لاگ می‌کند
        failedDetails.push(`${o.orderNumber || o.id} (HTTP ${detRes.status})`);
        continue;
      }
      const det = await detRes.json() as TapsiOrderDetail;
      const detItems = det.data?.items ?? [];
      const orderNo  = det.data?.order?.orderNumber || o.orderNumber || o.id;

      // تپسی برای هر واحد کالا یک ردیف جدا می‌دهد و فیلد تعداد ندارد؛
      // ردیف‌های هم‌sku را جمع می‌زنیم وگرنه فاکتور به‌جای ۳ عدد، ۳ قلم تک‌عددی می‌شود.
      const grouped = new Map<string, { sku: string; title: string; qty: number; unitPriceToman?: number }>();
      detItems.forEach((it, idx) => {
        if (it.state === "لغو" || it.cancelReason) return; // اقلام لغوشده رد می‌شوند
        const sku = (it.sku ?? "").trim();
        // بدون sku قابل نگاشت نیست، ولی حذفش یعنی فروشِ نامرئی؛
        // با کلید مصنوعی ثبت می‌شود تا در «سفارش‌های بازارگاه» دیده و دستی رسیدگی شود.
        const key = sku || `__noSku:${idx}`;
        const priceRial = it.finalPrice ? Number(it.finalPrice) : it.price ? Number(it.price) : NaN;
        const existing = grouped.get(key);
        if (existing) {
          existing.qty += 1;
        } else {
          grouped.set(key, {
            sku,
            title: it.name ?? sku ?? "(بدون عنوان)",
            qty:   1,
            unitPriceToman: Number.isFinite(priceRial) ? Math.round(priceRial / 10) : undefined,
          });
        }
      });

      for (const [key, row] of grouped) {
        items.push({
          // کلید یکتا بر پایه sku است، نه ایندکس — با ادغام ردیف‌ها ایندکس بی‌ثبات می‌شود
          platformOrderId:     `${o.id}:${key}`,
          platformOrderNo:     orderNo,
          platformOrderItemId: row.sku || key,
          // رشته‌ی خالی یعنی «پلتفرم شناسه‌ای نداد» — نگاشت پیدا نمی‌شود و
          // ردیف با وضعیت «نیازمند نگاشت» ثبت می‌شود
          platformProductId:   row.sku,
          qty:                 row.qty,
          title:               row.title,
          unitPrice:           row.unitPriceToman,
        });
      }
      await this.rateLimit(150);
    }

    if (failedDetails.length) {
      // بالادست این را در لاگ job می‌نشاند؛ سفارش‌ها در دور بعدی دوباره تلاش می‌شوند
      console.error("[tapsi-orders] دریافت جزئیات این سفارش‌ها ناموفق بود:", failedDetails.join(", "));
    }

    // سفارش‌های تپسی با SKU می‌آیند؛ نگاشت با شناسه محصول ذخیره شده → تبدیل می‌کنیم
    const skuList = items.map((i) => i.platformProductId).filter(Boolean);
    if (skuList.length) {
      const rows = await prisma.integPlatformProduct.findMany({
        where:  { platformCode: this.platformCode, sku: { in: skuList } },
        select: { platformProductId: true, sku: true },
      });
      const bySku = new Map(rows.filter((r) => r.sku).map((r) => [r.sku as string, r.platformProductId]));
      for (const it of items) {
        const mapped = bySku.get(it.platformProductId);
        if (mapped) it.platformProductId = mapped;
      }
    }

    const hasMore = (list.data?.totalItems ?? 0) > (pageNumber + 1) * 20;
    return { items, hasMore, cursor: hasMore ? String(pageNumber + 1) : undefined };
  }
}
