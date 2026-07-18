import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SellerHeader from "@/components/seller/SellerHeader";

export const dynamic = "force-dynamic";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { storeName: true, storeLogo: true, clubName: true },
  });

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.phone ||
    "";

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 dark:bg-[#0b0d12] flex flex-col"
    >
      {user && (
        <SellerHeader
          sellerName={name}
          storeName={settings?.storeName ?? null}
          storeLogo={settings?.storeLogo ?? null}
          clubName={settings?.clubName ?? "باشگاه مشتریان"}
        />
      )}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}