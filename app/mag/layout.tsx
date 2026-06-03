import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { getAuthUser } from "@/lib/auth";
import { CartProvider } from "@/components/store/cart/CartContext";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  return (
    <CartProvider isLoggedIn={!!user}>
      <Header />
      <main className="bg-gray-100 dark:bg-[#050505] min-h-screen transition-colors duration-300">
        {children}
      </main>
      <Footer />
    </CartProvider>
  );
}
