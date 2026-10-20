/**
 * کارهای حساب مشتری در چت فروشگاه — docs/plans/storefront-chat.md فاز ۲
 *
 * ⚠️ مرز امنیتی اینجاست، نه در پرامپت:
 *    - سفارش و گارانتیِ «من» شناسه را از سشن (`ctx.user`) می‌گیرند؛ مدل هیچ ورودی userId ندارد.
 *    - استعلام گارانتی با سریال فقط تطابق دقیق است (همان صفحه‌ی عمومی `/warranty`)؛
 *      جستجو با شماره موبایل که آن صفحه دارد اینجا نیست چون مدل می‌تواند شماره‌ی دیگری بسازد.
 *    - درخواست تماس فقط با شماره‌ای ثبت می‌شود که خود مشتری در گفتگو نوشته یا شماره‌ی حسابش است.
 *    - کد تخفیف فقط آن‌هایی که مدیر «معرفی به مشتری در دستیار خرید» را برایشان زده.
 *    - «افزودن به سبد» فقط یک دستور برای مرورگر است؛ سبد همان `CartProvider` سایت است.
 */
import { prisma } from "@/lib/prisma";
import { priceLabel } from "./text";
import { cardsBySlugs, type ProductCard } from "./search";

export type ShopUser = { id: string; phone: string; firstName: string | null };

/** دستوری که مرورگر اجرا می‌کند — app/api/chat/route.ts رویداد `{action}` */
export type ShopAction =
  | { type: "add_to_cart"; product: CartActionProduct; qty: number }
  | { type: "callback_done" };

export type CartActionProduct = {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  mainImage: string | null;
  images: { url: string }[];
};

export type ToolContext = {
  user: ShopUser | null;
  conversationId: string;
  siteId: string | null;
  /** پیام‌های خود مشتری در این گفتگو — مبنای پذیرش شماره‌ی تماس */
  userTexts: string[];
  actions: ShopAction[];
  /** صفحه‌ی فعلی سبد خرید سایت را دارد (پل سبد آماده است) */
  cartAvailable: boolean;
};

const LOGIN_URL = "/auth";

const ORDER_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت شده",
  CONFIRMED: "تأیید شده",
  PROCESSING: "در حال آماده‌سازی",
  PACKAGING: "در حال بسته‌بندی",
  SHIPPED: "ارسال شده",
  DELIVERED: "تحویل داده شده",
  COMPLETED: "تکمیل شده",
  CANCELED: "لغو شده",
  REFUNDED: "مبلغ برگشت داده شده",
};

const faDate = (d: Date) => d.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });

const notLoggedIn = () => ({
  loggedIn: false,
  note: "مشتری وارد حسابش نشده. بگو برای این کار وارد حساب شود (لینک ورود را بده) یا شماره‌ی سفارش و موبایلش را برای کارشناس بگذارد (request_callback).",
  loginUrl: LOGIN_URL,
});

// ─── سفارش ───────────────────────────────────────────────────────────────────

export async function myOrders(ctx: ToolContext, orderNumber?: string) {
  if (!ctx.user) return notLoggedIn();
  const num = orderNumber?.replace(/[^\dA-Za-z-]/g, "");
  const orders = await prisma.order.findMany({
    where: { userId: ctx.user.id, ...(num && { orderNumber: { contains: num } }) },
    orderBy: { createdAt: "desc" },
    take: num ? 3 : 5,
    select: {
      id: true, orderNumber: true, status: true, grandTotal: true, createdAt: true, trackingCode: true,
      items: { select: { titleSnapshot: true, variantTitleSnapshot: true, qty: true } },
    },
  });
  if (!orders.length) {
    return { loggedIn: true, orders: [], note: num ? "سفارشی با این شماره در حساب این مشتری نیست" : "این مشتری هنوز سفارشی ندارد" };
  }
  return {
    loggedIn: true,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: ORDER_STATUS[o.status] ?? o.status,
      date: faDate(o.createdAt),
      total: priceLabel(o.grandTotal),
      trackingCode: o.trackingCode || null,
      items: o.items.slice(0, 6).map((i) => `${i.titleSnapshot}${i.variantTitleSnapshot ? ` (${i.variantTitleSnapshot})` : ""} × ${i.qty}`),
      url: `/user/orders/${o.id}`,
    })),
  };
}

