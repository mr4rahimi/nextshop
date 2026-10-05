/**
 * لینک کوتاه `/s/<code>` — ساخت، ویرایش، ریدایرکت و آمار.
 *
 * - کد تصادفی ۵ کاراکتری یا نامک دلخواه؛ **پس از ساخت عوض نمی‌شود و پس از
 *   حذف هم آزاد نمی‌شود** — ممکن است چاپ شده باشد.
 * - **مقصد قابل تغییر است** — دلیل اصلی وجود لینک کوتاه.
 * - ریدایرکت 302 با `no-store`، نه 301: مرورگر 301 را کش می‌کند و تغییر مقصد
 *   به گوشی‌ای که یک‌بار باز کرده نمی‌رسد.
 *
 * مستندات: docs/features/tools.md بخش ۱
 */

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { BUYER_ORDER_STATUSES } from "@/lib/reviews";
import type { Prisma, ShortLinkKind } from "@prisma/client";
import {
  SLUG_RE, TARGET_HINT, ToolError, cleanSlug, cleanUtm, endOfTehranDay, normalizeTarget,
  randomToken, tehranDayKey,
} from "./common";
import { deviceOf, isBotRequest, osOf, referrerHostOf } from "./visitor";

export const SHORT_PREFIX = "/s/";

export function shortUrl(code: string): string {
  return `${SITE_URL.replace(/\/+$/, "")}${SHORT_PREFIX}${code}`;
}

export interface ShortLinkInput {
  title?: unknown;
  targetUrl?: unknown;
  code?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  isActive?: unknown;
  /** «YYYY-MM-DD» یا خالی */
  expiresOn?: unknown;
}

function parseTarget(v: unknown): string {
  const t = normalizeTarget(typeof v === "string" ? v : "", SITE_URL);
  if (!t) throw new ToolError(`مقصد معتبر نیست — ${TARGET_HINT}`);
  if (t.length > 2000) throw new ToolError("مقصد بیش از حد طولانی است");
  return t;
}

function parseExpiry(v: unknown): Date | null {
  if (v === undefined || v === null || v === "") return null;
  const d = endOfTehranDay(String(v));
  if (!d) throw new ToolError("تاریخ انقضا معتبر نیست");
  return d;
}

async function freeRandomCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = randomToken(i < 4 ? 5 : 6);
    const hit = await prisma.shortLink.findUnique({ where: { code }, select: { id: true } });
    if (!hit) return code;
  }
  throw new ToolError("ساخت کد یکتا ناموفق بود؛ دوباره تلاش کنید", 500);
}

export async function createShortLink(
  input: ShortLinkInput,
  opts: { kind?: ShortLinkKind; createdById?: string | null } = {},
) {
  const targetUrl = parseTarget(input.targetUrl);
  const title = typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 120) : targetUrl.slice(0, 120);

  let code = cleanSlug(input.code);
  if (code) {
    if (!SLUG_RE.test(code)) throw new ToolError("نامک فقط حروف کوچک لاتین، عدد و خط تیره (حداکثر ۴۰)");
    // حذف‌شده‌ها هم حساب‌اند — نامک پس از حذف آزاد نمی‌شود
    const taken = await prisma.shortLink.findUnique({ where: { code }, select: { id: true } });
    if (taken) throw new ToolError("این نامک قبلاً استفاده شده است (حتی اگر حذف شده باشد)");
  } else {
    code = await freeRandomCode();
  }

  return prisma.shortLink.create({
    data: {
      code,
      title,
      targetUrl,
      kind: opts.kind ?? "MANUAL",
      utmSource: cleanUtm(input.utmSource),
      utmMedium: cleanUtm(input.utmMedium),
      utmCampaign: cleanUtm(input.utmCampaign),
      isActive: input.isActive === undefined ? true : input.isActive === true,
      expiresAt: parseExpiry(input.expiresOn),
      createdById: opts.createdById ?? null,
    },
  });
}

/** کد عوض نمی‌شود؛ بقیه‌ی فیلدها فقط اگر آمده باشند */
export async function updateShortLink(id: string, input: ShortLinkInput) {
  const data: Prisma.ShortLinkUpdateInput = {};
  if (input.targetUrl !== undefined) data.targetUrl = parseTarget(input.targetUrl);
  if (typeof input.title === "string" && input.title.trim()) data.title = input.title.trim().slice(0, 120);
  if (input.utmSource !== undefined) data.utmSource = cleanUtm(input.utmSource);
  if (input.utmMedium !== undefined) data.utmMedium = cleanUtm(input.utmMedium);
  if (input.utmCampaign !== undefined) data.utmCampaign = cleanUtm(input.utmCampaign);
  if (input.isActive !== undefined) data.isActive = input.isActive === true;
  if (input.expiresOn !== undefined) data.expiresAt = parseExpiry(input.expiresOn);

  const link = await prisma.shortLink.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!link) throw new ToolError("لینک پیدا نشد", 404);
  return prisma.shortLink.update({ where: { id }, data });
}

export async function deleteShortLink(id: string) {
  await prisma.shortLink.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  });
}

// ─── ریدایرکت ────────────────────────────────────────────────────────────

