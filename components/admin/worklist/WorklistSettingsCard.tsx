"use client";

/**
 * دو تنظیمِ کلیِ کارتابل که تا فاز ۵ فقط با دستکاری مستقیم دیتابیس عوض می‌شدند.
 *
 * **سقف حضور روزانه** لازم است چون بیشتر از آن یعنی کارمند یادش رفته خروج
 * بزند، نه اینکه کار کرده. عددِ درست برای هر مجموعه فرق می‌کند، پس در کد نیست.
 *
 * **کلید کارتابل** پیش‌فرض خاموش است تا فروشگاه‌های دیگر با دیپلوی بعدی منوی
 * تازه نبینند. اینجا بودنش یعنی روز راه‌اندازی کسی مجبور نیست به دیتابیس بزند.
 */

import { useEffect, useState } from "react";

const CAP_OPTIONS = [6, 8, 9, 10, 12, 14, 16];

export default function WorklistSettingsCard() {
  const [enabled, setEnabled] = useState(false);
  const [capHours, setCapHours] = useState(10);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/worklist/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ignore || !d) return;
        setEnabled(Boolean(d.enabled));
        setCapHours(Math.round((d.dailyCapMin ?? 600) / 60));
        setLoaded(true);
      })
      .catch(() => {
        // بدون دسترسی: کارت اصلاً نشان داده نمی‌شود
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function save(next: { enabled?: boolean; capHours?: number }) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/worklist/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next.enabled ?? enabled,
          dailyCapMin: (next.capHours ?? capHours) * 60,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "ذخیره نشد");
      setEnabled(data.enabled);
      setCapHours(Math.round(data.dailyCapMin / 60));
      setMsg("ذخیره شد");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-4 mb-5 space-y-4">
      <h2 className="text-xs font-black text-gray-900 dark:text-white">تنظیمات کلی</h2>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => {
            setEnabled(e.target.checked);
            void save({ enabled: e.target.checked });
          }}
          className="mt-0.5 w-4 h-4 rounded accent-blue-500"
        />
        <span>
          <span className="block text-xs font-bold text-gray-900 dark:text-white">
            کارتابل روشن باشد
          </span>
          <span className="block text-[11px] text-gray-500 mt-0.5">
            با خاموش‌بودن، کارهای تکرارشونده ساخته نمی‌شوند و حضور هم ثبت نمی‌شود.
          </span>
        </span>
      </label>

      <div>
        <span className="block text-xs font-bold text-gray-900 dark:text-white">
          سقف حضور روزانه
        </span>
        <span className="block text-[11px] text-gray-500 mt-0.5 mb-2">
          بیشتر از این در یک روز ثبت نمی‌شود. عددِ بزرگ‌تر معمولاً یعنی کارمند یادش
          رفته خروج بزند.
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {CAP_OPTIONS.map((h) => (
            <button
              key={h}
              disabled={busy}
              onClick={() => {
                setCapHours(h);
                void save({ capHours: h });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-40 ${
                capHours === h
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {String(h).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)])} ساعت
            </button>
          ))}
        </div>
      </div>

      {msg && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{msg}</p>}
      {err && <p className="text-[11px] text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}
