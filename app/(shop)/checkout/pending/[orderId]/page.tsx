import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import CheckoutPendingClient from "@/components/store/cart/CheckoutPendingClient";

interface Props { params: Promise<{ orderId: string }> }

export const metadata = { title: "در انتظار تأیید پرداخت" };

export default async function PendingPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/auth");

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: {
      id: true, orderNumber: true, grandTotal: true, status: true,
      payments: { take: 1, orderBy: { createdAt: "desc" }, select: { provider: true } },
    },
  });

  if (!order) redirect("/cart");

  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });

  return (
    <CheckoutPendingClient
      order={serialize(order)}
      cardInfo={serialize({
        cardNumber:      storeSettings?.cardNumber ?? null,
        cardHolder:      storeSettings?.cardHolder ?? null,
        cardBank:        storeSettings?.cardBank ?? null,
        cardReceiptInfo: storeSettings?.cardReceiptInfo ?? null,
      })}
    />
  );
}
