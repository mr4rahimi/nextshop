/**
 * درخواست ثبت نظر — پیامک بعد از تحویل سفارش با لینک `/r/<token>`.
 *
 * صفحه‌ی لینک دکمه‌ی سکوهای نقشه (نشان، بلد، گوگل) را نشان می‌دهد و اگر
 * روشن باشد، محصولات همان سفارش را برای نظر در خود سایت.
 *
 * ⚠️ **فیلتر رضایت ممنوع.** سیاست گوگل «review gating» (فقط از راضی‌ها نظر
 * خواستن) را ممنوع کرده. پیامک به **همه‌ی** سفارش‌های واجد شرایط می‌رود و
 * متن پیامک و صفحه خنثی است («نظر شما برای ما مهم است»).
 *
 * ⚠️ **فقط تحویل‌های بعد از روشن‌شدن:** ردیف فقط در لحظه‌ی گذار وضعیت سفارش
 * ساخته می‌شود (`enqueueReviewRequest`)؛ روشن‌کردن به مشتری‌های قدیمی پیامک نمی‌زند.
 *
 * ⚠️ **یکتایی `ReviewRequest.orderId` قفل اتمی است** — هر سفارش حداکثر یک
 * پیامک، حتی اگر وضعیت چند بار رفت و برگشت کند.
 *
 * مستندات: docs/features/tools.md بخش ۴
 */

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { getSmsReadiness, sendPatternSms } from "@/lib/sms";
import { Prisma, type ReviewPlatform } from "@prisma/client";
import { ToolError, displayUrl, randomToken, tehranHour } from "./common";

export type MapPlatform = "NESHAN" | "BALAD" | "GOOGLE";

export const MAP_PLATFORMS: { key: MapPlatform; label: string; field: "neshanUrl" | "baladUrl" | "googleUrl"; hint: string }[] = [
  { key: "NESHAN", label: "نشان", field: "neshanUrl", hint: "در اپ نشان، مکان را باز کنید ← اشتراک‌گذاری ← کپی لینک" },
  { key: "BALAD", label: "بلد", field: "baladUrl", hint: "در اپ یا سایت بلد، صفحه‌ی مکان ← اشتراک‌گذاری" },
  { key: "GOOGLE", label: "گوگل‌مپ", field: "googleUrl", hint: "در Google Business Profile ← «درخواست نظر» ← لینک" },
];

export const PLATFORM_LABEL: Record<ReviewPlatform, string> = {
  NESHAN: "نشان",
  BALAD: "بلد",
  GOOGLE: "گوگل‌مپ",
  SITE: "محصولات سایت",
};

/** توکن عمومی برای استند پیشخوان، بلوک لندینگ و اینستاگرام */
export const PUBLIC_REVIEW_TOKEN = "shop";

export function reviewUrl(token: string): string {
  return `${SITE_URL.replace(/\/+$/, "")}/r/${token}`;
}

const DEFAULT_TITLE = "نظر شما برای ما مهم است";
const DEFAULT_MESSAGE = "ممنون که از ما خرید کردید. چند ثانیه وقت بگذارید و تجربه‌تان را با دیگران به اشتراک بگذارید.";

// ─── تنظیمات ─────────────────────────────────────────────────────────────

export async function getReviewSettings() {
  const s = await prisma.reviewRequestSetting.findUnique({ where: { id: "singleton" } });
  const order = Array.isArray(s?.platformOrder) ? (s!.platformOrder as string[]) : [];
  const platformOrder = [
    ...order.filter((k): k is MapPlatform => MAP_PLATFORMS.some((p) => p.key === k)),
    ...MAP_PLATFORMS.map((p) => p.key).filter((k) => !order.includes(k)),
  ];
  return {
    isEnabled: s?.isEnabled ?? false,
    enabledAt: s?.enabledAt?.toISOString() ?? null,
    neshanUrl: s?.neshanUrl ?? "",
    baladUrl: s?.baladUrl ?? "",
    googleUrl: s?.googleUrl ?? "",
    platformOrder,
    askProducts: s?.askProducts ?? true,
    patternCode: s?.patternCode ?? "",
    linkMode: (s?.linkMode === "FIXED" ? "FIXED" : "VARIABLE") as "VARIABLE" | "FIXED",
    triggerStatus: (s?.triggerStatus === "COMPLETED" ? "COMPLETED" : "DELIVERED") as "DELIVERED" | "COMPLETED",
    delayHours: s?.delayHours ?? 24,
    sendFrom: s?.sendFrom ?? 10,
    sendTo: s?.sendTo ?? 20,
    cooldownDays: s?.cooldownDays ?? 90,
    pageTitle: s?.pageTitle ?? "",
    pageMessage: s?.pageMessage ?? "",
  };
}

