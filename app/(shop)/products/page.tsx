import { Metadata } from "next";
import ProductsPageClient from "@/components/store/products/ProductsPageClient";
import { buildBaseMetadata } from "@/lib/seo";
import { listingIndexPolicy } from "@/lib/catalog";

type SP = Record<string, string | string[] | undefined>;

const TITLE = "همه محصولات";
const DESCRIPTION =
  "مشاهده و خرید همه محصولات فروشگاه. فیلتر بر اساس دسته‌بندی، برند و قیمت.";

/**
 * قبلاً این صفحه یک `metadata` ثابت داشت، یعنی هر `?brand=…` و `?page=…`
 * با `index, follow` منتشر می‌شد در حالی که معادلش در `/categories/[slug]`
 * نوایندکس بود. حالا هر دو از یک سیاست مشترک استفاده می‌کنند.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const policy = listingIndexPolicy("/products", sp);

  const pageSuffix =
    policy.kind !== "base" && policy.page > 1 ? ` — صفحه ${policy.page}` : "";

  return buildBaseMetadata({
    title: TITLE + pageSuffix,
    description: DESCRIPTION,
    keywords: "خرید آنلاین، فروشگاه اینترنتی، محصولات",
    path: policy.canonicalPath,
    canonicalPath: policy.canonicalPath,
    noIndex: policy.kind === "filtered",
    followWhenNoIndex: true,
  });
}

export default function ProductsPage() {
  return <ProductsPageClient />;
}
