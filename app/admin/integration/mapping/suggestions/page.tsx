import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const suggestions = await prisma.integMappingSuggestion.findMany({
    where:   { status: "PENDING" },
    orderBy: { confidence: "desc" },
    take:    100,
    include: { platform: true },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">پیشنهادهای اتصال</h1>
        <p className="text-sm text-gray-500 mt-1">تأیید یا رد پیشنهادهای auto-match سیستم</p>
      </div>

      {suggestions.length === 0 ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-12 text-center">
          <p className="text-gray-400 text-sm">پیشنهادی در انتظار بررسی وجود ندارد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map(s => (
            <div key={s.id} className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{s.platformTitle ?? s.platformProductId}</p>
                <p className="text-xs text-gray-400">{s.platform.name} · ID: {s.platformProductId}</p>
              </div>
              <div className="text-center flex-shrink-0">
                <p className="text-lg font-black text-blue-500">{Math.round(s.confidence * 100)}%</p>
                <p className="text-[10px] text-gray-400">اطمینان</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button className="px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-bold hover:bg-green-200 transition-colors">
                  تأیید
                </button>
                <button className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-200 transition-colors">
                  رد
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
