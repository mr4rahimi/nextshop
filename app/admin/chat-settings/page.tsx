"use client";

import { useEffect, useState } from "react";
import ChatFlowEditor from "@/components/admin/ChatFlowEditor";
import { FlowNode } from "@/lib/chat-flow";

// ── انواع داده ──────────────────────────────────────────────────────────────
interface FaqItem {
  question: string;
  answer: string;
}

interface ChatSettings {
  phone: string;
  email: string;
  address: string;
  workingHours: string;
  socials: {
    instagram: string;
    telegram: string;
    whatsapp: string;
  };
  shippingInfo: string;
  shippingCost: string;
  warrantyInfo: string;
  aboutBusiness: string;
  welcomeMessage: string;
  isEnabled: boolean;
  historyLimit: number;
  faq: FaqItem[];
  flow: FlowNode[];
}

const DEFAULTS: ChatSettings = {
  phone: "",
  email: "",
  address: "",
  workingHours: "",
  socials: { instagram: "", telegram: "", whatsapp: "" },
  shippingInfo: "",
  shippingCost: "",
  warrantyInfo: "",
  aboutBusiness: "",
  welcomeMessage: "سلام! من دستیار خرید این فروشگاه هستم. چطور می‌تونم کمکت کنم؟",
  isEnabled: true,
  historyLimit: 4,
  faq: [],
  flow: [],
};

// ── کامپوننت‌های فرم کوچک ──────────────────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-black text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all";

