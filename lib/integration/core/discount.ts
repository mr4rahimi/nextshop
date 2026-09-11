import { prisma } from "@/lib/prisma";
import type { PriceDiscount } from "@/lib/integration/types";

// ── منبع حقیقت تخفیف بازارگاه‌ها ────────────────────────────────────
//
// تا پیش از این، تخفیفِ ارسالی از کش `IntegPlatformProduct` خوانده می‌شد و آن کش
// فقط با job نوع FETCH_PRODUCTS پر می‌شد — jobی که بعد از اولین اجرای موفق دیگر
// هرگز صف نمی‌شد. نتیجه: هر سینک موجودی، تخفیف را از روی عکسی هفته‌ها قدیمی
// بازنویسی می‌کرد؛ تخفیف‌های حذف‌شده برمی‌گشتند و تخفیف‌های تازه پاک می‌شدند.
//
// حالا هر لینک نگاشت مالکیت صریح دارد. جزئیات در docs/integrations/discounts.md

const TEHRAN_TZ = "Asia/Tehran";

/** رشته‌ی `YYYY-MM-DD` به وقت تهران — همان فرمتی که اسنپ‌شاپ می‌خواهد. */
export function toTehranDate(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const t = d.getTime();
  if (!Number.isFinite(t)) return undefined;
  // en-CA خروجی YYYY-MM-DD می‌دهد؛ toISOString به UTC می‌برد و تاریخ را جابه‌جا می‌کند
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// اختلاف تهران با UTC ثابت است (۳:۳۰) — ایران از ۱۴۰۱ ساعت تابستانی ندارد.
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60_000;

/** `YYYY-MM-DD` → لحظه‌ی ۰۰:۰۰:۰۰ همان روز به وقت تهران. */
export function tehranDayStart(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const utcMidnight = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(utcMidnight - TEHRAN_OFFSET_MS);
}

/** `YYYY-MM-DD` → لحظه‌ی ۲۳:۵۹:۵۹ همان روز به وقت تهران. */
export function tehranDayEnd(dateStr: string): Date | null {
  const start = tehranDayStart(dateStr);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60_000 - 1000);
}

/** آیا بازه‌ی تخفیف همین حالا فعال است؟ مرزهای خالی یعنی بی‌کران. */
export function isWindowActive(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const t = now.getTime();
  if (startsAt && startsAt.getTime() > t) return false;
  if (endsAt && endsAt.getTime() < t) return false;
  return true;
}

interface DiscountFields {
  discountManaged: boolean;
  discountPercent: number | null;
  discountStartsAt: Date | null;
  discountEndsAt: Date | null;
  discountStock: number | null;
}

/**
 * تخفیف یک لینک تحت مدیریت.
 * `null` یعنی «تخفیفی نباید اعمال شود» — که در ارسال به معنی حذف تخفیف است،
 * نه نادیده گرفتنش. تخفیفِ منقضی هم همین‌جا به null تبدیل می‌شود.
 */
export function managedDiscountOf(
  link: DiscountFields,
  now: Date = new Date(),
): PriceDiscount | null {
  if (!link.discountPercent || link.discountPercent <= 0 || link.discountPercent >= 100) return null;
  if (!isWindowActive(link.discountStartsAt, link.discountEndsAt, now)) return null;
  return {
    percent:  link.discountPercent,
    startsAt: link.discountStartsAt,
    endsAt:   link.discountEndsAt,
    stock:    link.discountStock,
  };
}

/** تخفیف حفظ‌شده از کش پلتفرم — فقط برای لینک‌های آزاد. */
function cachedDiscountOf(
  snap: {
    originalPrice: number | null;
    discountPercent: number | null;
    discountSynced: boolean;
    discountStartsAt: Date | null;
    discountEndsAt: Date | null;
    discountStock: number | null;
  } | null,
  now: Date = new Date(),
): PriceDiscount | null | "UNKNOWN" {
  // کشی که هرگز دریافت نشده یعنی نمی‌دانیم محصول تخفیف دارد یا نه؛ ارسال قیمت
  // در این حالت متوقف می‌شود تا تخفیف ناشناخته‌ای پاک نشود.
  if (!snap || !snap.discountSynced) return "UNKNOWN";
  if (!snap.discountPercent || snap.discountPercent <= 0 || snap.originalPrice == null) return null;
  if (!isWindowActive(snap.discountStartsAt, snap.discountEndsAt, now)) return null;
  return {
    percent:  snap.discountPercent,
    startsAt: snap.discountStartsAt,
    endsAt:   snap.discountEndsAt,
    stock:    snap.discountStock,
  };
}

export type ResolvedDiscount = PriceDiscount | null | "UNKNOWN";

/**
 * تنها نقطه‌ای که تصمیم می‌گیرد چه تخفیفی به پلتفرم ارسال شود.
 * هر دو مسیر ارسال (سینک قیمت و سینک موجودی) باید از همین بگذرند؛ وگرنه همان
 * جنگ بازنویسی قدیمی بین دو منبع حقیقت تکرار می‌شود.
 */
