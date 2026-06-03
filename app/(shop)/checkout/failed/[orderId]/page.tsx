import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import CheckoutFailedClient from "@/components/store/cart/CheckoutFailedClient";

interface Props { params: Promise<{ orderId: string }> }
export const metadata = { title: "پرداخت ناموفق" };

export default async function FailedPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/auth");
  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: { id: true, orderNumber: true, grandTotal: true, createdAt: true },
  });

  if (!order) redirect("/user/orders");

  return <CheckoutFailedClient order={serialize(order)} />;
}
