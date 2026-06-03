import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getAuthUser } from "@/lib/auth";
import { CartProvider } from "@/components/store/cart/CartContext";
import { WishlistProvider } from "@/components/store/wishlist/WishlistContext";
import { prisma } from "@/lib/prisma";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([
    getAuthUser(),
    prisma.storeSettings.findUnique({ where: { id: "singleton" } }).catch(() => null),
  ]);

  return (
    <CartProvider isLoggedIn={!!user}>
      <WishlistProvider isLoggedIn={!!user}>
        <Header />
        <main className="bg-gray-100 dark:bg-[#050505] min-h-screen transition-colors duration-300 overflow-x-hidden pb-24 md:pb-0">
          {children}
        </main>
        <Footer />
        <MobileBottomNav phone={settings?.sitePhone ?? null} />
      </WishlistProvider>
    </CartProvider>
  );
}