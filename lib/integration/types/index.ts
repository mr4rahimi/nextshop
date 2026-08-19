// ── اطلاعات محصول از پلتفرم خارجی ────────────────────────────────────

export interface IntegProductInfo {
  platformId:     string;
  title:          string;
  sku?:           string;
  barcode?:       string;
  categoryName?:  string;
  brandName?:     string;
  purchasePrice?: number;  // قیمت خرید (فقط حسابداری)
  salePrice?:     number;  // قیمت مؤثر (بعد از تخفیف) — همیشه همان چیزی که مشتری می‌پردازد
  /** قیمت پیش از تخفیف. undefined یعنی محصول تخفیف ندارد و salePrice خودش قیمت اصلی است. */
  originalPrice?:    number;
  discountPercent?:  number;
  discountStartsAt?: Date;
  discountEndsAt?:   Date;
  discountStock?:    number;
  stock?:         number;
  unit?:          string;
  weight?:        number;
  attributes?:    Record<string, string>;
  imageUrls?:     string[];
}

export interface PaginatedProducts {
  items:   IntegProductInfo[];
  total:   number;
  page:    number;
  hasMore: boolean;
}

// ── عملیات sync ───────────────────────────────────────────────────────

export interface StockUpdate {
  platformProductId: string;
  stock:             number;
}

// قرارداد قیمت: `price` همیشه «قیمت اصلی» تازه‌محاسبه‌شده است (تومان).
// اگر محصول روی پلتفرم تخفیف فعال داشته باشد، `discount` پر می‌شود و آداپتور موظف
// است تخفیف را با همان درصد روی قیمت جدید بازسازی کند — نه اینکه پاکش کند.
export interface PriceDiscount {
  percent:   number;         // درصد تخفیف که باید حفظ شود
  startsAt?: Date | null;
  endsAt?:   Date | null;
  stock?:    number | null;  // موجودی اختصاصی تخفیف (اسنپ‌شاپ)
}

export interface PriceUpdate {
  platformProductId: string;
  price:             number;         // قیمت اصلی جدید (تومان)
  salePrice?:        number;         // قیمت مؤثر جدید (تومان) — از discount مشتق می‌شود
  discount?:         PriceDiscount | null;
}

/** قیمت اصلی + مؤثر را از یک قیمت پایه و درصد تخفیف می‌سازد. */
export function applyDiscount(
  basePrice: number,
  discount?: PriceDiscount | null,
): { original: number; effective: number } {
  const original = Math.round(basePrice);
  if (!discount || !(discount.percent > 0) || discount.percent >= 100) {
    return { original, effective: original };
  }
  return { original, effective: Math.round(original * (1 - discount.percent / 100)) };
}

export interface BatchResult {
  success: string[];
  failed:  { id: string; error: string }[];
}

// ── نتیجه تست اتصال ──────────────────────────────────────────────────

export interface ConnectionTestResult {
  success:   boolean;
  message?:  string;
  shopInfo?: Record<string, unknown>;
}

// ── payload هر نوع Job ────────────────────────────────────────────────

export interface SyncStockPayload {
  shopProductId:     string;
  platformProductId: string;
  stock:             number;
}

export interface SyncPricePayload {
  shopProductId:     string;
  platformProductId: string;
  price:             number;
  salePrice?:        number;
  discount?:         PriceDiscount | null;
}

export interface SyncAllPayload {
  batchSize?: number;
  cursor?:    string;
}

export interface FetchProductsPayload {
  page:      number;
  pageSize?: number;
}

export interface CreateProductPayload {
  shopProductId: string;
}

export interface TestConnectionPayload {
  connectionId: string;
}

// ── Rule Engine ───────────────────────────────────────────────────────

export interface PriceRuleContext {
  last_purchase_price: number;
  avg_purchase_price:  number;
  shop_price:          number;
  current_stock:       number;
  shipping_cost:       number;
  packaging_cost:      number;
}

export interface OrderItemInfo {
  platformOrderId: string;      
  /** شماره سفارش قابل نمایش (آنچه مشتری و پنل فروشنده می‌بینند) — نه شناسه داخلی */
  platformOrderNo?: string;
  platformOrderItemId?: string;
  platformProductId: string;    
  qty: number;
  title?: string;
  unitPrice?: number;      // تومان
  customerName?: string;
  customerPhone?: string;
}

export interface FetchOrdersResult {
  /** شماره سفارش‌هایی که در این دور لغو شده‌اند (اسنپ‌شاپ) */
  cancelledOrderIds?: string[];
  items: OrderItemInfo[];
  hasMore: boolean;
  cursor?: string;
}