// ─── گارانتی ─────────────────────────────────────────────────────────────────

function warrantyView(g: { serialNumber: string; productTitle: string; startDate: Date; endDate: Date }) {
  const daysLeft = Math.ceil((g.endDate.getTime() - Date.now()) / 86_400_000);
  return {
    serialNumber: g.serialNumber,
    product: g.productTitle,
    start: faDate(g.startDate),
    end: faDate(g.endDate),
    active: daysLeft > 0,
    daysLeft: Math.max(0, daysLeft),
  };
}

export async function checkWarranty(ctx: ToolContext, serial?: string) {
  const s = serial?.trim();
  const page = { warrantyPage: "/warranty", howToClaim: "ثبت درخواست خدمات گارانتی در صفحه‌ی /warranty انجام می‌شود" };
  if (s) {
    const g = await prisma.guaranty.findUnique({
      where: { serialNumber: s },
      select: { serialNumber: true, productTitle: true, startDate: true, endDate: true },
    });
    return g ? { found: true, warranty: warrantyView(g), ...page } : { found: false, note: "گارانتی با این شماره‌ی سریال ثبت نشده؛ از مشتری بخواه سریال را دوباره بررسی کند", ...page };
  }
  if (!ctx.user) {
    return { found: false, note: "شماره‌ی سریال دستگاه را از مشتری بپرس، یا بگو با ورود به حسابش گارانتی‌هایش را ببیند", loginUrl: LOGIN_URL, ...page };
  }
  const list = await prisma.guaranty.findMany({
    where: { userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { serialNumber: true, productTitle: true, startDate: true, endDate: true },
  });
  return { found: list.length > 0, warranties: list.map(warrantyView), ...page };
}

// ─── کد تخفیف ────────────────────────────────────────────────────────────────

export async function activeCoupons() {
  const now = new Date();
  const rows = await prisma.coupon.findMany({
    where: {
      showInChat: true,
      isActive: true,
      userId: null,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      code: true, title: true, type: true, value: true, maxDiscount: true, minOrderTotal: true, expiresAt: true,
      usageLimit: true, clubOnly: true, tierIds: true, _count: { select: { redemptions: true } },
    },
  });
  const coupons = rows
    .filter((c) => !c.usageLimit || c._count.redemptions < c.usageLimit)
    .map((c) => ({
      code: c.code,
      title: c.title,
      discount:
        c.type === "FREE_SHIP" ? "ارسال رایگان" :
        c.type === "PERCENT" ? `${Number(c.value).toLocaleString("fa-IR")}٪${c.maxDiscount > BigInt(0) ? ` تا سقف ${priceLabel(c.maxDiscount)}` : ""}` :
        priceLabel(c.value),
      minOrder: c.minOrderTotal > BigInt(0) ? priceLabel(c.minOrderTotal) : null,
      expires: c.expiresAt ? faDate(c.expiresAt) : null,
      onlyFor: c.tierIds.length ? "سطح‌های خاص باشگاه مشتریان" : c.clubOnly ? "اعضای باشگاه مشتریان" : null,
    }));
  return coupons.length
    ? { coupons, note: "کد در صفحه‌ی پرداخت (تسویه‌حساب) وارد می‌شود" }
    : { coupons: [], note: "الان کد تخفیف عمومی فعالی نیست؛ تخفیف نساز و وعده نده" };
}

// ─── درخواست تماس ────────────────────────────────────────────────────────────

const MAX_CALLBACKS_PER_CONVERSATION = 3;

/** ۰۹۱۲۳۴۵۶۷۸۹ از هر شکل نوشتاری (رقم فارسی، فاصله، +۹۸) */
export function normalizeMobile(input: string): string | null {
  const digits = input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\D/g, "");
  const m = digits.match(/^(?:0098|98|0)?(9\d{9})$/);
  return m ? `0${m[1]}` : null;
}

function mobilesIn(texts: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of texts) {
    const ascii = t.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    for (const m of ascii.matchAll(/(?:\+?98|0098|0)?[\s-]*9(?:[\s-]*\d){9}/g)) {
      const n = normalizeMobile(m[0]);
      if (n) out.add(n);
    }
  }
  return out;
}