/** لینک زنده برای ریدایرکت؛ `null` = خاموش، منقضی، حذف‌شده یا ناشناخته */
export async function findLiveLink(rawCode: string) {
  const code = rawCode.trim().toLowerCase();
  if (!code || code.length > 40) return null;
  const link = await prisma.shortLink.findUnique({ where: { code } });
  if (!link || link.deletedAt || !link.isActive) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;
  return link;
}

/**
 * شمارش بی‌سروصدا: خطای ثبت کلیک نباید جلوی ریدایرکت را بگیرد، پس
 * فراخواننده await نمی‌کند و هر خطایی همین‌جا بلعیده می‌شود.
 */
export async function recordShortLinkVisit(linkId: string, req: Request): Promise<void> {
  try {
    if (isBotRequest(req)) {
      await prisma.shortLink.update({ where: { id: linkId }, data: { botCount: { increment: 1 } } });
      return;
    }
    const ua = req.headers.get("user-agent") ?? "";
    const now = new Date();
    await prisma.$transaction([
      prisma.shortLink.update({
        where: { id: linkId },
        data: { clickCount: { increment: 1 }, lastClickedAt: now },
      }),
      prisma.shortLinkClick.create({
        data: { linkId, at: now, device: deviceOf(ua), os: osOf(ua), referrerHost: referrerHostOf(req) },
      }),
    ]);
  } catch (e) {
    console.error("[short-link] ثبت کلیک ناموفق:", e);
  }
}

// ─── فهرست و آمار ────────────────────────────────────────────────────────

export function serializeLink(l: {
  id: string; code: string; title: string; targetUrl: string; kind: ShortLinkKind;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
  isActive: boolean; expiresAt: Date | null; clickCount: number; botCount: number;
  lastClickedAt: Date | null; createdAt: Date;
}) {
  return {
    id: l.id,
    code: l.code,
    shortUrl: shortUrl(l.code),
    title: l.title,
    targetUrl: l.targetUrl,
    kind: l.kind,
    utmSource: l.utmSource,
    utmMedium: l.utmMedium,
    utmCampaign: l.utmCampaign,
    isActive: l.isActive,
    expiresAt: l.expiresAt?.toISOString() ?? null,
    expired: !!l.expiresAt && l.expiresAt.getTime() < Date.now(),
    clickCount: l.clickCount,
    botCount: l.botCount,
    lastClickedAt: l.lastClickedAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  };
}

export type ShortLinkDto = ReturnType<typeof serializeLink>;

export async function listShortLinks(q: string, page: number) {
  const pageSize = 30;
  const where: Prisma.ShortLinkWhereInput = {
    kind: "MANUAL",
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { code: { contains: q.toLowerCase() } },
            { targetUrl: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.shortLink.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.shortLink.count({ where }),
  ]);
  return { items: items.map(serializeLink), total, page, pageSize };
}

function countBy<T extends string>(rows: { key: T | null }[]): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.key ?? "مستقیم", (m.get(r.key ?? "مستقیم") ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

/**
 * آمار یک لینک در بازه: کلیک روزانه (روز تهران)، دستگاه، سیستم‌عامل، ارجاع‌دهنده.
 *
 * اگر لینک UTM داشته باشد، سفارش‌های سایت با همان `utm_source`/`utm_campaign`
 * هم شمرده می‌شوند — منبع ورود را `proxy.ts` روی کوکی و `/api/checkout` روی
 * سفارش می‌نویسد (docs/plans/seo-marketing.md بخش ۱۳.۵).
 */
export async function shortLinkStats(id: string, days: number) {
  const link = await prisma.shortLink.findUnique({ where: { id } });
  if (!link) throw new ToolError("لینک پیدا نشد", 404);

  const since = new Date(Date.now() - days * 86_400_000);
  const clicks = await prisma.shortLinkClick.findMany({
    where: { linkId: id, at: { gte: since } },
    select: { at: true, device: true, os: true, referrerHost: true },
    take: 50_000,
  });

  const daily = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) daily.set(tehranDayKey(new Date(Date.now() - i * 86_400_000)), 0);
  for (const c of clicks) {
    const k = tehranDayKey(c.at);
    if (daily.has(k)) daily.set(k, (daily.get(k) ?? 0) + 1);
  }

  let orders: { count: number; total: string } | null = null;
  if (link.utmSource || link.utmCampaign) {
    const where: Prisma.OrderWhereInput = {
      status: { in: BUYER_ORDER_STATUSES },
      createdAt: { gte: link.createdAt },
      ...(link.utmSource ? { utmSource: link.utmSource } : {}),
      ...(link.utmCampaign ? { utmCampaign: link.utmCampaign } : {}),
    };
    const agg = await prisma.order.aggregate({ where, _count: { _all: true }, _sum: { grandTotal: true } });
    orders = { count: agg._count._all, total: (agg._sum.grandTotal ?? 0n).toString() };
  }

  return {
    link: serializeLink(link),
    days,
    inRange: clicks.length,
    daily: [...daily.entries()].map(([day, count]) => ({ day, count })),
    devices: countBy(clicks.map((c) => ({ key: c.device }))),
    os: countBy(clicks.map((c) => ({ key: c.os }))),
    referrers: countBy(clicks.map((c) => ({ key: c.referrerHost }))).slice(0, 10),
    orders,
  };
}
