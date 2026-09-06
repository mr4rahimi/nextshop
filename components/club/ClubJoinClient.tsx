"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * عضویت عمومی در باشگاه — مقصد QR فروش حضوری
 *
 * سه مرحله: شماره → کد پیامکی → نتیجه. عمداً کوتاه است؛ هر فیلد اضافه روی
 * پیشخوان فروشگاه یعنی درصدی از مشتری‌ها نیمه‌کاره رها می‌کنند.
 */

function toFa(n: number | string) {
  return Number(n).toLocaleString("fa-IR");
}

type Step = "phone" | "code" | "done";

export default function ClubJoinClient({
  enabled,
  clubName,
  storeName,
  signupPoints,
  consentPoints,
}: {
  enabled: boolean;
  clubName: string | null;
  storeName: string | null;
  signupPoints: number;
  consentPoints: number;
}) {
  const params = useSearchParams();
  const via = params.get("via");

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  // ⚠️ پیش‌فرض خاموش — تیکِ از پیش‌خورده رضایت معتبر نیست
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ consentGiven: boolean; pointsGranted: number } | null>(null);

  const title = clubName || `باشگاه مشتریان${storeName ? ` ${storeName}` : ""}`;
  const totalPoints = signupPoints + (consent ? consentPoints : 0);

  async function submit(action: "send" | "verify") {
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/club/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "send"
            ? { phone }
            : { phone, code, firstName, consent, via, action: "verify" }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "خطایی رخ داد");
        return;
      }

      if (action === "send") {
        setStep("code");
      } else {
        setResult({
          consentGiven: Boolean(data.consentGiven),
          pointsGranted: Number(data.pointsGranted) || 0,
        });
        setStep("done");
      }
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <section className="py-24" dir="rtl">
        <div className="container max-w-md text-center">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            باشگاه مشتریان در حال حاضر فعال نیست.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 md:py-20" dir="rtl">
      <div className="container max-w-md">
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 space-y-6">
          <header className="text-center space-y-2">
            <h1 className="text-xl font-black text-gray-900 dark:text-white">{title}</h1>
            {step !== "done" && (
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
                عضو شوید و از تخفیف‌ها، جشنواره‌ها و هدیه‌ی تولد باخبر بمانید.
                {totalPoints > 0 && (
                  <span className="block mt-2 text-amber-600 dark:text-amber-400">
                    همین حالا {toFa(totalPoints)} امتیاز می‌گیرید
                  </span>
                )}
              </p>
            )}
          </header>

          {step === "phone" && (
            <div className="space-y-4">
              <Input
                label="شماره موبایل"
                value={phone}
                onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 11))}
                placeholder="09xxxxxxxxx"
                dir="ltr"
                inputMode="numeric"
              />

              <Input
                label="نام (اختیاری)"
                value={firstName}
                onChange={setFirstName}
                placeholder="برای اینکه شما را به نام صدا کنیم"
              />

              <ConsentBox
                checked={consent}
                onChange={setConsent}
                points={consentPoints}
              />

              <Button
                busy={busy}
                disabled={!/^09\d{9}$/.test(phone)}
                onClick={() => submit("send")}
              >
                دریافت کد تأیید
              </Button>
            </div>
          )}

          {step === "code" && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 text-center">
                کد چهاررقمی به {toFa(phone)} پیامک شد
              </p>

              <Input
                label="کد تأیید"
                value={code}
                onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 4))}
                placeholder="- - - -"
                dir="ltr"
                inputMode="numeric"
              />

              <Button busy={busy} disabled={code.length < 4} onClick={() => submit("verify")}>
                تأیید و عضویت
              </Button>

              <button
                type="button"
                onClick={() => { setStep("phone"); setCode(""); setError(""); }}
                className="w-full text-[11px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                تغییر شماره
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <p className="text-sm font-black text-gray-900 dark:text-white">
                عضویت شما ثبت شد
              </p>

              {result && result.pointsGranted > 0 && (
                <p className="text-xs font-black text-amber-600 dark:text-amber-400">
                  {toFa(result.pointsGranted)} امتیاز به حساب شما اضافه شد
                </p>
              )}

              <p className="text-[11px] font-bold text-gray-400 leading-relaxed">
                {result?.consentGiven
                  ? "از این پس تخفیف‌ها و جشنواره‌ها را برایتان می‌فرستیم. هر زمان بخواهید می‌توانید لغو کنید."
                  : "برای دیدن امتیاز و سطح عضویت، با همین شماره وارد سایت شوید."}
              </p>

              <a
                href="/user/club"
                className="block w-full py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black transition-opacity hover:opacity-90"
              >
                ورود به پنل باشگاه
              </a>
            </div>
          )}

          {error && (
            <p className="text-[11px] font-black text-red-500 text-center leading-relaxed">{error}</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── اجزای کوچک ────────────────────────────────────────────────────

function Input({
  label, value, onChange, placeholder, dir, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black text-gray-500 mb-2">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        inputMode={inputMode}
        className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary-500 transition-colors"
      />
    </label>
  );
}

function ConsentBox({
  checked, onChange, points,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  points: number;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 shrink-0 accent-primary-600 cursor-pointer"
      />
      <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
        از تخفیف‌ها و جشنواره‌ها باخبرم کنید
        {points > 0 && (
          <span className="text-amber-600 dark:text-amber-400"> (+{toFa(points)} امتیاز)</span>
        )}
        <span className="block text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
          هر زمان بخواهید می‌توانید لغو کنید.
        </span>
      </span>
    </label>
  );
}

function Button({
  children, onClick, busy, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="w-full py-3 rounded-2xl bg-primary-600 text-white text-xs font-black disabled:opacity-40 transition-opacity hover:opacity-90"
    >
      {busy ? "..." : children}
    </button>
  );
}
