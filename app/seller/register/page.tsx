"use client";

import { useEffect, useRef, useState } from "react";
import PhoneKeypad from "@/components/club/PhoneKeypad";
import { JALALI_MONTH_OPTIONS } from "@/lib/club/jalali";
import { normalizePhone, toPersianDigits } from "@/lib/club/phone";

type Result = {
  phone: string;
  fullName: string | null;
  alreadyMember: boolean;
  todayCount: number;
};

const EMPTY_EXTRA = {
  firstName: "",
  lastName: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
};

export default function SellerRegisterPage() {
  const [phone, setPhone] = useState("");
  const [extra, setExtra] = useState(EMPTY_EXTRA);
  const [consent, setConsent] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const normalized = normalizePhone(phone);
  const phoneValid = normalized !== null;

  function setPhoneSafe(next: string) {
    setPhone(next);
    if (error) setError("");
  }

  function setExtraField(key: keyof typeof EMPTY_EXTRA, value: string) {
    setExtra((e) => ({ ...e, [key]: value }));
  }

  function resetForm() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setPhone("");
    setExtra(EMPTY_EXTRA);
    setConsent(true);
    setShowMore(false);
    setResult(null);
    setError("");
  }

  async function submit() {
    if (!phoneValid || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/seller/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized,
          firstName: extra.firstName,
          lastName: extra.lastName,
          smsConsent: consent,
          birthYear: extra.birthYear || undefined,
          birthMonth: extra.birthMonth || undefined,
          birthDay: extra.birthDay || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "ثبت انجام نشد");
        return;
      }

      setResult(data);
      setTodayCount(data.todayCount);
      resetTimer.current = setTimeout(resetForm, 3000);
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setLoading(false);
    }
  }

  // ── حالت تأیید ─────────────────────────────────────────────────
  if (result) {
    const isNew = !result.alreadyMember;

    return (
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm text-center">
          <div
            className={`w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center mb-6 ${
              isNew
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-amber-500/10 text-amber-500"
            }`}
          >
            {isNew ? (
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
            {isNew ? "به باشگاه اضافه شد" : "قبلاً عضو بود"}
          </h2>

          <p className="text-lg font-black text-gray-700 dark:text-gray-200 tabular-nums" dir="ltr">
            {toPersianDigits(result.phone)}
          </p>
          {result.fullName && (
            <p className="text-sm font-bold text-gray-500 mt-1">{result.fullName}</p>
          )}

          <button
            onClick={resetForm}
            className="mt-8 w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-sm hover:bg-primary-700 transition-all active:scale-[0.98]"
          >
            مشتری بعدی
          </button>

          {todayCount !== null && (
            <p className="mt-4 text-[11px] font-bold text-gray-400">
              ثبت‌های امروز شما: {toPersianDigits(todayCount)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── فرم ثبت ────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex items-start justify-center px-5 py-6">
      <div className="w-full max-w-sm space-y-5">
        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
            <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">
              {error}
            </p>
          </div>
        )}

        <PhoneKeypad
          value={phone}
          onChange={setPhoneSafe}
          onSubmit={submit}
          disabled={loading}
        />

        {/* رضایت پیامک */}
        <button
          type="button"
          onClick={() => setConsent((c) => !c)}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl text-right transition-all hover:border-primary-500/40"
        >
          <span
            className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
              consent ? "bg-primary-600" : "border-2 border-gray-300 dark:border-white/20"
            }`}
          >
            {consent && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 leading-relaxed">
            مشتری با دریافت پیامک تخفیف‌ها و مناسبت‌ها موافق است
          </span>
        </button>

        {/* اطلاعات تکمیلی */}
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="w-full text-[11px] font-black text-gray-400 hover:text-primary-600 transition-colors"
        >
          {showMore ? "بستن اطلاعات تکمیلی" : "افزودن نام و تاریخ تولد"}
        </button>

        {showMore && (
          <div className="space-y-3 p-4 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl">
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="نام"
                value={extra.firstName}
                onChange={(e) => setExtraField("firstName", e.target.value)}
                className="px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all"
              />
              <input
                placeholder="نام خانوادگی"
                value={extra.lastName}
                onChange={(e) => setExtraField("lastName", e.target.value)}
                className="px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2">
                تاریخ تولد (شمسی)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  inputMode="numeric"
                  placeholder="سال"
                  maxLength={4}
                  value={extra.birthYear}
                  onChange={(e) => setExtraField("birthYear", e.target.value.replace(/\D/g, ""))}
                  className="px-3 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold text-center outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all"
                />
                <select
                  value={extra.birthMonth}
                  onChange={(e) => setExtraField("birthMonth", e.target.value)}
                  className="px-2 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all"
                >
                  <option value="">ماه</option>
                  {JALALI_MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.title}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="numeric"
                  placeholder="روز"
                  maxLength={2}
                  value={extra.birthDay}
                  onChange={(e) => setExtraField("birthDay", e.target.value.replace(/\D/g, ""))}
                  className="px-3 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold text-center outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all"
                />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading || !phoneValid}
          className="w-full py-5 bg-primary-600 text-white rounded-2xl font-black text-[15px] shadow-lg shadow-primary-600/25 hover:bg-primary-700 transition-all active:scale-[0.98] disabled:opacity-30 disabled:shadow-none"
        >
          {loading ? "در حال ثبت..." : "ثبت در باشگاه"}
        </button>

        {todayCount !== null && (
          <p className="text-center text-[11px] font-bold text-gray-400">
            ثبت‌های امروز شما: {toPersianDigits(todayCount)}
          </p>
        )}
      </div>
    </div>
  );
}