import { prisma } from "@/lib/prisma";
import { getQueueStats } from "@/lib/integration/core/queue";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [stats, recentJobs] = await Promise.all([
    getQueueStats(),
    prisma.integJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { platform: true },
    }),
  ]);

  const statusCfg: Record<string, { label: string; color: string }> = {
    PENDING:    { label: "در انتظار",    color: "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" },
    PROCESSING: { label: "در حال اجرا", color: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" },
    DONE:       { label: "تکمیل",       color: "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400" },
    FAILED:     { label: "شکست",        color: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400" },
    RETRYING:   { label: "تلاش مجدد",  color: "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" },
    CANCELLED:  { label: "لغو شده",    color: "bg-gray-100 dark:bg-white/5 text-gray-500" },
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">صف عملیات</h1>
        <p className="text-sm text-gray-500 mt-1">وضعیت job‌های یکپارچه‌سازی</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "در انتظار", value: stats.pending,    color: "text-amber-500" },
          { label: "در اجرا",   value: stats.processing, color: "text-blue-500"  },
          { label: "شکست",     value: stats.failed,     color: "text-red-500"   },
          { label: "تکمیل",    value: stats.done,       color: "text-green-500" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-white/[0.04]">
          <h2 className="font-black text-sm text-gray-900 dark:text-white">آخرین job‌ها</h2>
        </div>
        {recentJobs.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">هنوز job‌ای وجود ندارد</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {recentJobs.map(job => {
              const cfg = statusCfg[job.status] ?? statusCfg.PENDING;
              return (
                <div key={job.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">{job.platform.name}</span>
                  <span className="text-gray-500 text-xs">{job.type}</span>
                  {job.lastError && (
                    <span className="text-red-400 text-xs truncate flex-1">{job.lastError}</span>
                  )}
                  <span className="text-gray-400 text-xs flex-shrink-0 mr-auto">
                    {new Date(job.createdAt).toLocaleString("fa-IR")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
