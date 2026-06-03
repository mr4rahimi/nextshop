import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { notFound } from "next/navigation";
import UserOrderDetailClient from "@/components/user/UserOrderDetailClient";

interface Props { params: Promise<{ id: string }> }

export default async function OrderDetailPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) return null;
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, userId: user.id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true, title: true, slug: true, mainImage: true,
              warranty: true,
              images: { take: 1, select: { url: true } },
            },
          },
        },
      },
      address: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) notFound();
  return <UserOrderDetailClient order={serialize(order)} />;
}
