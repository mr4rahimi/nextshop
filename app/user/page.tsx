import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import UserDashboardClient from "@/components/user/UserDashboardClient";

export const metadata = { title: "پیشخوان | حساب کاربری" };

export default async function UserDashboardPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const [successOrders, processingOrders, canceledOrders, cartItems, recentOrders, walletBalance] =
    await Promise.all([
      prisma.order.count({ where: { userId: user.id, status: "DELIVERED" } }),
      prisma.order.count({ where: { userId: user.id, status: { in: ["PAID", "PROCESSING", "SHIPPED"] } } }),
      prisma.order.count({ where: { userId: user.id, status: "CANCELED" } }),
      prisma.cartItem.count({ where: { cart: { userId: user.id } } }),
      prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotal: true,
          createdAt: true,
        },
      }),
      prisma.walletTransaction.aggregate({
        where: { userId: user.id },
        _sum: { amount: true },
      }),
    ]);

  const stats = {
    successOrders,
    processingOrders,
    canceledOrders,
    cartItems,
    walletBalance: walletBalance._sum.amount ?? BigInt(0),
  };

  return (
    <UserDashboardClient
      user={user}
      stats={serialize(stats)}
      recentOrders={serialize(recentOrders)}
    />
  );
}
