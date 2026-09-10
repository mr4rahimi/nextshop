"use client";

/**
 * فرم ورود پنل مدیریت.
 *
 * این صفحه عمداً از اسکلت پنل (`app/admin/layout.tsx`) بیرون کشیده شده است؛
 * کاربر ناشناس نباید سایدبار و منوی مدیریت را حتی در پس‌زمینه ببیند.
 * layout با دیدن مسیر `/admin/login` فقط همین صفحه را رندر می‌کند.
 *
 * ظاهر این صفحه به‌عمد فقط یک حالت دارد (تیره) و به تم پنل وابسته نیست —
 * قبل از ورود هنوز هیچ ترجیحی از کاربر نمی‌دانیم.
 *
 * نام و لوگو از `StoreSettings` می‌آید و در `app/admin/login/page.tsx` خوانده می‌شود.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginForm({
  storeName,
  storeLogo,
}: {
  storeName: string;
  storeLogo: string | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در ورود");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("خطای اتصال به سرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="admin-login relative min-h-screen overflow-hidden bg-[#05070d] text-white">

      {/* ── پس‌زمینه ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* لکه‌های نور */}
        <div className="blob absolute -top-40 -right-32 h-[34rem] w-[34rem] rounded-full bg-blue-600/30 blur-[120px]" />
        <div className="blob blob-slow absolute -bottom-48 -left-32 h-[32rem] w-[32rem] rounded-full bg-indigo-500/25 blur-[120px]" />
        <div className="blob blob-slower absolute left-1/2 top-1/3 -ml-[13rem] h-[26rem] w-[26rem] rounded-full bg-cyan-400/15 blur-[130px]" />
        {/* شبکه‌ی ظریف */}
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(to_right,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        {/* محو شدن به سمت پایین */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070d] via-transparent to-transparent" />
      </div>

      {/* ── محتوا ────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 py-10 lg:grid-cols-2 lg:gap-16 lg:px-8">

        {/* معرفی — فقط در دسکتاپ */}
        <section className="hidden lg:block">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] font-black text-blue-300 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
            </span>
            محیط مدیریت {storeName}
          </div>

          <h2 className="text-4xl font-black leading-[1.35] text-white">
            همه‌چیزِ فروشگاه،
            <br />
            <span className="bg-gradient-to-l from-blue-400 via-sky-300 to-cyan-200 bg-clip-text text-transparent">
              در یک صفحه
            </span>
          </h2>

          <p className="mt-5 max-w-md text-sm font-bold leading-8 text-gray-400">
            محصول، سفارش، مشتری، گزارش و کارتابل کارکنان — از همین‌جا مدیریت می‌شود.
            برای ادامه با حساب مدیریتی خود وارد شوید.
          </p>

          <ul className="mt-9 space-y-3.5">
            {[
              "داشبورد فروش و موجودی به‌صورت لحظه‌ای",
              "کارتابل کارکنان، حضور و ارجاع کار",
              "دسترسی‌های تفکیک‌شده بر پایه‌ی نقش",
            ].map(text => (
              <li key={text} className="flex items-center gap-3 text-sm font-bold text-gray-300">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-300">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        {/* کارت ورود */}
        <section className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur-2xl sm:p-9">

            <div className="mb-8 text-center">
              {storeLogo ? (
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-2 backdrop-blur">
                  {/* لوگو از تنظیمات فروشگاه می‌آید و می‌تواند روی هر دامنه‌ای باشد */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={storeLogo} alt={storeName} className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/40">
                  <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              )}
              <h1 className="text-2xl font-black tracking-tight text-white">ورود به پنل مدیریت</h1>
              <p className="mt-2 text-xs font-bold text-gray-400">
                این بخش فقط برای مدیران {storeName} است
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              {error && (
                <div className="shake flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z" />
                  </svg>
                  <p className="text-xs font-black leading-6 text-red-300">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="admin-phone" className="mb-2 block text-[11px] font-black text-gray-300">
                  شماره موبایل
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  <input
                    id="admin-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="username"
                    autoFocus
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="09xxxxxxxxx"
                    disabled={loading}
                    required
                    dir="ltr"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pr-11 pl-4 text-sm font-bold text-white placeholder:text-gray-600 transition-all focus:border-blue-500/60 focus:bg-white/[0.07] focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-password" className="mb-2 block text-[11px] font-black text-gray-300">
                  رمز عبور
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    required
                    dir="ltr"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pr-11 pl-12 text-sm font-bold text-white placeholder:text-gray-600 transition-all focus:border-blue-500/60 focus:bg-white/[0.07] focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
                    className="absolute inset-y-0 left-0 flex w-12 items-center justify-center text-gray-500 transition-colors hover:text-gray-300"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-blue-600 to-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/30 transition-all hover:shadow-xl hover:shadow-blue-600/40 focus:outline-none focus:ring-4 focus:ring-blue-500/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
              >
                {loading ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    در حال ورود…
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    ورود به پنل
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-[11px] font-bold text-gray-600">
            <Link href="/" className="transition-colors hover:text-gray-400">
              ← بازگشت به فروشگاه
            </Link>
          </p>
        </section>
      </div>

      <style>{`
        .admin-login .blob { animation: adminLoginFloat 16s ease-in-out infinite; }
        .admin-login .blob-slow { animation-duration: 22s; animation-direction: reverse; }
        .admin-login .blob-slower { animation-duration: 28s; }
        @keyframes adminLoginFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50%      { transform: translate3d(0, -34px, 0) scale(1.08); }
        }
        .admin-login .shake { animation: adminLoginShake .32s ease-in-out; }
        @keyframes adminLoginShake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-5px); }
          75%      { transform: translateX(5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .admin-login .blob, .admin-login .shake { animation: none; }
        }
      `}</style>
    </div>
  );
}
