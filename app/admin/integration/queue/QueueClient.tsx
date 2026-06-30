"use client";

import { useState, useEffect, useCallback } from "react";

interface Job {
  id:           string;
  type:         string;
  platformCode: string;
  status:       string;
  priority:     number;
  attempts:     number;
  maxAttempts:  number;
  lastError:    string | null;
  scheduledAt:  string;
  startedAt:    string | null;
  completedAt:  string | null;
  createdAt:    string;
  payload:      unknown;
  platform:     { name: string };
}

interface Stats {
  pending:    number;
  processing: number;
  failed:     number;
  done:       number;
}

interface Props {
  initialJobs:  Job[];
  initialTotal: number;
  initialStats: Stats;
  platforms:    { code: string; name: string }[];
}

const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  PENDING:    { label: "در انتظار",    color: "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",   dot: "bg-amber-400" },
  PROCESSING: { label: "در حال اجرا", color: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",       dot: "bg-blue-500 animate-pulse" },
  DONE:       { label: "تکمیل",       color: "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400",   dot: "bg-green-500" },
  FAILED:     { label: "شکست",        color: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400",           dot: "bg-red-500" },
  RETRYING:   { label: "تلاش مجدد",  color: "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400", dot: "bg-purple-400" },
  CANCELLED:  { label: "لغو شده",    color: "bg-gray-100 dark:bg-white/5 text-gray-500",                               dot: "bg-gray-400" },
};

const TYPE_LABELS: Record<string, string> = {
  SYNC_ALL_STOCK: "Sync موجودی (همه)",
  SYNC_ALL_PRICE: "Sync قیمت (همه)",
  SYNC_STOCK:     "Sync موجودی",
  SYNC_PRICE:     "Sync قیمت",
  FETCH_PRODUCTS: "دریافت محصولات",
  TEST_CONNECTION: "تست اتصال",
  CREATE_PRODUCT: "ایجاد محصول",
};

export default function QueueClient({ initialJobs, initialTotal, initialStats, platforms }: Props) {
  const [jobs,      setJobs]      = useState<Job[]>(initialJobs);
  const [total,     setTotal]     = useState(initialTotal);
  const [stats,     setStats]     = useState(initialStats);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [page,      setPage]      = useState(1);
  const [pages,     setPages]     = useState(Math.ceil(initialTotal / 30));
  const [loading,   setLoading]   = useState(false);
  const [acting,    setActing]    = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchJobs = useCallback(async (p = page, status = statusFilter, platform = platformFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (status)   params.set("status",   status);
      if (platform) params.set("platform", platform);

      const res  = await fetch(`/api/integration/queue?${params}`);
      const data = await res.json() as { jobs: Job[]; total: number; pages: number };
      setJobs(data.jobs);
      setTotal(data.total);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, platformFilter]);

  // auto-refresh هر ۱۵ ثانیه
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchJobs(), 15_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchJobs]);

  function handleFilterChange(status: string, platform: string) {
    setStatusFilter(status);
    setPlatformFilter(platform);
    setPage(1);
    fetchJobs(1, status, platform);
  }

  async function handleAction(jobId: string, action: "retry" | "cancel") {
    setActing(jobId);
    try {
      const res  = await fetch("/api/integration/queue", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, jobId }),
      });
      if (res.ok) {
        await fetchJobs();
      } else {
        const data = await res.json() as { error?: string };
        alert(data.error ?? "خطا");
      }
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* آمار */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "در انتظار", value: stats.pending,    color: "text-amber-500", status: "PENDING" },
          { label: "در اجرا",   value: stats.processing, color: "text-blue-500",  status: "PROCESSING" },
          { label: "شکست",     value: stats.failed,     color: "text-red-500",   status: "FAILED" },
          { label: "تکمیل",    value: stats.done,       color: "text-green-500", status: "DONE" },
        ].map(s => (
          <button
            key={s.status}
            onClick={() => handleFilterChange(statusFilter === s.status ? "" : s.status, platformFilter)}
            className={`bg-white dark:bg-[#0f1117] rounded-2xl border p-4 text-center transition-colors ${
              statusFilter === s.status
                ? "border-blue-400 dark:border-blue-500/50"
                : "border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/10"
            }`}
          >
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      {/* فیلتر + refresh */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={platformFilter}
          onChange={e => handleFilterChange(statusFilter, e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">همه پلتفرم‌ها</option>
          {platforms.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>

        <button
          onClick={() => fetchJobs()}
          disabled={loading}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          {loading ? "در حال بارگذاری..." : "بروزرسانی"}
        </button>

        <label className="flex items-center gap-2 cursor-pointer mr-auto">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-xs text-gray-500 font-bold">بروزرسانی خودکار (۱۵ ثانیه)</span>
        </label>

        <p className="text-xs text-gray-400">{total} job</p>
      </div>

      {/* جدول job‌ها */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        {jobs.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">
            {statusFilter ? `هیچ job ${STATUS_CFG[statusFilter]?.label ?? statusFilter} وجود ندارد` : "هنوز job‌ای وجود ندارد"}
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {jobs.map(job => {
              const cfg = STATUS_CFG[job.status] ?? STATUS_CFG.PENDING;
              const isExpanded = expanded === job.id;

              return (
                <div key={job.id}>
                  <div
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : job.id)}
                  >
                    {/* وضعیت */}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
                      {cfg.label}
                    </span>

                    {/* پلتفرم */}
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-shrink-0 font-bold w-20 truncate">
                      {job.platform.name}
                    </span>

                    {/* نوع */}
                    <span className="text-xs text-gray-500 flex-1 truncate">
                      {TYPE_LABELS[job.type] ?? job.type}
                    </span>

                    {/* تلاش */}
                    {job.attempts > 0 && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        تلاش {job.attempts}/{job.maxAttempts}
                      </span>
                    )}

                    {/* خطا */}
                    {job.lastError && (
                      <span className="text-red-400 text-xs truncate flex-shrink-0 max-w-48 hidden sm:block">
                        {job.lastError}
                      </span>
                    )}

                    {/* زمان */}
                    <span className="text-gray-400 text-[10px] flex-shrink-0">
                      {new Date(job.createdAt).toLocaleString("fa-IR", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                    </span>

                    {/* دکمه‌ها */}
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {job.status === "FAILED" && (
                        <button
                          onClick={() => handleAction(job.id, "retry")}
                          disabled={acting === job.id}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-40"
                        >
                          {acting === job.id ? "..." : "تلاش مجدد"}
                        </button>
                      )}
                      {job.status === "PENDING" && (
                        <button
                          onClick={() => handleAction(job.id, "cancel")}
                          disabled={acting === job.id}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
                        >
                          {acting === job.id ? "..." : "لغو"}
                        </button>
                      )}
                    </div>

                    {/* فلش expand */}
                    <span className={`text-gray-300 dark:text-gray-600 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                  </div>

                  {/* جزئیات */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-3 bg-gray-50 dark:bg-white/[0.01] border-t border-gray-100 dark:border-white/[0.04]">
                      <div className="grid sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-gray-400 font-bold mb-1">شناسه Job</p>
                          <p className="font-mono text-gray-600 dark:text-gray-400">{job.id}</p>
                        </div>
                        {job.startedAt && (
                          <div>
                            <p className="text-gray-400 font-bold mb-1">شروع</p>
                            <p className="text-gray-600 dark:text-gray-400">{new Date(job.startedAt).toLocaleString("fa-IR")}</p>
                          </div>
                        )}
                        {job.completedAt && (
                          <div>
                            <p className="text-gray-400 font-bold mb-1">پایان</p>
                            <p className="text-gray-600 dark:text-gray-400">{new Date(job.completedAt).toLocaleString("fa-IR")}</p>
                          </div>
                        )}
                      </div>

                      {job.lastError && (
                        <div>
                          <p className="text-xs text-gray-400 font-bold mb-1">خطا</p>
                          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">{job.lastError}</p>
                        </div>
                      )}

                      {job.payload != null && (
                        <div>
                          <p className="text-xs text-gray-400 font-bold mb-1">Payload</p>
                          <pre className="text-[10px] font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 overflow-auto max-h-32">
                            {JSON.stringify(job.payload as object, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => { setPage(p => p - 1); fetchJobs(page - 1); }}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            قبلی
          </button>
          <span className="text-sm text-gray-500">
            صفحه {page} از {pages}
          </span>
          <button
            onClick={() => { setPage(p => p + 1); fetchJobs(page + 1); }}
            disabled={page >= pages || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            بعدی
          </button>
        </div>
      )}
    </div>
  );
}
