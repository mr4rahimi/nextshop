"use client";

import { useEffect, useState } from "react";

interface Settings {
  clubEnabled: boolean;
  clubName: string | null;
  smsLineNumber: string | null;
  smsMarketingLine: string | null;
  smsAllowedHourStart: number;
  smsAllowedHourEnd: number;
  smsMonthlyCapPerUser: number;
  smsOptOutText: string | null;
  pointPerToman: number;
  pointExpiryDays: number;
  storeName: string | null;
}

function toFa(n: number | string) {
  return Number(n).toLocaleString("fa-IR");
}

export default function ClubSettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [balance, setBalance] = useState<{ amount: number; count?: number } | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    const res = await fetch("/api/admin/club/settings");
    const d = await res.json();
    setS(d.settings);
    setBalance(d.balance);
    setBalanceError(d.balanceError);
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

      {/* اعتبار پنل */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white">اعتبار پنل پیامک</h2>
            {balanceError ? (
              <p className="text-[11px] font-bold text-red-500 mt-1.5">{balanceError}</p>
            ) : (
              <p className="text-[11px] font-bold text-gray-400 mt-1.5">
                حدود {toFa(balance?.count ?? 0)} پیامک باقی‌مانده
              </p>
            )}
          </div>
          <div className="text-left">
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
              {balance ? toFa(balance.amount) : "—"}
            </p>
            <button
              onClick={load}
              className="text-[10px] font-black text-primary-600 hover:underline"
            >
              بروزرسانی
            </button>
          </div>
        </div>
      </Card>

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