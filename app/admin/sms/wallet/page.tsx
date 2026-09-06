"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SmsAccountCard from "@/components/admin/sms/SmsAccountCard";
import {
  Card,
  Button,
  ErrorBox,
  Notice,
  PageHeader,
  fa,
  apiSend,
  type ApiError,
} from "@/components/admin/sms/ui";

/** مبالغ پیشنهادی — تومان */
const PRESETS = [100_000, 300_000, 500_000, 1_000_000, 2_000_000];

export default function WalletPage() {
  return (
    <Suspense fallback={null}>
      <WalletInner />
    </Suspense>
  );
}

function WalletInner() {
  const params = useSearchParams();
  const justCharged = params.get("charged") === "1";

  const [amount, setAmount] = useState(300_000);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const finalAmount = custom.trim() ? Number(custom.replace(/\D/g, "")) : amount;

  async function charge() {
    setBusy(true);
    setErr(null);

    const res = await apiSend<{ payUrl: string }>("/api/admin/sms/wallet/charge", "POST", {
      amount: finalAmount,
    });

    if (!res.ok) {
      setErr(res.err);
      setBusy(false);
      return;
    }

    // درگاه در همین تب باز می‌شود؛ بعد از پرداخت به همین صفحه برمی‌گردد
    window.location.href = res.data.payUrl;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="خرید اعتبار پیامک"
        hint="کیف پول پنل ایران‌پیامک را از همین‌جا شارژ کنید — بدون ورود جداگانه به پنل"
      />

      {justCharged && (
        <Notice
          ok
          text="از درگاه بازگشتید. اگر پرداخت موفق بوده، اعتبار جدید با «بروزرسانی» روی کارت بالا دیده می‌شود."
        />
      )}

      <SmsAccountCard />

      <Card title="مبلغ شارژ" hint="مبلغ به تومان است">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border ${
                !custom.trim() && amount === p
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-400"
              }`}
            >
              {fa(p)} تومان
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-[11px] font-black text-gray-600 dark:text-gray-300">
            یا مبلغ دلخواه
          </span>
          <input
            dir="ltr"
            inputMode="numeric"
            value={custom ? fa(custom.replace(/\D/g, "")) : ""}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="مثلاً ۷۵۰۰۰۰"
            className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-black text-gray-900 dark:text-white outline-none focus:border-primary-500 tabular-nums"
          />
        </label>

        <ErrorBox err={err} />

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs font-bold text-gray-500">
            مبلغ نهایی:{" "}
            <span className="text-gray-900 dark:text-white font-black tabular-nums">
              {fa(finalAmount)} تومان
            </span>
          </p>
          <Button onClick={charge} disabled={busy || finalAmount < 10_000}>
            {busy ? "در حال انتقال به درگاه..." : "پرداخت"}
          </Button>
        </div>

        <p className="text-[10px] font-bold text-gray-400 leading-relaxed pt-1">
          پرداخت روی درگاه ایران‌پیامک انجام می‌شود و مبلغ به کیف پول همان پنل می‌نشیند.
          خرید پکیج‌های پیامکی فعلاً فقط از خود پنل ممکن است.
        </p>
      </Card>
    </div>
  );
}
