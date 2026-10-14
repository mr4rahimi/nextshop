/**
 * ابزارهای تحلیل مدیر (فاز ۳) — docs/plans/admin-assistant.md بخش ۶ و ۱۸
 *
 * همان قواعد `tools.ts`، به‌علاوه‌ی قواعد گزارش (بخش ۶):
 *   - **نگهبان = نگهبان روت همان گزارش.** هر ابزار در `available` و دوباره در `run` چک می‌کند.
 *   - **منطق شمارش تازه نه:** روت و ابزار یک تابع `lib` را صدا می‌زنند (`activitySummary`،
 *     `teamReport`، `getSalesReport`، `getTrafficReport`، `profitLoss`، `aging` …).
 *   - بازه با `periodProperties`؛ دوره‌ی ناتمام بریده و با هم‌طولِ قبل مقایسه می‌شود.
 *   - درصد تغییر آماده (`change`) — مدل درصد نمی‌سازد.
 *   - خروجی کوتاه: بی سری روزانه، بی شماره تلفن، فهرست‌ها تا ۱۰–۱۵ ردیف.
 *   - `warnings` وقتی بازه پیش از شروع داده‌ی همان منبع است.
 */
import { prisma } from "@/lib/prisma";
import { can, canAny, type StaffAccess } from "@/lib/permissions";
import { activitySummary } from "@/lib/reports-activity";
import { ACTION_LABELS, ENTITY_LABELS } from "@/lib/reports";
import { firstOrderAt, salesTotals, topProducts, type SalesTotals } from "@/lib/reports-sales";
import { teamReport } from "@/lib/worklist/team-report";
import { getSalesReport, getTrafficReport, type SalesRow, type Totals } from "@/lib/analytics/site-analytics";
import { profitLoss } from "@/lib/accounting/reports/statements";
import { profitBy, type ProfitDim } from "@/lib/accounting/reports/profit";
import { expenseReport } from "@/lib/accounting/reports/ops";
import { aging } from "@/lib/accounting/reports/aging";
import { SEO_STATUS_LABELS, CONTENT_STATUS_LABELS } from "@/lib/marketing/types";
import { change, dataWarnings, periodInfo, periodProperties, resolvePeriod, type Period } from "./period";
import { faDate } from "./dates";
import type { AssistantTool } from "./tools";

const toman = (v: bigint | number | null | undefined) =>
  v === null || v === undefined ? null : `${Number(v).toLocaleString("fa-IR")} تومان`;

const periodParams = { type: "object", properties: { ...periodProperties }, required: [] };

type Guard = (a: StaffAccess) => boolean;

/** بازه + نگهبان دوباره؛ خطا متن آماده برای مدل است */
function withPeriod(guard: Guard, fn: (p: Period, args: Record<string, unknown>, access: StaffAccess) => Promise<unknown>) {
  return async (args: Record<string, unknown>, ctx: { access: StaffAccess }) => {
    if (!guard(ctx.access)) return { error: "به این گزارش دسترسی ندارید" };
    const p = resolvePeriod(args);
    if ("error" in p) return p;
    return fn(p, args, ctx.access);
  };
}

/** عدد فعلی، قبلی و درصد تغییر آماده */
const cmp = (cur: number, prev: number, money = false) => ({
  current: money ? toman(cur) : cur,
  previous: money ? toman(prev) : prev,
  change: change(cur, prev),
});

// ─────────────────────────────────────────────────────────────────
// فروش و سفارش
// ─────────────────────────────────────────────────────────────────

const salesGuard: Guard = (a) => canAny(a, ["PANEL_REPORTS", "PANEL_ORDERS"]);
const ordersGuard: Guard = (a) => can(a, "PANEL_ORDERS");

function salesBlock(c: SalesTotals, p: SalesTotals) {
  return {
    revenue: cmp(c.revenue, p.revenue, true),
    orders: cmp(c.orders, p.orders),
    avgBasket: cmp(c.avgBasket, p.avgBasket, true),
    online: { orders: c.online.orders, revenue: toman(c.online.revenue) },
    phoneOrders: { orders: c.phone.orders, revenue: toman(c.phone.revenue) },
    discountGiven: toman(c.discount),
    shippingCollected: toman(c.shipping),
    canceledOrRefunded: cmp(c.canceled, p.canceled),
    stillPendingPayment: c.pendingPayment,
  };
}

