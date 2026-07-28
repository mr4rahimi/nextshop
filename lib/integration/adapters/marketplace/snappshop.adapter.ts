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
} from "@/lib/integration/types";

const BASE = "https://apix.snappshop.ir/automation/v1";

// اسنپ‌شاپ علاوه بر توکن، «کد یکتای شناسایی» را در هدر User-Agent می‌خواهد
function baseHeaders(token: string, uniqueCode: string): HeadersInit {
  return {
    "Authorization": `Bearer ${token}`,
    "User-Agent":    uniqueCode,
    "Accept":        "application/json",
    "Content-Type":  "application/json",
  };
}

interface SnappVendor { id: string; title?: string; title_en?: string; status?: string }
interface SnappProduct {
  id: string; sku: string | null; product_number?: number; active?: boolean;
  stock: number | null; warehouse_stock?: number | null;
  title?: string; price: number | null;
}
interface SnappPagination {
  total?: number; current_page?: number; total_pages?: number; per_page?: number;
  has_more?: boolean; next_cursor?: string;
}
interface SnappEventItem {
  sku: string | null;
  vendor_product_info_id?: string;
  product_number?: number;
  canceled_quantity?: number;
  total_canceled_quantity?: number;
  deliverable_quantity?: number;
  final_price?: number;
  item_status?: string;
}
interface SnappEvent {
  event_type: "NEW_ORDER" | "CANCELLATION" | "CHANGE_STATUS";
  order_number: number | string;
  event_at?: string;
  new_status?: string;
  items?: SnappEventItem[];
}

export class SnappShopAdapter extends BaseAdapter {
  readonly platformCode = "snappshop";
  readonly platformName = "اسنپ‌شاپ";

  private static readonly CHUNK_SIZE = 50;

  private creds(c: Record<string, string>) {
    return {
      token:      c.token ?? "",
      uniqueCode: c.uniqueCode ?? "",
      vendorId:   c.vendorId ?? "",
    };
  }

  // ── تست اتصال — لیست فروشگاه‌های مرتبط با توکن ───────────────────
  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    const { token, uniqueCode } = this.creds(credentials);
    if (!token.trim())      return { success: false, message: "توکن وارد نشده" };
    if (!uniqueCode.trim()) return { success: false, message: "کد یکتای شناسایی وارد نشده" };

