import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getQueueStats } from "@/lib/integration/core/queue";

export const dynamic = "force-dynamic";

const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  CONNECTED:    { label: "متصل",        color: "text-green-600 dark:text-green-400",  dot: "bg-green-500" },
  DISCONNECTED: { label: "متصل نشده",  color: "text-gray-400",                        dot: "bg-gray-400" },
  ERROR:        { label: "خطا",          color: "text-red-600 dark:text-red-400",      dot: "bg-red-500" },
  SYNCING:      { label: "در حال sync", color: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-500 animate-pulse" },
};

export default async function IntegrationDashboardPage() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    platforms,
    connections,
    queueStats,
    mappingCount,
    suggestionCount,
    priceRuleCount,
    recentLogs,
    errorCount24h,
    syncCount24h,
    failedJobs,
  ] = await Promise.all([
    prisma.integPlatform.findMany({ where: { isActive: true }, orderBy: { type: "asc" } }),
    prisma.integConnection.findMany({ include: { platform: true } }),
    getQueueStats(),
    prisma.integProductMapping.count({ where: { isActive: true } }),
    prisma.integMappingSuggestion.count({ where: { status: "PENDING" } }),
    prisma.integPriceRule.count({ where: { isActive: true } }),
    prisma.integLog.findMany({
      orderBy: { createdAt: "desc" },
      take:    10,
      include: { platform: { select: { name: true } } },
    }),
    prisma.integLog.count({ where: { status: "ERROR", createdAt: { gte: since24h } } }),
    prisma.integLog.count({ where: { status: { in: ["SUCCESS", "PARTIAL"] }, createdAt: { gte: since24h } } }),
    prisma.integJob.findMany({
      where:   { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take:    5,
      include: { platform: { select: { name: true } } },
    }),
  ]);

  const connMap = new Map(connections.map(c => [c.platformCode, c]));

  // هشدارها
  const alerts: { type: "error" | "warn" | "info"; message: string; link?: string }[] = [];

  if (errorCount24h > 0) {
    alerts.push({
      type:    "error",
      message: `${errorCount24h} خطا در ۲۴ ساعت گذشته`,
      link:    "/admin/integration/logs?status=ERROR",
    });
  }

  if (failedJobs.length > 0) {
    alerts.push({
      type:    "error",
      message: `${failedJobs.length} job شکست‌خورده در صف — نیاز به retry`,
      link:    "/admin/integration/queue",
    });
  }

  if (suggestionCount > 0) {
    alerts.push({
      type:    "warn",
      message: `${suggestionCount} پیشنهاد نگاشت در انتظار تأیید`,
      link:    "/admin/integration/mapping/suggestions",
    });
  }

  const disconnectedPlatforms = platforms.filter(p => {
    const conn = connMap.get(p.code);
    return !conn || conn.status === "DISCONNECTED" || conn.status === "ERROR";
  });

  if (disconnectedPlatforms.length > 0) {
    alerts.push({
      type:    "warn",
      message: `${disconnectedPlatforms.map(p => p.name).join("، ")} — اتصال برقرار نیست`,
      link:    "/admin/integration",
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">سیستم یکپارچه‌سازی</h1>
        <p className="text-sm text-gray-500 mt-1">مدیریت اتصال به نرم‌افزارهای حسابداری و مارکت‌پلیس‌ها</p>
      </div>

      {/* هشدارها */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm ${
              a.type === "error"
                ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300"
                : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-300"
            }`}>
              <span className="flex-shrink-0 text-lg">{a.type === "error" ? "⚠" : "●"}</span>
              <span className="flex-1">{a.message}</span>
              {a.link && (
                <Link href={a.link} className="text-xs font-bold underline flex-shrink-0 opacity-70 hover:opacity-100">
                  مشاهده
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* آمار کلی */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link href="/admin/integration/mapping"
          className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 hover:border-blue-300 dark:hover:border-blue-500/30 transition-colors">
          <p className="text-xs text-gray-500 font-bold">نگاشت فعال</p>
          <p className="text-3xl font-black mt-1 text-blue-600 dark:text-blue-400">{mappingCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">محصول ↔ پلتفرم</p>
        </Link>

        <Link href="/admin/integration/mapping/suggestions"
          className="bg-white dark:bg-[#0f1117] rounded-2xl border border-amber-200 dark:border-amber-500/20 p-4 hover:border-amber-400 dark:hover:border-amber-500/40 transition-colors">
          <p className="text-xs text-gray-500 font-bold">پیشنهاد در انتظار</p>
          <p className="text-3xl font-black mt-1 text-amber-500">{suggestionCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">نیاز به تأیید</p>
        </Link>

        <Link href="/admin/integration/price-rules"
          className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 hover:border-purple-300 dark:hover:border-purple-500/30 transition-colors">
          <p className="text-xs text-gray-500 font-bold">قوانین قیمت فعال</p>
          <p className="text-3xl font-black mt-1 text-purple-600 dark:text-purple-400">{priceRuleCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">اعمال در sync</p>
        </Link>

        <Link href="/admin/integration/queue"
          className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 hover:border-gray-300 dark:hover:border-white/10 transition-colors">
          <p className="text-xs text-gray-500 font-bold">Queue</p>
          <p className={`text-3xl font-black mt-1 ${queueStats.failed > 0 ? "text-red-500" : "text-gray-900 dark:text-white"}`}>
            {queueStats.pending + queueStats.processing}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {queueStats.processing} در اجرا · {queueStats.failed > 0 ? <span className="text-red-400">{queueStats.failed} شکست</span> : "بدون خطا"}
          </p>
        </Link>
      </div>

      {/* آمار ۲۴ ساعت */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4">
        <p className="text-xs font-bold text-gray-500 mb-3">آمار ۲۴ ساعت اخیر</p>
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-black text-green-600 dark:text-green-400">{syncCount24h}</p>
            <p className="text-xs text-gray-400 mt-0.5">عملیات موفق</p>
          </div>
          <div>
            <p className={`text-2xl font-black ${errorCount24h > 0 ? "text-red-500" : "text-gray-400"}`}>{errorCount24h}</p>
            <p className="text-xs text-gray-400 mt-0.5">خطا</p>
          </div>
        </div>
      </div>

      {/* وضعیت پلتفرم‌ها */}
      <div>
        <h2 className="text-base font-black text-gray-800 dark:text-gray-200 mb-3">پلتفرم‌ها</h2>
        <div className="grid gap-3">
          {platforms.map(p => {
            const conn   = connMap.get(p.code);
            const status = conn?.status ?? "DISCONNECTED";
            const cfg    = STATUS_CFG[status] ?? STATUS_CFG.DISCONNECTED;

            return (
              <div key={p.code}
                className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-lg font-black text-gray-400">
                  {p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 dark:text-white text-sm">{p.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-gray-400">{p.type === "ACCOUNTING" ? "حسابداری" : "مارکت‌پلیس"}</p>
                    {conn?.lastSyncAt && (
                      <p className="text-[10px] text-gray-400">
                        آخرین sync: {new Date(conn.lastSyncAt).toLocaleString("fa-IR", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                      </p>
                    )}
                    {conn?.lastError && (
                      <p className="text-[10px] text-red-400 truncate max-w-48">{conn.lastError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                </div>
                <Link href={`/admin/integration/connections/${p.code}`}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                  {conn ? "تنظیمات" : "اتصال"}
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* job‌های شکست‌خورده */}
      {failedJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-red-600 dark:text-red-400">Job‌های شکست‌خورده</h2>
            <Link href="/admin/integration/queue?status=FAILED" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              مشاهده همه ←
            </Link>
          </div>
          <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-red-200 dark:border-red-800/30 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {failedJobs.map(job => (
                <div key={job.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400 flex-shrink-0">{job.platform.name}</span>
                  <span className="text-xs text-gray-500">{job.type}</span>
                  <span className="text-xs text-red-400 truncate flex-1">{job.lastError ?? "خطای ناشناخته"}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {new Date(job.createdAt).toLocaleString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* activity feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-gray-800 dark:text-gray-200">فعالیت اخیر</h2>
          <Link href="/admin/integration/logs" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            همه لاگ‌ها ←
          </Link>
        </div>
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
          {recentLogs.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">هنوز فعالیتی ثبت نشده</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {recentLogs.map(log => (
                <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    log.status === "SUCCESS" ? "bg-green-500" :
                    log.status === "ERROR"   ? "bg-red-500"   : "bg-amber-400"
                  }`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold flex-shrink-0">{log.platform.name}</span>
                  <span className="text-xs text-gray-500">{log.operationType}</span>
                  {log.errorMessage && (
                    <span className="text-xs text-red-400 truncate flex-1">{log.errorMessage}</span>
                  )}
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mr-auto">
                    {new Date(log.createdAt).toLocaleString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
