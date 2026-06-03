import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import CheckoutConfirmClient from "@/components/store/cart/CheckoutConfirmClient";

interface Props { params: Promise<{ orderId: string }> }

export const metadata = { title: "تأیید نهایی سفارش" };

export default async function ConfirmPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/auth");

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: {
      address: true,
      items: {
        include: {
          product: {
            select: { id: true, title: true, mainImage: true, images: { take: 1, select: { url: true } } },
          },
        },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order || order.status !== "PENDING_PAYMENT") redirect("/cart");

  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });

  const paymentMethod = order.payments[0]?.provider === "card_transfer" ? "card" : "online";

  return (
    <CheckoutConfirmClient
      order={serialize(order)}
      paymentMethod={paymentMethod}
      cardInfo={serialize({
        cardNumber:      storeSettings?.cardNumber ?? null,
        cardHolder:      storeSettings?.cardHolder ?? null,
        cardBank:        storeSettings?.cardBank ?? null,
        cardReceiptInfo: storeSettings?.cardReceiptInfo ?? null,
      })}
    />
  );
}
