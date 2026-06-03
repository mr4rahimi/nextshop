import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AddressesClient from "@/components/user/AddressesClient";

export const metadata = { title: "آدرس‌های من" };

export default async function AddressesPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return <AddressesClient initialAddresses={addresses} />;
}
