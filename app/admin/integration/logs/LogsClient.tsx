"use client";

import { useState, useCallback } from "react";

interface Log {
  id:            string;
  platformCode:  string;
  operationType: string;
  direction:     string;
  entityType:    string;
  entityId:      string | null;
  status:        string;
  errorMessage:  string | null;
  durationMs:    number | null;
  responseData:  unknown;
  createdAt:     string;
  platform:      { name: string };
}

interface Props {
  initialLogs:  Log[];
  initialTotal: number;
  platforms:    { code: string; name: string }[];
}

const STATUS_CFG = {
  SUCCESS: { label: "موفق",  color: "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400" },
  ERROR:   { label: "خطا",   color: "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400" },
  PARTIAL: { label: "جزئی", color: "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" },
};

const OP_LABELS: Record<string, string> = {
  SYNC_ALL_STOCK: "Sync موجودی کل",
  SYNC_ALL_PRICE: "Sync قیمت کل",
  SYNC_STOCK:     "Sync موجودی",
  SYNC_PRICE:     "Sync قیمت",
  FETCH_PRODUCTS: "دریافت محصولات",
  TEST_CONNECTION: "تست اتصال",
  CREATE_PRODUCT: "ایجاد محصول",
};

const OP_TYPES = Object.keys(OP_LABELS);

export default function LogsClient({ initialLogs, initialTotal, platforms }: Props) {
  const [logs,           setLogs]           = useState<Log[]>(initialLogs);
  const [total,          setTotal]          = useState(initialTotal);
  const [platformFilter, setPlatformFilter] = useState("");
  const [statusFilter,   setStatusFilter]   = useState("");
  const [typeFilter,     setTypeFilter]     = useState("");
  const [page,           setPage]           = useState(1);
  const [pages,          setPages]          = useState(Math.ceil(initialTotal / 40));
  const [loading,        setLoading]        = useState(false);
  const [expanded,       setExpanded]       = useState<string | null>(null);

  const fetchLogs = useCallback(async (
    p           = 1,
    platform    = platformFilter,
    status      = statusFilter,
    type        = typeFilter,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (platform) params.set("platform", platform);
      if (status)   params.set("status",   status);
      if (type)     params.set("type",     type);

      const res  = await fetch(`/api/integration/logs?${params}`);
      const data = await res.json() as { logs: Log[]; total: number; pages: number };
      setLogs(data.logs);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [platformFilter, statusFilter, typeFilter]);

  function handleFilter(newPlatform: string, newStatus: string, newType: string) {
    setPlatformFilter(newPlatform);
    setStatusFilter(newStatus);
    setTypeFilter(newType);
    fetchLogs(1, newPlatform, newStatus, newType);
  }

  return (
    <div className="space-y-5">
      {/* فیلترها */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={platformFilter}
          onChange={e => handleFilter(e.target.value, statusFilter, typeFilter)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">همه پلتفرم‌ها</option>
          {platforms.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={e => handleFilter(platformFilter, e.target.value, typeFilter)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="SUCCESS">موفق</option>
          <option value="ERROR">خطا</option>
          <option value="PARTIAL">جزئی</option>
        </select>

        <select
          value={typeFilter}
          onChange={e => handleFilter(platformFilter, statusFilter, e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">همه انواع</option>
          {OP_TYPES.map(t => <option key={t} value={t}>{OP_LABELS[t]}</option>)}
        </select>

        {(platformFilter || statusFilter || typeFilter) && (
          <button
            onClick={() => handleFilter("", "", "")}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            × پاک کردن فیلتر
          </button>
        )}

        <span className="text-xs text-gray-400 mr-auto">{total} رکورد</span>
      </div>

      {/* جدول */}
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-12">در حال بارگذاری...</p>
        ) : logs.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">رکوردی یافت نشد</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {logs.map(log => {
              const cfg = STATUS_CFG[log.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.ERROR;
              const isExpanded = expanded === log.id;

              return (
                <div key={log.id}>
                  <div
                    className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : log.id)}
                  >
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
                      {cfg.label}
                    </span>

                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-shrink-0 font-bold w-16 truncate">
                      {log.platform.name}
                    </span>

                    <span className="text-xs text-gray-500 flex-shrink-0 w-32 truncate">
                      {OP_LABELS[log.operationType] ?? log.operationType}
                    </span>

                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {log.direction === "INBOUND" ? "← دریافت" : "ارسال →"}
                    </span>

                    {log.durationMs !== null && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{log.durationMs}ms</span>
                    )}

                    {log.errorMessage && (
                      <span className="text-red-400 text-xs truncate flex-1 hidden sm:block">{log.errorMessage}</span>
                    )}

                    {/* summary از responseData */}
                    {!log.errorMessage && log.responseData != null && (
                      <span className="text-[10px] text-gray-400 flex-1 truncate hidden sm:block">
                        {JSON.stringify(log.responseData as object).slice(0, 60)}
                      </span>
                    )}

                    <span className="text-[10px] text-gray-400 flex-shrink-0 mr-auto">
                      {new Date(log.createdAt).toLocaleString("fa-IR", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                    </span>

                    <span className={`text-gray-300 dark:text-gray-600 flex-shrink-0 transition-transform text-[10px] ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 bg-gray-50 dark:bg-white/[0.01] border-t border-gray-100 dark:border-white/[0.04] space-y-2">
                      {log.errorMessage && (
                        <div>
                          <p className="text-xs text-gray-400 font-bold mb-1">خطا</p>
                          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">{log.errorMessage}</p>
                        </div>
                      )}
                      {log.responseData != null && (
                        <div>
                          <p className="text-xs text-gray-400 font-bold mb-1">نتیجه</p>
                          <pre className="text-[10px] font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 overflow-auto max-h-28">
                            {JSON.stringify(log.responseData as object, null, 2)}
                          </pre>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 font-mono">
                        ID: {log.id}
                        {log.entityId && ` · Entity: ${log.entityId.slice(-8)}`}
                      </p>
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
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            قبلی
          </button>
          <span className="text-sm text-gray-500">صفحه {page} از {pages}</span>
          <button
            onClick={() => fetchLogs(page + 1)}
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
