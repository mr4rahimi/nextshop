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
  PriceDiscount,
} from "@/lib/integration/types";
import { applyDiscount } from "@/lib/integration/types";

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
interface SnappDiscount {
  id?: string; special_price?: number | null; stock?: number | null;
  percent?: number | null; start_at?: string | null; end_at?: string | null;
}
interface SnappProduct {
  id: string; sku: string | null; product_number?: number; active?: boolean;
  stock: number | null; warehouse_stock?: number | null;
  title?: string; price: number | null;
  discount?: SnappDiscount | null;
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
interface SnappOrderDetail {
  order_number?: number | string;
  order_status?: string;
  customer?: { first_name?: string; last_name?: string; phone?: string | null };
  items?: {
    sku?: string | null;
    vendor_product_info_id?: string;
    item_status?: string;
    quantity?: number;
    canceled_quantity?: number;
    original_price?: number;
    discount_amount?: number;
    final_price?: number;
  }[];
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

    // اسنپ‌شاپ: price = قیمت پایه، discount.special_price = قیمت بعد از تخفیف.
    // تخفیف باید نگه داشته شود وگرنه PATCH بعدی پاکش می‌کند (price اجباری است).
    const items: IntegProductInfo[] = raw.map((p) => {
      const base     = p.price ?? undefined;   // اسنپ‌شاپ تومانی است — بدون تبدیل
      const special  = p.discount?.special_price ?? undefined;
      const hasDisc  = base != null && base > 0 && special != null && special > 0 && special < base;
      const percent  = hasDisc
        ? (p.discount?.percent ?? Math.round(((base - special) / base) * 10000) / 100)
        : undefined;
      return {
        platformId: p.id,
        title:      p.title ?? p.sku ?? p.id,
        salePrice:  hasDisc ? special : base,
        originalPrice:    hasDisc ? base : undefined,
        discountPercent:  percent,
        discountStartsAt: hasDisc && p.discount?.start_at ? new Date(p.discount.start_at) : undefined,
        discountEndsAt:   hasDisc && p.discount?.end_at   ? new Date(p.discount.end_at)   : undefined,
        discountStock:    hasDisc ? (p.discount?.stock ?? undefined) : undefined,
        stock:      p.stock ?? undefined,
        sku:        p.sku ?? undefined,
      };
    });

    const current = pg.current_page ?? page;
    const total   = pg.total_pages ?? current;

    return { items, total: pg.total ?? items.length, page: current, hasMore: current < total };
  }

  // ── اسنپ‌شاپ در آپدیت، هم stock و هم price را اجباری می‌خواهد ─────
  // و چون فیلدهای special_price در همان PATCH می‌آیند، اگر ارسال نشوند تخفیف
  // محصول پاک می‌شود. پس هر آپدیت باید کل تصویر (قیمت + موجودی + تخفیف) را ببرد.
  private async loadContext(
    ids: string[],
  ): Promise<Map<string, { basePrice?: number; stock?: number; discount?: PriceDiscount }>> {
    const [snapshots, links] = await Promise.all([
      prisma.integPlatformProduct.findMany({
        where:  { platformCode: this.platformCode, platformProductId: { in: ids } },
        select: {
          platformProductId: true, price: true, stock: true,
          originalPrice: true, discountPercent: true,
          discountStartsAt: true, discountEndsAt: true, discountStock: true,
        },
      }),
      prisma.integMappingLink.findMany({
        where:  { platformCode: this.platformCode, externalId: { in: ids }, isActive: true },
        select: { externalId: true, mapping: { select: { stock: true } } },
      }),
    ]);

    const map = new Map<string, { basePrice?: number; stock?: number; discount?: PriceDiscount }>();
    for (const s of snapshots) {
      // price ستون «قیمت مؤثر» است؛ قیمت پایه وقتی تخفیف هست در originalPrice می‌نشیند
      const basePrice = s.originalPrice ?? s.price ?? undefined;
      const discount =
        s.discountPercent != null && s.discountPercent > 0 && s.originalPrice != null
          ? {
              percent:  s.discountPercent,
              startsAt: s.discountStartsAt,
              endsAt:   s.discountEndsAt,
              stock:    s.discountStock,
            }
          : undefined;
      map.set(s.platformProductId, { basePrice, stock: s.stock ?? undefined, discount });
    }
    for (const l of links) {
      const cur = map.get(l.externalId) ?? {};
      map.set(l.externalId, { ...cur, stock: l.mapping.stock ?? cur.stock });
    }
    return map;
  }

  private static fmtDate(d?: Date | null): string | undefined {
    if (!d) return undefined;
    const t = d.getTime();
    if (!Number.isFinite(t)) return undefined;
    return d.toISOString().slice(0, 10); // اسنپ‌شاپ فرمت YYYY-MM-DD می‌خواهد
  }

