import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/admin/DashboardClient";

export const metadata = { title: "داشبورد | پنل مدیریت" };

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

export default async function AdminDashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalProducts,
    totalCategories,
    totalBrands,
    totalBlogPosts,
    totalChatConversations,
    todayChatConversations,
    stockAggregate,
    orderStats,
    recentOrders,
    topProductsRaw,
    stockHighRaw,
    stockLowRaw,
    recentChatsRaw,
    dailySalesRaw,
    dailyOrdersRaw,
    dailyUsersRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.blogPost.count(),
    prisma.chatConversation.count(),
    prisma.chatConversation.count({ where: { createdAt: { gte: today } } }),
    prisma.product.aggregate({ _sum: { stock: true } }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { grandTotal: true },
    }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    }),
    prisma.product.findMany({
      take: 8,
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, price: true, salePrice: true, mainImage: true, slug: true, stock: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      orderBy: { stock: "desc" },
      take: 5,
      select: { id: true, title: true, stock: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      orderBy: { stock: "asc" },
      take: 5,
      select: { id: true, title: true, stock: true },
    }),
    prisma.chatConversation.findMany({
      take: 5,
      orderBy: { lastMessageAt: "desc" },
      include: {
        messages: { take: 1, orderBy: { createdAt: "desc" }, where: { role: "user" } },
      },
    }),
    prisma.$queryRaw<{ date: Date; total: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS date,
             COALESCE(SUM("grandTotal"), 0)::bigint AS total
      FROM "Order"
      WHERE "createdAt" >= NOW() - INTERVAL '90 days'
        AND status NOT IN ('PENDING_PAYMENT','CANCELED','REFUNDED')
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS date, COUNT(*)::bigint AS count
      FROM "Order"
      WHERE "createdAt" >= NOW() - INTERVAL '90 days'
        AND status IN ('COMPLETED','DELIVERED')
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS date, COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '90 days'
      GROUP BY 1 ORDER BY 1
    `,
  ]);

  // top buyers via groupBy then user lookup
  const topBuyerGroups = await prisma.order.groupBy({
    by: ["userId"],
    where: { status: { in: ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED", "DELIVERED", "COMPLETED"] } },
    _sum: { grandTotal: true },
    _count: { id: true },
    orderBy: [{ _sum: { grandTotal: "desc" } }],
    take: 6,
  });
  const buyerUsers = topBuyerGroups.length
    ? await prisma.user.findMany({
        where: { id: { in: topBuyerGroups.map(g => g.userId) } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      })
    : [];
  const buyerMap = new Map(buyerUsers.map(u => [u.id, u]));
  const topBuyers = topBuyerGroups.map(g => {
    const u = buyerMap.get(g.userId);
    const name = u ? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.phone) : g.userId.slice(0, 8);
    return { name, orders: g._count.id, total: Number(g._sum.grandTotal ?? 0) };
  });

  const totalRevenue = orderStats
    .filter(s => ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED", "DELIVERED", "COMPLETED"].includes(s.status))
    .reduce((sum, s) => sum + Number(s._sum.grandTotal ?? 0), 0);
  const totalOrders = orderStats.reduce((sum, s) => sum + s._count.id, 0);

  return (
    <DashboardClient
      stats={{
        totalUsers,
        totalProducts,
        totalCategories,
        totalBrands,
        totalOrders,
        totalRevenue,
        totalBlogPosts,
        totalChatConversations,
        todayChatConversations,
        totalStock: stockAggregate._sum.stock ?? 0,
      }}
      orderStats={orderStats.map(s => ({
        status: s.status,
        count: s._count.id,
        total: Number(s._sum.grandTotal ?? 0),
      }))}
      recentOrders={recentOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        grandTotal: Number(o.grandTotal),
        createdAt: o.createdAt.toISOString(),
        userName: [o.user.firstName, o.user.lastName].filter(Boolean).join(" ") || o.user.phone,
      }))}
      topProducts={topProductsRaw.map(p => ({
        id: p.id,
        title: p.title,
        price: Number(p.price),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        mainImage: p.mainImage,
        slug: p.slug,
        stock: p.stock,
      }))}
      topBuyers={topBuyers}
      stockHigh={stockHighRaw}
      stockLow={stockLowRaw}
      recentChats={recentChatsRaw.map(c => ({
        id: c.id,
        userId: c.userId,
        sessionId: c.sessionId,
        lastMessageAt: c.lastMessageAt.toISOString(),
        lastMessage: c.messages[0]?.content?.slice(0, 80) ?? null,
      }))}
      dailySales={fillDays(dailySalesRaw.map(r => ({ date: r.date, value: Number(r.total) })), 90)}
      dailyOrders={fillDays(dailyOrdersRaw.map(r => ({ date: r.date, value: Number(r.count) })), 90)}
      dailyUsers={fillDays(dailyUsersRaw.map(r => ({ date: r.date, value: Number(r.count) })), 90)}
    />
  );
}
