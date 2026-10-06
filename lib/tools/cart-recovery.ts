/**
 * یادآوری سبد رهاشده — پیامک با لینک `/c/<token>` به مشتری‌ای که اقلامی در سبد
 * گذاشته و خرید نکرده.
 *
 * ⚠️ **فقط سبد سروری:** سبد مهمان در `localStorage` است و شماره‌ای از او نداریم.
 * ورود فروشگاه با موبایل است، پس هر `Cart` یک شماره دارد.
 *
 * ⚠️ **آخرین فعالیت = بیشترین `CartItem.updatedAt`.** `Cart.updatedAt` با تغییر
 * اقلام عوض نمی‌شود. تسویه اقلام را پاک می‌کند، پس سبدی که قلم دارد خرید نشده.
 *
 * ⚠️ **یک یادآوری برای هر دور سبد:** ردیف تازه فقط وقتی ساخته می‌شود که سبد بعد از
 * `cartActivityAt` آخرین ردیف همان کاربر تغییر کرده باشد؛ `cooldownDays` هم جلوی
 * پیامک پشت‌سرهم به یک شماره را می‌گیرد.
 *
 * مستندات: docs/plans/store-tools-2.md بخش ۱
 */

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { getSmsReadiness, sendPatternSms } from "@/lib/sms";
import { Prisma, type CartRecoveryStatus } from "@prisma/client";
import { ToolError, displayUrl, randomToken, tehranHour } from "./common";

// ─── تنظیمات ─────────────────────────────────────────────────────────────

export async function getCartRecoverySettings() {
  const s = await prisma.cartRecoverySetting.findUnique({ where: { id: "singleton" } });
  return {
    isEnabled: s?.isEnabled ?? false,
    enabledAt: s?.enabledAt?.toISOString() ?? null,
    patternCode: s?.patternCode ?? "",
    linkMode: (s?.linkMode === "FIXED" ? "FIXED" : "VARIABLE") as "VARIABLE" | "FIXED",
    delayMinutes: s?.delayMinutes ?? 120,
    sendFrom: s?.sendFrom ?? 10,
    sendTo: s?.sendTo ?? 21,
    minCartTotal: Number(s?.minCartTotal ?? 0),
    cooldownDays: s?.cooldownDays ?? 7,
    couponEnabled: s?.couponEnabled ?? false,
    couponType: (s?.couponType === "FIXED" ? "FIXED" : "PERCENT") as "PERCENT" | "FIXED",
    couponValue: Number(s?.couponValue ?? 5),
    couponMaxDiscount: Number(s?.couponMaxDiscount ?? 0),
    couponValidHours: s?.couponValidHours ?? 48,
  };
}

export type CartRecoverySettings = Awaited<ReturnType<typeof getCartRecoverySettings>>;

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export async function saveCartRecoverySettings(input: Record<string, unknown>) {
  const prev = await prisma.cartRecoverySetting.findUnique({ where: { id: "singleton" } });
  const isEnabled = input.isEnabled === true;
  const sendFrom = clampInt(input.sendFrom, 0, 23, 10);
  const sendTo = clampInt(input.sendTo, 1, 24, 21);
  if (sendTo <= sendFrom) throw new ToolError("پایان بازه‌ی ارسال باید بعد از شروعش باشد");

  const couponEnabled = input.couponEnabled === true;
  const couponType = input.couponType === "FIXED" ? "FIXED" : "PERCENT";
  const couponValue = clampInt(input.couponValue, 0, couponType === "PERCENT" ? 100 : 1_000_000_000, 5);
  if (couponEnabled && couponValue < 1) throw new ToolError("مقدار تخفیف را وارد کنید");

  const data = {
    isEnabled,
    // روشن‌شدن تازه زمانش را ثبت می‌کند؛ ماندن در حالت روشن آن را عوض نمی‌کند
    enabledAt: isEnabled ? (prev?.isEnabled && prev.enabledAt ? prev.enabledAt : new Date()) : prev?.enabledAt ?? null,
    patternCode: typeof input.patternCode === "string" ? input.patternCode.trim().slice(0, 60) || null : null,
    linkMode: input.linkMode === "FIXED" ? "FIXED" : "VARIABLE",
    delayMinutes: clampInt(input.delayMinutes, 30, 4320, 120),
    sendFrom,
    sendTo,
    minCartTotal: BigInt(clampInt(input.minCartTotal, 0, 10_000_000_000, 0)),
    cooldownDays: clampInt(input.cooldownDays, 1, 90, 7),
    couponEnabled,
    couponType,
    couponValue: BigInt(couponValue),
    couponMaxDiscount: BigInt(clampInt(input.couponMaxDiscount, 0, 1_000_000_000, 0)),
    couponValidHours: clampInt(input.couponValidHours, 1, 720, 48),
  };
  await prisma.cartRecoverySetting.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  return getCartRecoverySettings();
}