    try {
      const res = await fetch(`${BASE}/vendors`, { headers: baseHeaders(token, uniqueCode) });
      if (res.status === 401) return { success: false, message: "توکن یا کد یکتا نامعتبر است (۴۰۱)" };
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { success: false, message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
      }

      const data = await res.json() as { status?: boolean; data?: SnappVendor[] };
      const vendors = data.data ?? [];
      if (!vendors.length) return { success: false, message: "هیچ فروشگاهی برای این توکن یافت نشد" };

      const v = vendors[0];
      return {
        success: true,
        message: `اتصال برقرار شد — فروشگاه: ${v.title ?? v.title_en ?? v.id}`,
        shopInfo: {
          vendorTitle: v.title ?? v.title_en,
          identifier:  v.id,   // شناسه فروشگاه رشته‌ای است و در فرم پر می‌شود
        },
      };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "خطای شبکه" };
    }
  }

  // ── دریافت محصولات (۲۰ تایی، صفحه‌بندی page) ─────────────────────
  async fetchProducts(
    credentials: Record<string, string>,
    page = 1,
  ): Promise<PaginatedProducts> {
    const { token, uniqueCode, vendorId } = this.creds(credentials);
    if (!vendorId) throw new Error("شناسه فروشگاه (vendorId) تنظیم نشده است");

    const res = await fetch(`${BASE}/vendors/${vendorId}/products?page=${page}`, {
      headers: baseHeaders(token, uniqueCode),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json() as {
      data?: SnappProduct[];
      meta?: { pagination?: SnappPagination };
    };
    const raw  = json.data ?? [];
    const pg   = json.meta?.pagination ?? {};

    const items: IntegProductInfo[] = raw.map((p) => ({
      platformId: p.id,
      title:      p.title ?? p.sku ?? p.id,
      salePrice:  p.price ?? undefined,   // اسنپ‌شاپ تومانی است — بدون تبدیل
      stock:      p.stock ?? undefined,
      sku:        p.sku ?? undefined,
    }));

    const current = pg.current_page ?? page;
    const total   = pg.total_pages ?? current;

    return { items, total: pg.total ?? items.length, page: current, hasMore: current < total };
  }

  // ── اسنپ‌شاپ در آپدیت، هم stock و هم price را اجباری می‌خواهد ─────
  private async loadContext(ids: string[]): Promise<Map<string, { price?: number; stock?: number }>> {
    const [snapshots, links] = await Promise.all([
      prisma.integPlatformProduct.findMany({
        where:  { platformCode: this.platformCode, platformProductId: { in: ids } },
        select: { platformProductId: true, price: true, stock: true },
      }),
      prisma.integMappingLink.findMany({
        where:  { platformCode: this.platformCode, externalId: { in: ids }, isActive: true },
        select: { externalId: true, mapping: { select: { stock: true } } },
      }),
    ]);

    const map = new Map<string, { price?: number; stock?: number }>();
    for (const s of snapshots) {
      map.set(s.platformProductId, { price: s.price ?? undefined, stock: s.stock ?? undefined });
    }
    for (const l of links) {
      const cur = map.get(l.externalId) ?? {};
      map.set(l.externalId, { ...cur, stock: l.mapping.stock ?? cur.stock });
    }
    return map;
  }

  async updateStock(
    credentials: Record<string, string>,
    updates: StockUpdate[],
  ): Promise<BatchResult> {
    const ctx = await this.loadContext(updates.map((u) => u.platformProductId));
    const products: Record<string, unknown>[] = [];
    const ids: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const u of updates) {
      const price = ctx.get(u.platformProductId)?.price;
      if (price == null || price <= 0) {
        failed.push({ id: u.platformProductId, error: "قیمت فعلی نامشخص است — ابتدا «دریافت محصولات» را اجرا کنید (اسنپ‌شاپ قیمت را در آپدیت اجباری می‌داند)" });
        continue;
      }
      products.push({ id: u.platformProductId, stock: u.stock, price: Math.round(price) });
      ids.push(u.platformProductId);
    }

    const result = await this.bulkUpdate(credentials, products, ids);
    return { success: result.success, failed: [...failed, ...result.failed] };
  }

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdate[],
  ): Promise<BatchResult> {
    const ctx = await this.loadContext(updates.map((u) => u.platformProductId));
    const products: Record<string, unknown>[] = [];
    const ids: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const u of updates) {
      const stock = ctx.get(u.platformProductId)?.stock;
      if (stock == null) {
        failed.push({ id: u.platformProductId, error: "موجودی فعلی نامشخص است — ابتدا «دریافت محصولات» را اجرا کنید (اسنپ‌شاپ موجودی را در آپدیت اجباری می‌داند)" });
        continue;
      }
      // قیمت‌های اسنپ‌شاپ به تومان است — بدون ضرب در ۱۰
      const toman = Math.round(u.salePrice ?? u.price);
      products.push({ id: u.platformProductId, stock, price: toman });
      ids.push(u.platformProductId);
    }

    const result = await this.bulkUpdate(credentials, products, ids);
    return { success: result.success, failed: [...failed, ...result.failed] };
  }

  private async bulkUpdate(
    credentials: Record<string, string>,
    products: Record<string, unknown>[],
    ids: string[],
  ): Promise<BatchResult> {
    const { token, uniqueCode, vendorId } = this.creds(credentials);
    const success: string[] = [];
    const failed:  { id: string; error: string }[] = [];
    if (!products.length) return { success, failed };
    if (!vendorId) return { success, failed: ids.map((id) => ({ id, error: "شناسه فروشگاه تنظیم نشده است" })) };

    for (let i = 0; i < products.length; i += SnappShopAdapter.CHUNK_SIZE) {
      const chunk    = products.slice(i, i + SnappShopAdapter.CHUNK_SIZE);
      const chunkIds = ids.slice(i, i + SnappShopAdapter.CHUNK_SIZE);

      try {
        await this.rateLimit(200);
        const res = await fetch(`${BASE}/vendors/${vendorId}/products`, {
          method:  "PATCH",
          headers: baseHeaders(token, uniqueCode),
          body:    JSON.stringify({ products: chunk }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          failed.push(...chunkIds.map((id) => ({ id, error: `HTTP ${res.status}: ${body.slice(0, 300)}` })));
          continue;
        }

        const body = await res.json().catch(() => null) as
          | { data?: { id?: string; d?: string; sku?: string; status?: boolean; messages?: string[] }[] }
          | null;

        const rows = body?.data;
        if (Array.isArray(rows)) {
          const byId = new Map(rows.map((r) => [r.id ?? r.d ?? r.sku ?? "", r]));
          for (const id of chunkIds) {
            const r = byId.get(id);
            if (r && r.status === false) {
              failed.push({ id, error: r.messages?.join(" | ") ?? "رد شد توسط اسنپ‌شاپ" });
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

  // ── سفارش‌ها: فید رویدادی با cursor ذخیره‌شونده ──────────────────
  async fetchOrders(
    credentials: Record<string, string>,
    cursor?: string,
  ): Promise<FetchOrdersResult> {
    const { token, uniqueCode, vendorId } = this.creds(credentials);
    if (!vendorId) throw new Error("شناسه فروشگاه (vendorId) تنظیم نشده است");

    // اولین فراخوانی در هر چرخه: cursor ذخیره‌شده در اتصال
    let useCursor = cursor;
    if (!useCursor) {
      const conn = await prisma.integConnection.findFirst({
        where:  { platformCode: this.platformCode },
        select: { config: true },
      });
      const cfg = (conn?.config ?? {}) as { ordersCursor?: string };
      useCursor = cfg.ordersCursor;
    }

    const url = `${BASE}/vendors/${vendorId}/orders/events${useCursor ? `?cursor=${encodeURIComponent(useCursor)}` : ""}`;
    const res = await fetch(url, { headers: baseHeaders(token, uniqueCode) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json() as { data?: SnappEvent[]; meta?: { pagination?: SnappPagination } };
    const events = json.data ?? [];
    const pg     = json.meta?.pagination ?? {};

    if (events.length > 0) {
      console.log("[snappshop-orders] raw sample:", JSON.stringify(events[0]).slice(0, 1200));
    }

    const items: {
      platformOrderId: string;
      platformOrderItemId?: string;
      platformProductId: string;
      qty: number;
      title?: string;
      unitPrice?: number;
      customerName?: string;
      customerPhone?: string;
    }[] = [];
    const cancelledOrderIds: string[] = [];
    const customerCache = new Map<string, { name?: string; phone?: string }>();

    for (const ev of events) {
      const orderNo = String(ev.order_number);

      if (ev.event_type === "CANCELLATION") {
        cancelledOrderIds.push(orderNo);
        continue;
      }
      if (ev.event_type !== "NEW_ORDER") continue;

      // مشخصات خریدار فقط از اندپوینت جزئیات سفارش در دسترس است
      if (!customerCache.has(orderNo)) {
        let info: { name?: string; phone?: string } = {};
        try {
          await this.rateLimit(150);
          const dRes = await fetch(`${BASE}/vendors/${vendorId}/orders/${orderNo}`, {
            headers: baseHeaders(token, uniqueCode),
          });
          if (dRes.ok) {
            const d = await dRes.json() as {
              data?: { customer?: { first_name?: string; last_name?: string; phone?: string | null } };
            };
            const c = d.data?.customer;
            const name = [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim();
            info = { name: name || undefined, phone: c?.phone ?? undefined };
          }
        } catch { /* بدون مشخصات ادامه می‌دهیم */ }
        customerCache.set(orderNo, info);
      }
      const cust = customerCache.get(orderNo) ?? {};

      for (const it of ev.items ?? []) {
        if (it.item_status === "CANCELED") continue;
        const productId = it.vendor_product_info_id ?? it.sku ?? "";
        if (!productId) continue;

        const qty   = it.deliverable_quantity ?? 1;
        const total = typeof it.final_price === "number" ? it.final_price : undefined; // تومان
        items.push({
          platformOrderId:     `${orderNo}:${productId}`,
          platformOrderItemId: String(it.product_number ?? productId),
          platformProductId:   productId,
          qty:                 qty > 0 ? qty : 1,
          title:               it.sku ?? undefined,
          unitPrice:           total != null && qty > 0 ? Math.round(total / qty) : undefined,
          customerName:        cust.name,
          customerPhone:       cust.phone,
        });
      }
    }

    // ذخیره cursor برای دور بعد (فید یک‌طرفه است)
    const nextCursor = pg.next_cursor;
    if (nextCursor) {
      const conn = await prisma.integConnection.findFirst({
        where:  { platformCode: this.platformCode },
        select: { id: true, config: true },
      });
      if (conn) {
        const cfg = (conn.config ?? {}) as Record<string, unknown>;
        await prisma.integConnection.update({
          where: { id: conn.id },
          data:  { config: { ...cfg, ordersCursor: nextCursor } as never },
        }).catch(() => {});
      }
    }

    return { items, hasMore: pg.has_more === true, cursor: nextCursor, cancelledOrderIds };
  }
}
