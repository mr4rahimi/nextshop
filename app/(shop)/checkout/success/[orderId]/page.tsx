import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import CheckoutSuccessClient from "@/components/store/cart/CheckoutSuccessClient";

interface Props { params: Promise<{ orderId: string }> }
export const metadata = { title: "پرداخت موفق" };

export default async function SuccessPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/auth");
  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: {
      id: true, orderNumber: true, grandTotal: true,
      createdAt: true, status: true,
      payments: { take: 1, orderBy: { createdAt: "desc" }, select: { providerRef: true } },
    },
  });

  if (!order) redirect("/user/orders");

  // آپدیت وضعیت به PAID اگه هنوز PENDING بود
  if (order.status === "PENDING_PAYMENT") {
    await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
    await prisma.payment.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "SUCCEEDED" },
    });
  }

  return <CheckoutSuccessClient order={serialize(order)} />;
}
