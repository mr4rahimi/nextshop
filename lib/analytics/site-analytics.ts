/**
 * گزارش‌های «آمار بازدید» کارتابل — فقط سمت سرور.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۱۳.۶
 * الگو: `bartar-crm/features/marketing/services/site-analytics.service.ts`
 *
 * دو گزارش عمداً جدا می‌مانند و جمع نمی‌شوند: «بازدید» رفتار است از Umami،
 * «منبع فروش» پول است از دیتابیس خودمان.
 */

import { prisma } from "@/lib/prisma";
import { rangeOf } from "@/lib/analytics/events";
import { getAnalyticsSettings, umamiRead } from "@/lib/analytics/umami";

const DAY = 24 * 60 * 60 * 1000;
const TEHRAN = "Asia/Tehran";

export type MetricRow = { name: string; value: number };

export type Totals = {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  /** ثانیه — جمع کل، نه میانگین */
  totaltime: number;
};

function resolveRange(key: string | null) {
  const r = rangeOf(key);
  const endAt = Date.now();
  const span = r.days * DAY;
  const startAt = endAt - span;
  return {
    key: r.key,
    startAt,
    endAt,
    // دوره‌ی قبل دقیقاً هم‌طول، وگرنه درصد تغییر بی‌معنی است
    previousStartAt: startAt - span,
    previousEndAt: startAt,
    // ۹۰ ستون ساعتی روی موبایل خوانده نمی‌شود
    unit: (r.days <= 1 ? "hour" : "day") as "hour" | "day",
  };
}

type RawMetric = { x: string | null; y: number };

function toRows(raw: unknown): MetricRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is RawMetric => !!i && typeof i === "object")
    .map((i) => ({ name: i.x ?? "نامشخص", value: Number(i.y) || 0 }))
    .filter((r) => r.value > 0);
}

function toTotals(raw: unknown): Totals {
  const d = (raw ?? {}) as Record<string, unknown>;
  // Umami نسخه‌ی ۲ هر عدد را `{ value }` می‌داد و نسخه‌ی ۳ عدد خام؛ هر دو پذیرفته می‌شوند
  const num = (k: string) => {
    const v = d[k];
    if (v && typeof v === "object" && "value" in v) return Number((v as { value: unknown }).value) || 0;
    return Number(v) || 0;
  };
  return {
    pageviews: num("pageviews"),
    visitors: num("visitors"),
    visits: num("visits"),
    bounces: num("bounces"),
    totaltime: num("totaltime"),
  };
}

type SeriesRaw = { pageviews?: { x: string; y: number }[]; sessions?: { x: string; y: number }[] };

function toSeries(raw: unknown) {
  const d = (raw ?? {}) as SeriesRaw;
  const sessions = new Map((d.sessions ?? []).map((p) => [p.x, Number(p.y) || 0]));
  return (d.pageviews ?? []).map((p) => ({
    key: p.x,
    pageviews: Number(p.y) || 0,
    sessions: sessions.get(p.x) ?? 0,
  }));
}

export type TrafficReport =
  | { connected: false; reason: "not-configured" }
  | {
      connected: true;
      range: string;
      unit: "hour" | "day";
      totals: Totals;
      previous: Totals;
      activeVisitors: number;
      series: { key: string; pageviews: number; sessions: number }[];
      events: MetricRow[];
      pages: MetricRow[];
      titles: MetricRow[];
      entryPages: MetricRow[];
      exitPages: MetricRow[];
      referrers: MetricRow[];
      channels: MetricRow[];
      browsers: MetricRow[];
      operatingSystems: MetricRow[];
      devices: MetricRow[];
      countries: MetricRow[];
      cities: MetricRow[];
    };

/** همه‌ی سنجه‌های بازدید در یک رفت‌وبرگشت از دید کلاینت */
export async function getTrafficReport(rangeKey: string | null): Promise<TrafficReport> {
  const settings = await getAnalyticsSettings();
  const slug = settings.umamiShareSlug;
  if (!slug) return { connected: false, reason: "not-configured" };

  const { key, startAt, endAt, previousStartAt, previousEndAt, unit } = resolveRange(rangeKey);
  const window = { startAt, endAt };
  const metric = (type: string, limit = 12) => umamiRead(slug, "metrics", { ...window, type, limit });

  const [
    stats, previous, active, series, events, pages, titles, entryPages, exitPages,
    referrers, channels, browsers, operatingSystems, devices, countries, cities,
  ] = await Promise.all([
    umamiRead(slug, "stats", window),
    umamiRead(slug, "stats", { startAt: previousStartAt, endAt: previousEndAt }),
    umamiRead<{ visitors?: number; x?: number }>(slug, "active"),
    umamiRead(slug, "pageviews", { ...window, unit, timezone: TEHRAN }),
    metric("event", 20),
    metric("path"),
    metric("title"),
    metric("entry"),
    metric("exit"),
    metric("referrer"),
    umamiRead(slug, "metrics", { ...window, type: "channel" }),
    metric("browser"),
    metric("os"),
    metric("device"),
    metric("country"),
    metric("city"),
  ]);

  return {
    connected: true,
    range: key,
    unit,
    totals: toTotals(stats),
    previous: toTotals(previous),
    activeVisitors: Number(active?.visitors ?? active?.x) || 0,
    series: toSeries(series),
    events: toRows(events),
    pages: toRows(pages),
    titles: toRows(titles),
    entryPages: toRows(entryPages),
    exitPages: toRows(exitPages),
    referrers: toRows(referrers),
    channels: toRows(channels),
    browsers: toRows(browsers),
    operatingSystems: toRows(operatingSystems),
    devices: toRows(devices),
    countries: toRows(countries),
    cities: toRows(cities),
  };
}

