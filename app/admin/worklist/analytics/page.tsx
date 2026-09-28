import HelpButton from "@/components/admin/worklist/HelpButton";
import AnalyticsClient from "@/components/admin/marketing/AnalyticsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "آمار بازدید" };

/** مستندات: docs/plans/seo-marketing.md بخش ۱۳ */
export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">آمار بازدید</h1>
          <HelpButton topic="siteAnalytics" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          بازدید از آنالیتیکس خودمان می‌آید و روی همین سرور می‌ماند؛ «منبع فروش» از خود سفارش‌ها
          می‌گوید کدام کانال و کدام صفحه فروخت.
        </p>
      </div>
      <AnalyticsClient />
    </div>
  );
}
