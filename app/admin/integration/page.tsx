import { prisma } from "@/lib/prisma";
import { getQueueStats } from "@/lib/integration/core/queue";

export const dynamic = "force-dynamic";

export default async function IntegrationDashboardPage() {
  const [platforms, connections, queueStats] = await Promise.all([
    prisma.integPlatform.findMany({ where: { isActive: true }, orderBy: { type: "asc" } }),
    prisma.integConnection.findMany({ include: { platform: true } }),
    getQueueStats(),
  ]);

  const connMap = new Map(connections.map(c => [c.platformCode, c]));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">سیستم یکپارچه‌سازی</h1>
        <p className="text-sm text-gray-500 mt-1">مدیریت اتصال به نرم‌افزارهای حسابداری و مارکت‌پلیس‌ها</p>
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "در انتظار",     value: queueStats.pending,    color: "text-amber-500" },
          { label: "در حال اجرا",   value: queueStats.processing, color: "text-blue-500"  },
          { label: "شکست خورده",   value: queueStats.failed,     color: "text-red-500"   },
          { label: "تکمیل‌شده",    value: queueStats.done,       color: "text-green-500" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4">
            <p className="text-xs text-gray-500 font-bold">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">عملیات Queue</p>
          </div>
        ))}
      </div>

      {/* Platforms */}
      <div>
        <h2 className="text-base font-black text-gray-800 dark:text-gray-200 mb-3">پلتفرم‌ها</h2>
        <div className="grid gap-3">
          {platforms.map(p => {
            const conn = connMap.get(p.code);
            const status = conn?.status ?? "DISCONNECTED";
            const statusCfg: Record<string, { label: string; color: string; dot: string }> = {
              CONNECTED:    { label: "متصل",          color: "text-green-600 dark:text-green-400",  dot: "bg-green-500" },
              DISCONNECTED: { label: "متصل نشده",     color: "text-gray-400",                        dot: "bg-gray-400" },
              ERROR:        { label: "خطا",            color: "text-red-600 dark:text-red-400",      dot: "bg-red-500"   },
              SYNCING:      { label: "در حال sync",   color: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-500"  },
            };
            const cfg = statusCfg[status] ?? statusCfg.DISCONNECTED;

            return (
              <div key={p.code}
                className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-lg font-black text-gray-400">
                  {p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 dark:text-white text-sm">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.type === "ACCOUNTING" ? "حسابداری" : "مارکت‌پلیس"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                </div>
                <a href={`/admin/integration/connections/${p.code}`}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                  {conn ? "تنظیمات" : "اتصال"}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
