"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CheckoutPaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    if (!orderId) return;

    fetch("/api/payment/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          setError(data.error ?? "خطا در اتصال به درگاه پرداخت");
          setStatus("error");
        }
      })
      .catch(() => {
        setError("خطا در اتصال به درگاه پرداخت");
        setStatus("error");
      });
  }, [orderId]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950" dir="rtl">
        <div className="max-w-sm w-full mx-4 bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-800 text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">خطا در اتصال به درگاه</h2>
            <p className="text-sm text-gray-400 mt-2">{error}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => { setStatus("loading"); setError(""); window.location.reload(); }}
              className="w-full py-3 bg-primary-600 text-white rounded-2xl font-black text-sm hover:bg-primary-700 transition-all"
            >
              تلاش مجدد
            </button>
            <button
              onClick={() => router.push(`/checkout/failed/${orderId}`)}
              className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
            >
              بازگشت
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950" dir="rtl">
      <div className="max-w-sm w-full mx-4 bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-800 text-center space-y-6">
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">در حال اتصال به درگاه پرداخت</h2>
          <p className="text-xs text-gray-400 mt-2">لطفاً صبر کنید، در حال انتقال به درگاه آقای پرداخت...</p>
        </div>
      </div>
    </div>
  );
}
