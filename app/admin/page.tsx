import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffAccess, canAny } from "@/lib/permissions";
import { canOpenPath } from "@/lib/admin-sections";
import { pathAllowedByPlan } from "@/lib/plan/features";
import { getLicenseState } from "@/lib/plan/license";
import { DESKTOP_CATEGORIES } from "@/components/admin/desktop/registry";
import DesktopClient from "@/components/admin/desktop/DesktopClient";
import { IN_TRANSIT } from "@/lib/accounting/inventory/docs";

export const metadata = { title: "پیشخوان | پنل مدیریت" };

/** روزهای سری روزانه — دو برابر بیشترین بازه‌ی نمودار تا «دوره‌ی قبل» هم داشته باشد */
const DAYS = 180;

/** وضعیت‌هایی که فروش واقعی حساب می‌شوند */
const SOLD = ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

function fillDays(data: { date: Date; value: number }[], days: number): number[] {
  const out = new Array(days).fill(0);
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  data.forEach(({ date, value }) => {
    const daysAgo = Math.floor((now.getTime() - new Date(date).getTime()) / 86400000);
    if (daysAgo >= 0 && daysAgo < days) out[days - 1 - daysAgo] = value;
  });
  return out;
}

/**
 * پیشخوان دسکتاپی — همه‌ی بخش‌های پنل به شکل آیکن در دسته‌ها، با ویجت‌های
 * گزارش لابه‌لای آن‌ها. مستندات: docs/features/admin-desktop.md
 */
export default async function AdminDashboardPage() {
  // داشبورد فروش و موجودی کل مجموعه را نشان می‌دهد؛ کارمندی که به گزارش یا
  // سفارش دسترسی ندارد مستقیم به کارتابلش می‌رود (lib/admin-sections.ts)
  const access = await getStaffAccess();
  if (access && !canAny(access, ["PANEL_REPORTS", "PANEL_ORDERS"])) {
    redirect("/admin/worklist");
  }

  // اپی که کاربر مجوزش را ندارد یا در بسته‌اش نیست به مرورگر نمی‌رسد
  const license = await getLicenseState();
  const open = (href: string) => {
    const path = href.split("?")[0];
    return (!access || canOpenPath(path, access)) && pathAllowedByPlan(path, license.panelFeatures);
  };
  const categories = DESKTOP_CATEGORIES
    .map((c) => ({ ...c, apps: c.apps.filter((a) => open(a.href)) }))
    .filter((c) => c.apps.length > 0);

  const [
    totalUsers,
    totalProducts,
    outOfStock,
    orderStats,
    recentOrders,
    stockLowRaw,
    pendingReviews,
    pendingBlogComments,
    pendingCallbacks,
    pendingGuaranty,
    transfersInTransit,
    dailySalesRaw,
    dailyOrdersRaw,
    dailyUsersRaw,
    heatRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true, stock: { lte: 0 } } }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { grandTotal: true },
    }),
    prisma.order.findMany({
      take: 7,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    }),
    prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      orderBy: { stock: "asc" },
      take: 6,
      select: { id: true, title: true, stock: true },
    }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.blogComment.count({ where: { status: "PENDING" } }),
    prisma.callbackRequest.count({ where: { status: "pending" } }),
    prisma.guarantyRequest.count({ where: { status: "PENDING" } }),
    prisma.accTransfer.count({ where: IN_TRANSIT }),
    prisma.$queryRaw<{ date: Date; total: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS date,
             COALESCE(SUM("grandTotal"), 0)::bigint AS total
      FROM "Order"
      WHERE "createdAt" >= NOW() - INTERVAL '180 days'
        AND status NOT IN ('PENDING_PAYMENT','CANCELED','REFUNDED')
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS date, COUNT(*)::bigint AS count
      FROM "Order"
      WHERE "createdAt" >= NOW() - INTERVAL '180 days'
        AND status NOT IN ('PENDING_PAYMENT','CANCELED','REFUNDED')
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS date, COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '180 days'
      GROUP BY 1 ORDER BY 1
    `,
    // سفارش‌ها به تفکیک روز هفته و ساعت به وقت تهران — createdAt به UTC ذخیره می‌شود
    prisma.$queryRaw<{ dow: number; hour: number; count: bigint }[]>`
      SELECT EXTRACT(DOW FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran')::int AS dow,
             EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran')::int AS hour,
             COUNT(*)::bigint AS count
      FROM "Order"
      WHERE "createdAt" >= NOW() - INTERVAL '90 days'
        AND status NOT IN ('PENDING_PAYMENT','CANCELED','REFUNDED')
      GROUP BY 1, 2
    `,
  ]);

  const topBuyerGroups = await prisma.order.groupBy({
    by: ["userId"],
    where: { status: { in: [...SOLD] } },
    _sum: { grandTotal: true },
    _count: { id: true },
    orderBy: [{ _sum: { grandTotal: "desc" } }],
    take: 5,
  });
  const buyerUsers = topBuyerGroups.length
    ? await prisma.user.findMany({
        where: { id: { in: topBuyerGroups.map((g) => g.userId) } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      })
    : [];
  const buyerMap = new Map(buyerUsers.map((u) => [u.id, u]));
  const topBuyers = topBuyerGroups.map((g) => {
    const u = buyerMap.get(g.userId);
    const name = u ? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.phone) : g.userId.slice(0, 8);
    return { id: g.userId, name, orders: g._count.id, total: Number(g._sum.grandTotal ?? 0) };
  });

  // شنبه = ردیف ۰ (DOW پستگرس: یکشنبه = ۰)
  const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[]);
  heatRaw.forEach((r) => {
    heatmap[(Number(r.dow) + 1) % 7][Number(r.hour)] = Number(r.count);
  });

  const statusCount = (s: string) => orderStats.find((o) => o.status === s)?._count.id ?? 0;

  return (
    <DesktopClient
      categories={categories}
      badges={{
        orders: statusCount("PAID") + statusCount("CONFIRMED"),
        comments: pendingReviews + pendingBlogComments,
        callbacks: pendingCallbacks,
        guaranty: pendingGuaranty,
        transfers: transfersInTransit,
      }}
      totals={{ users: totalUsers, products: totalProducts, outOfStock }}
      orderStats={orderStats.map((s) => ({
        status: s.status,
        count: s._count.id,
        total: Number(s._sum.grandTotal ?? 0),
      }))}
      recentOrders={recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        grandTotal: Number(o.grandTotal),
        createdAt: o.createdAt.toISOString(),
        userName: [o.user.firstName, o.user.lastName].filter(Boolean).join(" ") || o.user.phone,
      }))}
      stockLow={stockLowRaw}
      topBuyers={topBuyers}
      heatmap={heatmap}
      dailySales={fillDays(dailySalesRaw.map((r) => ({ date: r.date, value: Number(r.total) })), DAYS)}
      dailyOrders={fillDays(dailyOrdersRaw.map((r) => ({ date: r.date, value: Number(r.count) })), DAYS)}
      dailyUsers={fillDays(dailyUsersRaw.map((r) => ({ date: r.date, value: Number(r.count) })), DAYS)}
    />
  );
}
