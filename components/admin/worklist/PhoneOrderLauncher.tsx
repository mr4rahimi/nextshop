"use client";

import { useState } from "react";
import PhoneOrderForm from "@/components/admin/orders/PhoneOrderForm";

export default function PhoneOrderLauncher() {
  const [open, setOpen] = useState(true);
  const [count, setCount] = useState(0);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(true)}
        className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold"
      >
        + سفارش تلفنی تازه
      </button>
      {count > 0 && (
        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {count.toLocaleString("fa-IR")} سفارش در این نشست ثبت شد. سودشان بعد از پرداخت در «سود معاملات» می‌آید.
        </p>
      )}
      <PhoneOrderForm open={open} onClose={() => setOpen(false)} onCreated={() => setCount((c) => c + 1)} />
    </div>
  );
}
