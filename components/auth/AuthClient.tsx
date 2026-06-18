"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Step = "phone" | "auth" | "set-password";
type AuthMode = "otp" | "password";

export default function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/store/site-settings")
      .then(r => r.json())
      .then(d => {
        setStoreLogo(d.storeLogo ?? null);
        setStoreName(d.storeName ?? null);
      })
      .catch(() => {});
  }, []);

  const [step, setStep] = useState<Step>("phone");
  const [authMode, setAuthMode] = useState<AuthMode>("otp");
  const [phone, setPhone] = useState("");
  const [isExisting, setIsExisting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifiedCode, setVerifiedCode] = useState("");

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  function formatTimer(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }

  async function handleCheckPhone() {
    setError("");
    if (!/^09[0-9]{9}$/.test(phone)) {
      setError("شماره موبایل را به درستی وارد کنید (مثلاً ۰۹۱۲۳۴۵۶۷۸۹)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      setIsExisting(data.exists);
      setStep("auth");
      setAuthMode("otp");
    } catch {
      setError("خطا در اتصال. لطفاً مجدداً تلاش کنید");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setOtpSent(true);
      setTimer(120);
      setOtp(["", "", "", ""]);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
      if (data.devCode) console.log(`[DEV] کد OTP: ${data.devCode}`);
    } catch {
      setError("خطا در ارسال کد");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^[0-9]?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 3) otpRefs[index + 1].current?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  }

  async function handleVerifyOtp() {
    setError("");
    const code = otp.join("");
    if (code.length < 4) { setError("کد ۴ رقمی را کامل وارد کنید"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      if (data.isNewUser) {
        setVerifiedCode(code);
        setStep("set-password");
      } else {
        router.push(redirect);
        router.refresh();
      }
    } catch {
      setError("خطا در تأیید کد");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginPassword() {
    setError("");
    if (!password) { setError("رمز عبور را وارد کنید"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push(redirect);
      router.refresh();
    } catch {
      setError("خطا در ورود");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError("");
    if (newPassword.length < 6) { setError("رمز عبور باید حداقل ۶ کاراکتر باشد"); return; }
    if (newPassword !== newPasswordConfirm) { setError("رمزهای عبور مطابقت ندارند"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push(redirect);
      router.refresh();
    } catch {
      setError("خطا در ثبت‌نام");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipPassword() {
    setLoading(true);
    try {
      const tempPass = Math.random().toString(36).slice(2) + "Aa1";
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password: tempPass }),
      });
      if (!res.ok) { setError("خطا"); return; }
      router.push(redirect);
      router.refresh();
    } catch {
      setError("خطا");
    } finally {
      setLoading(false);
    }
  }

  const otpComplete = otp.every(d => d !== "");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 transition-colors duration-500 overflow-hidden"

      dir="rtl"
    >
      <div className="w-full max-w-[420px] relative">
        <Link href="/" className="inline-flex items-center gap-2 mb-4 text-xs font-black text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          بازگشت
        </Link>
        {/* Blobs */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-400/20 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative overflow-hidden bg-white/70 dark:bg-gray-900/60 backdrop-blur-3xl border border-white dark:border-white/10 rounded-[3.5rem] p-8 md:p-10 shadow-2xl shadow-primary-500/10">

          {storeLogo && (
            <div className="flex justify-center mb-8">
              <Link href="/" className="flex items-center gap-2">
                <img src={storeLogo} className="w-30" alt={storeName ?? ""} />
              </Link>
            </div>
          )}

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">
              {step === "phone" && "خوش آمدید"}
              {step === "auth" && "احراز هویت"}
              {step === "set-password" && "ایجاد رمز عبور"}
            </h2>
            <p className="text-[11px] font-bold text-gray-500 mt-2">
              {step === "phone" && "برای ادامه، شماره موبایل خود را وارد کنید"}
              {step === "auth" && `در حال تأیید هویت برای شماره ${phone}`}
              {step === "set-password" && "برای امنیت بیشتر یک رمز عبور تعیین کنید"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{error}</p>
            </div>
          )}

          {/* ── Step 1: Phone ─────────────────────────────────────────────── */}
          {step === "phone" && (
            <div className="space-y-6">
              <input
                type="tel"
                placeholder="09120000000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCheckPhone()}
                className="w-full px-6 py-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-2xl text-left font-black tracking-widest outline-none focus:border-primary-500 focus:ring-4 focus:ring-blue-500/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
                dir="ltr"
              />
              <button
                onClick={handleCheckPhone}
                disabled={loading}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-[14px] shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-60"
              >
                {loading ? "در حال بررسی..." : "مرحله بعد"}
              </button>
            </div>
          )}

          {/* ── Step 2: Auth ──────────────────────────────────────────────── */}
          {step === "auth" && (
            <div className="space-y-6">

              {}
              {isExisting && (
                <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-2xl">
                  <button
                    onClick={() => { setAuthMode("otp"); setOtpSent(false); setError(""); }}
                    className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all ${authMode === "otp" ? "bg-white dark:bg-gray-800 shadow-sm text-primary-600" : "text-gray-500"}`}
                  >
                    کد تأیید (SMS)
                  </button>
                  <button
                    onClick={() => { setAuthMode("password"); setError(""); }}
                    className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all ${authMode === "password" ? "bg-white dark:bg-gray-800 shadow-sm text-primary-600" : "text-gray-500"}`}
                  >
                    رمز عبور
                  </button>
                </div>
              )}

              {/* OTP Area */}
              {authMode === "otp" && (
                <div className="space-y-6">
                  {!otpSent ? (
                    <button
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="w-full py-4 bg-primary-50 dark:bg-primary-500/10 text-primary-600 border border-blue-200 dark:border-primary-500/20 rounded-2xl font-black text-[13px] hover:bg-blue-100 transition-all disabled:opacity-60"
                    >
                      {loading ? "در حال ارسال..." : "ارسال کد تأیید به شماره موبایل"}
                    </button>
                  ) : (
                    <div className="space-y-6 animate-fadeIn">
                      {/* OTP inputs */}
                      <div className="flex flex-row-reverse justify-between gap-2">
                        {otp.map((digit, i) => (
                          <input
                            key={i}
                            ref={otpRefs[i]}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleOtpChange(i, e.target.value)}
                            onKeyDown={e => handleOtpKeyDown(i, e)}
                            className="w-14 h-14 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl text-center text-xl font-black text-primary-600 dark:text-primary-400 focus:border-primary-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                          />
                        ))}
                      </div>

                      {/* Timer */}
                      <div className="flex items-center justify-center gap-2 text-[11px] font-black">
                        {timer > 0 ? (
                          <span className="text-primary-600 flex items-center gap-1">
                            {formatTimer(timer)}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        ) : (
                          <button onClick={handleSendOtp} disabled={loading} className="text-gray-400 hover:text-primary-600 transition-all underline decoration-dotted">
                            ارسال مجدد کد
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Password Area */}
              {authMode === "password" && (
                <input
                  type="password"
                  placeholder="رمز عبور خود را وارد کنید"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLoginPassword()}
                  className="w-full px-6 py-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-2xl text-center font-black tracking-widest outline-none focus:border-primary-500 focus:ring-4 focus:ring-blue-500/10 text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
                />
              )}

              {}
              <button
                onClick={authMode === "otp" ? handleVerifyOtp : handleLoginPassword}
                disabled={loading || (authMode === "otp" && (!otpSent || !otpComplete)) || (authMode === "password" && !password)}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-[14px] shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-40"
              >
                {loading ? "در حال بررسی..." : "تأیید و ورود"}
              </button>

              <button
                onClick={() => { setStep("phone"); setError(""); setOtp(["","","",""]); setOtpSent(false); }}
                className="w-full text-[10px] font-black text-gray-400 hover:text-primary-500 transition-all text-center"
              >
                ویرایش شماره موبایل
              </button>
            </div>
          )}

          {/* ── Step 3: Set Password ─────────────────────────────────────── */}
          {step === "set-password" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center font-bold">
                حساب کاربری شما ایجاد شد. برای ورودهای بعدی یک رمز عبور تعیین کنید.
              </p>

              <input
                type="password"
                placeholder="رمز عبور (حداقل ۶ کاراکتر)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-6 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-2xl font-black outline-none focus:border-primary-500 focus:ring-4 focus:ring-blue-500/10 text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
              />

              <input
                type="password"
                placeholder="تکرار رمز عبور"
                value={newPasswordConfirm}
                onChange={e => setNewPasswordConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                className="w-full px-6 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-2xl font-black outline-none focus:border-primary-500 focus:ring-4 focus:ring-blue-500/10 text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
              />

              <button
                onClick={handleRegister}
                disabled={loading || !newPassword || !newPasswordConfirm}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-[14px] shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-40"
              >
                {loading ? "در حال ثبت..." : "ثبت رمز و ورود"}
              </button>

              <button
                onClick={handleSkipPassword}
                disabled={loading}
                className="w-full py-3 border border-gray-200 dark:border-white/10 text-gray-500 rounded-2xl font-black text-[12px] hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
              >
                بعداً ایجاد می‌کنم
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
