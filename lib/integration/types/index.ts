// ── اطلاعات محصول از پلتفرم خارجی ────────────────────────────────────

export interface IntegProductInfo {
  platformId:     string;
  title:          string;
  sku?:           string;
  barcode?:       string;
  categoryName?:  string;
  brandName?:     string;
  purchasePrice?: number;  // قیمت خرید (فقط حسابداری)
  salePrice?:     number;
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

export interface PriceUpdate {
  platformProductId: string;
  price:             number;
  salePrice?:        number;
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
  platformOrderItemId?: string;
  platformProductId: string;    
  qty: number;
  title?: string;
  unitPrice?: number;      // تومان
  customerName?: string;
  customerPhone?: string;
}

export interface FetchOrdersResult {
  items: OrderItemInfo[];
  hasMore: boolean;
  cursor?: string;
}