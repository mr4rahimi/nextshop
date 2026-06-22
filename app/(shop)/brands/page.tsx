import type { Metadata } from "next";
import { buildBaseMetadata } from "@/lib/seo";

export const metadata: Metadata = buildBaseMetadata({
  title: "برندها",
  description: "مشاهده تمام برندهای موجود در فروشگاه و خرید محصولات اورجینال.",
  path: "/brands",
});

export default function BrandsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold">برندها</h1>
    </div>
  );
}
  