/**
 * «موجود شد خبرم کن» — مشتری روی صفحه‌ی کالای ناموجود شماره می‌گذارد و وقتی کالا
 * موجود شد پیامک می‌گیرد.
 *
 * ⚠️ **ارسال با اسکن، نه قلاب:** موجودی از چند مسیر عوض می‌شود (ویرایش محصول، ویرایش
 * گروهی، اتصال بازارها، انبار حسابداری). زمان‌بند هر ۵ دقیقه کالاهای فعالِ موجود با
 * درخواست WAITING را پیدا می‌کند؛ هیچ مسیر ویرایش موجودی لازم نیست چیزی صدا بزند.
 *
 * ⚠️ «موجود» همان قاعده‌ی صفحه‌ی محصول است: `!trackStock || stock > 0`.
 *
 * مستندات: docs/features/tools.md بخش ۷، docs/plans/store-tools-2.md بخش ۲
 */

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { getSmsReadiness, sendPatternSms } from "@/lib/sms";
import { Prisma, type StockAlertStatus } from "@prisma/client";
import { ToolError, displayUrl, randomToken, tehranHour } from "./common";

// ─── تنظیمات ─────────────────────────────────────────────────────────────

export async function getStockAlertSettings() {
  const s = await prisma.stockAlertSetting.findUnique({ where: { id: "singleton" } });
  return {
    isEnabled: s?.isEnabled ?? false,
    patternCode: s?.patternCode ?? "",
    linkMode: (s?.linkMode === "NONE" ? "NONE" : "VARIABLE") as "VARIABLE" | "NONE",
    sendFrom: s?.sendFrom ?? 10,
    sendTo: s?.sendTo ?? 21,
  };
}

export type StockAlertSettings = Awaited<ReturnType<typeof getStockAlertSettings>>;

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export async function saveStockAlertSettings(input: Record<string, unknown>) {
  const sendFrom = clampInt(input.sendFrom, 0, 23, 10);
  const sendTo = clampInt(input.sendTo, 1, 24, 21);
  if (sendTo <= sendFrom) throw new ToolError("پایان بازه‌ی ارسال باید بعد از شروعش باشد");
  const data = {
    isEnabled: input.isEnabled === true,
    patternCode: typeof input.patternCode === "string" ? input.patternCode.trim().slice(0, 60) || null : null,
    linkMode: input.linkMode === "NONE" ? "NONE" : "VARIABLE",
    sendFrom,
    sendTo,
  };
  await prisma.stockAlertSetting.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  return getStockAlertSettings();
}

export function alertUrl(token: string): string {
  return `${SITE_URL.replace(/\/+$/, "")}/n/${token}`;
}

/** نام کالا در متغیر پترن — سامانه‌ها طول متغیر را محدود می‌کنند */
export function productVar(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  return t.length > 40 ? `${t.slice(0, 39).trim()}…` : t;
}

function normalizePhone(p: string): string | null {
  let d = p.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[^\d]/g, "");
  if (d.startsWith("98")) d = `0${d.slice(2)}`;
  return /^09\d{9}$/.test(d) ? d : null;
}

const inStockWhere = { isActive: true, OR: [{ trackStock: false }, { stock: { gt: 0 } }] } satisfies Prisma.ProductWhereInput;

// ─── فرم عمومی ───────────────────────────────────────────────────────────

const RATE_WINDOW_MS = 60 * 60_000;
const RATE_MAX = 10;
const rate = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rate.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rate.set(key, hits);
    return true;
  }
  hits.push(now);
  rate.set(key, hits);
  if (rate.size > 5000) rate.clear();
  return false;
}

/** وضعیت فرم برای صفحه‌ی محصول: روشن است؟ این کاربر قبلاً ثبت کرده؟ */
export async function stockAlertState(productId: string, user: { id: string; phone: string } | null) {
  const s = await prisma.stockAlertSetting.findUnique({ where: { id: "singleton" }, select: { isEnabled: true } });
  if (!s?.isEnabled) return { enabled: false, phone: null, subscribed: false };
  const phone = user ? normalizePhone(user.phone) : null;
  const existing = phone
    ? await prisma.stockAlert.findUnique({ where: { productId_phone: { productId, phone } }, select: { status: true } })
    : null;
  return { enabled: true, phone, subscribed: existing?.status === "WAITING" };
}

/**
 * ثبت درخواست. فقط وقتی روشن است و کالا فعال و واقعاً ناموجود است.
 * ثبت تکراری خطا نیست — همان ردیف به WAITING برمی‌گردد.
 */