export type ReviewSettings = Awaited<ReturnType<typeof getReviewSettings>>;

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export async function saveReviewSettings(input: Record<string, unknown>) {
  const prev = await prisma.reviewRequestSetting.findUnique({ where: { id: "singleton" } });
  const urls: Record<string, string | null> = {};
  for (const p of MAP_PLATFORMS) {
    const v = typeof input[p.field] === "string" ? (input[p.field] as string).trim() : "";
    if (v && !/^https:\/\/\S+$/i.test(v)) throw new ToolError(`آدرس ${p.label} باید با https:// شروع شود`);
    urls[p.field] = v.slice(0, 1000) || null;
  }
  const order = Array.isArray(input.platformOrder)
    ? (input.platformOrder as unknown[]).filter((k): k is MapPlatform => MAP_PLATFORMS.some((p) => p.key === k))
    : ["NESHAN", "BALAD", "GOOGLE"];
  const isEnabled = input.isEnabled === true;
  const sendFrom = clampInt(input.sendFrom, 0, 23, 10);
  const sendTo = clampInt(input.sendTo, 1, 24, 20);
  if (sendTo <= sendFrom) throw new ToolError("پایان بازه‌ی ارسال باید بعد از شروعش باشد");

  const data = {
    isEnabled,
    // روشن‌شدن تازه زمانش را ثبت می‌کند؛ ماندن در حالت روشن آن را عوض نمی‌کند
    enabledAt: isEnabled ? (prev?.isEnabled && prev.enabledAt ? prev.enabledAt : new Date()) : prev?.enabledAt ?? null,
    neshanUrl: urls.neshanUrl,
    baladUrl: urls.baladUrl,
    googleUrl: urls.googleUrl,
    platformOrder: order,
    askProducts: input.askProducts !== false,
    patternCode: typeof input.patternCode === "string" ? input.patternCode.trim().slice(0, 60) || null : null,
    linkMode: input.linkMode === "FIXED" ? "FIXED" : "VARIABLE",
    triggerStatus: input.triggerStatus === "COMPLETED" ? "COMPLETED" : "DELIVERED",
    delayHours: clampInt(input.delayHours, 0, 168, 24),
    sendFrom,
    sendTo,
    cooldownDays: clampInt(input.cooldownDays, 1, 365, 90),
    pageTitle: typeof input.pageTitle === "string" ? input.pageTitle.trim().slice(0, 120) || null : null,
    pageMessage: typeof input.pageMessage === "string" ? input.pageMessage.trim().slice(0, 500) || null : null,
  };
  await prisma.reviewRequestSetting.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  return getReviewSettings();
}

/** سکوهای تنظیم‌شده به ترتیب نمایش */
export function configuredPlatforms(s: ReviewSettings): { key: MapPlatform; label: string; url: string }[] {
  return s.platformOrder
    .map((k) => {
      const meta = MAP_PLATFORMS.find((p) => p.key === k)!;
      return { key: k, label: meta.label, url: s[meta.field] };
    })
    .filter((p) => !!p.url);
}

/**
 * دکمه‌های سکو برای یک درخواست یا لینک عمومی — هر دکمه از
 * `/r/<token>/go/<platform>` می‌گذرد تا کلیکش شمرده شود.
 * بلوک «ثبت نظر» لندینگ هم از همین می‌خواند، پس تغییر آدرس‌ها بدون انتشار
 * دوباره‌ی لندینگ اعمال می‌شود.
 */
export async function reviewPlatformLinks(token: string | null) {
  const s = await getReviewSettings();
  const t = token ?? PUBLIC_REVIEW_TOKEN;
  return configuredPlatforms(s).map((p) => ({ key: p.key, label: p.label, url: `/r/${t}/go/${p.key.toLowerCase()}` }));
}

// ─── ساخت درخواست ────────────────────────────────────────────────────────

/**
 * در گذار وضعیت سفارش صدا زده می‌شود. اگر «تحویل» همان وضعیت تنظیم‌شده باشد،
 * یک ردیف PENDING با زمان ارسال می‌سازد. هر خطایی بلعیده می‌شود — مسیر سفارش
 * نباید به‌خاطر پیامک نظر بشکند.
 *
 * تحویل = DELIVERED؛ سفارشی که مستقیم به COMPLETED برود هم حساب است.
 * اگر «تکمیل» انتخاب شده باشد فقط COMPLETED.
 */
