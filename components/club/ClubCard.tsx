"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * کارت باشگاه مشتریان در داشبورد کاربر
 *
 * داده را خودش می‌گیرد تا نیازی به تغییر سرور کامپوننت والد نباشد.
 * جایگزین کارت هاردکد «امتیاز باشگاه مشتریان» می‌شود.
 */

interface ClubData {
  points: number;
  smsConsent: boolean;
  birth: { year: number; month: number; day: number } | null;
  tier: { title: string; color: string | null } | null;
}

function toFa(n: number | string) {
  return Number(n).toLocaleString("fa-IR");
}

export default function ClubCard() {
  const [data, setData] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/club/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // چه چیزی مشتری را به تکمیل پروفایل ترغیب می‌کند
  const missingBirth = data && !data.birth;
  const missingConsent = data && !data.smsConsent;

  return (
    <Link
      href="/user/club"
      className="group relative block p-8 rounded-[2.5rem] bg-white/40 dark:bg-white/[0.03] backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] dark:shadow-none transition-all duration-500 hover:-translate-y-2"
    >
      <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner group-hover:scale-110 transition-transform duration-500">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-tighter">
              {data?.tier?.title ?? "Club"}
            </span>
            <span className="text-[11px] font-bold text-gray-400 mt-1">
              باشگاه مشتریان
            </span>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          {loading ? (
            <span className="inline-block w-16 h-8 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
          ) : (
            <span className="text-3xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight">
              {toFa(data?.points ?? 0)}
            </span>
          )}
          <span className="text-[11px] font-black text-gray-400">امتیاز</span>
        </div>

        {/* به‌جای نوار پیشرفت الکی، کار بعدی مشتری را نشان می‌دهیم */}
        <div className="mt-6 flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400">
            {loading
              ? "\u200c"
              : missingBirth
                ? "تاریخ تولدتان را ثبت کنید و هدیه بگیرید"
                : missingConsent
                  ? "دریافت تخفیف‌های ویژه را فعال کنید"
                  : "مشاهده کارت عضویت"}
          </span>

          <span className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </span>
        </div>

        {(missingBirth || missingConsent) && !loading && (
          <div className="mt-3 w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-l from-emerald-500 to-teal-400 rounded-full" />
          </div>
        )}
      </div>
    </Link>
  );
}