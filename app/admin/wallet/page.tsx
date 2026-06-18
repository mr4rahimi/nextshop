"use client";

import { useState } from "react";

interface WalletUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  walletBalance: string;
  walletTx: { id: string; amount: string; reason: string; createdAt: string }[];
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const inp = "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all";

export default function AdminWalletPage() {
  const [phone, setPhone] = useState("");
  const [user, setUser] = useState<WalletUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"increase" | "decrease">("increase");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function searchUser() {
    if (!phone.trim()) return;
    setSearching(true);
    setSearchError(null);
    setUser(null);
    try {
      const res = await fetch(`/api/admin/wallet?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "کاربر یافت نشد");
      setUser(data);
    } catch (e: any) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !amount || !reason) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, amount: Number(amount), reason, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در عملیات");
      setUser(prev => prev ? { ...prev, walletBalance: data.walletBalance } : null);
      setSaveSuccess(true);
      setAmount("");
      setReason("");
      setTimeout(() => setSaveSuccess(false), 3000);
      const refresh = await fetch(`/api/admin/wallet?phone=${encodeURIComponent(phone.trim())}`);
      const refreshData = await refresh.json();
      if (refresh.ok) setUser(refreshData);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">مدیریت کیف پول</h1>
        <p className="text-xs text-gray-500 mt-0.5">افزایش یا کاهش موجودی کیف پول کاربران</p>
      </div>

      {}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
        <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">جستجوی کاربر</h2>
        <div className="flex gap-3">
          <input dir="ltr" value={phone} onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchUser()}
            placeholder="شماره موبایل کاربر..." className={`${inp} flex-1`} />
          <button onClick={searchUser} disabled={searching}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all">
            {searching ? "جستجو..." : "جستجو"}
          </button>
        </div>
        {searchError && (
          <p className="mt-3 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{searchError}</p>
        )}
      </div>

      {user && (
        <>
          {}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-base font-black text-gray-900 dark:text-white">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{user.phone}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400 mb-1">موجودی فعلی</p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {toFa(Number(user.walletBalance))}
                  <span className="text-sm font-bold text-gray-400 mr-1">تومان</span>
                </p>
              </div>
            </div>
          </div>

          {}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">تغییر موجودی</h2>

            {saveError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-bold">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                موجودی با موفقیت آپدیت شد
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                {[
                  { v: "increase", l: "افزایش موجودی", color: "emerald" },
                  { v: "decrease", l: "کاهش موجودی", color: "red" },
                ].map(t => (
                  <button key={t.v} type="button" onClick={() => setType(t.v as any)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all border ${
                      type === t.v
                        ? t.color === "emerald"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-red-500 text-white border-red-500"
                        : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10"
                    }`}>
                    {t.v === "increase" ? "↑ " : "↓ "}{t.l}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">مبلغ (تومان) *</label>
                <input required type="number" min="1" dir="ltr" value={amount} onChange={e => setAmount(e.target.value)}
                  className={inp} placeholder="مثلاً: 500000" />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">دلیل *</label>
                <input required value={reason} onChange={e => setReason(e.target.value)}
                  className={inp} placeholder="مثلاً: شارژ دستی توسط ادمین، بازگشت وجه سفارش..." />
              </div>

              <button type="submit" disabled={saving || !amount || !reason}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all">
                {saving ? "در حال ثبت..." : "اعمال تغییر"}
              </button>
            </form>
          </div>

          {}
          {user.walletTx.length > 0 && (
            <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
                <h2 className="text-sm font-black text-gray-900 dark:text-white">آخرین تراکنش‌ها</h2>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {user.walletTx.map(tx => {
                  const amt = Number(tx.amount);
                  const isPos = amt >= 0;
                  return (
                    <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{tx.reason}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(tx.createdAt)}</p>
                      </div>
                      <p className={`text-sm font-black ${isPos ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {isPos ? "+" : ""}{toFa(Math.abs(amt))} تومان
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
