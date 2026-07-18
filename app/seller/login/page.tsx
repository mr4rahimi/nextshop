"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!phone || !password) {
      setError("شماره موبایل و رمز عبور را وارد کنید");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/seller/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ورود انجام نشد");
        return;
      }
      router.replace("/seller/register");
      router.refresh();
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">
            ورود فروشنده
          </h1>
          <p className="text-[11px] font-bold text-gray-500 mt-2">
            برای ثبت مشتریان حضوری وارد شوید
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
            <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">
              {error}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <input
            type="tel"
            inputMode="numeric"
            dir="ltr"
            placeholder="09120000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full px-6 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-2xl text-center font-black tracking-widest outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 text-gray-900 dark:text-white transition-all"
          />

          <input
            type="password"
            placeholder="رمز عبور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full px-6 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-2xl text-center font-black outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 text-gray-900 dark:text-white transition-all"
          />

          <button
            onClick={submit}
            disabled={loading}
            className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "در حال بررسی..." : "ورود"}
          </button>
        </div>
      </div>
    </div>
  );
}