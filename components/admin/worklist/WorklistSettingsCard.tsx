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
import { WEEKDAY_LABELS, validateWorkHours, type DayHours } from "@/lib/worklist/work-hours";
import HelpButton from "./HelpButton";

const CAP_OPTIONS = [6, 8, 9, 10, 12, 14, 16];

export default function WorklistSettingsCard() {
  const [enabled, setEnabled] = useState(false);
  const [capHours, setCapHours] = useState(10);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hours, setHours] = useState<DayHours[]>([]);
  const [loyalOrders, setLoyalOrders] = useState("2");
  const [loyalSpent, setLoyalSpent] = useState("0");
  const [platforms, setPlatforms] = useState<{ key: string; label: string }[]>([]);
  const [newPlatform, setNewPlatform] = useState("");

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/worklist/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ignore || !d) return;
        setEnabled(Boolean(d.enabled));
        setCapHours(Math.round((d.dailyCapMin ?? 600) / 60));
        setHours(d.workHours ?? []);
        setLoyalOrders(String(d.loyalMinOrders ?? 2));
        setLoyalSpent(String(d.loyalMinSpent ?? "0"));
        setPlatforms(d.platforms ?? []);
        setLoaded(true);
      })
      .catch(() => {
        // بدون دسترسی: کارت اصلاً نشان داده نمی‌شود
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function save(next: {
    enabled?: boolean;
    capHours?: number;
    workHours?: DayHours[];
    loyalMinOrders?: string;
    loyalMinSpent?: string;
    platforms?: { key: string; label: string }[];
  }) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        enabled: next.enabled ?? enabled,
        dailyCapMin: (next.capHours ?? capHours) * 60,
      };
      if (next.workHours) body.workHours = next.workHours;
      if (next.loyalMinOrders !== undefined) body.loyalMinOrders = next.loyalMinOrders;
      if (next.loyalMinSpent !== undefined) body.loyalMinSpent = next.loyalMinSpent;
      if (next.platforms !== undefined) body.platforms = next.platforms;
      const res = await fetch("/api/admin/worklist/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "ذخیره نشد");
      setEnabled(data.enabled);
      setCapHours(Math.round(data.dailyCapMin / 60));
      setHours(data.workHours);
      setLoyalOrders(String(data.loyalMinOrders));
      setLoyalSpent(String(data.loyalMinSpent));
      if (data.platforms) setPlatforms(data.platforms);
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
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-black text-gray-900 dark:text-white">تنظیمات کلی</h2>
        <HelpButton topic="workHours" size="sm" />
      </div>

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

      {/* ── ساعت کاری ─────────────────────────────────────────── */}
      <div>
        <span className="block text-xs font-bold text-gray-900 dark:text-white">ساعت کاری</span>
        <span className="block text-[11px] text-gray-500 mt-0.5 mb-2">
          روز تعطیل هیچ کار تکراری ساخته نمی‌شود و در صفحه‌ی حضور ساعت موظف همین است.
        </span>
        <div className="space-y-1.5">
          {hours.map((h) => (
            <div key={h.day} className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 w-28 cursor-pointer">
                <input
                  type="checkbox"
                  checked={h.open}
                  onChange={(e) =>
                    setHours((prev) => prev.map((x) => (x.day === h.day ? { ...x, open: e.target.checked } : x)))
                  }
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className={`text-xs font-bold ${h.open ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
                  {WEEKDAY_LABELS[h.day]}
                </span>
              </label>
              {h.open ? (
                <>
                  <TimeInput
                    value={h.start}
                    onChange={(v) => setHours((prev) => prev.map((x) => (x.day === h.day ? { ...x, start: v } : x)))}
                  />
                  <span className="text-[11px] text-gray-400">تا</span>
                  <TimeInput
                    value={h.end}
                    onChange={(v) => setHours((prev) => prev.map((x) => (x.day === h.day ? { ...x, end: v } : x)))}
                  />
                </>
              ) : (
                <span className="text-[11px] text-red-500">تعطیل</span>
              )}
            </div>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={() => {
            const v = validateWorkHours(hours);
            if ("error" in v) {
              setErr(v.error);
              return;
            }
            void save({ workHours: v.hours });
          }}
          className="mt-2 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
        >
          ذخیره‌ی ساعت کاری
        </button>
      </div>

      {/* ── مشتری ثابت ─────────────────────────────────────────── */}
      <div>
        <span className="block text-xs font-bold text-gray-900 dark:text-white">تعریف مشتری ثابت</span>
        <span className="block text-[11px] text-gray-500 mt-0.5 mb-2">
          قاعده‌ی «تماس با مشتری ثابتی که مدتی خرید نکرده» فقط این مشتری‌ها را انتخاب می‌کند.
          فاصله‌ی تماس روی خودِ هر قاعده تنظیم می‌شود.
        </span>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11px] text-gray-600 dark:text-gray-400">
            حداقل تعداد خرید
            <input
              inputMode="numeric"
              value={loyalOrders}
              onChange={(e) => setLoyalOrders(e.target.value.replace(/\D/g, ""))}
              className="block mt-1 w-24 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400"
            />
          </label>
          <label className="text-[11px] text-gray-600 dark:text-gray-400">
            حداقل مبلغ کل خرید (تومان، صفر یعنی بدون شرط)
            <input
              inputMode="numeric"
              value={loyalSpent}
              onChange={(e) => setLoyalSpent(e.target.value.replace(/\D/g, ""))}
              className="block mt-1 w-44 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400"
              dir="ltr"
            />
          </label>
          <button
            disabled={busy}
            onClick={() => void save({ loyalMinOrders: loyalOrders || "1", loyalMinSpent: loyalSpent || "0" })}
            className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
          >
            ذخیره
          </button>
        </div>
      </div>

      {/* ── بازارگاه‌ها ─────────────────────────────────────────── */}
      <div>
        <span className="block text-xs font-bold text-gray-900 dark:text-white">بازارگاه‌ها</span>
        <span className="block text-[11px] text-gray-500 mt-0.5 mb-2">
          خوراک فیلد «بازارگاه» در کارهایی مثل قیمت‌گذاری پنل‌ها. چون بازارگاه فیلد
          جداست نه نتیجه، گزارش «هر پنل چند روز بروز شد» جدا درمی‌آید.
        </span>

        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {platforms.map((p) => (
              <span
                key={p.key}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-700 dark:text-gray-300"
              >
                {p.label}
                <button
                  disabled={busy}
                  onClick={() => {
                    const next = platforms.filter((x) => x.key !== p.key);
                    setPlatforms(next);
                    void save({ platforms: next });
                  }}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                  title="حذف"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11px] text-gray-600 dark:text-gray-400">
            نام بازارگاه تازه
            <input
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              placeholder="مثلاً دیجی‌کالا"
              className="block mt-1 w-44 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400"
            />
          </label>
          <button
            disabled={busy || !newPlatform.trim()}
            onClick={() => {
              const label = newPlatform.trim();
              // کلید از نام ساخته می‌شود و بعدش دست نمی‌خورد؛ اسم فارسی کلید
              // بی‌ضرر است چون کلید فقط شناسه‌ی داخلی فهرست است.
              const key = label.replace(/\s+/g, "-").toLowerCase();
              if (platforms.some((p) => p.key === key || p.label === label)) {
                setNewPlatform("");
                return;
              }
              const next = [...platforms, { key, label }];
              setPlatforms(next);
              setNewPlatform("");
              void save({ platforms: next });
            }}
            className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
          >
            افزودن
          </button>
        </div>

        <p className="text-[11px] text-gray-400 mt-2">
          حذف یک بازارگاه، کارهای ثبت‌شده‌ی قبلی را عوض نمی‌کند — نام روی خودِ کار
          ذخیره شده است.
        </p>
      </div>

      {msg && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{msg}</p>}
      {err && <p className="text-[11px] text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400"
      dir="ltr"
    />
  );
}
