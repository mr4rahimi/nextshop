import CartPageClient from "@/components/store/cart/CartPageClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("سبد خرید");
export default function CartPage() {
  return <CartPageClient />;
}
