import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PriceRulesPage() {
  const rules = await prisma.integPriceRule.findMany({ orderBy: { priority: "asc" } });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">قوانین قیمت</h1>
          <p className="text-sm text-gray-500 mt-1">فرمول‌های محاسبه قیمت برای هر پلتفرم</p>
        </div>
        <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors opacity-50 cursor-not-allowed" disabled>
          + قانون جدید
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-12 text-center">
          <p className="text-gray-400 text-sm">هنوز قانونی تعریف نشده</p>
          <p className="text-gray-400 text-xs mt-2">این بخش در فاز ۴ پیاده‌سازی می‌شود</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(r => (
            <div key={r.id} className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-bold text-sm text-gray-900 dark:text-white">{r.name}</p>
                {r.description && <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>}
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                r.isActive
                  ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                  : "bg-gray-100 dark:bg-white/5 text-gray-500"
              }`}>
                {r.isActive ? "فعال" : "غیرفعال"}
              </span>
              <span className="text-xs text-gray-400">اولویت {r.priority}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
