/**
 * بازارگاه‌های نمایشی — docs/plans/demo.md مرحله‌ی ۲.
 *
 * در `DEMO_MODE` این آداپتور جای باسلام، اسنپ‌شاپ و تپسی‌شاپ را در
 * `adapter-registry` می‌گیرد. همان رابط آداپتور واقعی را دارد، پس worker،
 * نگاشت، قوانین قیمت، سفارش و فاکتور همان مسیر واقعی را می‌روند — فقط به جای
 * درخواست بیرونی، «سمت بازارگاه» همین ردیف‌های `IntegPlatformProduct` است.
 *
 * - دریافت محصولات: ردیف‌های همان بازارگاه (سید ساخته) برگردانده می‌شوند.
 * - ارسال موجودی/قیمت: همیشه موفق؛ ردیف سمت بازارگاه هم به‌روز می‌شود.
 * - سفارش: هر دور دریافت با احتمال `ORDER_CHANCE` یک سفارش ساختگی از کالاهای
 *   نگاشت‌شده می‌سازد؛ `forceDemoOrder` دور بعد را حتماً سفارش‌دار می‌کند.
 * - گفت‌وگو (فقط باسلام): گاهی پرسش مشتری می‌رسد؛ پاسخ ادمین «ارسال» می‌شود.
 *
 * ⚠️ هیچ fetch بیرونی در این فایل نیست و نباید باشد.
 */

