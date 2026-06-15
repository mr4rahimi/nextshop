import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import CheckoutClient from "@/components/store/cart/CheckoutClient";

export const metadata = { title: "تکمیل سفارش" };

export default async function CheckoutPage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth?redirect=/store/checkout");

  const [addresses, settings, userData] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    prisma.storeSettings.findUnique({ where: { id: "singleton" } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalance: true },
    }),
  ]);

  return (
    <CheckoutClient
      initialAddresses={serialize(addresses)}
      storeSettings={serialize({
        cardNumber:      settings?.cardNumber ?? null,
        cardHolder:      settings?.cardHolder ?? null,
        cardBank:        settings?.cardBank ?? null,
        cardReceiptInfo: settings?.cardReceiptInfo ?? null,
        paymentGatewayActive: settings?.paymentGatewayActive ?? false,
        walletEnabled:   settings?.walletEnabled ?? false,
      })}
      walletBalance={String(userData?.walletBalance ?? 0n)}
    />
  );
}