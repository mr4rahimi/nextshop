"use client";

/**
 * راه‌اندازی حسابداری داخلی — سه قدم: چه می‌شود، سال مالی، تأیید.
 * بعد از راه‌اندازی مستقیم به «مانده‌های اول دوره» می‌رود.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatJalali, toJalali } from "@/lib/club/jalali";
import { jalaliYearBounds } from "@/lib/accounting/dates";
import { api, btn, Card, ErrorText, PageHeader } from "./ui";
import { faNum } from "@/lib/accounting/money";

interface SettingsData {
  mode: "NONE" | "HESABAN" | "INTERNAL";
  hesaban: { autoInvoice: boolean } | null;
  can: { settings: boolean };
}

export default function SetupWizard() {
  const thisYear = toJalali(new Date()).year;
  const [step, setStep] = useState(1);
  const [year, setYear] = useState(thisYear);
  const [s, setS] = useState<SettingsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SettingsData>("/api/admin/accounting/settings").then(setS).catch((e) => setError(e.message));
  }, []);

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/accounting/setup", { method: "POST", json: { jalaliYear: year } });
      window.location.href = "/admin/accounting/opening?welcome=1";
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
      setBusy(false);
    }
  }

  if (s?.mode === "INTERNAL") {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm font-bold">حسابداری داخلی قبلاً راه‌اندازی شده است.</p>
        <Link href="/admin/accounting" className={`${btn.primary} mt-4`}>
          رفتن به حسابداری
        </Link>
      </Card>
    );
  }

  const bounds = jalaliYearBounds(year);

  return (
    <div>
      <PageHeader
        title="راه‌اندازی حسابداری داخلی"
        help="accountingSetup"
        back={{ href: "/admin/accounting", label: "حسابداری" }}
      />

      <div className="flex items-center gap-2 mb-5">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-black text-gray-900 dark:text-white">با راه‌اندازی چه می‌شود؟</h2>
          <ul className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300 leading-7">
            <li>✅ یک <b>سرفصل حساب آماده‌ی فروشگاهی</b> ساخته می‌شود؛ لازم نیست چیزی از حسابداری بدانید.</li>
            <li>✅ یک <b>صندوق</b> ساخته می‌شود. حساب‌های بانکی و کارتخوان را بعداً خودتان اضافه می‌کنید.</li>
            <li>✅ بعدش موجودی نقد و بانک، و طلب و بدهی اشخاص در <b>اول سال مالی</b> را وارد می‌کنید.</li>
            <li>✅ از این به بعد هر پولی که می‌آید و می‌رود، به زبان ساده ثبت می‌شود و حساب‌ها خودشان به‌روز می‌مانند.</li>
          </ul>
          {s?.mode === "HESABAN" && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 text-xs leading-6 text-amber-800 dark:text-amber-300">
              ⚠️ الان حسابان وب حسابداری این کسب‌وکار است
              {s.hesaban?.autoInvoice ? " و فاکتور فروش خودکار به آن فرستاده می‌شود" : ""}. با راه‌اندازی حسابداری داخلی،
              <b> ارسال فاکتور به حسابان خاموش می‌شود</b> — فقط یکی از این دو منبع حساب‌ها می‌ماند.
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className={btn.primary} disabled={!s?.can.settings}>
              ادامه
            </button>
          </div>
          {s && !s.can.settings && <ErrorText>برای راه‌اندازی، مجوز «راه‌اندازی و تنظیمات حسابداری» لازم است.</ErrorText>}
        </Card>
      )}

      {step === 2 && (
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-black text-gray-900 dark:text-white">سال مالی</h2>
          <p className="text-xs text-gray-500 leading-6">
            سال مالی از اول فروردین تا آخر اسفند است. معمولاً سال جاری را انتخاب کنید؛ اگر نزدیک پایان سال هستید و می‌خواهید از
            فروردین آینده شروع کنید، سال بعد را.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[thisYear, thisYear + 1].map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-2xl border p-4 text-right transition ${
                  year === y ? "border-blue-500 ring-1 ring-blue-500 bg-blue-500/5" : "border-gray-200 dark:border-white/10"
                }`}
              >
                <p className="text-lg font-black text-gray-900 dark:text-white">{faNum(y)}</p>
                <p className="text-[11px] text-gray-500 mt-1">{y === thisYear ? "سال جاری" : "سال آینده"}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            از {formatJalali(bounds.start)} تا {formatJalali(bounds.end)}
          </p>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className={btn.soft}>
              قبلی
            </button>
            <button onClick={() => setStep(3)} className={btn.primary}>
              ادامه
            </button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-black text-gray-900 dark:text-white">تأیید</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-gray-500">سال مالی</dt>
            <dd className="font-bold">{faNum(year)}</dd>
            <dt className="text-gray-500">سرفصل حساب‌ها</dt>
            <dd className="font-bold">قالب آماده‌ی فروشگاهی</dd>
            <dt className="text-gray-500">حسابداری فعال بعد از این</dt>
            <dd className="font-bold text-blue-600">حسابداری داخلی</dd>
          </dl>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className={btn.soft} disabled={busy}>
              قبلی
            </button>
            <button onClick={activate} className={btn.primary} disabled={busy}>
              {busy ? "در حال راه‌اندازی…" : "راه‌اندازی کن"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
