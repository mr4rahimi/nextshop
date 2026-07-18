"use client";

import { useCallback, useEffect, useState } from "react";
import { formatJalaliShort } from "@/lib/club/jalali";

interface Message {
  id: string;
  phone: string;
  templateKey: string | null;
  kind: "TRANSACTIONAL" | "MARKETING";
  body: string | null;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "SKIPPED";
  providerStatus: string | null;
  providerRequestId: number | null;
  skipReason: string | null;
  errorMessage: string | null;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  campaign: { title: string } | null;
}

interface Stats {
  byStatus: Record<string, number>;
  bySkipReason: Record<string, number>;
  optOutCount: number;
  last30Days: number;
}

const STATUS_FA: Record<Message["status"], { label: string; cls: string }> = {
  QUEUED: { label: "در صف", cls: "bg-gray-500/10 text-gray-500" },
  SENT: { label: "ارسال شده", cls: "bg-blue-500/10 text-blue-600" },
  DELIVERED: { label: "تحویل شده", cls: "bg-emerald-500/10 text-emerald-600" },
  FAILED: { label: "ناموفق", cls: "bg-red-500/10 text-red-600" },
  SKIPPED: { label: "رد شده", cls: "bg-amber-500/10 text-amber-600" },
};

const SKIP_FA: Record<string, string> = {
  OPTED_OUT: "لغو عضویت کرده",
  NO_CONSENT: "رضایت تبلیغاتی ندارد",
  BLOCKED: "توسط ادمین مسدود",
  MONTHLY_CAP: "سقف ماهانه",
  INVALID_PHONE: "شماره نامعتبر",
  USER_INACTIVE: "حساب غیرفعال",
  DRY_RUN: "حالت آزمایشی",
};

const PROVIDER_FA: Record<string, string> = {
  "pending-approval": "در انتظار تأیید اپراتور",
  "in-queue": "در صف پنل",
  sent: "ارسال شده",
  rejected: "رد شده",
  cancelled: "لغو شده",
  "insufficient-balance": "اعتبار ناکافی",
};

const PAGE_SIZE = 30;

function toFa(n: number | string) {
  return Number(n).toLocaleString("fa-IR");
}

