import type { Metadata } from "next";
import { buildBaseMetadata } from "@/lib/seo";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? "فروشگاه";

export const metadata: Metadata = buildBaseMetadata({
  title: `دسته‌بندی‌ها | ${storeName}`,
  description: `مشاهده تمام دسته‌بندی‌های ${storeName} و خرید محصولات دلخواه.`,
  path: "/categories",
});

export default function CategoriesPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold">دسته‌بندی‌ها</h1>
    </div>
  );
}
