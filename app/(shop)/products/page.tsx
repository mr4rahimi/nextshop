import { Metadata } from "next";
import ProductsPageClient from "@/components/store/products/ProductsPageClient";
import { buildBaseMetadata } from "@/lib/seo";

export const metadata: Metadata = buildBaseMetadata({
  title: "همه محصولات",
  description: "مشاهده و خرید همه محصولات فروشگاه. فیلتر بر اساس دسته‌بندی، برند و قیمت.",
  keywords: "خرید آنلاین، فروشگاه اینترنتی، محصولات",
  path: "/products",
});

export default function ProductsPage() {
  return <ProductsPageClient />;
}