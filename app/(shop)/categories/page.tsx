import type { Metadata } from "next";
import { buildBaseMetadata } from "@/lib/seo";

export const metadata: Metadata = buildBaseMetadata({
  title: "دسته‌بندی‌ها",
  description: "مشاهده تمام دسته‌بندی‌های فروشگاه و خرید محصولات دلخواه.",
  path: "/categories",
});

export default function CategoriesPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold">دسته‌بندی‌ها</h1>
    </div>
  );
}
