import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import DashboardClient from "@/components/admin/DashboardClient";

export const metadata = { title: "داشبورد | پنل مدیریت" };

export default async function AdminDashboardPage() {
  const [
    totalUsers,
    totalProducts,
    totalCategories,
    totalBrands,
    orderStats,
    recentOrders,
    topProducts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { grandTotal: true },
    }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.product.findMany({
      take: 5,
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, price: true, salePrice: true, mainImage: true, slug: true },
    }),
  ]);

  const totalRevenue = orderStats
    .filter(s => ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(s.status))
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
      }}
      orderStats={serialize(orderStats)}
      recentOrders={serialize(recentOrders)}
      topProducts={serialize(topProducts)}
    />
  );
}