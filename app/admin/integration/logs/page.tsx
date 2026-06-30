import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const logs = await prisma.integLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { platform: true },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">گزارش لاگ‌ها</h1>
        <p className="text-sm text-gray-500 mt-1">تاریخچه کامل عملیات یکپارچه‌سازی</p>
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        {logs.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">هنوز لاگی ثبت نشده</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {logs.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                  log.status === "SUCCESS" ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400" :
                  log.status === "ERROR"   ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400" :
                  "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                }`}>
                  {log.status === "SUCCESS" ? "موفق" : log.status === "ERROR" ? "خطا" : "جزئی"}
                </span>
                <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">{log.platform.name}</span>
                <span className="text-gray-500 text-xs">{log.operationType}</span>
                <span className="text-gray-400 text-xs">{log.entityType}{log.entityId ? ` #${log.entityId.slice(-6)}` : ""}</span>
                {log.durationMs && <span className="text-gray-400 text-xs">{log.durationMs}ms</span>}
                {log.errorMessage && (
                  <span className="text-red-400 text-xs truncate flex-1">{log.errorMessage}</span>
                )}
                <span className="text-gray-400 text-xs flex-shrink-0 mr-auto">
                  {new Date(log.createdAt).toLocaleString("fa-IR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