export default function SmsLogPage() {
  const [items, setItems] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", status: "", kind: "", days: "30" });
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));

    const res = await fetch(`/api/admin/club/sms-log?${p}`);
    const d = await res.json();

    setItems(d.items ?? []);
    setTotal(d.total ?? 0);
    setStats(d.stats ?? null);
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  async function optOut(phone: string) {
    if (!confirm(`شماره ${phone} به لیست لغو اضافه شود؟ دیگر پیام تبلیغاتی دریافت نمی‌کند.`))
      return;

    const res = await fetch("/api/admin/club/sms-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "optout", phone }),
    });
    const d = await res.json();
    setMsg(d.message ?? d.error);
    load();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const delivered = stats?.byStatus.DELIVERED ?? 0;
  const sent = (stats?.byStatus.SENT ?? 0) + delivered;
  const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">گزارش ارسال پیامک</h1>
        <p className="text-sm text-gray-500 mt-1">{toFa(total)} رکورد با فیلتر فعلی</p>
      </div>

      {msg && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-2xl text-xs font-bold text-center">
          {msg}
        </div>
      )}

      {/* آمار */}
      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="ارسال ۳۰ روز اخیر" value={stats.last30Days} />
            <StatCard
              label="نرخ تحویل"
              value={deliveryRate}
              suffix="٪"
              tone={deliveryRate >= 85 ? "ok" : deliveryRate > 0 ? "warn" : undefined}
            />
            <StatCard label="رد شده" value={stats.byStatus.SKIPPED ?? 0} tone="warn" />
            <StatCard label="لیست لغو" value={stats.optOutCount} />
          </div>

          {Object.keys(stats.bySkipReason).length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-xs font-black text-gray-900 dark:text-white mb-3">
                چرا پیام‌ها ارسال نشدند؟
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.bySkipReason)
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <span
                      key={reason}
                      className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 text-[11px] font-bold text-gray-600 dark:text-gray-300"
                    >
                      {SKIP_FA[reason] ?? reason}
                      <span className="font-black text-gray-900 dark:text-white mr-1.5">
                        {toFa(count)}
                      </span>
                    </span>
                  ))}
              </div>
              {stats.bySkipReason.NO_CONSENT > 0 && (
                <p className="text-[10px] font-bold text-amber-600 mt-3 leading-relaxed">
                  {toFa(stats.bySkipReason.NO_CONSENT)} پیام به‌خاطر نبود رضایت تبلیغاتی ارسال
                  نشد. با یک پیامک خدماتی می‌توانید از مشتریان رضایت بگیرید.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* فیلترها */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, q: search.trim() }));
          }}
          className="flex gap-2"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو با شماره موبایل..."
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-primary-500 dark:text-white"
          />
          <button className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-black">
            جستجو
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Select
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={[
              { value: "", label: "همه وضعیت‌ها" },
              { value: "DELIVERED", label: "تحویل شده" },
              { value: "SENT", label: "ارسال شده" },
              { value: "SKIPPED", label: "رد شده" },
              { value: "FAILED", label: "ناموفق" },
              { value: "QUEUED", label: "در صف" },
            ]}
          />
          <Select
            value={filters.kind}
            onChange={(v) => setFilters((f) => ({ ...f, kind: v }))}
            options={[
              { value: "", label: "همه انواع" },
              { value: "TRANSACTIONAL", label: "خدماتی" },
              { value: "MARKETING", label: "تبلیغاتی" },
            ]}
          />
          <Select
            value={filters.days}
            onChange={(v) => setFilters((f) => ({ ...f, days: v }))}
            options={[
              { value: "1", label: "۲۴ ساعت اخیر" },
              { value: "7", label: "۷ روز اخیر" },
              { value: "30", label: "۳۰ روز اخیر" },
              { value: "", label: "همه زمان‌ها" },
            ]}
          />
        </div>
      </div>

      {/* فهرست */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-bold text-gray-400">
            در حال بارگذاری...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-gray-500">
            رکوردی یافت نشد
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((m) => {
              const st = STATUS_FA[m.status];
              return (
                <div key={m.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs font-black text-gray-900 dark:text-white tabular-nums"
                          dir="ltr"
                        >
                          {m.phone}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${st.cls}`}>
                          {st.label}
                        </span>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-gray-500/10 text-gray-500">
                          {m.kind === "MARKETING" ? "تبلیغاتی" : "خدماتی"}
                        </span>
                      </div>

                      {m.body && (
                        <p className="text-[11px] font-bold text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                          {m.body}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-gray-400 flex-wrap">
                        <span>{formatJalaliShort(new Date(m.queuedAt))}</span>
                        {m.campaign && <span>کمپین: {m.campaign.title}</span>}
                        {m.templateKey && <span dir="ltr">{m.templateKey}</span>}
                        {m.providerStatus && PROVIDER_FA[m.providerStatus] && (
                          <span className="text-blue-500">
                            {PROVIDER_FA[m.providerStatus]}
                          </span>
                        )}
                        {m.skipReason && (
                          <span className="text-amber-600">
                            {SKIP_FA[m.skipReason] ?? m.skipReason}
                          </span>
                        )}
                        {m.errorMessage && (
                          <span className="text-red-500">{m.errorMessage}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => optOut(m.phone)}
                      className="text-[10px] font-black text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="افزودن به لیست لغو"
                    >
                      لغو عضویت
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold text-gray-500">
              صفحه {toFa(page)} از {toFa(totalPages)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-black disabled:opacity-40"
              >
                قبلی
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-black disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-[11px] font-black text-gray-600 dark:text-gray-300 outline-none focus:border-primary-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StatCard({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: "ok" | "warn";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-gray-900 dark:text-white";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-[10px] font-bold text-gray-400">{label}</p>
      <p className={`text-2xl font-black tabular-nums mt-1 ${color}`}>
        {toFa(value)}
        {suffix && <span className="text-sm mr-0.5">{suffix}</span>}
      </p>
    </div>
  );
}