export async function subscribeStockAlert(
  input: { productId?: unknown; phone?: unknown; website?: unknown },
  ctx: { ip: string | null; userId: string | null },
): Promise<{ already: boolean }> {
  // فیلد تله: انسان نمی‌بیندش، ربات پرش می‌کند
  if (typeof input.website === "string" && input.website.trim()) return { already: false };

  const s = await prisma.stockAlertSetting.findUnique({ where: { id: "singleton" }, select: { isEnabled: true } });
  if (!s?.isEnabled) throw new ToolError("این امکان فعلاً فعال نیست");
  const phone = normalizePhone(typeof input.phone === "string" ? input.phone : "");
  if (!phone) throw new ToolError("شماره موبایل معتبر نیست — مثل ۰۹۱۲۱۲۳۴۵۶۷");
  const productId = typeof input.productId === "string" ? input.productId : "";
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { isActive: true, trackStock: true, stock: true } });
  if (!p || !p.isActive) throw new ToolError("کالا پیدا نشد");
  if (!p.trackStock || p.stock > 0) throw new ToolError("این کالا الان موجود است — می‌توانید همین حالا سفارش دهید");
  if (rateLimited(ctx.ip ?? "unknown")) throw new ToolError("درخواست‌های زیادی فرستاده‌اید؛ کمی بعد دوباره تلاش کنید");

  const existing = await prisma.stockAlert.findUnique({ where: { productId_phone: { productId, phone } } });
  if (existing) {
    if (existing.status === "WAITING") return { already: true };
    await prisma.stockAlert.update({
      where: { id: existing.id },
      data: { status: "WAITING", reason: null, notifiedAt: null, clickedAt: null, createdAt: new Date(), userId: ctx.userId ?? existing.userId },
    });
    return { already: false };
  }
  for (let i = 0; i < 4; i++) {
    try {
      await prisma.stockAlert.create({ data: { productId, phone, userId: ctx.userId, token: randomToken(6) } });
      return { already: false };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown })?.target ?? "");
        if (target.includes("phone") || target.includes("productId")) return { already: true }; // دو کلیک هم‌زمان
        continue; // توکن تکراری
      }
      throw e;
    }
  }
  throw new Error("ثبت درخواست ناموفق بود");
}

/** کلیک لینک پیامک → آدرس صفحه‌ی محصول، یا `null`. پیش‌نمایش ربات (`count=false`) شمرده نمی‌شود */
export async function resolveAlertClick(rawToken: string, count = true): Promise<string | null> {
  const token = rawToken.trim().toLowerCase();
  if (!/^[a-z0-9]{6}$/.test(token)) return null;
  const a = await prisma.stockAlert.findUnique({ where: { token }, select: { id: true, clickedAt: true, product: { select: { slug: true } } } });
  if (!a) return null;
  if (count && !a.clickedAt) prisma.stockAlert.update({ where: { id: a.id }, data: { clickedAt: new Date() } }).catch(() => {});
  return `/products/${encodeURIComponent(a.product.slug)}?utm_source=sms&utm_medium=sms&utm_campaign=back-in-stock`;
}

// ─── ارسال ───────────────────────────────────────────────────────────────

const BATCH = 30;
/** درخواستی که بیش از این منتظر مانده دیگر پیامک نمی‌گیرد — مشتری احتمالاً جای دیگری خریده */
const EXPIRE_MS = 180 * 86_400_000;

/**
 * یک دور ارسال — حداکثر ۳۰ پیامک. زمان‌بند (`scheduler.ts`) هر ۵ دقیقه صدا می‌زند.
 * به همه‌ی منتظرها می‌رود حتی اگر موجودی کمتر باشد — پیامک قول کالا نیست.
 */
export async function runStockAlerts(now = new Date()): Promise<{ sent: number; skipped: number; failed: number; note?: string }> {
  const r = { sent: 0, skipped: 0, failed: 0 };
  const s = await getStockAlertSettings();
  if (!s.isEnabled) return { ...r, note: "خاموش" };
  if (!s.patternCode) return { ...r, note: "کد پترن ثبت نشده" };
  const sms = await getSmsReadiness();
  if (!sms.ready) return { ...r, note: sms.reason ?? undefined };
  const h = tehranHour(now);
  if (h < s.sendFrom || h >= s.sendTo) return { ...r, note: "بیرون از بازه‌ی ساعت ارسال" };

  const expired = await prisma.stockAlert.updateMany({
    where: { status: "WAITING", createdAt: { lt: new Date(now.getTime() - EXPIRE_MS) } },
    data: { status: "CANCELLED", reason: "بیش از ۶ ماه منتظر ماند" },
  });
  r.skipped += expired.count;

  const due = await prisma.stockAlert.findMany({
    where: { status: "WAITING", product: inStockWhere },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, phone: true, token: true, product: { select: { title: true } } },
  });

  for (const a of due) {
    const phone = normalizePhone(a.phone);
    if (!phone) {
      await prisma.stockAlert.updateMany({ where: { id: a.id, status: "WAITING" }, data: { status: "CANCELLED", reason: "شماره موبایل معتبر نیست" } });
      r.skipped++;
      continue;
    }
    const optedOut = await prisma.smsOptOut.findFirst({ where: { phone: { in: [phone, a.phone] } }, select: { id: true } });
    if (optedOut) {
      await prisma.stockAlert.updateMany({ where: { id: a.id, status: "WAITING" }, data: { status: "CANCELLED", reason: "مشتری پیامک را لغو کرده" } });
      r.skipped++;
      continue;
    }

    // قفل: فقط یک پروسه این ردیف را برمی‌دارد
    const claim = await prisma.stockAlert.updateMany({ where: { id: a.id, status: "WAITING" }, data: { status: "SENT", notifiedAt: now } });
    if (claim.count !== 1) continue;

    const attributes: Record<string, string> = { product: productVar(a.product.title) };
    if (s.linkMode === "VARIABLE") attributes.link = displayUrl(alertUrl(a.token));
    try {
      await sendPatternSms(phone, s.patternCode, attributes);
      r.sent++;
    } catch (e) {
      await prisma.stockAlert.update({
        where: { id: a.id },
        data: { status: "FAILED", reason: e instanceof Error ? e.message.slice(0, 200) : "خطای ارسال" },
      });
      r.failed++;
    }
  }
  return r;
}

