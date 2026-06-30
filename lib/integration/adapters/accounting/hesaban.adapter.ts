import { BaseAdapter } from "../base.adapter";
import type {
  ConnectionTestResult,
  PaginatedProducts,
  IntegProductInfo,
  StockUpdate,
  PriceUpdate,
  BatchResult,
} from "@/lib/integration/types";

const BASE_URL = "https://hesabanweb.com";
const DEFAULT_PAGE_SIZE = 100;

// ── Hesaban API response shapes ───────────────────────────────────────

interface HesabanUserInfo {
  [key: string]: unknown;
}

interface HesabanProductResponse {
  id: number;
  name: string | null;
  code: string | null;
  barcode: string | null;
  price: number;        // قیمت فروش (ریال)
  buyPrice: number;     // قیمت خرید
  oneAmount: number;    // میانگین بهای تمام‌شده
  count: number;        // موجودی کل همه انبارها
  enumerationUnit: string | null;
  disabled: boolean;
  description: string | null;
  model: string | null;
}

// ── Adapter ───────────────────────────────────────────────────────────

export class HesabanAdapter extends BaseAdapter {
  readonly platformCode = "hesaban";
  readonly platformName = "وب‌حسابان";

  private headers(token: string): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  // ── تست اتصال ────────────────────────────────────────────────────

  async testConnection(
    credentials: Record<string, string>,
  ): Promise<ConnectionTestResult> {
    const { token } = credentials;
    if (!token?.trim()) return { success: false, message: "توکن وارد نشده" };

    try {
      const res = await fetch(`${BASE_URL}/User/GetUserInfo`, {
        headers: this.headers(token),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        return { success: false, message: body.error ?? `HTTP ${res.status}` };
      }

      const info: HesabanUserInfo = await res.json();
      return {
        success:  true,
        message:  "اتصال با موفقیت برقرار شد",
        shopInfo: info,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "خطای شبکه",
      };
    }
  }

  // ── دریافت محصولات (برای initial mapping و sync) ─────────────────

  async fetchProducts(
    credentials: Record<string, string>,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<PaginatedProducts> {
    const { token } = credentials;

    const res = await fetch(
      `${BASE_URL}/Product/PRODUCTS/false/${pageSize}/${page}`,
      { headers: this.headers(token) },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    const data: HesabanProductResponse[] = await res.json();
    const hasMore = data.length === pageSize;

    const items: IntegProductInfo[] = data
      .filter((p) => !p.disabled && p.code)
      .map((p) => ({
        platformId:    p.code!,
        title:         p.name ?? "(بدون نام)",
        sku:           p.code ?? undefined,
        barcode:       p.barcode ?? undefined,
        purchasePrice: p.buyPrice,
        salePrice:     p.price,
        stock:         p.count,
        unit:          p.enumerationUnit ?? undefined,
      }));

    // تعداد کل — فقط برای صفحه اول
    let total = (page - 1) * pageSize + data.length;
    if (page === 1 && hasMore) {
      try {
        const r = await fetch(`${BASE_URL}/Product/GetProductsCount`, {
          headers: this.headers(token),
        });
        if (r.ok) total = await r.json() as number;
      } catch {}
    }

    return { items, total, page, hasMore };
  }

  // ── Hesaban = سیستم حسابداری؛ موجودی از طریق فاکتور تغییر می‌کند ─

  async updateStock(
    _credentials: Record<string, string>,
    _updates: StockUpdate[],
  ): Promise<BatchResult> {
    throw new Error(
      "وب‌حسابان یک سیستم حسابداری است؛ موجودی مستقیماً از API تغییر نمی‌کند",
    );
  }

  // ── ویرایش قیمت در حسابان (از قیمت فروشگاه به حسابان) ──────────
  // نیاز به دریافت اطلاعات کامل محصول قبل از Edit

  async updatePrice(
    credentials: Record<string, string>,
    updates: PriceUpdate[],
  ): Promise<BatchResult> {
    const { token } = credentials;
    const success: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const update of updates) {
      try {
        await this.rateLimit(150);

        const getRes = await fetch(
          `${BASE_URL}/Product/GetProductByCode?code=${encodeURIComponent(update.platformProductId)}`,
          { headers: this.headers(token) },
        );

        if (!getRes.ok) {
          failed.push({ id: update.platformProductId, error: `HTTP ${getRes.status}` });
          continue;
        }

        const product = await getRes.json();

        const editRes = await fetch(`${BASE_URL}/Product/Edit`, {
          method:  "POST",
          headers: this.headers(token),
          body:    JSON.stringify({ ...product, price: update.price }),
        });

        if (!editRes.ok) {
          const body = await editRes.json().catch(() => ({})) as { error?: string };
          failed.push({ id: update.platformProductId, error: body.error ?? `HTTP ${editRes.status}` });
        } else {
          success.push(update.platformProductId);
        }
      } catch (err) {
        failed.push({
          id:    update.platformProductId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { success, failed };
  }
}
