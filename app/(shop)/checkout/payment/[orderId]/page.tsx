"use client";
// صفحه mock درگاه پرداخت — تا اتصال درگاه واقعی
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function MockPaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  async function handleSuccess() {
    setProcessing(true);
    // TODO: در اینجا callback درگاه واقعی پردازش میشه
    await fetch(`/api/checkout/${orderId}/verify`, { method: "POST" }).catch(() => {});
    router.push(`/checkout/success/${orderId}`);
  }

  async function handleFail() {
    router.push(`/checkout/failed/${orderId}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950" dir="rtl">
      <div className="max-w-sm w-full mx-4 bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-800 text-center space-y-6">
        <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">درگاه پرداخت</h2>
          <p className="text-xs text-gray-400 mt-2">این صفحه موقتی است — درگاه واقعی به‌زودی متصل می‌شود</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">محیط آزمایشی — شبیه‌سازی نتیجه پرداخت</p>
        </div>
        <div className="space-y-3">
          <button onClick={handleSuccess} disabled={processing}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm hover:bg-emerald-600 transition-all disabled:opacity-60">
            {processing ? "در حال پردازش..." : "✅ شبیه‌سازی پرداخت موفق"}
          </button>
          <button onClick={handleFail} disabled={processing}
            className="w-full py-4 bg-red-50 dark:bg-red-900/20 text-secondary-500 border border-red-200 dark:border-red-800 rounded-2xl font-black text-sm hover:bg-red-100 transition-all disabled:opacity-60">
            ❌ شبیه‌سازی پرداخت ناموفق
          </button>
        </div>
      </div>
    </div>
  );
}
