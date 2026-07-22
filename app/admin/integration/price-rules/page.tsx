import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PriceRulesClient from "./PriceRulesClient";

export const dynamic = "force-dynamic";

export default async function PriceRulesPage() {
  // برچسب پلتفرم‌ها از دیتابیس — پلتفرم جدید خودکار اضافه می‌شود
  const dbPlatforms = await prisma.integPlatform.findMany({
    where:  { isActive: true },
    select: { code: true, name: true },
  });
  const PLATFORM_LABELS: Record<string, string> = {
    shop: "فروشگاه",
    ...Object.fromEntries(dbPlatforms.map((p) => [p.code, p.name])),
  };

  const rules = await prisma.integPriceRule.findMany({
    orderBy: { priority: "asc" },
    include: { tiers: true },
  });

  const serialized = rules.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isActive: r.isActive,
    priority: r.priority,
    targetPlatforms: r.targetPlatforms,
    tiersCount: r.tiers.length,
    marginPercent: r.marginPercent,
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">قوانین قیمت</h1>
          <p className="text-sm text-gray-500 mt-1">فرمول محاسبه‌ی قیمت هنگام ارسال به پلتفرم‌ها بر اساس قیمت خرید</p>
        </div>
        <Link href="/admin/integration/price-rules/create" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
          + قانون جدید
        </Link>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-2xl p-4 text-sm text-blue-700 dark:text-blue-300 space-y-1.5">
        <p className="font-bold">قیمت چطور محاسبه می‌شود؟</p>
        <p className="text-xs opacity-80">قیمت خرید + کارمزد پلتفرم + ارسال + بسته‌بندی + سایر هزینه‌ها، سپس سود روی مجموع اعمال می‌شود.</p>
        <p className="text-xs opacity-80">
          قیمت خرید از <Link href="/admin/integration/pricing" className="underline">صفحه‌ی مدیریت قیمت خرید</Link> تنظیم می‌شود.
        </p>
      </div>

      <PriceRulesClient initialRules={serialized} platformLabels={PLATFORM_LABELS} />
    </div>
  );
}