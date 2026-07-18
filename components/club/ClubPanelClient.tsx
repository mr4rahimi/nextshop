"use client";

import { useEffect, useState } from "react";
import { JALALI_MONTH_OPTIONS, jalaliMonthName } from "@/lib/club/jalali";
import { toPersianDigits } from "@/lib/club/phone";

interface Profile {
  clubName: string;
  clubEnabled: boolean;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  joinedAt: string;
  source: string;
  smsConsent: boolean;
  birth: { year: number; month: number; day: number } | null;
  points: number;
  tier: { title: string; color: string | null } | null;
  stats: {
    orderCount: number;
    totalSpent: string;
    lastPurchaseAt: string | null;
  };
}

const SOURCE_LABELS: Record<string, string> = {
  ONLINE: "ثبت‌نام در سایت",
  IN_STORE: "عضویت حضوری",
  CALLER_ID: "تماس تلفنی",
  IMPORT: "افزوده‌شده توسط فروشگاه",
  MARKETPLACE: "خرید از مارکت‌پلیس",
};

export default function ClubPanelClient() {
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
  });

  async function load() {
    try {
      const res = await fetch("/api/club/profile");
      if (!res.ok) throw new Error();
      const d: Profile = await res.json();
      setData(d);
      setForm({
        firstName: d.firstName ?? "",
        lastName: d.lastName ?? "",
        birthYear: d.birth ? String(d.birth.year) : "",
        birthMonth: d.birth ? String(d.birth.month) : "",
        birthDay: d.birth ? String(d.birth.day) : "",
      });
    } catch {
      setMessage({ text: "اطلاعات بارگذاری نشد", ok: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/club/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          birthYear: form.birthYear || null,
          birthMonth: form.birthMonth || null,
          birthDay: form.birthDay || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMessage({ text: d.error ?? "ذخیره نشد", ok: false });
        return;
      }
      setMessage({ text: "ذخیره شد", ok: true });
      await load();
    } catch {
      setMessage({ text: "ارتباط با سرور برقرار نشد", ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function toggleConsent(next: boolean) {
    setData((d) => (d ? { ...d, smsConsent: next } : d)); // خوش‌بینانه
    try {
      const res = await fetch("/api/club/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsConsent: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setData((d) => (d ? { ...d, smsConsent: !next } : d)); // بازگردانی
      setMessage({ text: "تغییر ثبت نشد", ok: false });
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-100 dark:bg-white/5 rounded-3xl" />
          <div className="h-48 bg-gray-100 dark:bg-white/5 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <p className="text-sm font-bold text-gray-500">
          اطلاعات باشگاه در دسترس نیست
        </p>
      </div>
    );
  }

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ");

  return (
    <div dir="rtl" className="max-w-2xl mx-auto px-5 py-10 space-y-5">
      {/* کارت عضویت */}
      <section className="relative overflow-hidden rounded-3xl bg-primary-600 text-white p-6">
        <div className="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -left-4 -bottom-16 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative">
          <p className="text-[11px] font-bold text-white/70">{data.clubName}</p>
          <h1 className="text-xl font-black mt-1">
            {fullName || "عضو باشگاه"}
          </h1>
          <p className="text-sm font-black text-white/80 mt-1 tabular-nums" dir="ltr">
            {toPersianDigits(data.phone)}
          </p>

          <div className="flex items-end justify-between mt-6">
            <div>
              <p className="text-[10px] font-bold text-white/60">امتیاز شما</p>
              <p className="text-3xl font-black tabular-nums">
                {toPersianDigits(data.points)}
              </p>
            </div>
            {data.tier && (
              <span className="px-3 py-1.5 rounded-xl bg-white/15 text-[11px] font-black">
                {data.tier.title}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* آمار */}
      <section className="grid grid-cols-2 gap-3">
        <Stat label="تعداد خرید" value={toPersianDigits(data.stats.orderCount)} />
        <Stat
          label="نحوه عضویت"
          value={SOURCE_LABELS[data.source] ?? data.source}
          small
        />
      </section>

      {message && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-bold text-center ${
            message.ok
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* اطلاعات شخصی */}
      <section className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-3xl p-5 space-y-4">
        <h2 className="text-sm font-black text-gray-900 dark:text-white">
          اطلاعات شما
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="نام"
            value={form.firstName}
            onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
          />
          <Field
            label="نام خانوادگی"
            value={form.lastName}
            onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-2">
            تاریخ تولد
            <span className="font-bold text-gray-400 mr-1.5">
              — برای دریافت هدیه تولد
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              inputMode="numeric"
              placeholder="سال"
              maxLength={4}
              value={form.birthYear}
              onChange={(e) =>
                setForm((f) => ({ ...f, birthYear: e.target.value.replace(/\D/g, "") }))
              }
              className={inputClass}
            />
            <select
              value={form.birthMonth}
              onChange={(e) => setForm((f) => ({ ...f, birthMonth: e.target.value }))}
              className={inputClass}
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
              value={form.birthDay}
              onChange={(e) =>
                setForm((f) => ({ ...f, birthDay: e.target.value.replace(/\D/g, "") }))
              }
              className={inputClass}
            />
          </div>
          {data.birth && (
            <p className="text-[10px] font-bold text-gray-400 mt-2">
              ثبت‌شده: {toPersianDigits(data.birth.day)}{" "}
              {jalaliMonthName(data.birth.month)} {toPersianDigits(data.birth.year)}
            </p>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3.5 bg-primary-600 text-white rounded-2xl font-black text-sm hover:bg-primary-700 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
        </button>
      </section>

      {/* تنظیمات پیامک */}
      <section className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-3xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              دریافت پیامک تخفیف‌ها
            </h2>
            <p className="text-[11px] font-bold text-gray-500 mt-1.5 leading-relaxed">
              تخفیف‌های ویژه، هدیه تولد و مناسبت‌ها را پیامک می‌کنیم.
              هر زمان بخواهید می‌توانید خاموشش کنید.
            </p>
          </div>

          <button
            onClick={() => toggleConsent(!data.smsConsent)}
            role="switch"
            aria-checked={data.smsConsent}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
              data.smsConsent ? "bg-primary-600" : "bg-gray-200 dark:bg-white/10"
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                data.smsConsent ? "right-1" : "right-6"
              }`}
            />
          </button>
        </div>

        <p className="text-[10px] font-bold text-gray-400 mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
          پیامک‌های مربوط به سفارش‌ها و کد ورود همیشه ارسال می‌شوند و به این
          تنظیم ربطی ندارند.
        </p>
      </section>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold text-center outline-none focus:border-primary-500 text-gray-900 dark:text-white transition-all";

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black text-gray-500 mb-2">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} text-right`}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-4">
      <p className="text-[10px] font-bold text-gray-400">{label}</p>
      <p
        className={`font-black text-gray-900 dark:text-white mt-1 ${
          small ? "text-xs" : "text-xl tabular-nums"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
