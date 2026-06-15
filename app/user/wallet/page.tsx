"use client";

import { useEffect, useState } from "react";

interface WalletTx {
  id: string;
  amount: string;
  reason: string;
  createdAt: string;
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function WalletPage() {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/wallet")
      .then(r => r.json())
      .then(data => {
        setBalance(BigInt(data.balance ?? 0));
        setTransactions(data.transactions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/40 dark:bg-white/[0.03] rounded-[2.5rem] h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">کیف پول</h1>
        <p className="text-sm text-gray-500 mt-1">موجودی و تاریخچه تراکنش‌های کیف پول شما</p>
      </div>

      {/* کارت موجودی */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-500/30">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-white/5 rounded-full blur-xl" />
        <div className="relative z-10">
          <p className="text-sm font-bold opacity-70 mb-2">موجودی فعلی</p>
          <p className="text-4xl font-black tracking-tight">
            {toFa(Number(balance ?? 0n))}
            <span className="text-lg font-bold opacity-70 mr-2">ریال</span>
          </p>
          <p className="text-xs opacity-60 mt-3">
            {transactions.length > 0
              ? `آخرین تراکنش: ${formatDate(transactions[0].createdAt)}`
              : "هنوز تراکنشی ثبت نشده"}
          </p>
        </div>
      </div>

      {/* تاریخچه تراکنش‌ها */}
      <div className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-xl shadow-gray-200/40 dark:shadow-none">
        <div className="px-6 py-5 border-b border-gray-200/30 dark:border-white/5">
          <h2 className="text-base font-black text-gray-900 dark:text-white">تاریخچه تراکنش‌ها</h2>
        </div>

        {transactions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-bold text-gray-400">هنوز تراکنشی ثبت نشده است</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200/30 dark:divide-white/5">
            {transactions.map(tx => {
              const amount = Number(tx.amount);
              const isPositive = amount >= 0;
              return (
                <div key={tx.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      isPositive ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"
                    }`}>
                      <svg className={`w-5 h-5 ${isPositive ? "text-emerald-500" : "text-red-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isPositive
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        }
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{tx.reason}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(tx.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-black ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {isPositive ? "+" : ""}{toFa(Math.abs(amount))}
                    </p>
                    <p className="text-[10px] text-gray-400">ریال</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}