import { prisma } from "@/lib/prisma";
import { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import type {
  BatchResult,
  ChatInfo,
  ChatMessageInfo,
  ConnectionTestResult,
  FetchChatsResult,
  FetchMessagesResult,
  FetchOrdersResult,
  IntegProductInfo,
  OrderItemInfo,
  PaginatedProducts,
  PriceUpdate,
  SendMessageResult,
  StockUpdate,
} from "@/lib/integration/types";

export const DEMO_MARKETPLACES = [
  { code: "basalam", name: "باسلام", chat: true },
  { code: "snappshop", name: "اسنپ‌شاپ", chat: false },
  { code: "tapsi_shop", name: "تپسی‌شاپ", chat: false },
] as const;

/** احتمال سفارش تازه در هر دور دریافت (هر ۵ دقیقه برای هر بازارگاه) */
const ORDER_CHANCE = 0.35;
/** احتمال پرسش تازه‌ی مشتری در هر دور گفت‌وگو */
const CHAT_CHANCE = 0.2;

export const FIRST_NAMES = ["علی", "زهرا", "محمد", "فاطمه", "حسین", "مریم", "رضا", "سارا", "امیر", "نرگس", "مهدی", "الهام", "سعید", "نازنین", "پویا", "مهسا", "کیان", "هانیه", "آرش", "یاسمن"];
export const LAST_NAMES = ["رضایی", "محمدی", "حسینی", "کریمی", "موسوی", "احمدی", "جعفری", "صادقی", "رحیمی", "نوری", "کاظمی", "قاسمی", "اکبری", "شریفی", "طاهری", "یزدانی"];

export const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** شماره‌ی ساختگی — پیش‌شماره‌ی ۰۹۰۰ به هیچ اپراتوری داده نشده */
export const fakePhone = () => `0900${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

const CHAT_QUESTIONS = [
  "سلام، این مدل برای گوشی من هم اندازه است؟",
  "ارسال به شیراز چند روز طول می‌کشد؟",
  "رنگ مشکی‌اش موجود است؟",
  "گارانتی دارد؟ اصل است؟",
  "اگر دو تا بخرم تخفیف می‌دهید؟",
  "سفارشم را دیروز ثبت کردم، کی ارسال می‌شود؟",
  "با شارژر سریع سامسونگ هم کار می‌کند؟",
];

// وضعیت بین درخواست‌ها روی globalThis: route handler و worker (instrumentation)
// در Next می‌توانند نمونه‌ی ماژول جدا داشته باشند ولی پروسه یکی است
type DemoState = { forced: Set<string>; pendingChats: Map<string, ChatMessageInfo[]> };
const g = globalThis as typeof globalThis & { __demoMarketplace?: DemoState };
const state: DemoState = (g.__demoMarketplace ??= { forced: new Set(), pendingChats: new Map() });

/** دور بعدِ دریافت سفارش این بازارگاه حتماً یک سفارش بیاورد */
export function forceDemoOrder(platformCode: string) {
  state.forced.add(platformCode);
}

export class DemoMarketplaceAdapter extends BaseAdapter {
  constructor(
    readonly platformCode: string,
    readonly platformName: string,
  ) {
    super();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return {
      success: true,
      message: `اتصال نمایشی ${this.platformName} برقرار است`,
      shopInfo: { name: `غرفه‌ی نمایشی در ${this.platformName}` },
    };
  }

  async fetchProducts(_c: Record<string, string>, page: number, pageSize = 100): Promise<PaginatedProducts> {
    const where = { platformCode: this.platformCode };
    const [rows, total] = await Promise.all([
      prisma.integPlatformProduct.findMany({ where, orderBy: { platformProductId: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.integPlatformProduct.count({ where }),
    ]);
    const items: IntegProductInfo[] = rows.map((r) => ({
      platformId: r.platformProductId,
      title: r.title,
      sku: r.sku ?? undefined,
      barcode: r.barcode ?? undefined,
      salePrice: r.price ?? undefined,
      originalPrice: r.originalPrice ?? undefined,
      discountPercent: r.discountPercent ?? undefined,
      stock: r.stock ?? undefined,
      unit: r.unit ?? undefined,
    }));
    return { items, total, page, hasMore: page * pageSize < total };
  }

  async updateStock(_c: Record<string, string>, updates: StockUpdate[]): Promise<BatchResult> {
    for (const u of updates) {
      await prisma.integPlatformProduct.updateMany({
        where: { platformCode: this.platformCode, platformProductId: u.platformProductId },
        data: { stock: u.stock },
      });
    }
    return { success: updates.map((u) => u.platformProductId), failed: [] };
  }

  async updatePrice(_c: Record<string, string>, updates: PriceUpdate[]): Promise<BatchResult> {
    for (const u of updates) {
      const discounted = u.discount && u.discount.percent > 0;
      await prisma.integPlatformProduct.updateMany({
        where: { platformCode: this.platformCode, platformProductId: u.platformProductId },
        data: {
          price: u.salePrice ?? u.price,
          originalPrice: discounted ? u.price : null,
          discountPercent: discounted ? u.discount!.percent : null,
        },
      });
    }
    return { success: updates.map((u) => u.platformProductId), failed: [] };
  }

  async fetchOrders(): Promise<FetchOrdersResult> {
    const forced = state.forced.delete(this.platformCode);
    if (!forced && Math.random() > ORDER_CHANCE) return { items: [], hasMore: false };
    const item = await demoOrderItem(this.platformCode);
    return { items: item ? [item] : [], hasMore: false };
  }
}

/**
 * گفت‌وگو جدا: worker از روی وجود `fetchChats` تصمیم می‌گیرد، پس بازارگاهی که
 * در واقعیت پیام‌رسان ندارد نباید این متدها را داشته باشد.
 */
export class DemoChatMarketplaceAdapter extends DemoMarketplaceAdapter {
  async resolveSelfId(): Promise<string | null> {
    return "demo-shop";
  }

  async fetchChats(): Promise<FetchChatsResult> {
    if (Math.random() < CHAT_CHANCE) await queueChatQuestion(this.platformCode);
    const now = new Date();
    const chats: ChatInfo[] = [];
    for (const [key, messages] of state.pendingChats) {
      const [platform, externalId] = key.split("|");
      if (platform !== this.platformCode || !messages.length) continue;
      const last = messages[messages.length - 1];
      chats.push({
        externalId,
        chatType: "private",
        contactId: last.senderId,
        contactName: last.senderName,
        unseenCount: messages.length,
        updatedAt: now,
        lastMessageAt: last.sentAt,
        lastMessageText: last.text,
        raw: { demo: true },
      });
    }
    return { chats, maxUpdatedAt: now };
  }

  async fetchMessages(_c: Record<string, string>, opts: { chatId: string }): Promise<FetchMessagesResult> {
    const key = `${this.platformCode}|${opts.chatId}`;
    const messages = state.pendingChats.get(key) ?? [];
    state.pendingChats.delete(key);
    return { messages, hasMore: false };
  }

  async sendMessage(): Promise<SendMessageResult> {
    const now = new Date();
    return { externalId: String(now.getTime()), sentAt: now };
  }
}

/** یک قلم سفارش از کالایی که نگاشت دارد و موجودی‌اش ته نکشیده */
async function demoOrderItem(platformCode: string): Promise<OrderItemInfo | null> {
  const links = await prisma.integMappingLink.findMany({
    where: { platformCode, isActive: true, mapping: { isActive: true, stock: { gt: 2 } } },
    select: { externalId: true, externalTitle: true },
    take: 300,
  });
  if (!links.length) return null;
  const link = pick(links);
  const remote = await prisma.integPlatformProduct.findUnique({
    where: { platformCode_platformProductId: { platformCode, platformProductId: link.externalId } },
    select: { title: true, price: true },
  });
  const stamp = Date.now();
  const orderNo = String(stamp).slice(-8);
  return {
    platformOrderId: `demo-${stamp}:1`,
    platformOrderNo: orderNo,
    platformOrderItemId: "1",
    platformProductId: link.externalId,
    qty: Math.random() < 0.8 ? 1 : 2,
    title: remote?.title ?? link.externalTitle ?? "کالای نمایشی",
    unitPrice: remote?.price ?? undefined,
    customerName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    customerPhone: fakePhone(),
    orderedAt: new Date(),
  };
}

/** پرسش تازه — نیمی در گفت‌وگوی موجود، نیمی از مشتری تازه */
async function queueChatQuestion(platformCode: string) {
  const existing = Math.random() < 0.5
    ? await prisma.integChat.findFirst({ where: { platformCode, chatType: "private" }, orderBy: { lastMessageAt: "asc" }, select: { externalId: true, contactId: true, contactName: true } })
    : null;
  const now = new Date();
  const externalId = existing?.externalId ?? `demo-chat-${now.getTime()}`;
  const contactId = existing?.contactId ?? `demo-user-${now.getTime()}`;
  const name = existing?.contactName ?? `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  const key = `${platformCode}|${externalId}`;
  const list = state.pendingChats.get(key) ?? [];
  list.push({
    externalId: String(now.getTime()),
    senderId: contactId,
    senderName: name,
    messageType: "text",
    text: pick(CHAT_QUESTIONS),
    files: [],
    sentAt: now,
    raw: { demo: true },
  });
  state.pendingChats.set(key, list);
}
