import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CartProvider } from "@/components/store/cart/CartContext";
import { WishlistProvider } from "@/components/store/wishlist/WishlistContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import UserSidebar from "@/components/user/UserSidebar";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([
    getAuthUser(),
    prisma.storeSettings.findUnique({ where: { id: "singleton" } }).catch(() => null),
  ]);

  if (!user) redirect("/auth?redirect=/user");

  return (
    <CartProvider isLoggedIn={!!user}>
      <WishlistProvider isLoggedIn={!!user}>
        <Header />
        <div className="bg-gray-100 dark:bg-[#050505] min-h-screen pb-24 md:pb-0" dir="rtl">
          <div className="container mx-auto py-10 px-4">
            <div className="flex flex-col lg:flex-row gap-8">
              <UserSidebar user={user} />
              <main className="flex-1 space-y-8 min-w-0">{children}</main>
            </div>
          </div>
        </div>
        <Footer />
        <MobileBottomNav phone={settings?.sitePhone ?? null} />
      </WishlistProvider>
    </CartProvider>
  );
}