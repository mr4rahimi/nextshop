import type {
  IntegProductInfo,
  PaginatedProducts,
  StockUpdate,
  PriceUpdate,
  BatchResult,
  ConnectionTestResult,
  FetchOrdersResult,
  FetchChatsResult,
  FetchMessagesResult,
  SendMessageResult,
} from "@/lib/integration/types";

export abstract class BaseAdapter {
  abstract readonly platformCode: string;
  abstract readonly platformName: string;

  // تست اتصال — همه Adapterها باید پیاده کنند
  abstract testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult>;

  // دریافت صفحه‌ای از محصولات پلتفرم (برای initial mapping)
  abstract fetchProducts(
    credentials: Record<string, string>,
    page: number,
    pageSize?: number
  ): Promise<PaginatedProducts>;

  // به‌روزرسانی موجودی (batch)
  abstract updateStock(
    credentials: Record<string, string>,
    updates: StockUpdate[]
  ): Promise<BatchResult>;

  // به‌روزرسانی قیمت (batch) — اختیاری
  updatePrice?(
    credentials: Record<string, string>,
    updates: PriceUpdate[]
  ): Promise<BatchResult>;

  // ساخت محصول جدید — اختیاری
  createProduct?(
    credentials: Record<string, string>,
    product: IntegProductInfo
  ): Promise<string>;

  fetchOrders?(
    credentials: Record<string, string>,
    cursor?: string
  ): Promise<FetchOrdersResult>;

  // تثبیت مکان‌نمای فید سفارش‌ها — فقط بعد از اینکه سفارش‌های آن صفحه واقعاً
  // ذخیره شدند صدا زده می‌شود. فیدهای یک‌طرفه (اسنپ‌شاپ) اگر مکان‌نما را پیش از
  // پردازش جلو ببرند، شکستِ وسط کار یعنی از دست رفتن دائمی آن سفارش‌ها.
  commitOrdersCursor?(
    credentials: Record<string, string>,
    cursor: string
  ): Promise<void>;

  // ── گفت‌وگوها — اختیاری، فقط پلتفرم‌هایی که پیام‌رسان دارند ─────────
  // هر سه با هم معنی دارند: بدون fetchChats دو تای دیگر جایی صدا زده نمی‌شوند.

  /** لیست گفت‌وگوهای تغییرکرده از `updatedFrom` به بعد. */
  fetchChats?(
    credentials: Record<string, string>,
    opts: { updatedFrom?: Date | null; limit?: number },
  ): Promise<FetchChatsResult>;

  /** پیام‌های یک گفت‌وگو، فقط آن‌هایی که شناسه‌شان از `sinceMessageId` بزرگ‌تر است. */
  fetchMessages?(
    credentials: Record<string, string>,
    opts: { chatId: string; sinceMessageId?: string | null; limit?: number },
  ): Promise<FetchMessagesResult>;

  /** شناسه کاربر خودمان روی پلتفرم — برای تشخیص جهت هر پیام. */
  resolveSelfId?(credentials: Record<string, string>): Promise<string | null>;

  /** ارسال پاسخ متنی به یک گفت‌وگو. */
  sendMessage?(
    credentials: Record<string, string>,
    opts: { chatId: string; text: string; repliedMessageId?: string | null },
  ): Promise<SendMessageResult>;

  // Rate limiting — هر Adapter می‌تواند override کند
  protected async rateLimit(_ms = 0): Promise<void> {
    if (_ms > 0) await new Promise(r => setTimeout(r, _ms));
  }
}
