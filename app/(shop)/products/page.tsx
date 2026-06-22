import { Metadata } from "next";
import ProductsPageClient from "@/components/store/products/ProductsPageClient";
import { buildBaseMetadata } from "@/lib/seo";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? "فروشگاه";

export const metadata: Metadata = buildBaseMetadata({
  title: `همه محصولات | ${storeName}`,
  description: `مشاهده و خرید همه محصولات ${storeName}. فیلتر بر اساس دسته‌بندی، برند و قیمت.`,
  keywords: "خرید آنلاین، فروشگاه اینترنتی، محصولات",
  path: "/products",
});

export default function ProductsPage() {
  return <ProductsPageClient />;
}