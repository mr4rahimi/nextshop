"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * کارت وضعیت حساب پنل پیامک
 *
 * مشترک بین `/admin/sms` و تنظیمات باشگاه مشتریان. عمداً نام و شماره‌ی صاحب
 * حساب را نشان می‌دهد: هر کسب‌وکار پنل جداگانه دارد و بدون این، وصل بودن به
 * پنل اشتباه هیچ نشانه‌ی قابل دیدنی ندارد.
 */

export interface Balance {
  amount: number;
  count?: number;
  details?: { count: number; rate: number; amount: number }[];
}

export interface AccountProfile {
  displayName: string;
  mobile: string;
  verified: boolean;
  blocked: boolean;
  planTitle?: string;
  planExpiryDate?: string;
}

interface AccountError {
  code: string;
  message: string;
  fixUrl?: string;
}

function fa(n: number) {
  return n.toLocaleString("fa-IR");
}

/** تعداد پیامک کسری است؛ زیر ۱۰ تا یک رقم اعشار نگه می‌داریم تا «۰» گمراه‌کننده نشود */
function faCount(n: number) {
  return n < 10
    ? n.toLocaleString("fa-IR", { maximumFractionDigits: 1 })
    : Math.floor(n).toLocaleString("fa-IR");
}

export default function SmsAccountCard({ compact = false }: { compact?: boolean }) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState<AccountError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sms/account");
      const d = await res.json();
      setBalance(d.balance ?? null);
      setProfile(d.profile ?? null);
      setError(d.error ?? null);
    } catch {
      setError({ code: "UNREACHABLE", message: "ارتباط با سرور برقرار نشد" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const low = balance !== null && balance.count !== undefined && balance.count < 50;

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">اعتبار پنل پیامک</h2>

          {loading ? (
            <div className="h-4 w-40 bg-gray-100 dark:bg-gray-800 rounded mt-2 animate-pulse" />
          ) : error ? (
            <div className="mt-1.5">
              <p className="text-[11px] font-bold text-red-500">{error.message}</p>
              {error.fixUrl && (
                <Link
                  href={error.fixUrl}
                  className="text-[10px] font-black text-primary-600 hover:underline"
                >
                  رفتن به تنظیمات پیامکی ←
                </Link>
              )}
            </div>
          ) : (
            <>
              <p
                className={`text-[11px] font-bold mt-1.5 ${
                  low ? "text-amber-600" : "text-gray-400"
                }`}
              >
                {balance?.count !== undefined
                  ? `حدود ${faCount(balance.count)} پیامک باقی‌مانده`
                  : "تعداد پیامک باقی‌مانده اعلام نشد"}
                {low && " — رو به اتمام"}
              </p>

              {profile && (
                <p className="text-[10px] font-bold text-gray-400 mt-1.5">
                  حساب <span className="text-gray-600 dark:text-gray-300">{profile.displayName || "—"}</span>
                  {profile.mobile && (
                    <span dir="ltr" className="tabular-nums"> · {profile.mobile}</span>
                  )}
                  {profile.planTitle && <span> · پکیج {profile.planTitle}</span>}
                  {profile.blocked && <span className="text-red-500"> · حساب مسدود است</span>}
                  {!profile.verified && <span className="text-amber-600"> · احراز نشده</span>}
                </p>
              )}
            </>
          )}
        </div>

        <div className="text-left shrink-0">
          <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
            {balance ? fa(balance.amount) : "—"}
            {balance && (
              <span className="text-xs font-bold text-gray-400 mr-1">تومان</span>
            )}
          </p>
          <button
            onClick={load}
            disabled={loading}
            className="text-[10px] font-black text-primary-600 hover:underline mt-1.5 disabled:opacity-50"
          >
            {loading ? "در حال بروزرسانی..." : "بروزرسانی"}
          </button>
        </div>
      </div>

      {!compact && balance?.details && balance.details.length > 1 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
          <p className="text-[10px] font-black text-gray-500">ریز اعتبار به تفکیک تعرفه</p>
          {balance.details.map((d, i) => (
            <div key={i} className="flex justify-between text-[11px] font-bold text-gray-500">
              <span>{fa(d.count)} پیامک · تعرفه {fa(d.rate)} تومان</span>
              <span className="tabular-nums">{fa(d.amount)} تومان</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