// ─── پنل ─────────────────────────────────────────────────────────────────

/** لغو یک درخواست منتظر از پنل */
export async function cancelStockAlert(id: string) {
  const r = await prisma.stockAlert.updateMany({ where: { id, status: "WAITING" }, data: { status: "CANCELLED", reason: "از پنل لغو شد" } });
  if (r.count !== 1) throw new ToolError("این درخواست دیگر منتظر نیست", 404);
}

/** خریدی که تا این مدت بعد از پیامک از همان شماره و همان کالا ثبت شود */
const PURCHASE_WINDOW_MS = 7 * 86_400_000;

export async function stockAlertStats(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [waiting, demand, sentRows, recent, failed30] = await Promise.all([
    prisma.stockAlert.count({ where: { status: "WAITING" } }),
    prisma.stockAlert.groupBy({
      by: ["productId"],
      where: { status: "WAITING" },
      _count: { _all: true },
      _min: { createdAt: true },
      orderBy: { _count: { productId: "desc" } },
      take: 30,
    }),
    prisma.stockAlert.findMany({
      where: { status: "SENT", notifiedAt: { gte: since } },
      select: { id: true, phone: true, productId: true, notifiedAt: true, clickedAt: true },
      take: 1000,
    }),
    prisma.stockAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true, phone: true, status: true, reason: true, createdAt: true, notifiedAt: true, clickedAt: true,
        product: { select: { id: true, title: true } },
      },
    }),
    prisma.stockAlert.count({ where: { status: "FAILED", notifiedAt: { gte: since } } }),
  ]);

  const products = demand.length
    ? await prisma.product.findMany({
        where: { id: { in: demand.map((d) => d.productId) } },
        select: { id: true, title: true, stock: true, trackStock: true, isActive: true },
      })
    : [];
  const pById = new Map(products.map((p) => [p.id, p]));

  // خرید بعد از پیامک: سفارش همان کالا از کاربری با همان شماره در ۷ روز
  let purchased = 0;
  if (sentRows.length) {
    const phones = [...new Set(sentRows.map((x) => x.phone))];
    const minAt = new Date(Math.min(...sentRows.map((x) => x.notifiedAt!.getTime())));
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: minAt }, user: { phone: { in: phones } }, status: { notIn: ["CANCELED", "REFUNDED"] } },
      select: { createdAt: true, user: { select: { phone: true } }, items: { select: { productId: true } } },
    });
    for (const a of sentRows) {
      const t0 = a.notifiedAt!.getTime();
      if (orders.some((o) => o.user.phone === a.phone && o.createdAt.getTime() >= t0 && o.createdAt.getTime() - t0 <= PURCHASE_WINDOW_MS && o.items.some((i) => i.productId === a.productId))) {
        purchased++;
      }
    }
  }

  return {
    days,
    waiting,
    sent: sentRows.length,
    clicked: sentRows.filter((x) => x.clickedAt).length,
    purchased,
    failed: failed30,
    demand: demand.map((d) => {
      const p = pById.get(d.productId);
      return {
        productId: d.productId,
        title: p?.title ?? "—",
        waiting: d._count._all,
        since: d._min.createdAt?.toISOString() ?? null,
        inStock: p ? p.isActive && (!p.trackStock || p.stock > 0) : false,
        stock: p?.stock ?? 0,
      };
    }),
    recent: recent.map((x) => ({
      id: x.id,
      phone: x.phone,
      status: x.status as StockAlertStatus,
      reason: x.reason,
      productId: x.product.id,
      productTitle: x.product.title,
      createdAt: x.createdAt.toISOString(),
      notifiedAt: x.notifiedAt?.toISOString() ?? null,
      clickedAt: x.clickedAt?.toISOString() ?? null,
    })),
  };
}
