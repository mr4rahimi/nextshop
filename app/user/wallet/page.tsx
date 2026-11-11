"use client";

import { useEffect, useState } from "react";

interface WalletTx {
  id: string;
  amount: string;
  reason: string;
  createdAt: string;
}

interface ClubCredit {
  credit: string;
  card: string | null;
  tier: { title: string; color: string | null } | null;
  usableOnline: boolean;
  nextExpiry: { at: string; credit: string } | null;
  history: { id: string; label: string; amount: string; createdAt: string; expiresAt: string | null }[];
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function dateFa(d: string) { return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" }); }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function WalletPage() {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [club, setClub] = useState<ClubCredit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/wallet")
      .then(r => r.json())
      .then(data => {
        setBalance(BigInt(data.balance ?? 0));
        setTransactions(data.transactions ?? []);
        setClub(data.club ?? null);
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

      {}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-primary-500/30">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-white/5 rounded-full blur-xl" />
        <div className="relative z-10">
          <p className="text-sm font-bold opacity-70 mb-2">موجودی فعلی</p>
          <p className="text-4xl font-black tracking-tight">
            {toFa(Number(balance ?? 0n))}
            <span className="text-lg font-bold opacity-70 mr-2">تومان</span>
          </p>
          <p className="text-xs opacity-60 mt-3">
            {transactions.length > 0
              ? `آخرین تراکنش: ${formatDate(transactions[0].createdAt)}`
              : "هنوز تراکنشی ثبت نشده"}
          </p>
        </div>
      </div>

      {/* اعتبار کارت اشتراک / باشگاه — همان شماره موبایل، فروشگاه و سایت */}
      {club && (
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-500 to-orange-700 p-8 text-white shadow-2xl shadow-amber-500/30">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold opacity-80">اعتبار کارت باشگاه</p>
              <p className="text-xs font-black opacity-80">
                {club.tier?.title ?? ""}
                {club.card ? ` · کارت ${club.card}` : ""}
              </p>
            </div>
            <p className="mt-2 text-4xl font-black tracking-tight">
              {toFa(Number(club.credit))}
              <span className="text-lg font-bold opacity-70 mr-2">تومان</span>
            </p>
            <p className="text-xs opacity-80 mt-3 leading-6">
              با هر خرید از فروشگاه{club.usableOnline ? " و سایت" : ""} شارژ می‌شود و در خرید بعدی
              {club.usableOnline ? " — در فروشگاه یا هنگام پرداخت سفارش اینترنتی —" : " در فروشگاه"} قابل استفاده است.
            </p>
            {club.nextExpiry && Number(club.nextExpiry.credit) > 0 && (
              <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-black">
                {toFa(Number(club.nextExpiry.credit))} تومان تا {dateFa(club.nextExpiry.at)} اعتبار دارد
              </p>
            )}
          </div>
        </div>
      )}

      {club && club.history.length > 0 && (
        <div className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200/30 dark:border-white/5">
            <h2 className="text-base font-black text-gray-900 dark:text-white">گردش اعتبار کارت</h2>
          </div>
          <div className="divide-y divide-gray-200/30 dark:divide-white/5">
            {club.history.map((h) => {
              const amount = Number(h.amount);
              return (
                <div key={h.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{h.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatDate(h.createdAt)}
                      {h.expiresAt ? ` · اعتبار تا ${dateFa(h.expiresAt)}` : ""}
                    </p>
                  </div>
                  <p className={`text-sm font-black ${amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {amount >= 0 ? "+" : "−"}
                    {toFa(Math.abs(amount))}
                    <span className="mr-1 text-[10px] text-gray-400">تومان</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {}
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
                      <svg className={`w-5 h-5 ${isPositive ? "text-emerald-500" : "text-secondary-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="text-[10px] text-gray-400">تومان</p>
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
