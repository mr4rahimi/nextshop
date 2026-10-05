import ReviewsClient from "@/components/admin/tools/ReviewsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "درخواست ثبت نظر" };

/** درخواست ثبت نظر — docs/features/tools.md بخش ۴ */
export default function ToolsReviewsPage() {
  return <ReviewsClient />;
}
