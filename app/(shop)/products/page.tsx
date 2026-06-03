import { Metadata } from "next";
import ProductsPageClient from "@/components/store/products/ProductsPageClient";

export const metadata: Metadata = {
  title: "همه محصولات | فروشگاه",
  description: "مشاهده و خرید همه محصولات فروشگاه",
};

export default function ProductsPage() {
  return <ProductsPageClient />;
}