export function recoveryUrl(token: string): string {
  return `${SITE_URL.replace(/\/+$/, "")}/c/${token}`;
}

/** لینک حالت «ثابت» — داخل متن پترن */
export function fixedCartUrl(): string {
  return `${SITE_URL.replace(/\/+$/, "")}/cart`;
}

// ─── سبدهای باز ──────────────────────────────────────────────────────────

/** سبدهایی که آخرین تغییرشان در این بازه است، تازه‌ترین اول */
async function openCartGroups(opts: { before?: Date; after?: Date; take: number }) {
  const groups = await prisma.cartItem.groupBy({
    by: ["cartId"],
    _max: { updatedAt: true },
    having: {
      updatedAt: {
        _max: {
          ...(opts.before ? { lte: opts.before } : {}),
          ...(opts.after ? { gte: opts.after } : {}),
        },
      },
    },
    orderBy: { _max: { updatedAt: "desc" } },
    take: opts.take,
  });
  return groups.map((g) => ({ cartId: g.cartId, activityAt: g._max.updatedAt! }));
}

async function loadCarts(cartIds: string[]) {
  return prisma.cart.findMany({
    where: { id: { in: cartIds } },
    select: {
      id: true,
      userId: true,
      user: { select: { phone: true, firstName: true, lastName: true, isActive: true } },
      items: {
        select: {
          qty: true,
          product: { select: { id: true, title: true, price: true, salePrice: true, isActive: true } },
        },
      },
    },
  });
}

type LoadedCart = Awaited<ReturnType<typeof loadCarts>>[number];

function cartSnapshot(cart: LoadedCart) {
  const items = cart.items
    .filter((i) => i.product.isActive)
    .map((i) => ({
      productId: i.product.id,
      title: i.product.title,
      qty: i.qty,
      unitPrice: Number(i.product.salePrice ?? i.product.price),
    }));
  const total = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  return { items, total };
}