  /** بدنه‌ی یک آیتم PATCH — همیشه کامل، تا هیچ فیلدی به‌طور ضمنی پاک نشود. */
  private static buildPayload(
    id: string,
    basePrice: number,
    stock: number,
    discount?: PriceDiscount | null,
  ): Record<string, unknown> {
    const { original, effective } = applyDiscount(basePrice, discount);
    const body: Record<string, unknown> = { id, stock, price: original };
    if (discount && discount.percent > 0 && effective < original) {
      body.special_price = effective;
      const start = SnappShopAdapter.fmtDate(discount.startsAt);
      const end   = SnappShopAdapter.fmtDate(discount.endsAt);
      if (start) body.special_price_start_at = start;
      if (end)   body.special_price_end_at   = end;
      if (discount.stock != null) body.special_price_stock = discount.stock;
    }
    return body;
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
      const c = ctx.get(u.platformProductId);
      if (c?.basePrice == null || c.basePrice <= 0) {
        failed.push({ id: u.platformProductId, error: "قیمت فعلی نامشخص است — ابتدا «دریافت محصولات» را اجرا کنید (اسنپ‌شاپ قیمت را در آپدیت اجباری می‌داند)" });
        continue;
      }
      products.push(SnappShopAdapter.buildPayload(u.platformProductId, c.basePrice, u.stock, c.discount));
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
      const c = ctx.get(u.platformProductId);
      if (c?.stock == null) {
        failed.push({ id: u.platformProductId, error: "موجودی فعلی نامشخص است — ابتدا «دریافت محصولات» را اجرا کنید (اسنپ‌شاپ موجودی را در آپدیت اجباری می‌داند)" });
        continue;
      }
      // قیمت‌های اسنپ‌شاپ به تومان است — بدون ضرب در ۱۰
      const discount = u.discount !== undefined ? u.discount : c.discount;
      products.push(SnappShopAdapter.buildPayload(u.platformProductId, u.price, c.stock, discount));
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

    const items: OrderItemInfo[] = [];
    const cancelledOrderIds: string[] = [];

    // عنوان محصول در فید رویدادها نیست — از snapshot محصولات پلتفرم برمی‌داریم
    const productIds = new Set<string>();
    for (const ev of events) {
      for (const it of ev.items ?? []) {
        const pid = it.vendor_product_info_id ?? it.sku;
        if (pid) productIds.add(pid);
      }
    }
    const titleMap = new Map<string, string>();
    if (productIds.size) {
      const rows = await prisma.integPlatformProduct.findMany({
        where:  { platformCode: this.platformCode, platformProductId: { in: [...productIds] } },
        select: { platformProductId: true, title: true },
      });
      for (const r of rows) titleMap.set(r.platformProductId, r.title);
    }

    for (const ev of events) {
      const orderNo = String(ev.order_number);

      if (ev.event_type === "CANCELLATION") {
        cancelledOrderIds.push(orderNo);
        continue;
      }
      if (ev.event_type !== "NEW_ORDER") continue;

      // جزئیات سفارش: مشخصات خریدار + تعداد و قیمت واقعی هر قلم.
      // فید رویدادها فقط final_price کل را می‌دهد و تعداد را ناقص.
      let detail: SnappOrderDetail | null = null;
      try {
        await this.rateLimit(150);
        const dRes = await fetch(`${BASE}/vendors/${vendorId}/orders/${orderNo}`, {
          headers: baseHeaders(token, uniqueCode),
        });
        if (dRes.ok) detail = (await dRes.json() as { data?: SnappOrderDetail }).data ?? null;
      } catch { /* بدون جزئیات، از خود رویداد استفاده می‌کنیم */ }

      const c = detail?.customer;
      const custName  = [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() || undefined;
      const custPhone = c?.phone ?? undefined;

      // ترجیح با اقلام جزئیات سفارش؛ اگر در دسترس نبود، اقلام رویداد
      // اقلام بدون شناسه‌ی محصول حذف نمی‌شوند — با کلید مصنوعی ثبت می‌شوند تا
      // فروش نامرئی نماند و در «سفارش‌های بازارگاه» قابل رسیدگی دستی باشد.
      const detailItems = detail?.items ?? [];
      const source: { pid: string; key: string; qty: number; unitPrice?: number }[] = detailItems.length
        ? detailItems
            .filter((it) => it.item_status !== "CANCELED")
            .map((it, idx) => {
              const pid = it.vendor_product_info_id ?? it.sku ?? "";
              const qty = Math.max(0, (it.quantity ?? 0) - (it.canceled_quantity ?? 0)) || (it.quantity ?? 1);
              // final_price مجموع اقلام باقیمانده است — تقسیم بر تعداد
              const total = typeof it.final_price === "number" ? it.final_price : undefined;
              return {
                pid,
                key: pid || `__noId:${idx}`,
                qty,
                unitPrice: total != null && qty > 0 ? Math.round(total / qty) : undefined,
              };
            })
        : (ev.items ?? [])
            .filter((it) => it.item_status !== "CANCELED")
            .map((it, idx) => {
              const pid = it.vendor_product_info_id ?? it.sku ?? "";
              const qty = it.deliverable_quantity ?? 1;
              const total = typeof it.final_price === "number" ? it.final_price : undefined;
              return {
                pid,
                key: pid || `__noId:${idx}`,
                qty: qty > 0 ? qty : 1,
                unitPrice: total != null && qty > 0 ? Math.round(total / qty) : undefined,
              };
            });

      for (const row of source) {
        items.push({
          platformOrderId:     `${orderNo}:${row.key}`,
          platformOrderNo:     orderNo,
          platformOrderItemId: row.key,
          platformProductId:   row.pid,
          qty:                 row.qty,
          title:               titleMap.get(row.pid),
          unitPrice:           row.unitPrice,   // تومان
          customerName:        custName,
          customerPhone:       custPhone,
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