// ── منبع فروش ─────────────────────────────────────────────────────────

export type SalesRow = {
  key: string;
  orders: number;
  paidOrders: number;
  /** تومان — فقط سفارش‌هایی که از «در انتظار پرداخت» گذشته‌اند */
  revenue: number;
};

export type SalesReport = {
  range: string;
  /** اولین سفارشی که منبع دارد؛ `null` یعنی هنوز هیچ سفارشی ثبت نشده */
  dataSince: string | null;
  totals: { orders: number; paidOrders: number; revenue: number; unknownOrders: number };
  channels: SalesRow[];
  landingPages: SalesRow[];
  campaigns: SalesRow[];
  referrers: SalesRow[];
};

type GroupRaw = { key: string | null; orders: bigint; paid: bigint; revenue: bigint | null };

/**
 * فقط سفارش آنلاین (`createdByStaffId = null`)؛ سفارش تلفنی منبع وب ندارد و
 * «نامعلوم» شمردنش سهم نامعلوم را دروغ بالا می‌برد. لغو و برگشت‌خورده فروش
 * نیستند؛ «در انتظار پرداخت» شمرده می‌شود ولی در مبلغ نمی‌آید.
 */
export async function getSalesReport(rangeKey: string | null): Promise<SalesReport> {
  const { key, startAt, endAt } = resolveRange(rangeKey);
  const from = new Date(startAt);
  const to = new Date(endAt);

  const group = async (column: "trafficChannel" | "landingPath" | "utmCampaign" | "referrerHost", limit: number) => {
    // نام ستون از فهرست بسته می‌آید، نه از ورودی کاربر
    const rows = await prisma.$queryRawUnsafe<GroupRaw[]>(
      `SELECT "${column}" AS key,
              COUNT(*) AS orders,
              COUNT(*) FILTER (WHERE status <> 'PENDING_PAYMENT') AS paid,
              SUM("grandTotal") FILTER (WHERE status <> 'PENDING_PAYMENT') AS revenue
         FROM "Order"
        WHERE "createdByStaffId" IS NULL
          AND status NOT IN ('CANCELED','REFUNDED')
          AND "createdAt" >= $1 AND "createdAt" < $2
          AND "${column}" IS NOT NULL
        GROUP BY 1
        ORDER BY revenue DESC NULLS LAST, orders DESC
        LIMIT ${limit}`,
      from,
      to,
    );
    return rows.map(
      (r): SalesRow => ({
        key: r.key ?? "",
        orders: Number(r.orders),
        paidOrders: Number(r.paid),
        revenue: Number(r.revenue ?? 0),
      }),
    );
  };

  const [channels, landingPages, campaigns, referrers, totalsRaw, first] = await Promise.all([
    group("trafficChannel", 20),
    group("landingPath", 15),
    group("utmCampaign", 15),
    group("referrerHost", 15),
    prisma.$queryRaw<{ orders: bigint; paid: bigint; revenue: bigint | null; unknown: bigint }[]>`
      SELECT COUNT(*) AS orders,
             COUNT(*) FILTER (WHERE status <> 'PENDING_PAYMENT') AS paid,
             SUM("grandTotal") FILTER (WHERE status <> 'PENDING_PAYMENT') AS revenue,
             COUNT(*) FILTER (WHERE "trafficChannel" IS NULL) AS unknown
        FROM "Order"
       WHERE "createdByStaffId" IS NULL
         AND status NOT IN ('CANCELED','REFUNDED')
         AND "createdAt" >= ${from} AND "createdAt" < ${to}`,
    prisma.order.findFirst({
      where: { trafficChannel: { not: null }, createdByStaffId: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const t = totalsRaw[0];
  return {
    range: key,
    dataSince: first?.createdAt.toISOString() ?? null,
    totals: {
      orders: Number(t?.orders ?? 0),
      paidOrders: Number(t?.paid ?? 0),
      revenue: Number(t?.revenue ?? 0),
      unknownOrders: Number(t?.unknown ?? 0),
    },
    channels,
    landingPages,
    campaigns,
    referrers,
  };
}
