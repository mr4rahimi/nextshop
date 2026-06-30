import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PriceRulesClient from "./PriceRulesClient";

export const dynamic = "force-dynamic";

const PLATFORM_LABELS: Record<string, string> = {
  hesaban: "وب‌حسابان",
  basalam: "باسلام",
};

export default async function PriceRulesPage() {
  const rules = await prisma.integPriceRule.findMany({ orderBy: { priority: "asc" } });

  const serialized = rules.map(r => ({
    id:               r.id,
    name:             r.name,
    description:      r.description,
    isActive:         r.isActive,
    priority:         r.priority,
    targetPlatforms:  r.targetPlatforms,
    scopeCategoryIds: r.scopeCategoryIds,
    scopeBrandIds:    r.scopeBrandIds,
    createdAt:        r.createdAt.toISOString(),
    updatedAt:        r.updatedAt.toISOString(),
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">قوانین قیمت</h1>
          <p className="text-sm text-gray-500 mt-1">فرمول‌های محاسبه قیمت هنگام ارسال به مارکت‌پلیس‌ها</p>
        </div>
        <Link
          href="/admin/integration/price-rules/create"
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          + قانون جدید
        </Link>
      </div>

      {/* راهنما */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-2xl p-4 text-sm text-blue-700 dark:text-blue-300 space-y-1.5">
        <p className="font-bold">قوانین قیمت چطور کار می‌کنند؟</p>
        <p className="text-xs opacity-80">
          هنگام Sync قیمت به مارکت‌پلیس، به‌جای قیمت مستقیم فروشگاه، فرمول اجرا می‌شود.
          قوانین بر اساس اولویت (عدد کمتر = اجرا اول) مرتب می‌شوند.
          اولین قانون قابل‌اعمال اجرا می‌شود — بقیه نادیده گرفته می‌شوند.
        </p>
        <p className="text-xs opacity-80">
          اگر هیچ قانونی تعریف نشده باشد، قیمت فروشگاه مستقیم ارسال می‌شود.
        </p>
      </div>

      <PriceRulesClient
        initialRules={serialized}
        platformLabels={PLATFORM_LABELS}
      />
    </div>
  );
}
