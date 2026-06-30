import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const [mappingCount, suggestionCount] = await Promise.all([
    prisma.integProductMapping.count(),
    prisma.integMappingSuggestion.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">نگاشت محصولات</h1>
        <p className="text-sm text-gray-500 mt-1">ارتباط محصولات فروشگاه با سیستم‌های خارجی</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5">
          <p className="text-3xl font-black text-gray-900 dark:text-white">{mappingCount}</p>
          <p className="text-sm text-gray-500 mt-1">نگاشت فعال</p>
        </div>
        <Link href="/admin/integration/mapping/suggestions"
          className="bg-white dark:bg-[#0f1117] rounded-2xl border border-amber-200 dark:border-amber-500/20 p-5 hover:border-amber-400 dark:hover:border-amber-500/40 transition-colors">
          <p className="text-3xl font-black text-amber-500">{suggestionCount}</p>
          <p className="text-sm text-gray-500 mt-1">پیشنهاد در انتظار تأیید</p>
          {suggestionCount > 0 && (
            <p className="text-xs text-amber-500 mt-2 font-bold">← بررسی کنید</p>
          )}
        </Link>
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8 text-center">
        <p className="text-gray-400 text-sm">
          برای شروع نگاشت، ابتدا به حسابداری متصل شوید و سپس محصولات را دریافت کنید.
        </p>
        <Link href="/admin/integration/connections"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
          رفتن به اتصالات
        </Link>
      </div>
    </div>
  );
}
