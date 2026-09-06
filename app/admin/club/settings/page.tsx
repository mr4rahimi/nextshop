"use client";

import { useEffect, useState } from "react";
import SmsAccountCard from "@/components/admin/sms/SmsAccountCard";

interface Settings {
  clubEnabled: boolean;
  clubName: string | null;
  smsLineNumber: string | null;
  smsMarketingLine: string | null;
  smsAllowedHourStart: number;
  smsAllowedHourEnd: number;
  smsMonthlyCapPerUser: number;
  smsOptOutText: string | null;
  smsOptInText: string | null;
  pointPerToman: number;
  pointExpiryDays: number;
  pointOnSignup: number;
  pointOnBirthday: number;
  pointOnReview: number;
  pointOnConsent: number;
  pointOnReferrer: number;
  pointOnReferee: number;
  pointRedeemEnabled: boolean;
  pointRedeemRate: number;
  pointRedeemMin: number;
  pointRedeemMaxPct: number;
  channelPriority: string[];
  storeName: string | null;
}

const CHANNEL_FA: Record<string, string> = {
  SMS: "پیامک",
  BALE: "بله",
  TELEGRAM: "تلگرام",
};

function toFa(n: number | string) {
  return Number(n).toLocaleString("fa-IR");
}

export default function ClubSettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    const res = await fetch("/api/admin/club/settings");
    const d = await res.json();
    setS(d.settings);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
    setMsg(null);
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/club/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg({ text: d.error ?? "ذخیره نشد", ok: false });
        return;
      }
      setS(d.settings);
      setMsg({ text: "تنظیمات ذخیره شد", ok: true });
    } catch {
      setMsg({ text: "ارتباط با سرور برقرار نشد", ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !s) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const marketingMissing = !s.smsMarketingLine;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            تنظیمات باشگاه مشتریان
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            خطوط پیامک، قوانین ارسال و امتیازدهی
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-black hover:bg-primary-700 transition-all disabled:opacity-50"
        >
          {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
        </button>
      </div>

      {msg && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-bold text-center ${
            msg.ok
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
              : "bg-red-50 dark:bg-red-900/20 text-red-600"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* اعتبار پنل — کارت مشترک با /admin/sms */}
      <SmsAccountCard compact />

      {/* عمومی */}
      <Card title="عمومی">
        <Toggle
          label="باشگاه مشتریان فعال باشد"
          hint="با خاموش کردن، پیامک‌های خودکار و کمپین‌ها متوقف می‌شوند"
          checked={s.clubEnabled}
          onChange={(v) => set("clubEnabled", v)}
        />
        <Field
          label="نام باشگاه"
          hint="در پنل مشتری و کارت عضویت نمایش داده می‌شود"
          value={s.clubName ?? ""}
          onChange={(v) => set("clubName", v)}
          placeholder="باشگاه مشتریان"
        />
      </Card>

      {/* خطوط */}
      <Card title="خطوط پیامک">
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <p className="text-[10px] font-black text-gray-500 mb-1">خط خدماتی</p>
          <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums" dir="ltr">
            {s.smsLineNumber ?? "—"}
          </p>
          <p className="text-[10px] font-bold text-gray-400 mt-2 leading-relaxed">
            برای کد ورود، وضعیت سفارش و پیامک‌های خودکار. از تنظیمات فروشگاه قابل تغییر است.
            روی این خط فقط ارسال با <span className="font-black">پترن</span> فوری انجام می‌شود.
          </p>
        </div>

        <Field
          label="خط تبلیغاتی"
          hint="برای کمپین‌ها. بدون این، ارسال کمپین ممکن نیست."
          value={s.smsMarketingLine ?? ""}
          onChange={(v) => set("smsMarketingLine", v)}
          placeholder="مثلاً 50002178584001"
          dir="ltr"
          warn={marketingMissing}
        />

        {marketingMissing && (
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
              خط تبلیغاتی ثبت نشده است. ارسال کمپین با خط خدماتی انجام نمی‌شود چون
              ریسک مسدود شدن آن خط را دارد.
            </p>
          </div>
        )}
      </Card>

      {/* قوانین ارسال */}
      <Card title="قوانین ارسال تبلیغاتی">
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="ساعت شروع مجاز"
            value={s.smsAllowedHourStart}
            min={0}
            max={23}
            onChange={(v) => set("smsAllowedHourStart", v)}
          />
          <NumberField
            label="ساعت پایان مجاز"
            value={s.smsAllowedHourEnd}
            min={1}
            max={24}
            onChange={(v) => set("smsAllowedHourEnd", v)}
          />
        </div>
        <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
          پیام‌های تبلیغاتی خارج از این بازه به ابتدای بازه بعدی موکول می‌شوند.
          ساعت بر اساس تهران محاسبه می‌شود. پیامک‌های تراکنشی از این قانون مستثنا هستند.
        </p>

        <NumberField
          label="سقف پیامک تبلیغاتی هر مشتری در ۳۰ روز"
          hint="۰ یعنی بدون محدودیت — توصیه نمی‌شود"
          value={s.smsMonthlyCapPerUser}
          min={0}
          max={100}
          onChange={(v) => set("smsMonthlyCapPerUser", v)}
        />

        <Field
          label="متن لغو عضویت"
          hint="به انتهای پیام‌های تبلیغاتی اضافه می‌شود"
          value={s.smsOptOutText ?? ""}
          onChange={(v) => set("smsOptOutText", v)}
          placeholder="لغو۱۱"
        />

        <Field
          label="کلمه‌ی کلیدی رضایت"
          hint="مشتری این را به خط خدماتی پیامک می‌کند تا عضو شود. «۱»، «عضویت»، «بله» و «ok» همیشه پذیرفته می‌شوند."
          value={s.smsOptInText ?? ""}
          onChange={(v) => set("smsOptInText", v)}
          placeholder="عضویت"
        />
      </Card>

      {/* اولویت کانال‌ها */}
      <Card title="ترتیب کانال‌ها">
        <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
          هر عضو فقط از <b>اولین</b> کانالی که در دسترسش باشد پیام می‌گیرد، نه از
          همه — وگرنه یک نفر چند بار یک پیام می‌گیرد. کانال‌های رایگان را بالاتر
          بگذارید. پیامک همیشه آخرین پناهگاه است، حتی اگر از فهرست برداریدش.
        </p>

        <div className="space-y-2">
          {(s.channelPriority ?? ["SMS"]).map((c, i) => (
            <div
              key={c}
              className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2"
            >
              <span className="text-[10px] font-black text-gray-400 w-5">{toFa(i + 1)}</span>
              <span className="flex-1 text-[11px] font-black text-gray-700 dark:text-gray-300">
                {CHANNEL_FA[c] ?? c}
              </span>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => {
                  const next = [...s.channelPriority];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  set("channelPriority", next);
                }}
                className="px-2 py-1 rounded-lg bg-white dark:bg-white/10 text-[10px] font-black text-gray-600 dark:text-gray-300 disabled:opacity-25"
              >
                بالا
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.keys(CHANNEL_FA)
            .filter((c) => !(s.channelPriority ?? []).includes(c))
            .map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("channelPriority", [...(s.channelPriority ?? []), c])}
                className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 text-[10px] font-black text-gray-600 dark:text-gray-300"
              >
                + {CHANNEL_FA[c]}
              </button>
            ))}
        </div>
      </Card>

      {/* امتیاز */}
      <Card title="امتیازدهی">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-2">
              امتیاز به ازای هر تومان خرید
            </label>
            <input
              type="number"
              step="0.0001"
              value={s.pointPerToman}
              onChange={(e) => set("pointPerToman", Number(e.target.value))}
              className={inputCls}
              dir="ltr"
            />
            <p className="text-[10px] font-bold text-gray-400 mt-2">
              با نرخ فعلی، خرید ۱٬۰۰۰٬۰۰۰ تومانی برابر است با{" "}
              <span className="font-black text-gray-600 dark:text-gray-300">
                {toFa(Math.floor(1_000_000 * s.pointPerToman))}
              </span>{" "}
              امتیاز
            </p>
          </div>

          <NumberField
            label="انقضای امتیاز (روز)"
            hint="۰ یعنی بدون انقضا"
            value={s.pointExpiryDays}
            min={0}
            onChange={(v) => set("pointExpiryDays", v)}
          />
        </div>
      </Card>

      {/* امتیاز رویدادها */}
      <Card title="امتیاز رویدادها">
        <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
          مقدار ۰ یعنی آن رویداد امتیازی نمی‌دهد. هیچ‌کدام از این اعداد در کد ثابت
          نیست — هر کسب‌وکار مقدار خودش را تعیین می‌کند.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="امتیاز عضویت"
            hint="یک بار، هنگام پیوستن به باشگاه"
            value={s.pointOnSignup}
            min={0}
            onChange={(v) => set("pointOnSignup", v)}
          />
          <NumberField
            label="امتیاز تولد"
            hint="سالانه، در روز تولد عضو"
            value={s.pointOnBirthday}
            min={0}
            onChange={(v) => set("pointOnBirthday", v)}
          />
          <NumberField
            label="امتیاز ثبت نظر"
            hint="برای هر نظر تأییدشده روی محصول"
            value={s.pointOnReview}
            min={0}
            onChange={(v) => set("pointOnReview", v)}
          />
          <NumberField
            label="امتیاز رضایت دریافت پیام"
            hint="یک بار، وقتی عضو اجازه‌ی ارسال پیام می‌دهد"
            value={s.pointOnConsent}
            min={0}
            onChange={(v) => set("pointOnConsent", v)}
          />
          <NumberField
            label="امتیاز معرف"
            hint="به کسی که دوستش را معرفی کرده"
            value={s.pointOnReferrer}
            min={0}
            onChange={(v) => set("pointOnReferrer", v)}
          />
          <NumberField
            label="امتیاز معرفی‌شده"
            hint="به کسی که با معرفی عضو شده"
            value={s.pointOnReferee}
            min={0}
            onChange={(v) => set("pointOnReferee", v)}
          />
        </div>
      </Card>

      {/* خرج کردن امتیاز */}
      <Card title="استفاده از امتیاز">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={s.pointRedeemEnabled}
            onChange={(e) => set("pointRedeemEnabled", e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary-600"
          />
          <span>
            <span className="block text-xs font-black text-gray-800 dark:text-gray-100">
              مشتری بتواند امتیازش را خرج کند
            </span>
            <span className="block text-[10px] font-bold text-gray-400 mt-1 leading-relaxed">
              بدون این، امتیاز فقط یک عدد نمایشی است و انگیزه‌ای برای مشتری نمی‌سازد
            </span>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-2">
              ارزش هر امتیاز (تومان)
            </label>
            <input
              type="number"
              step="0.1"
              min={0}
              value={s.pointRedeemRate}
              onChange={(e) => set("pointRedeemRate", Number(e.target.value))}
              className={inputCls}
              dir="ltr"
            />
            <p className="text-[10px] font-bold text-gray-400 mt-2">
              ۱۰۰۰ امتیاز ={" "}
              <span className="font-black text-gray-600 dark:text-gray-300">
                {toFa(Math.floor(1000 * s.pointRedeemRate))}
              </span>{" "}
              تومان تخفیف
            </p>
          </div>

          <NumberField
            label="حداقل امتیاز قابل استفاده"
            hint="زیر این مقدار، امتیاز قابل خرج کردن نیست"
            value={s.pointRedeemMin}
            min={0}
            onChange={(v) => set("pointRedeemMin", v)}
          />

          <NumberField
            label="سقف درصدی از سفارش"
            hint="حداکثر چند درصد مبلغ سفارش با امتیاز پرداخت شود"
            value={s.pointRedeemMaxPct}
            min={0}
            onChange={(v) => set("pointRedeemMaxPct", Math.min(v, 100))}
          />
        </div>
      </Card>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-primary-600 text-white text-sm font-black hover:bg-primary-700 transition-all disabled:opacity-50"
      >
        {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
      </button>
    </div>
  );
}

// ─── اجزا ───────────────────────────────────────────────────────────

const inputCls =
  "w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:border-primary-500 dark:text-white transition-all";

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      {title && (
        <h2 className="text-sm font-black text-gray-900 dark:text-white">{title}</h2>
      )}
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  dir,
  warn,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  warn?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black text-gray-500 mb-2">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className={`${inputCls} ${warn ? "border-amber-400" : ""}`}
      />
      {hint && <p className="text-[10px] font-bold text-gray-400 mt-2">{hint}</p>}
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black text-gray-500 mb-2">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputCls}
        dir="ltr"
      />
      {hint && <p className="text-[10px] font-bold text-gray-400 mt-2">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-start justify-between gap-4 text-right"
    >
      <div>
        <p className="text-xs font-black text-gray-900 dark:text-white">{label}</p>
        {hint && <p className="text-[10px] font-bold text-gray-400 mt-1">{hint}</p>}
      </div>
      <span
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
          checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
            checked ? "right-1" : "right-6"
          }`}
        />
      </span>
    </button>
  );
}