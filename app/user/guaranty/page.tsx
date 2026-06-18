"use client";

import { useEffect, useState } from "react";

interface GuarantyRequest {
  id: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  adminNote: string | null;
  createdAt: string;
}

interface GuarantyItem {
  id: string;
  serialNumber: string;
  productTitle: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  requests: GuarantyRequest[];
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}

function remainingDays(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function StatusBadge({ endDate }: { endDate: string }) {
  const days = remainingDays(endDate);
  if (days < 0) {
    return <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 border border-gray-200 dark:border-white/10">منقضی شده</span>;
  }
  if (days <= 14) {
    return <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">{toFa(days)} روز مانده</span>;
  }
  return <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">{toFa(days)} روز مانده</span>;
}

const REQUEST_STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDING:     { label: "در انتظار بررسی", color: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20" },
  IN_PROGRESS: { label: "در حال بررسی",   color: "bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border-blue-200 dark:border-primary-500/20" },
  RESOLVED:    { label: "حل شده",         color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" },
  REJECTED:    { label: "رد شده",         color: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20" },
};

export default function UserGuarantyPage() {
  const [items, setItems] = useState<GuarantyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/guaranty")
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white/40 dark:bg-white/[0.03] rounded-[2.5rem] h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">گارانتی‌های من</h1>
        <p className="text-sm text-gray-500 mt-1">{toFa(items.length)} گارانتی ثبت شده برای شما</p>
      </div>

      {items.length === 0 && (
        <div className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] p-10 text-center">
          <p className="text-sm font-bold text-gray-400">هنوز گارانتی‌ای برای شما ثبت نشده است</p>
        </div>
      )}

      {items.map(item => (
        <div key={item.id} className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] p-6 shadow-xl shadow-gray-200/40 dark:shadow-none">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">{item.productTitle}</h3>
              <p className="text-xs text-gray-400 mt-1 font-mono" dir="ltr">ستومان: {item.serialNumber}</p>
            </div>
            <StatusBadge endDate={item.endDate} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            <div className="bg-white/50 dark:bg-white/[0.02] rounded-2xl p-3">
              <p className="text-gray-400 font-bold mb-1">تاریخ شروع</p>
              <p className="font-black text-gray-700 dark:text-gray-300">{formatDate(item.startDate)}</p>
            </div>
            <div className="bg-white/50 dark:bg-white/[0.02] rounded-2xl p-3">
              <p className="text-gray-400 font-bold mb-1">تاریخ پایان</p>
              <p className="font-black text-gray-700 dark:text-gray-300">{formatDate(item.endDate)}</p>
            </div>
          </div>

          {}
          {item.requests.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-gray-200/30 dark:border-white/5">
              <p className="text-xs font-black text-gray-500 dark:text-gray-400">درخواست‌های ثبت‌شده:</p>
              {item.requests.map(req => (
                <div key={req.id} className="bg-white/50 dark:bg-white/[0.02] rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-400">{formatDate(req.createdAt)}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${REQUEST_STATUS_CFG[req.status].color}`}>
                      {REQUEST_STATUS_CFG[req.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-6">{req.description}</p>
                  {req.adminNote && (
                    <p className="text-[11px] text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 rounded-xl px-3 py-2 mt-1">
                      پاسخ پشتیبانی: {req.adminNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