// ── صفحه اصلی ──────────────────────────────────────────────────────────────────
export default function ChatSettingsPage() {
  const [settings, setSettings] = useState<ChatSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/chat-settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({ ...DEFAULTS, ...data, socials: { ...DEFAULTS.socials, ...data.socials } });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/admin/chat-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // ── کمک‌کننده‌های FAQ ──────────────────────────────────────────────────────
  function addFaq() {
    setSettings((p) => ({ ...p, faq: [...p.faq, { question: "", answer: "" }] }));
  }
  function updateFaq(i: number, key: keyof FaqItem, value: string) {
    setSettings((p) => {
      const faq = [...p.faq];
      faq[i] = { ...faq[i], [key]: value };
      return { ...p, faq };
    });
  }
  function removeFaq(i: number) {
    setSettings((p) => ({ ...p, faq: p.faq.filter((_, idx) => idx !== i) }));
  }

  if (loading)
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-white dark:bg-[#0f1117] rounded-2xl animate-pulse" />
        ))}
      </div>
    );

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      {/* هدر */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">تنظیمات چت هوشمند</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            اطلاعات کسب‌وکار که دستیار هوشمند برای پاسخ به مشتریان استفاده می‌کند
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* فعال/غیرفعال */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-black text-gray-600 dark:text-gray-300">
              {settings.isEnabled ? "فعال" : "غیرفعال"}
            </span>
            <button
              onClick={() => setSettings((p) => ({ ...p, isEnabled: !p.isEnabled }))}
              className={`relative w-11 h-6 rounded-full transition-all ${
                settings.isEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  settings.isEnabled ? "right-0.5" : "left-0.5"
                }`}
              />
            </button>
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${
              saved
                ? "bg-emerald-600 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow shadow-blue-500/20"
            } disabled:opacity-50`}
          >
            {saving ? "در حال ذخیره..." : saved ? "✓ ذخیره شد" : "ذخیره تغییرات"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* پیام خوش‌آمد */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
          <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">پیام خوش‌آمدگویی</h2>
          <Field label="اولین پیامی که کاربر هنگام باز کردن چت می‌بیند">
            <textarea
              value={settings.welcomeMessage}
              onChange={(e) => setSettings((p) => ({ ...p, welcomeMessage: e.target.value }))}
              rows={3}
              className={inputClass}
            />
          </Field>
        </div>

        {/* تنظیمات تاریخچه */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
          <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">حافظه‌ی گفتگو</h2>
          <Field
            label="تعداد پیام‌های تاریخچه"
            hint="چند پیام آخر همراه هر سوال به هوش مصنوعی ارسال شود"
          >
            <input
              type="number"
              min={0}
              max={20}
              value={settings.historyLimit}
              onChange={(e) =>
                setSettings((p) => ({ ...p, historyLimit: Math.max(0, Number(e.target.value) || 0) }))
              }
              className={inputClass}
            />
          </Field>
          <div className="mt-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-bold leading-6">
            ⚠ هرچه این عدد بیشتر باشد، توکن بیشتری مصرف می‌شود و طول پیام ارسالی افزایش می‌یابد.
            مقدار پیشنهادی: ۴ تا ۶
          </div>
        </div>

        {/* اطلاعات تماس */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">اطلاعات تماس</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="تلفن">
              <input
                value={settings.phone}
                onChange={(e) => setSettings((p) => ({ ...p, phone: e.target.value }))}
                className={inputClass}
                placeholder="021-12345678"
              />
            </Field>
            <Field label="ایمیل">
              <input
                value={settings.email}
                onChange={(e) => setSettings((p) => ({ ...p, email: e.target.value }))}
                className={inputClass}
                dir="ltr"
                placeholder="info@shop.com"
              />
            </Field>
          </div>
          <Field label="آدرس">
            <input
              value={settings.address}
              onChange={(e) => setSettings((p) => ({ ...p, address: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="ساعات کاری">
            <input
              value={settings.workingHours}
              onChange={(e) => setSettings((p) => ({ ...p, workingHours: e.target.value }))}
              className={inputClass}
              placeholder="شنبه تا پنجشنبه ۹ تا ۱۸"
            />
          </Field>
        </div>

        {/* شبکه‌های اجتماعی */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">شبکه‌های اجتماعی</h2>
          <Field label="اینستاگرام">
            <input
              value={settings.socials.instagram}
              onChange={(e) =>
                setSettings((p) => ({ ...p, socials: { ...p.socials, instagram: e.target.value } }))
              }
              className={inputClass}
              dir="ltr"
              placeholder="@username"
            />
          </Field>
          <Field label="تلگرام">
            <input
              value={settings.socials.telegram}
              onChange={(e) =>
                setSettings((p) => ({ ...p, socials: { ...p.socials, telegram: e.target.value } }))
              }
              className={inputClass}
              dir="ltr"
              placeholder="@username"
            />
          </Field>
          <Field label="واتساپ">
            <input
              value={settings.socials.whatsapp}
              onChange={(e) =>
                setSettings((p) => ({ ...p, socials: { ...p.socials, whatsapp: e.target.value } }))
              }
              className={inputClass}
              dir="ltr"
              placeholder="09123456789"
            />
          </Field>
        </div>

        {/* ارسال و گارانتی */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">ارسال و گارانتی</h2>
          <Field label="روش‌های ارسال" hint="مثلاً: پست پیشتاز، تیپاکس، پیک موتوری">
            <textarea
              value={settings.shippingInfo}
              onChange={(e) => setSettings((p) => ({ ...p, shippingInfo: e.target.value }))}
              rows={2}
              className={inputClass}
            />
          </Field>
          <Field label="هزینه‌های ارسال" hint="مثلاً: تهران ۵۰ هزار تومان، شهرستان ۸۰ هزار تومان">
            <textarea
              value={settings.shippingCost}
              onChange={(e) => setSettings((p) => ({ ...p, shippingCost: e.target.value }))}
              rows={2}
              className={inputClass}
            />
          </Field>
          <Field label="اطلاعات گارانتی">
            <textarea
              value={settings.warrantyInfo}
              onChange={(e) => setSettings((p) => ({ ...p, warrantyInfo: e.target.value }))}
              rows={2}
              className={inputClass}
            />
          </Field>
        </div>

        {/* درباره کسب‌وکار */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 xl:col-span-2">
          <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">درباره کسب‌وکار</h2>
          <Field
            label="اطلاعات کلی"
            hint="هر اطلاعات دیگری که می‌خواهید دستیار درباره فروشگاه شما بداند"
          >
            <textarea
              value={settings.aboutBusiness}
              onChange={(e) => setSettings((p) => ({ ...p, aboutBusiness: e.target.value }))}
              rows={4}
              className={inputClass}
            />
          </Field>
        </div>

        {/* سوالات متداول */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">سوالات متداول</h2>
            <button
              onClick={addFaq}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
            >
              + افزودن سوال
            </button>
          </div>

          {settings.faq.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">
              هنوز سوالی اضافه نشده. روی «افزودن سوال» کلیک کنید.
            </p>
          ) : (
            <div className="space-y-3">
              {settings.faq.map((item, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-black text-gray-400 mt-2.5">{i + 1}</span>
                    <div className="flex-1 space-y-2">
                      <input
                        value={item.question}
                        onChange={(e) => updateFaq(i, "question", e.target.value)}
                        className={inputClass}
                        placeholder="سوال..."
                      />
                      <textarea
                        value={item.answer}
                        onChange={(e) => updateFaq(i, "answer", e.target.value)}
                        rows={2}
                        className={inputClass}
                        placeholder="پاسخ..."
                      />
                    </div>
                    <button
                      onClick={() => removeFaq(i)}
                      className="text-red-400 hover:text-red-600 transition-all mt-2"
                      title="حذف"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* درخت دکمه‌های هدایت‌گر */}
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 xl:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              دکمه‌های هدایت‌گر چت
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              مسیری که کاربر بعد از باز کردن چت طی می‌کند. هر دکمه می‌تواند زیردکمه داشته باشد
              یا مستقیم به یک موضوع وصل شود.
            </p>
          </div>
         
          <ChatFlowEditor
            value={settings.flow}
            welcomeMessage={settings.welcomeMessage}
            onChange={(flow) => setSettings((p) => ({ ...p, flow }))}
          />
        </div>
      </div>
    </div>
  );
}