export async function resolveDiscountForPush(
  platformCode: string,
  externalId: string,
  now: Date = new Date(),
): Promise<ResolvedDiscount> {
  const map = await resolveDiscountsForPush(platformCode, [externalId], now);
  // `??` اینجا فاجعه بود: `null` یعنی «تخفیفی ندارد» — یک نتیجه‌ی کاملاً معتبر —
  // ولی nullish محسوب می‌شد و به "UNKNOWN" تبدیل می‌شد. یعنی هر لینک تحت مدیریتی
  // که هنوز درصد تخفیف نگرفته بود، ارسال قیمتش مسدود می‌شد.
  return map.has(externalId) ? map.get(externalId)! : "UNKNOWN";
}

/** نسخه‌ی گروهی — برای ارسال‌های دسته‌ای که ده‌ها محصول را با هم می‌برند. */
export async function resolveDiscountsForPush(
  platformCode: string,
  externalIds: string[],
  now: Date = new Date(),
): Promise<Map<string, ResolvedDiscount>> {
  const out = new Map<string, ResolvedDiscount>();
  if (!externalIds.length) return out;

  const ids = [...new Set(externalIds)];

  const links = await prisma.integMappingLink.findMany({
    where:  { platformCode, externalId: { in: ids }, isActive: true },
    select: {
      externalId: true, discountManaged: true, discountPercent: true,
      discountStartsAt: true, discountEndsAt: true, discountStock: true,
    },
  });
  const linkMap = new Map(links.map((l) => [l.externalId, l]));

  // کش فقط برای لینک‌های آزاد (و محصولات بدون لینک) لازم است
  const needCache = ids.filter((id) => linkMap.get(id)?.discountManaged !== true);
  const snaps = needCache.length
    ? await prisma.integPlatformProduct.findMany({
        where:  { platformCode, platformProductId: { in: needCache } },
        select: {
          platformProductId: true, originalPrice: true, discountPercent: true,
          discountSynced: true, discountStartsAt: true, discountEndsAt: true, discountStock: true,
        },
      })
    : [];
  const snapMap = new Map(snaps.map((s) => [s.platformProductId, s]));

  for (const id of ids) {
    const link = linkMap.get(id);
    if (link?.discountManaged) {
      out.set(id, managedDiscountOf(link, now));
    } else {
      out.set(id, cachedDiscountOf(snapMap.get(id) ?? null, now));
    }
  }
  return out;
}

// ── ثبت نتیجه‌ی ارسال روی خود لینک ─────────────────────────────────
// بدون این، کاربر در صفحه‌ی تخفیف‌ها نمی‌فهمد تخفیفی که ذخیره کرده واقعاً به
// بازارگاه رسیده یا در ارسال رد شده است.

export async function recordDiscountPush(
  platformCode: string,
  externalId: string,
  error?: string | null,
): Promise<void> {
  await prisma.integMappingLink.updateMany({
    where: { platformCode, externalId },
    data:  error
      ? { discountPushError: error.slice(0, 500) }
      : { discountPushedAt: new Date(), discountPushError: null },
  }).catch(() => {});
}

// ── بازه‌هایی که همین حالا باز یا بسته شده‌اند ──────────────────────
//
// اسنپ‌شاپ تاریخ شروع و پایان را خودش می‌فهمد، ولی تپسی‌شاپ فقط یک «قیمت نهایی»
// می‌گیرد و از بازه خبر ندارد. پس اجرای بازه بر عهده‌ی ماست: وقتی تخفیفی شروع
// یا تمام می‌شود باید قیمت دوباره ارسال شود، وگرنه تخفیف تپسی یا هرگز اعمال
// نمی‌شود یا برای همیشه روی محصول می‌ماند.
//
// ملاک، مقایسه‌ی وضعیت بازه در «الان» با وضعیتش در «لحظه‌ی آخرین ارسال» است.
// لینکی که هنوز ارسالی نداشته کنار گذاشته می‌شود؛ اولین ارسال کار خودش را می‌کند.

export interface DiscountWindowChange {
  mappingId:    string;
  platformCode: string;
  externalId:   string;
  activeNow:    boolean;
}

export async function findDiscountWindowChanges(
  limit = 50,
  now: Date = new Date(),
): Promise<DiscountWindowChange[]> {
  const links = await prisma.integMappingLink.findMany({
    where: {
      isActive:         true,
      discountManaged:  true,
      discountPercent:  { gt: 0 },
      discountPushedAt: { not: null },
      // فقط لینک‌هایی که اصلاً مرزی دارند — بی‌کران‌ها هرگز تغییر وضعیت نمی‌دهند
      OR: [{ discountStartsAt: { not: null } }, { discountEndsAt: { not: null } }],
      mapping: { isActive: true, syncPriceEnabled: true },
    },
    select: {
      mappingId: true, platformCode: true, externalId: true,
      discountStartsAt: true, discountEndsAt: true, discountPushedAt: true,
    },
    take: limit,
  });

  const out: DiscountWindowChange[] = [];
  for (const l of links) {
    const activeNow  = isWindowActive(l.discountStartsAt, l.discountEndsAt, now);
    const activeThen = isWindowActive(l.discountStartsAt, l.discountEndsAt, l.discountPushedAt!);
    if (activeNow !== activeThen) {
      out.push({
        mappingId:    l.mappingId,
        platformCode: l.platformCode,
        externalId:   l.externalId,
        activeNow,
      });
    }
  }
  return out;
}
