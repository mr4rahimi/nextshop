import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import UserOrdersClient from "@/components/user/UserOrdersClient";

export const metadata = { title: "سفارش‌های من" };

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function UserOrdersPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) return null;

  const params = await searchParams;
  const status = params.status;
  const page = parseInt(params.page ?? "1");
  const PAGE_SIZE = 10;

  const statusMap: Record<string, string[]> = {
    active:    ["PAID", "PROCESSING", "SHIPPED"],
    delivered: ["DELIVERED"],
    canceled:  ["CANCELED", "REFUNDED"],
  };

  const statusFilter = status && statusMap[status]
    ? { status: { in: statusMap[status] as any } }
    : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id, ...statusFilter },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        items: {
          take: 3,
          include: {
            product: { select: { mainImage: true, images: { take: 1, select: { url: true } } } },
          },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where: { userId: user.id, ...statusFilter } }),
  ]);

  return (
    <UserOrdersClient
      orders={serialize(orders)}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      currentStatus={status}
    />
  );
}