const fullName = (u: { firstName: string | null; lastName: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || null;

/** سبدهای باز همین حالا — برای پیگیری تلفنی، حتی وقتی ارسال خاموش است */
export async function listOpenCarts(take = 30) {
  const groups = await openCartGroups({ before: new Date(), take });
  const carts = await loadCarts(groups.map((g) => g.cartId));
  const byId = new Map(carts.map((c) => [c.id, c]));
  return groups
    .map((g) => {
      const c = byId.get(g.cartId);
      if (!c) return null;
      const snap = cartSnapshot(c);
      return {
        cartId: c.id,
        name: fullName(c.user),
        phone: c.user.phone,
        items: snap.items.length,
        qty: snap.items.reduce((s, i) => s + i.qty, 0),
        total: snap.total,
        titles: snap.items.slice(0, 3).map((i) => i.title),
        activityAt: g.activityAt.toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.items > 0);
}

// ─── تشخیص ───────────────────────────────────────────────────────────────

/** سبدی که بیش از این بی‌تغییر مانده دیگر «رهاشده‌ی تازه» نیست */
const STALE_MS = 3 * 86_400_000;
const SCAN_TAKE = 200;

/**
 * سبدهای رهاشده‌ی تازه را پیدا می‌کند و برای هرکدام یک ردیف PENDING می‌سازد.
 * ارسال جداست (`runCartRecoveries`) تا بازه‌ی ساعت فقط روی ارسال اثر بگذارد.
 */
export async function scanAbandonedCarts(now = new Date()): Promise<number> {
  const s = await getCartRecoverySettings();
  if (!s.isEnabled || !s.enabledAt) return 0;

  const enabledAt = new Date(s.enabledAt);
  const oldest = new Date(Math.max(now.getTime() - STALE_MS, enabledAt.getTime()));
  const groups = await openCartGroups({ before: new Date(now.getTime() - s.delayMinutes * 60_000), after: oldest, take: SCAN_TAKE });
  if (groups.length === 0) return 0;

  const carts = await loadCarts(groups.map((g) => g.cartId));
  const byId = new Map(carts.map((c) => [c.id, c]));
  let created = 0;

  for (const g of groups) {
    const cart = byId.get(g.cartId);
    if (!cart || !cart.user.isActive || !cart.user.phone) continue;

    // همین دور سبد قبلاً یادآوری داشته — حذف قلم هم بیشینه را عقب می‌برد و همین‌جا می‌ماند
    const done = await prisma.cartRecovery.findFirst({
      where: { userId: cart.userId, cartActivityAt: { gte: g.activityAt } },
      select: { id: true },
    });
    if (done) continue;

    const snap = cartSnapshot(cart);
    if (snap.items.length === 0 || snap.total < s.minCartTotal) continue;

    // سفارش بعد از آخرین تغییر سبد (مثلاً تسویه از دستگاه دیگر که سبد را خالی نکرد)
    const ordered = await prisma.order.findFirst({
      where: { userId: cart.userId, createdAt: { gte: g.activityAt } },
      select: { id: true },
    });
    if (ordered) continue;

    for (let i = 0; i < 4; i++) {
      try {
        await prisma.cartRecovery.create({
          data: {
            userId: cart.userId,
            phone: cart.user.phone,
            name: fullName(cart.user),
            token: randomToken(6),
            items: snap.items,
            cartTotal: BigInt(snap.total),
            cartActivityAt: g.activityAt,
            dueAt: now,
          },
        });
        created++;
        break;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // توکن تکراری
        throw e;
      }
    }
  }
  return created;
}

// ─── ارسال ───────────────────────────────────────────────────────────────

const BATCH = 20;
/** ردیفی که بیش از این در صف مانده (مثلاً شب تا صبح) هنوز ارسال می‌شود؛ بیشتر نه */
const QUEUE_STALE_MS = 24 * 3_600_000;
const COUPON_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function normalizePhone(p: string): string | null {
  let d = p.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[^\d]/g, "");
  if (d.startsWith("98")) d = `0${d.slice(2)}`;
  return /^09\d{9}$/.test(d) ? d : null;
}

function couponCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "CR";
  for (const b of bytes) out += COUPON_ALPHABET[b % COUPON_ALPHABET.length];
  return out;
}

async function skip(id: string, reason: string) {
  await prisma.cartRecovery.updateMany({ where: { id, status: "PENDING" }, data: { status: "SKIPPED", reason } });
}

/** کد تخفیف شخصی همین مشتری — یک‌بار مصرف، با مهلت */
async function createRecoveryCoupon(s: CartRecoverySettings, userId: string, now: Date) {
  for (let i = 0; i < 4; i++) {
    try {
      return await prisma.coupon.create({
        data: {
          code: couponCode(),
          title: "یادآوری سبد خرید",
          type: s.couponType,
          value: BigInt(s.couponValue),
          maxDiscount: s.couponType === "PERCENT" ? BigInt(s.couponMaxDiscount) : 0n,
          expiresAt: new Date(now.getTime() + s.couponValidHours * 3_600_000),
          usageLimit: 1,
          perUserLimit: 1,
          userId,
          note: "ساخته‌شده خودکار برای یادآوری سبد رهاشده",
        },
        select: { id: true, code: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("ساخت کد تخفیف ناموفق بود");
}

/**
 * یک دور ارسال — حداکثر ۲۰ پیامک. زمان‌بند (`scheduler.ts`) هر ۵ دقیقه صدا می‌زند.
 * ارسال ناموفق (`FAILED`) دوباره تلاش نمی‌شود.
 */
export async function runCartRecoveries(now = new Date()): Promise<{ sent: number; skipped: number; failed: number; note?: string }> {
  const r = { sent: 0, skipped: 0, failed: 0 };
  const s = await getCartRecoverySettings();
  if (!s.isEnabled) return { ...r, note: "خاموش" };
  if (!s.patternCode) return { ...r, note: "کد پترن ثبت نشده" };
  const sms = await getSmsReadiness();
  if (!sms.ready) return { ...r, note: sms.reason ?? undefined };
  const h = tehranHour(now);
  if (h < s.sendFrom || h >= s.sendTo) return { ...r, note: "بیرون از بازه‌ی ساعت ارسال" };

  const due = await prisma.cartRecovery.findMany({
    where: { status: "PENDING", dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: BATCH,
  });

  for (const q of due) {
    if (now.getTime() - q.dueAt.getTime() > QUEUE_STALE_MS) {
      await skip(q.id, "بیش از یک روز در صف مانده بود");
      r.skipped++;
      continue;
    }
    const phone = normalizePhone(q.phone);
    if (!phone) {
      await skip(q.id, "شماره موبایل معتبر نیست");
      r.skipped++;
      continue;
    }
    const left = await prisma.cartItem.count({ where: { cart: { userId: q.userId } } });
    if (left === 0) {
      await skip(q.id, "سبد پیش از ارسال خالی شد");
      r.skipped++;
      continue;
    }
    const ordered = await prisma.order.findFirst({ where: { userId: q.userId, createdAt: { gte: q.cartActivityAt } }, select: { id: true } });
    if (ordered) {
      await skip(q.id, "پیش از ارسال سفارش ثبت کرد");
      r.skipped++;
      continue;
    }
    const optedOut = await prisma.smsOptOut.findFirst({ where: { phone: { in: [phone, q.phone] } }, select: { id: true } });
    if (optedOut) {
      await skip(q.id, "مشتری پیامک را لغو کرده");
      r.skipped++;
      continue;
    }
    const recent = await prisma.cartRecovery.findFirst({
      where: {
        phone: q.phone,
        status: { in: ["SENT", "RECOVERED"] },
        sentAt: { gte: new Date(now.getTime() - s.cooldownDays * 86_400_000) },
      },
      select: { id: true },
    });
    if (recent) {
      await skip(q.id, `در ${s.cooldownDays.toLocaleString("fa-IR")} روز گذشته یادآوری سبد گرفته`);
      r.skipped++;
      continue;
    }

    // قفل: فقط یک پروسه این ردیف را برمی‌دارد
    const claim = await prisma.cartRecovery.updateMany({ where: { id: q.id, status: "PENDING" }, data: { status: "SENT", sentAt: now } });
    if (claim.count !== 1) continue;

    let coupon: { id: string; code: string } | null = null;
    try {
      if (s.couponEnabled) {
        coupon = await createRecoveryCoupon(s, q.userId, now);
        await prisma.cartRecovery.update({ where: { id: q.id }, data: { couponId: coupon.id, couponCode: coupon.code } });
      }
      const attributes: Record<string, string> = { name: q.name || "مشتری" };
      if (s.linkMode === "VARIABLE") attributes.link = displayUrl(recoveryUrl(q.token));
      if (coupon) attributes.code = coupon.code;
      await sendPatternSms(phone, s.patternCode, attributes);
      r.sent++;
    } catch (e) {
      // کدی که به دست مشتری نرسید نباید فعال بماند
      if (coupon) await prisma.coupon.update({ where: { id: coupon.id }, data: { isActive: false } }).catch(() => {});
      await prisma.cartRecovery.update({
        where: { id: q.id },
        data: { status: "FAILED", reason: e instanceof Error ? e.message.slice(0, 200) : "خطای ارسال" },
      });
      r.failed++;
    }
  }
  return r;
}

// ─── بازگشت ──────────────────────────────────────────────────────────────

/** سفارشی که تا این مدت بعد از پیامک ثبت شود «بازگشته» حساب می‌شود */
const ATTRIBUTION_MS = 7 * 86_400_000;

/**
 * بعد از ساخت سفارش در `/api/checkout` صدا زده می‌شود. آخرین یادآوری ارسال‌شده‌ی
 * همین کاربر در ۷ روز اخیر را «بازگشته» می‌کند. خطا بلعیده می‌شود — تسویه نباید
 * به‌خاطر گزارش بشکند.
 */
export async function markCartRecovered(userId: string, orderId: string, grandTotal: bigint): Promise<void> {
  try {
    const now = new Date();
    const last = await prisma.cartRecovery.findFirst({
      where: { userId, status: "SENT", sentAt: { gte: new Date(now.getTime() - ATTRIBUTION_MS) } },
      orderBy: { sentAt: "desc" },
      select: { id: true },
    });
    if (!last) return;
    await prisma.cartRecovery.updateMany({
      where: { id: last.id, status: "SENT" },
      data: { status: "RECOVERED", recoveredOrderId: orderId, recoveredAt: now, recoveredTotal: grandTotal },
    });
  } catch (e) {
    console.error("[cart-recovery] ثبت بازگشت ناموفق:", e);
  }
}

// ─── صفحه‌ی عمومی ────────────────────────────────────────────────────────

export interface RecoveryPageData {
  token: string;
  name: string | null;
  storeName: string;
  products: { id: string; title: string; slug: string; price: string; salePrice: string | null; mainImage: string | null; qty: number; inStock: boolean }[];
  coupon: { code: string; expiresAt: string | null; usable: boolean } | null;
}

/** `null` = توکن ناشناخته */
export async function loadRecoveryPage(rawToken: string): Promise<RecoveryPageData | null> {
  const token = rawToken.trim().toLowerCase();
  if (!/^[a-z0-9]{6}$/.test(token)) return null;
  const rec = await prisma.cartRecovery.findUnique({ where: { token } });
  if (!rec) return null;

  if (!rec.openedAt) {
    // بی‌سروصدا — خطا جلوی صفحه را نمی‌گیرد
    prisma.cartRecovery.update({ where: { id: rec.id }, data: { openedAt: new Date() } }).catch(() => {});
  }

  const snap = (Array.isArray(rec.items) ? rec.items : []) as { productId: string; qty: number }[];
  const ids = snap.map((i) => i.productId).filter((x) => typeof x === "string");
  const [products, coupon, store] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true, title: true, slug: true, price: true, salePrice: true, mainImage: true, stock: true, trackStock: true,
        images: { take: 1, select: { url: true } },
      },
    }),
    rec.couponId ? prisma.coupon.findUnique({ where: { id: rec.couponId }, select: { code: true, expiresAt: true, isActive: true, usedCount: true } }) : null,
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true } }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  return {
    token,
    name: rec.name,
    storeName: store?.storeName ?? "",
    products: snap
      .map((i) => {
        const p = byId.get(i.productId);
        if (!p) return null;
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          price: p.price.toString(),
          salePrice: p.salePrice?.toString() ?? null,
          mainImage: p.mainImage ?? p.images[0]?.url ?? null,
          qty: Math.max(1, Math.min(99, Number(i.qty) || 1)),
          inStock: !p.trackStock || p.stock > 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x),
    coupon: coupon
      ? {
          code: coupon.code,
          expiresAt: coupon.expiresAt?.toISOString() ?? null,
          usable: coupon.isActive && coupon.usedCount === 0 && (!coupon.expiresAt || coupon.expiresAt > new Date()),
        }
      : null,
  };
}

// ─── گزارش ───────────────────────────────────────────────────────────────

export async function cartRecoveryStats(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const where = { createdAt: { gte: since } };
  const [byStatus, opened, recoveredSum, pendingNow, couponIds, recent] = await Promise.all([
    prisma.cartRecovery.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.cartRecovery.count({ where: { ...where, openedAt: { not: null } } }),
    prisma.cartRecovery.aggregate({ where: { ...where, status: "RECOVERED" }, _sum: { recoveredTotal: true } }),
    prisma.cartRecovery.count({ where: { status: "PENDING" } }),
    prisma.cartRecovery.findMany({ where: { ...where, couponId: { not: null } }, select: { couponId: true } }),
    prisma.cartRecovery.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, phone: true, name: true, status: true, reason: true, cartTotal: true, items: true,
        createdAt: true, sentAt: true, openedAt: true, couponCode: true, recoveredTotal: true, recoveredOrderId: true,
      },
    }),
  ]);
  const couponsUsed = couponIds.length
    ? await prisma.couponRedemption.count({ where: { couponId: { in: couponIds.map((c) => c.couponId!) } } })
    : 0;
  const orderIds = recent.map((r) => r.recoveredOrderId).filter((x): x is string => !!x);
  const orders = orderIds.length
    ? await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true } })
    : [];
  const orderNo = new Map(orders.map((o) => [o.id, o.orderNumber]));

  const status: Record<CartRecoveryStatus, number> = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0, RECOVERED: 0 };
  for (const g of byStatus) status[g.status] = g._count._all;
  return {
    days,
    status,
    /** ارسال‌شده‌ها، بازگشته‌ها هم ارسال شده بودند */
    sent: status.SENT + status.RECOVERED,
    opened,
    recoveredTotal: Number(recoveredSum._sum.recoveredTotal ?? 0),
    couponsIssued: couponIds.length,
    couponsUsed,
    pendingNow,
    recent: recent.map((x) => ({
      id: x.id,
      phone: x.phone,
      name: x.name,
      status: x.status,
      reason: x.reason,
      cartTotal: Number(x.cartTotal),
      items: Array.isArray(x.items) ? x.items.length : 0,
      createdAt: x.createdAt.toISOString(),
      sentAt: x.sentAt?.toISOString() ?? null,
      openedAt: x.openedAt?.toISOString() ?? null,
      couponCode: x.couponCode,
      recoveredTotal: x.recoveredTotal == null ? null : Number(x.recoveredTotal),
      orderNumber: x.recoveredOrderId ? orderNo.get(x.recoveredOrderId) ?? null : null,
    })),
  };
}