export async function requestCallback(ctx: ToolContext, args: { phone?: string; summary?: string; productSlug?: string }) {
  const given = args.phone ? normalizeMobile(args.phone) : null;
  const own = ctx.user ? normalizeMobile(ctx.user.phone) : null;
  const phone = given ?? own;
  if (!phone) {
    return { ok: false, note: "شماره‌ی موبایل مشتری لازم است؛ از خودش بپرس (یا بگو از دکمه‌ی «درخواست تماس کارشناس» استفاده کند)" };
  }
  if (phone !== own && !mobilesIn(ctx.userTexts).has(phone)) {
    return { ok: false, note: "این شماره را مشتری در گفتگو ننوشته؛ فقط شماره‌ای که خودش می‌نویسد ثبت می‌شود. از او بپرس" };
  }
  const already = await prisma.callbackRequest.count({ where: { conversationId: ctx.conversationId } });
  if (already >= MAX_CALLBACKS_PER_CONVERSATION) {
    return { ok: true, note: "درخواست تماس این گفتگو قبلاً ثبت شده؛ دوباره ثبت نکن و به مشتری بگو همکاران تماس می‌گیرند" };
  }

  const product = args.productSlug
    ? await prisma.product.findFirst({ where: { slug: args.productSlug.trim(), isActive: true }, select: { title: true, slug: true } })
    : null;
  const note = [
    "از دستیار خرید",
    product && `کالا: ${product.title} — /products/${product.slug}`,
    args.summary?.trim() && `خلاصه: ${args.summary.trim().slice(0, 300)}`,
  ].filter(Boolean).join(" | ");

  await prisma.callbackRequest.create({
    data: { phone, siteId: ctx.siteId, conversationId: ctx.conversationId, userId: ctx.user?.id ?? null, status: "pending", note },
  });
  ctx.actions.push({ type: "callback_done" });
  return { ok: true, phone, note: "درخواست ثبت شد؛ به مشتری بگو همکاران در ساعت کاری با همین شماره تماس می‌گیرند" };
}

// ─── سبد ─────────────────────────────────────────────────────────────────────

export async function addToCart(ctx: ToolContext, slug: string, qty: number) {
  const p = await prisma.product.findFirst({
    where: { slug: slug.trim().replace(/^\/?products\//, ""), isActive: true },
    select: {
      id: true, title: true, slug: true, price: true, salePrice: true, mainImage: true, hasVariants: true, stock: true, trackStock: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
  });
  if (!p) return { ok: false, note: "این کالا پیدا نشد؛ نامک را از نتیجه‌ی جستجو بردار" };
  const card: ProductCard | undefined = (await cardsBySlugs([p.slug]))[0];
  if (p.hasVariants) return { ok: false, note: "این کالا رنگ/سایز دارد؛ مشتری باید در صفحه‌ی محصول انتخاب کند", url: `/products/${p.slug}` };
  if (Number(p.salePrice ?? p.price) <= 0) return { ok: false, note: "قیمت استعلامی است و آنلاین فروخته نمی‌شود؛ درخواست تماس پیشنهاد بده", url: `/products/${p.slug}` };
  if (p.trackStock && p.stock <= 0) return { ok: false, note: "ناموجود است؛ جایگزین موجود پیشنهاد بده", url: `/products/${p.slug}` };
  if (!ctx.cartAvailable) return { ok: false, note: "در این صفحه سبد در دسترس نیست؛ لینک محصول را بده تا از صفحه‌ی خودش اضافه کند", url: `/products/${p.slug}` };

  const n = Math.min(Math.max(1, Math.round(qty || 1)), p.trackStock ? Math.max(1, p.stock) : 20);
  ctx.actions.push({
    type: "add_to_cart",
    qty: n,
    product: {
      id: p.id, title: p.title, slug: p.slug, price: String(p.price), salePrice: p.salePrice !== null ? String(p.salePrice) : null,
      mainImage: p.mainImage, images: p.images,
    },
  });
  return { ok: true, added: { title: p.title, qty: n, priceText: card?.priceText }, cartUrl: "/cart", note: "به سبد اضافه شد؛ برای نهایی کردن به /cart برود" };
}