export async function enqueueReviewRequest(orderId: string, newStatus: string): Promise<void> {
  try {
    const s = await getReviewSettings();
    if (!s.isEnabled) return;
    const ok = s.triggerStatus === "COMPLETED" ? newStatus === "COMPLETED" : newStatus === "DELIVERED" || newStatus === "COMPLETED";
    if (!ok) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, user: { select: { phone: true, firstName: true, lastName: true } } },
    });
    if (!order?.user?.phone) return;

    const name = [order.user.firstName, order.user.lastName].filter(Boolean).join(" ").trim() || null;
    for (let i = 0; i < 4; i++) {
      try {
        await prisma.reviewRequest.create({
          data: {
            orderId,
            userId: order.userId,
            phone: order.user.phone,
            name,
            token: randomToken(6),
            dueAt: new Date(Date.now() + s.delayHours * 3_600_000),
          },
        });
        return;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const target = String((e.meta as { target?: unknown })?.target ?? "");
          // سفارش قبلاً درخواست داشته — همان کافی است
          if (target.includes("orderId")) return;
          continue; // توکن تکراری — دوباره
        }
        throw e;
      }
    }
  } catch (e) {
    console.error("[review-request] ساخت درخواست ناموفق:", e);
  }
}

// ─── ارسال ───────────────────────────────────────────────────────────────

const BATCH = 20;
/** تحویلی که بیش از این عقب افتاده (مثلاً بعد از خاموشی سرور) دیگر پیامک نمی‌گیرد */
const STALE_MS = 3 * 86_400_000;

function normalizePhone(p: string): string | null {
  let d = p.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[^\d]/g, "");
  if (d.startsWith("98")) d = `0${d.slice(2)}`;
  return /^09\d{9}$/.test(d) ? d : null;
}

async function skip(id: string, reason: string) {
  await prisma.reviewRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "SKIPPED", reason } });
}

/**
 * یک دور ارسال — حداکثر ۲۰ پیامک. زمان‌بند (`scheduler.ts`) هر ۵ دقیقه صدا می‌زند.
 * ارسال ناموفق (`FAILED`) دوباره تلاش نمی‌شود — با دلیل در فهرست دیده می‌شود.
 */