const SALES_TOOLS: AssistantTool[] = [
  {
    name: "report_sales",
    label: "خواندن گزارش فروش",
    topic: "فروش فروشگاه (مبلغ، تعداد سفارش، میانگین سبد، پرفروش‌ها)",
    description:
      "فروش سایت و سفارش تلفنی در یک بازه، با مقایسه‌ی آماده با دوره‌ی هم‌طولِ قبل: مبلغ فروش، تعداد سفارش، میانگین سبد، " +
      "سهم آنلاین و تلفنی، تخفیف داده‌شده، لغوشده‌ها و ۱۰ محصول پرفروش (به مبلغ). فروش = سفارشی که پرداخت شده و لغو نشده (همان داشبورد). " +
      "فروش بازارگاه‌ها اینجا نیست. سود و بهای تمام‌شده نمی‌دهد.",
    parameters: periodParams,
    available: salesGuard,
    run: withPeriod(salesGuard, async (p) => {
      const [cur, prev, top, since] = await Promise.all([
        salesTotals(p.start, p.end),
        salesTotals(p.previous.start, p.previous.end),
        topProducts(p.start, p.end, 10),
        firstOrderAt(),
      ]);
      const warnings = dataWarnings(p, since, "سفارش");
      return {
        period: periodInfo(p),
        page: "/admin",
        ...salesBlock(cur, prev),
        topProducts: top.map((t) => ({ title: t.title, qty: t.qty, orders: t.orders, revenue: toman(t.revenue) })),
        ...(warnings.length ? { warnings } : {}),
      };
    }),
  },
  {
    name: "report_orders_status",
    label: "بررسی سفارش‌های معطل",
    topic: "وضعیت سفارش‌ها (معطل، ارسال‌نشده، منتظر پرداخت)",
    description:
      "وضعیت همین حالای سفارش‌ها: تعداد هر وضعیت باز، سفارش‌های پرداخت‌شده‌ای که بیش از ۲ روز است وضعیتشان عوض نشده (معطل)، " +
      "منتظر پرداخت قدیمی‌تر از یک روز، و لغو/مسترد ۷ روز اخیر. ورودی ندارد.",
    parameters: { type: "object", properties: {}, required: [] },
    available: ordersGuard,
    run: async (_args, ctx) => {
      if (!ordersGuard(ctx.access)) return { error: "به این گزارش دسترسی ندارید" };
      const now = Date.now();
      const twoDays = new Date(now - 2 * 86_400_000);
      const OPEN = ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING"] as const;
      const [byStatus, stuck, stuckCount, oldPending, canceled7] = await Promise.all([
        prisma.order.groupBy({
          by: ["status"],
          where: { status: { in: ["PENDING_PAYMENT", ...OPEN, "SHIPPED"] } },
          _count: { _all: true },
        }),
        prisma.order.findMany({
          where: { status: { in: [...OPEN] }, updatedAt: { lt: twoDays } },
          orderBy: { updatedAt: "asc" },
          take: 10,
          select: { orderNumber: true, status: true, updatedAt: true, createdAt: true, grandTotal: true, createdByStaffId: true },
        }),
        prisma.order.count({ where: { status: { in: [...OPEN] }, updatedAt: { lt: twoDays } } }),
        prisma.order.count({ where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(now - 86_400_000) } } }),
        prisma.order.count({ where: { status: { in: ["CANCELED", "REFUNDED"] }, updatedAt: { gte: new Date(now - 7 * 86_400_000) } } }),
      ]);
      const LABELS: Record<string, string> = {
        PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", CONFIRMED: "تأیید شده",
        PROCESSING: "در حال آماده‌سازی", PACKAGING: "بسته‌بندی", SHIPPED: "ارسال شده",
      };
      return {
        page: "/admin/orders",
        openByStatus: byStatus.map((s) => ({ status: LABELS[s.status] ?? s.status, count: s._count._all })),
        stuckOverTwoDays: {
          count: stuckCount,
          note: "پرداخت‌شده یا در جریان که بیش از ۲ روز هیچ تغییری نکرده (معیار: آخرین ویرایش سفارش)",
          oldest: stuck.map((o) => ({
            orderNumber: o.orderNumber,
            status: LABELS[o.status] ?? o.status,
            lastChange: faDate(o.updatedAt),
            created: faDate(o.createdAt),
            total: toman(o.grandTotal),
            phoneOrder: !!o.createdByStaffId,
          })),
        },
        pendingPaymentOverOneDay: oldPending,
        canceledOrRefundedLast7Days: canceled7,
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// منبع فروش و بازدید (آنالیز سئو)
// ─────────────────────────────────────────────────────────────────

const analyticsGuard: Guard = (a) => canAny(a, ["SEO_ANALYTICS_VIEW", "MARKETING_SETTINGS_MANAGE"]);

const salesRows = (rows: SalesRow[], n = 10) =>
  rows.slice(0, n).map((r) => ({ name: r.key, orders: r.orders, paidOrders: r.paidOrders, revenue: toman(r.revenue) }));

const metricRows = (rows: { name: string; value: number }[], n = 10) => rows.slice(0, n).map((r) => `${r.name}: ${r.value}`);

const trafficTotals = (c: Totals, p: Totals) => ({
  visitors: cmp(c.visitors, p.visitors),
  visits: cmp(c.visits, p.visits),
  pageviews: cmp(c.pageviews, p.pageviews),
  bounceRate: c.visits ? `${Math.round((c.bounces / c.visits) * 100)}٪` : null,
  previousBounceRate: p.visits ? `${Math.round((p.bounces / p.visits) * 100)}٪` : null,
  avgVisitMinutes: c.visits ? Math.round((c.totaltime / c.visits / 60) * 10) / 10 : null,
});

const ANALYTICS_TOOLS: AssistantTool[] = [
  {
    name: "report_sales_sources",
    label: "خواندن منبع فروش",
    topic: "منبع ورود سفارش‌ها (گوگل، کمپین، UTM، صفحه‌ی ورود)",
    description:
      "سفارش‌های آنلاین هر منبع ورود در یک بازه: کانال (گوگل، مستقیم، شبکه‌ی اجتماعی …)، صفحه‌ی ورود، کمپین UTM و سایت ارجاع‌دهنده، " +
      "با مقایسه‌ی کل با دوره‌ی قبل. سفارش تلفنی منبع ندارد و اینجا نیست.",
    parameters: periodParams,
    available: analyticsGuard,
    run: withPeriod(analyticsGuard, async (p) => {
      const [cur, prev] = await Promise.all([
        getSalesReport(null, p),
        getSalesReport(null, p.previous),
      ]);
      const since = cur.dataSince ? new Date(cur.dataSince) : null;
      const warnings = dataWarnings(p, since, "منبع ورود سفارش");
      return {
        period: periodInfo(p),
        page: "/admin/worklist/analytics",
        orders: cmp(cur.totals.orders, prev.totals.orders),
        paidRevenue: cmp(cur.totals.revenue, prev.totals.revenue, true),
        unknownSourceOrders: cur.totals.unknownOrders,
        channels: salesRows(cur.channels),
        landingPages: salesRows(cur.landingPages),
        campaigns: salesRows(cur.campaigns),
        referrers: salesRows(cur.referrers),
        ...(warnings.length ? { warnings } : {}),
      };
    }),
  },
  {
    name: "report_traffic",
    label: "خواندن آمار بازدید",
    topic: "آمار بازدید سایت (بازدیدکننده، صفحه‌ها، ورودی‌ها، دستگاه)",
    description:
      "آمار بازدید سایت از Umami در یک بازه با مقایسه‌ی دوره‌ی قبل: بازدیدکننده، نشست، صفحه‌دید، نرخ پرش، پربازدیدترین صفحه‌ها، " +
      "صفحه‌های ورود، سایت‌های ارجاع‌دهنده، کانال‌ها و دستگاه‌ها. بازدید رفتار است و با فروش جمع نمی‌شود.",
    parameters: periodParams,
    available: analyticsGuard,
    run: withPeriod(analyticsGuard, async (p) => {
      const r = await getTrafficReport(null, p);
      if (!r.connected) return { error: "آمار بازدید (Umami) در تنظیمات مارکتینگ وصل نشده است", page: "/admin/worklist/analytics" };
      return {
        period: periodInfo(p),
        page: "/admin/worklist/analytics",
        note: "داده از روز نصب Umami روی سایت است؛ اگر بازه پیش از آن باشد صفر یعنی ثبت نشده، نه افت",
        ...trafficTotals(r.totals, r.previous),
        onlineNow: r.activeVisitors,
        topPages: metricRows(r.pages),
        entryPages: metricRows(r.entryPages),
        referrers: metricRows(r.referrers),
        channels: metricRows(r.channels),
        devices: metricRows(r.devices, 5),
        cities: metricRows(r.cities, 8),
      };
    }),
  },
];

// ─────────────────────────────────────────────────────────────────
// ابزارها، باشگاه و کاتالوگ
// ─────────────────────────────────────────────────────────────────

const toolsGuard: Guard = (a) => canAny(a, ["TOOLS_VIEW", "TOOLS_MANAGE"]);
const clubGuard: Guard = (a) => can(a, "PANEL_CLUB");
const catalogGuard: Guard = (a) => can(a, "PANEL_CATALOG");

const MARKETING_TOOLS: AssistantTool[] = [
  {
    name: "report_campaigns",
    label: "خواندن آمار لینک‌ها و QR",
    topic: "آمار لینک کوتاه، UTM و کیوآر کد",
    description:
      "کلیک انسانی لینک‌های کوتاه و QRهای پویا در یک بازه (بی ربات‌ها)، با مقایسه‌ی کل با دوره‌ی قبل و ۱۵ لینک پرکلیک با کمپین UTM‌شان.",
    parameters: periodParams,
    available: toolsGuard,
    run: withPeriod(toolsGuard, async (p) => {
      const [byLink, prevTotal, first] = await Promise.all([
        prisma.shortLinkClick.groupBy({
          by: ["linkId"],
          where: { at: { gte: p.start, lt: p.end } },
          _count: { _all: true },
          orderBy: { _count: { linkId: "desc" } },
        }),
        prisma.shortLinkClick.count({ where: { at: { gte: p.previous.start, lt: p.previous.end } } }),
        prisma.shortLinkClick.findFirst({ orderBy: { at: "asc" }, select: { at: true } }),
      ]);
      const total = byLink.reduce((s, r) => s + r._count._all, 0);
      const head = byLink.slice(0, 15);
      const links = await prisma.shortLink.findMany({
        where: { id: { in: head.map((r) => r.linkId) } },
        select: { id: true, code: true, title: true, kind: true, utmCampaign: true, utmSource: true, qrCode: { select: { title: true } } },
      });
      const byId = new Map(links.map((l) => [l.id, l]));
      const warnings = first ? dataWarnings(p, first.at, "کلیک لینک کوتاه") : [];
      return {
        period: periodInfo(p),
        page: "/admin/tools/links",
        clicks: cmp(total, prevTotal),
        linksWithClicks: byLink.length,
        top: head.map((r) => {
          const l = byId.get(r.linkId);
          return {
            title: l?.qrCode?.title ?? l?.title ?? "حذف‌شده",
            code: l?.code ?? null,
            isQr: !!l?.qrCode,
            utm: l?.utmCampaign ? `${l.utmSource ?? "-"} / ${l.utmCampaign}` : null,
            clicks: r._count._all,
          };
        }),
        ...(warnings.length ? { warnings } : {}),
      };
    }),
  },
  {
    name: "report_sms_campaigns",
    label: "خواندن نتیجه‌ی کمپین‌های پیامکی",
    topic: "کمپین‌های پیامکی باشگاه مشتریان و نتیجه‌شان",
    description:
      "کمپین‌های پیامکی باشگاه که در بازه شروع یا زمان‌بندی شده‌اند: وضعیت، تعداد مخاطب، ارسال‌شده، تحویل‌شده، ناموفق و ردشده؛ " +
      "و جمع پیام‌های بازه به تفکیک نوع. هزینه‌ی ریالی نمی‌دهد (واحدش از پنل پیامک است).",
    parameters: periodParams,
    available: clubGuard,
    run: withPeriod(clubGuard, async (p) => {
      const inP = { gte: p.start, lt: p.end };
      const [campaigns, byKind] = await Promise.all([
        prisma.smsCampaign.findMany({
          where: { OR: [{ startedAt: inP }, { scheduledAt: inP }, { AND: [{ startedAt: null }, { createdAt: inP }] }] },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            id: true, title: true, status: true, scheduledAt: true, startedAt: true, finishedAt: true,
            totalCount: true, sentCount: true, failedCount: true, skippedCount: true,
          },
        }),
        prisma.smsMessage.groupBy({ by: ["kind", "status"], where: { queuedAt: inP }, _count: { _all: true } }),
      ]);
      const delivered = campaigns.length
        ? await prisma.smsMessage.groupBy({
            by: ["campaignId"],
            where: { campaignId: { in: campaigns.map((c) => c.id) }, status: "DELIVERED" },
            _count: { _all: true },
          })
        : [];
      const deliveredOf = new Map(delivered.map((d) => [d.campaignId, d._count._all]));
      const STATUS: Record<string, string> = {
        DRAFT: "پیش‌نویس", SCHEDULED: "زمان‌بندی‌شده", RUNNING: "در حال ارسال", PAUSED: "متوقف", DONE: "تمام‌شده", CANCELED: "لغوشده",
      };
      const kinds: Record<string, Record<string, number>> = {};
      for (const g of byKind) (kinds[g.kind] ??= {})[g.status] = g._count._all;
      return {
        period: periodInfo(p),
        page: "/admin/club",
        campaigns: campaigns.map((c) => ({
          title: c.title,
          status: STATUS[c.status] ?? c.status,
          started: faDate(c.startedAt ?? c.scheduledAt),
          finished: faDate(c.finishedAt),
          audience: c.totalCount,
          sent: c.sentCount,
          delivered: deliveredOf.get(c.id) ?? 0,
          failed: c.failedCount,
          skipped: c.skippedCount,
        })),
        messagesByKind: kinds,
        note: "skipped یعنی رد شده پیش از ارسال (لغو اشتراک، شماره‌ی نامعتبر یا تکراری)",
      };
    }),
  },
  {
    name: "catalog_health",
    label: "بررسی سلامت کاتالوگ",
    topic: "سلامت کاتالوگ (محصول بی‌قیمت، بی‌عکس، بی‌متا، ناموجود)",
    description:
      "وضعیت همین حالای محصولات فعال: بی‌قیمت، بی‌عکس، بی‌عنوان سئو، بی‌توضیح متا، ناموجود و رو به اتمام، " +
      "با تعداد و ۵ نمونه‌ی هر کدام. همان فیلترهای فهرست محصولات. ورودی ندارد.",
    parameters: { type: "object", properties: {}, required: [] },
    available: catalogGuard,
    run: async (_args, ctx) => {
      if (!catalogGuard(ctx.access)) return { error: "به این گزارش دسترسی ندارید" };
      const active = { isActive: true };
      const blank = (f: "seoTitle" | "seoDescription" | "mainImage") => ({ OR: [{ [f]: null }, { [f]: "" }] });
      const CHECKS = [
        { key: "noPrice", label: "بی‌قیمت", filter: "noprice", where: { ...active, price: 0 } },
        { key: "noImage", label: "بی‌عکس اصلی", filter: null, where: { ...active, ...blank("mainImage") } },
        { key: "noSeoTitle", label: "بی‌عنوان سئو", filter: "noseotitle", where: { ...active, ...blank("seoTitle") } },
        { key: "noMeta", label: "بی‌توضیح متا", filter: "nometa", where: { ...active, ...blank("seoDescription") } },
        { key: "outOfStock", label: "ناموجود (با کنترل موجودی)", filter: "outofstock", where: { ...active, trackStock: true, stock: 0 } },
      ];
      const [total, inactive, results, low] = await Promise.all([
        prisma.product.count({ where: active }),
        prisma.product.count({ where: { isActive: false } }),
        Promise.all(
          CHECKS.map(async (c) => {
            const [count, sample] = await Promise.all([
              prisma.product.count({ where: c.where }),
              prisma.product.findMany({ where: c.where, orderBy: { updatedAt: "desc" }, take: 5, select: { title: true } }),
            ]);
            return {
              check: c.label,
              count,
              sample: sample.map((s) => s.title),
              filterInProductsList: c.filter ? `فیلتر وضعیت «${c.label}» در فهرست محصولات` : null,
            };
          }),
        ),
        prisma.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*)::bigint AS n FROM "Product"
           WHERE "trackStock" = true AND "isActive" = true AND stock > 0 AND stock <= "lowStockThreshold"`,
      ]);
      return {
        page: "/admin/products",
        activeProducts: total,
        inactiveProducts: inactive,
        checks: results,
        lowStock: Number(low[0]?.n ?? 0),
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// تیم
// ─────────────────────────────────────────────────────────────────

const reportsGuard: Guard = (a) => can(a, "PANEL_REPORTS");
const teamGuard: Guard = (a) => can(a, "WORK_REPORT_VIEW");
const marketingTeamGuard: Guard = (a) => can(a, "MARKETING_VIEW_ALL");

const TEAM_TOOLS: AssistantTool[] = [
  {
    name: "report_panel_activity",
    label: "خواندن گزارش فعالیت پنل",
    topic: "فعالیت کارکنان در پنل (محصول ساخته/ویرایش‌شده، آپلود، حذف)",
    description:
      "گزارش عملکرد پنل در یک بازه: چند محصول ساخته و ویرایش شد، آپلود و حذف، و هر کارمند چند کار در پنل ثبت کرده (از ثبت فعالیت). " +
      "برای «کی چند محصول اضافه کرد» یا «فعالیت تیم محتوا در پنل».",
    parameters: periodParams,
    available: reportsGuard,
    run: withPeriod(reportsGuard, async (p) => {
      const [cur, prevCreated, first] = await Promise.all([
        activitySummary({ from: p.start, to: p.end }),
        prisma.product.count({ where: { createdAt: { gte: p.previous.start, lt: p.previous.end } } }),
        prisma.activityLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      ]);
      const warnings = dataWarnings(p, first?.createdAt ?? null, "ثبت فعالیت کارکنان");
      return {
        period: periodInfo(p),
        page: "/admin/reports",
        productsCreated: cmp(cur.kpi.productsCreated, prevCreated),
        productsUpdated: cur.kpi.productsUpdated,
        activeProductsNow: cur.kpi.productsActive,
        imagesUploaded: cur.kpi.imagesUploaded,
        deletions: cur.kpi.deletions,
        byAction: Object.fromEntries(Object.entries(cur.byAction).map(([k, v]) => [ACTION_LABELS[k] ?? k, v])),
        byEntity: Object.fromEntries(Object.entries(cur.byEntity).map(([k, v]) => [ENTITY_LABELS[k] ?? k, v])),
        byStaff: cur.byActor.slice(0, 12).map((a) => ({
          name: a.name,
          total: a.count,
          actions: Object.fromEntries(Object.entries(a.actions).map(([k, v]) => [ACTION_LABELS[k] ?? k, v])),
        })),
        ...(warnings.length ? { warnings: [...warnings, "تعداد محصول ساخته‌شده از جدول محصول است و از روز اول درست است"] } : {}),
      };
    }),
  },
  {
    name: "report_team",
    label: "خواندن عملکرد تیم کارتابل",
    topic: "عملکرد تیم در کارتابل (کار بسته‌شده، عقب‌افتاده، ثبت نتیجه)",
    description:
      "عملکرد تیم در کارتابل در یک بازه: کار بسته‌شده، ثبت‌شده، نرخ ثبت نتیجه، عقب‌افتاده‌ی همین حالا، مستندسازی و کار خودکار، " +
      "به تفکیک حوزه، نوع کار و هر کارمند. کار سئو و محتوا اینجا نیست (report_marketing_team).",
    parameters: periodParams,
    available: teamGuard,
    run: withPeriod(teamGuard, async (p) => {
      const [cur, prev] = await Promise.all([
        teamReport({ from: p.start, to: p.end }),
        prisma.staffTask.count({ where: { status: "DONE", doneAt: { gte: p.previous.start, lt: p.previous.end } } }),
      ]);
      return {
        period: periodInfo(p),
        page: "/admin/worklist/reports",
        done: cmp(cur.kpi.done, prev),
        created: cur.kpi.created,
        outcomeRate: `${cur.kpi.outcomeRate}٪`,
        overdueNow: cur.kpi.overdue,
        documented: cur.kpi.documented,
        automaticWork: cur.kpi.system,
        byDomain: cur.byDomain.map((d) => `${d.label}: ${d.value}`),
        byType: cur.byType.map((d) => `${d.label}: ${d.value}`),
        staff: cur.staff.slice(0, 15).map((s) => ({
          name: s.name,
          done: s.done,
          created: s.created,
          withOutcome: s.withOutcome,
          documented: s.documented,
          overdueNow: s.overdue,
          automaticWork: s.system,
        })),
        notes: [
          "done = بسته‌شده در بازه؛ created و نرخ ثبت نتیجه = ثبت‌شده در بازه؛ overdueNow = وضعیت همین حالا",
          "کار خودکار (automaticWork) از ثبت فعالیت است و با کار دستی جمع نمی‌شود",
        ],
      };
    }),
  },
  {
    name: "report_marketing_team",
    label: "خواندن وضعیت تیم سئو و محتوا",
    topic: "کارهای سئو، محتوا و لینک‌سازی تیم به تفکیک کارمند",
    description:
      "به تفکیک هر کارمند: کارهای سئو و محتوای باز، عقب‌افتاده و منتظر تأیید (همین حالا)، و در بازه: تأییدشده، برگشت‌خورده " +
      "و گره‌های لینکِ زنده‌شده.",
    parameters: periodParams,
    available: marketingTeamGuard,
    run: withPeriod(marketingTeamGuard, async (p) => {
      const now = new Date();
      const inP = { gte: p.start, lt: p.end };
      const [seoOpen, seoDone, seoReturned, contentOpen, contentDone, contentReturned, linksOpen, linksLive] = await Promise.all([
        prisma.seoTask.findMany({
          where: { deletedAt: null, status: { in: ["ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL"] } },
          select: { assigneeId: true, assigneeName: true, status: true, dueAt: true },
        }),
        prisma.seoTask.groupBy({ by: ["assigneeId", "assigneeName"], where: { deletedAt: null, status: "DONE", approvedAt: inP }, _count: { _all: true } }),
        prisma.seoTaskEvent.findMany({ where: { action: "RETURNED", createdAt: inP }, select: { task: { select: { assigneeId: true, assigneeName: true } } } }),
        prisma.contentTask.findMany({
          where: { deletedAt: null, status: { in: ["ASSIGNED", "WRITING", "AWAITING_PUBLISH", "PUBLISHING", "AWAITING_APPROVAL"] } },
          select: { writerId: true, writerName: true, status: true, dueAt: true },
        }),
        prisma.contentTask.groupBy({ by: ["writerId", "writerName"], where: { deletedAt: null, status: "DONE", approvedAt: inP }, _count: { _all: true } }),
        prisma.contentTaskEvent.findMany({ where: { action: "RETURNED", createdAt: inP }, select: { task: { select: { writerId: true, writerName: true } } } }),
        prisma.linkNode.findMany({
          where: { deletedAt: null, status: { in: ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"] } },
          select: { assigneeId: true, assigneeName: true, dueAt: true },
        }),
        prisma.linkNode.groupBy({ by: ["assigneeId", "assigneeName"], where: { deletedAt: null, liveAt: inP }, _count: { _all: true } }),
      ]);

      type Row = {
        name: string;
        seo: { open: number; overdue: number; awaitingApproval: number; approved: number; returned: number };
        content: { open: number; overdue: number; awaitingApproval: number; approved: number; returned: number };
        links: { open: number; overdue: number; wentLive: number };
      };
      const rows = new Map<string, Row>();
      const row = (id: string | null, name: string | null) => {
        const key = id ?? "none";
        let r = rows.get(key);
        if (!r) {
          r = {
            name: id ? name || "بی‌نام" : "بدون مسئول",
            seo: { open: 0, overdue: 0, awaitingApproval: 0, approved: 0, returned: 0 },
            content: { open: 0, overdue: 0, awaitingApproval: 0, approved: 0, returned: 0 },
            links: { open: 0, overdue: 0, wentLive: 0 },
          };
          rows.set(key, r);
        }
        return r;
      };
      const late = (due: Date | null) => !!due && due < now;

      for (const t of seoOpen) {
        const r = row(t.assigneeId, t.assigneeName).seo;
        r.open++;
        if (t.status === "AWAITING_APPROVAL") r.awaitingApproval++;
        else if (late(t.dueAt)) r.overdue++;
      }
      for (const g of seoDone) row(g.assigneeId, g.assigneeName).seo.approved += g._count._all;
      for (const e of seoReturned) row(e.task.assigneeId, e.task.assigneeName).seo.returned++;
      for (const t of contentOpen) {
        const r = row(t.writerId, t.writerName).content;
        r.open++;
        if (t.status === "AWAITING_APPROVAL") r.awaitingApproval++;
        else if (late(t.dueAt)) r.overdue++;
      }
      for (const g of contentDone) row(g.writerId, g.writerName).content.approved += g._count._all;
      for (const e of contentReturned) row(e.task.writerId, e.task.writerName).content.returned++;
      for (const n of linksOpen) {
        const r = row(n.assigneeId, n.assigneeName).links;
        r.open++;
        if (late(n.dueAt)) r.overdue++;
      }
      for (const g of linksLive) row(g.assigneeId, g.assigneeName).links.wentLive += g._count._all;

      return {
        period: periodInfo(p),
        pages: { seo: "/admin/worklist/seo", content: "/admin/worklist/content", links: "/admin/worklist/links" },
        statusNames: { seo: SEO_STATUS_LABELS, content: CONTENT_STATUS_LABELS },
        staff: [...rows.values()].slice(0, 20),
        notes: [
          "open/overdue/awaitingApproval = همین حالا؛ approved، returned و wentLive = در بازه",
          "کار محتوا به نام محتوانویس شمرده شده است",
        ],
      };
    }),
  },
];

// ─────────────────────────────────────────────────────────────────
// مالی — نگهبان‌ها همان روت گزارش حسابداری (`reports/[kind]`)
// ─────────────────────────────────────────────────────────────────

const financeGuard: Guard = (a) => can(a, "ACC_REPORTS");
/** سود و بهای تمام‌شده حساس‌ترین عدد است — `ACC_COST_VIEW` هم لازم است (COST_REPORTS روت) */
const profitGuard: Guard = (a) => can(a, "ACC_REPORTS") && can(a, "ACC_COST_VIEW");

const accRange = (p: Period) => ({ from: p.fromDay, to: p.toDay });
const accPrev = (p: Period) => ({ from: p.previous.fromDay, to: p.previous.toDay });

const FINANCE_TOOLS: AssistantTool[] = [
  {
    name: "report_finance",
    label: "خواندن گزارش هزینه و مطالبات",
    topic: "هزینه‌ها و مطالبات و بدهی‌ها در حسابداری",
    description:
      "از حسابداری: هزینه‌های بازه به تفکیک حساب با مقایسه‌ی دوره‌ی قبل، و سنی مطالبات (طلب از مشتری) و بدهی (به تأمین‌کننده) همین حالا " +
      "با ۵ بدهکار بزرگ. سود و فروش خالص نمی‌دهد (report_profit). تاریخ‌ها روز حسابداری است.",
    parameters: periodParams,
    available: financeGuard,
    run: withPeriod(financeGuard, async (p) => {
      const [exp, recv, pay] = await Promise.all([
        expenseReport(prisma, accRange(p), accPrev(p)),
        aging(prisma, "sales"),
        aging(prisma, "purchase"),
      ]);
      const agingBlock = (a: Awaited<ReturnType<typeof aging>>) => ({
        totalOpen: toman(a.totals.open),
        notDue: toman(a.totals.notDue),
        overdue1to30: toman(a.totals.d30),
        overdue31to60: toman(a.totals.d60),
        overdue61to90: toman(a.totals.d90),
        overdueOver90: toman(a.totals.d90plus),
        top: [...a.rows].sort((x, y) => (y.open > x.open ? 1 : -1)).slice(0, 5).map((r) => ({ name: r.name, open: toman(r.open), invoices: r.invoices })),
      });
      return {
        period: periodInfo(p),
        page: "/admin/accounting/reports",
        expenses: {
          ...cmp(Number(exp.total), Number(exp.prevTotal ?? 0), true),
          byAccount: exp.rows.slice(0, 12).map((r) => ({ account: r.name, group: r.group, amount: toman(r.amount), previous: toman(r.prev) })),
        },
        receivables: agingBlock(recv),
        payables: agingBlock(pay),
        note: "مطالبات و بدهی وضعیت همین حالاست، نه بازه",
      };
    }),
  },
  {
    name: "report_profit",
    label: "خواندن گزارش سود",
    topic: "سود، بهای تمام‌شده و حاشیه‌ی سود",
    description:
      "از حسابداری در یک بازه با مقایسه‌ی دوره‌ی قبل: فروش خالص، سود ناخالص، هزینه‌ها و سود خالص (سود و زیان)، و ۱۰ ردیف اول سود " +
      "به تفکیک by: product (محصول)، category (دسته) یا channel (کانال فروش: سایت، تلفنی، بازارگاه …).",
    parameters: {
      type: "object",
      properties: { ...periodProperties, by: { type: "string", enum: ["product", "category", "channel"], description: "پیش‌فرض product" } },
      required: [],
    },
    available: profitGuard,
    run: withPeriod(profitGuard, async (p, args) => {
      const by = (["product", "category", "channel"].includes(String(args.by)) ? args.by : "product") as ProfitDim;
      const [pl, rows] = await Promise.all([
        profitLoss(prisma, accRange(p), accPrev(p)),
        profitBy(prisma, accRange(p), by),
      ]);
      const t = pl.totals;
      const pt = pl.prevTotals;
      const pct = (num: bigint, den: bigint) => (den > 0n ? `${(Number((num * 1000n) / den) / 10).toLocaleString("fa-IR")}٪` : null);
      return {
        period: periodInfo(p),
        page: "/admin/accounting/reports",
        netSales: cmp(Number(t.netSales), Number(pt?.netSales ?? 0), true),
        grossProfit: cmp(Number(t.gross), Number(pt?.gross ?? 0), true),
        grossMargin: pct(t.gross, t.netSales),
        expenses: cmp(Number(t.expenses), Number(pt?.expenses ?? 0), true),
        netProfit: cmp(Number(t.net), Number(pt?.net ?? 0), true),
        [`by_${by}`]: rows.rows.slice(0, 10).map((r) => ({
          name: r.label,
          qty: r.qty,
          revenue: toman(r.revenue),
          cost: toman(r.cost),
          profit: toman(r.profit),
          margin: r.marginBp === null ? null : `${(r.marginBp / 100).toLocaleString("fa-IR")}٪`,
        })),
        note: "عددها از سندهای حسابداری است؛ فروش ثبت‌نشده در حسابداری اینجا نمی‌آید و ممکن است با گزارش فروش سایت فرق کند",
      };
    }),
  },
];

// ─────────────────────────────────────────────────────────────────
// بازارگاه‌ها
// ─────────────────────────────────────────────────────────────────

const integrationGuard: Guard = (a) => can(a, "PANEL_INTEGRATION");

const INTEGRATION_TOOLS: AssistantTool[] = [
  {
    name: "report_marketplaces",
    label: "بررسی وضعیت بازارگاه‌ها",
    topic: "وضعیت اتصال و همگام‌سازی بازارگاه‌ها و سفارش‌هایشان",
    description:
      "وضعیت اتصال هر بازارگاه و حسابداری بیرونی (آخرین همگام‌سازی و خطا)، سفارش‌های بازارگاه در بازه به تفکیک پلتفرم و وضعیت، " +
      "سفارش‌هایی که همین حالا منتظر نگاشت محصول‌اند، و کارهای همگام‌سازی ناموفق بازه.",
    parameters: periodParams,
    available: integrationGuard,
    run: withPeriod(integrationGuard, async (p) => {
      const inP = { gte: p.start, lt: p.end };
      const [connections, orders, needsMapping, failedJobs, errors] = await Promise.all([
        prisma.integConnection.findMany({
          select: { status: true, lastSyncAt: true, lastError: true, lastErrorAt: true, platform: { select: { name: true, type: true } } },
        }),
        prisma.integOrder.groupBy({ by: ["platformCode", "status"], where: { createdAt: inP }, _count: { _all: true }, _sum: { qty: true } }),
        prisma.integOrder.count({ where: { status: "NEEDS_MAPPING" } }),
        prisma.integJob.groupBy({ by: ["platformCode", "type"], where: { status: "FAILED", createdAt: inP }, _count: { _all: true } }),
        prisma.integLog.groupBy({ by: ["platformCode"], where: { status: "ERROR", createdAt: inP }, _count: { _all: true } }),
      ]);
      const platforms = await prisma.integPlatform.findMany({ select: { code: true, name: true } });
      const nameOf = new Map(platforms.map((x) => [x.code, x.name]));
      const ORDER: Record<string, string> = { PENDING: "در انتظار", NEEDS_MAPPING: "منتظر نگاشت", INVOICED: "فاکتور شده", CANCELLED: "لغوشده" };
      return {
        period: periodInfo(p),
        page: "/admin/integration",
        connections: connections.map((c) => ({
          platform: c.platform.name,
          kind: c.platform.type === "MARKETPLACE" ? "بازارگاه" : "حسابداری",
          status: c.status,
          lastSync: faDate(c.lastSyncAt),
          lastError: c.lastError && c.lastErrorAt && (!c.lastSyncAt || c.lastErrorAt > c.lastSyncAt) ? c.lastError.slice(0, 200) : null,
        })),
        orders: orders.map((o) => ({
          platform: nameOf.get(o.platformCode) ?? o.platformCode,
          status: ORDER[o.status] ?? o.status,
          orders: o._count._all,
          items: o._sum.qty ?? 0,
        })),
        needsMappingNow: needsMapping,
        failedJobs: failedJobs.map((j) => ({ platform: nameOf.get(j.platformCode) ?? j.platformCode, type: j.type, count: j._count._all })),
        errorLogs: errors.map((e) => ({ platform: nameOf.get(e.platformCode) ?? e.platformCode, count: e._count._all })),
      };
    }),
  },
];

export const REPORT_TOOLS: AssistantTool[] = [
  ...SALES_TOOLS,
  ...ANALYTICS_TOOLS,
  ...MARKETING_TOOLS,
  ...TEAM_TOOLS,
  ...FINANCE_TOOLS,
  ...INTEGRATION_TOOLS,
];