export async function runReviewRequests(now = new Date()): Promise<{ sent: number; skipped: number; failed: number; note?: string }> {
  const r = { sent: 0, skipped: 0, failed: 0 };
  const s = await getReviewSettings();
  if (!s.isEnabled) return { ...r, note: "خاموش" };
  if (!s.patternCode) return { ...r, note: "کد پترن ثبت نشده" };
  const sms = await getSmsReadiness();
  if (!sms.ready) return { ...r, note: sms.reason ?? undefined };
  const h = tehranHour(now);
  if (h < s.sendFrom || h >= s.sendTo) return { ...r, note: "بیرون از بازه‌ی ساعت ارسال" };

  const due = await prisma.reviewRequest.findMany({
    where: { status: "PENDING", dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: BATCH,
  });

  for (const q of due) {
    if (now.getTime() - q.dueAt.getTime() > STALE_MS) {
      await skip(q.id, "بیش از ۳ روز از زمان ارسال گذشته بود");
      r.skipped++;
      continue;
    }
    const phone = normalizePhone(q.phone);
    if (!phone) {
      await skip(q.id, "شماره موبایل معتبر نیست");
      r.skipped++;
      continue;
    }
    const optedOut = await prisma.smsOptOut.findFirst({ where: { phone: { in: [phone, q.phone] } }, select: { id: true } });
    if (optedOut) {
      await skip(q.id, "مشتری پیامک را لغو کرده");
      r.skipped++;
      continue;
    }
    const recent = await prisma.reviewRequest.findFirst({
      where: { phone: q.phone, status: "SENT", sentAt: { gte: new Date(now.getTime() - s.cooldownDays * 86_400_000) } },
      select: { id: true },
    });
    if (recent) {
      await skip(q.id, `در ${s.cooldownDays.toLocaleString("fa-IR")} روز گذشته پیامک نظر گرفته`);
      r.skipped++;
      continue;
    }

    // قفل: فقط یک پروسه این ردیف را برمی‌دارد
    const claim = await prisma.reviewRequest.updateMany({ where: { id: q.id, status: "PENDING" }, data: { status: "SENT", sentAt: now } });
    if (claim.count !== 1) continue;

    const attributes: Record<string, string> = { name: q.name || "مشتری" };
    if (s.linkMode === "VARIABLE") attributes.link = displayUrl(reviewUrl(q.token));
    try {
      await sendPatternSms(phone, s.patternCode, attributes);
      r.sent++;
    } catch (e) {
      await prisma.reviewRequest.update({
        where: { id: q.id },
        data: { status: "FAILED", reason: e instanceof Error ? e.message.slice(0, 200) : "خطای ارسال" },
      });
      r.failed++;
    }
  }
  return r;
}

// ─── صفحه‌ی عمومی ────────────────────────────────────────────────────────

export interface ReviewPageData {
  token: string;
  requestId: string | null;
  title: string;
  message: string;
  storeName: string;
  storeLogo: string | null;
  platforms: { key: string; label: string; url: string }[];
  products: { id: string; title: string; image: string | null; url: string }[];
}

/** `null` = ناشناخته، یا لینک عمومی وقتی هیچ سکویی تنظیم نشده */
export async function loadReviewPage(rawToken: string): Promise<ReviewPageData | null> {
  const token = rawToken.trim().toLowerCase();
  const s = await getReviewSettings();
  const store = await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true, storeLogo: true } });
  const base = {
    title: s.pageTitle || DEFAULT_TITLE,
    message: s.pageMessage || DEFAULT_MESSAGE,
    storeName: store?.storeName ?? "",
    storeLogo: store?.storeLogo ?? null,
  };

  if (token === PUBLIC_REVIEW_TOKEN) {
    const platforms = await reviewPlatformLinks(null);
    if (platforms.length === 0) return null;
    return { token, requestId: null, ...base, platforms, products: [] };
  }

  if (!/^[a-z0-9]{6}$/.test(token)) return null;
  const req = await prisma.reviewRequest.findUnique({
    where: { token },
    select: {
      id: true,
      openedAt: true,
      order: {
        select: {
          items: {
            select: {
              product: {
                select: { id: true, title: true, slug: true, isActive: true, mainImage: true, images: { take: 1, select: { url: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!req) return null;

  if (!req.openedAt) {
    // بی‌سروصدا — خطا جلوی صفحه را نمی‌گیرد
    prisma.reviewRequest.update({ where: { id: req.id }, data: { openedAt: new Date() } }).catch(() => {});
  }

  const seen = new Set<string>();
  const products = s.askProducts
    ? req.order.items
        .map((i) => i.product)
        .filter((p) => p && p.isActive && !seen.has(p.id) && seen.add(p.id))
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          title: p.title,
          image: p.mainImage ?? p.images[0]?.url ?? null,
          url: `/r/${token}/go/site?p=${encodeURIComponent(p.slug)}`,
        }))
    : [];

  return { token, requestId: req.id, ...base, platforms: await reviewPlatformLinks(token), products };
}

/**
 * مقصد کلیک و ثبت آن. `null` = سکو تنظیم نشده یا توکن ناشناخته.
 * SITE به صفحه‌ی همان محصول و زبانه‌ی نظرات می‌رود.
 */
export async function resolvePlatformClick(rawToken: string, rawPlatform: string, productSlug: string | null): Promise<string | null> {
  const token = rawToken.trim().toLowerCase();
  const platform = rawPlatform.trim().toUpperCase() as ReviewPlatform;
  if (!(platform in PLATFORM_LABEL)) return null;

  let requestId: string | null = null;
  if (token !== PUBLIC_REVIEW_TOKEN) {
    const req = await prisma.reviewRequest.findUnique({ where: { token }, select: { id: true } });
    if (!req) return null;
    requestId = req.id;
  }

  let target: string | null = null;
  if (platform === "SITE") {
    if (!productSlug || requestId === null) return null;
    target = `/products/${encodeURIComponent(productSlug)}#reviews`;
  } else {
    const s = await getReviewSettings();
    const meta = MAP_PLATFORMS.find((p) => p.key === platform)!;
    target = s[meta.field] || null;
  }
  if (!target) return null;

  prisma.reviewPlatformClick.create({ data: { requestId, platform } }).catch((e) => console.error("[review-click]", e));
  return target;
}

// ─── گزارش ───────────────────────────────────────────────────────────────

export async function reviewStats(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [byStatus, opened, clicks, recent, pending] = await Promise.all([
    prisma.reviewRequest.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.reviewRequest.count({ where: { createdAt: { gte: since }, openedAt: { not: null } } }),
    prisma.reviewPlatformClick.groupBy({
      by: ["platform"],
      where: { at: { gte: since } },
      _count: { _all: true },
    }),
    prisma.reviewRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, phone: true, name: true, status: true, reason: true, dueAt: true, sentAt: true, openedAt: true, createdAt: true,
        order: { select: { orderNumber: true } },
        _count: { select: { clicks: true } },
      },
    }),
    prisma.reviewRequest.count({ where: { status: "PENDING" } }),
  ]);
  const publicClicks = await prisma.reviewPlatformClick.count({ where: { at: { gte: since }, requestId: null } });

  const status: Record<string, number> = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
  for (const g of byStatus) status[g.status] = g._count._all;
  return {
    days,
    status,
    pendingNow: pending,
    opened,
    publicClicks,
    clicks: Object.fromEntries(clicks.map((c) => [c.platform, c._count._all])) as Record<string, number>,
    recent: recent.map((x) => ({
      id: x.id,
      phone: x.phone,
      name: x.name,
      orderNumber: x.order.orderNumber,
      status: x.status,
      reason: x.reason,
      dueAt: x.dueAt.toISOString(),
      sentAt: x.sentAt?.toISOString() ?? null,
      openedAt: x.openedAt?.toISOString() ?? null,
      clicks: x._count.clicks,
    })),
  };
}
