"use client";

/**
 * تنظیمات هوش مصنوعی — docs/features/ai-product-image.md
 * کلید GapGPT هر سایت، مدل و کیفیت پیش‌فرض تصویر، و حالت‌های آماده‌ی استودیو تصویر.
 */
import { useEffect, useState } from "react";
import HelpButton from "@/components/admin/worklist/HelpButton";
import {
  AI_IMAGE_MODELS, AI_IMAGE_QUALITIES, DEFAULT_IMAGE_PRESETS,
  type AiImagePreset, type AiImageQuality,
} from "@/lib/ai/image-presets";

interface ClientSettings {
  apiKeyMasked: string;
  keySource: "ai" | "chat" | "env" | "none";
  imageModel: string;
  imageQuality: AiImageQuality;
  imagePresets: AiImagePreset[];
}

const SOURCE_LABEL: Record<ClientSettings["keySource"], string> = {
  ai: "کلید همین صفحه",
  chat: "کلید قدیمی تنظیمات چت — بهتر است همین‌جا دوباره وارد شود",
  env: "کلید پیش‌فرض سرور",
  none: "کلیدی تنظیم نشده",
};

const card = "bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5";
const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-black text-gray-700 dark:text-gray-300">{label}</label>
      {hint && <p className="text-[10px] text-gray-400 leading-5">{hint}</p>}
      {children}
    </div>
  );
}

export default function AiSettingsPage() {
  const [s, setS] = useState<ClientSettings | null>(null);
  const [newKey, setNewKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ai-settings").then(r => r.json()).then(setS)
      .catch(() => setMsg({ ok: false, text: "خواندن تنظیمات ناموفق بود." }));
  }, []);

  async function save(extra: { clearKey?: boolean } = {}) {
    if (!s) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: newKey, ...extra,
          imageModel: s.imageModel, imageQuality: s.imageQuality, imagePresets: s.imagePresets,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `کد ${res.status}`);
      setS(body); setNewKey("");
      setMsg({ ok: true, text: "✓ ذخیره شد" });
    } catch (e) {
      setMsg({ ok: false, text: `ذخیره ناموفق: ${e instanceof Error ? e.message : "خطا"}` });
    } finally { setSaving(false); }
  }

  async function testKey() {
    setTesting(true); setMsg(null);
    try {
      const r = await (await fetch("/api/admin/ai-settings", { method: "POST" })).json();
      setMsg(r.ok
        ? { ok: true, text: r.imageModelAvailable ? "✓ اتصال برقرار است و مدل تصویر در دسترس است." : "اتصال برقرار است، ولی مدل تصویر انتخاب‌شده در حساب شما نیست." }
        : { ok: false, text: r.error });
    } catch { setMsg({ ok: false, text: "تست اتصال ناموفق بود." }); }
    finally { setTesting(false); }
  }

  function updatePreset(i: number, patch: Partial<AiImagePreset>) {
    setS(p => p && { ...p, imagePresets: p.imagePresets.map((x, j) => j === i ? { ...x, ...patch } : x) });
  }

  if (!s) {
    return (
      <div className="p-6 space-y-4">
        {msg && <p className="text-sm text-red-500">{msg.text}</p>}
        {[0, 1].map(i => <div key={i} className="h-32 bg-white dark:bg-[#0f1117] rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">تنظیمات هوش مصنوعی</h1>
            <p className="text-xs text-gray-500 mt-0.5">کلید GapGPT این سایت برای چت هوشمند و استودیو تصویر محصول</p>
          </div>
          <HelpButton topic="aiSettings" />
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs font-bold ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</span>}
          <button onClick={() => save()} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-black bg-blue-600 hover:bg-blue-700 text-white shadow shadow-blue-500/20 disabled:opacity-50 transition-all">
            {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
          </button>
        </div>
      </div>

      {/* کلید */}
      <div className={card + " space-y-4"}>
        <h2 className="text-sm font-black text-gray-900 dark:text-white">کلید GapGPT</h2>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-gray-500">کلید فعلی:</span>
          <code dir="ltr" className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300">
            {s.apiKeyMasked || "—"}
          </code>
          <span className={`px-2 py-1 rounded-lg font-bold ${s.keySource === "none" ? "bg-red-50 text-red-600 dark:bg-red-500/10" : s.keySource === "ai" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}>
            {SOURCE_LABEL[s.keySource]}
          </span>
        </div>
        <Field label="کلید تازه" hint="از پنل gapgpt.app بگیرید. خالی بگذارید تا کلید فعلی عوض نشود. کلید فقط روی سرور استفاده می‌شود و دوباره نمایش داده نمی‌شود.">
          <div className="flex gap-2">
            <input type={showKey ? "text" : "password"} value={newKey} onChange={e => setNewKey(e.target.value)}
              className={inputClass + " flex-1 font-mono text-xs"} dir="ltr" placeholder="sk-..." autoComplete="off" />
            <button type="button" onClick={() => setShowKey(v => !v)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              {showKey ? "پنهان" : "نمایش"}
            </button>
          </div>
        </Field>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={testKey} disabled={testing}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-all">
            {testing ? "در حال تست..." : "تست اتصال (کلید ذخیره‌شده)"}
          </button>
          {s.keySource === "ai" && (
            <button type="button" onClick={() => confirm("کلید این صفحه پاک شود؟") && save({ clearKey: true })}
              className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-500/20 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
              پاک کردن کلید
            </button>
          )}
        </div>
      </div>

      {/* مدل و کیفیت */}
      <div className={card + " grid grid-cols-1 sm:grid-cols-2 gap-4"}>
        <h2 className="text-sm font-black text-gray-900 dark:text-white sm:col-span-2">ساخت تصویر محصول</h2>
        <Field label="مدل" hint="فعلاً در GapGPT فقط این مدل عکس ورودی می‌گیرد.">
          <select value={s.imageModel} onChange={e => setS({ ...s, imageModel: e.target.value })} className={inputClass} dir="ltr">
            {AI_IMAGE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="کیفیت پیش‌فرض" hint="کاربر هنگام ساخت هم می‌تواند عوضش کند.">
          <select value={s.imageQuality} onChange={e => setS({ ...s, imageQuality: e.target.value as AiImageQuality })} className={inputClass}>
            {AI_IMAGE_QUALITIES.map(q => <option key={q.value} value={q.value}>{q.label} — {q.hint}</option>)}
          </select>
        </Field>
      </div>

      {/* حالت‌های آماده */}
      <div className={card + " space-y-4"}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white">حالت‌های آماده</h2>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-5">
              دکمه‌هایی که در استودیو تصویر نمایش داده می‌شوند. پرامپت را انگلیسی بنویسید؛ قید «محصول را دقیقاً حفظ کن» خودکار به آخرش اضافه می‌شود.
            </p>
          </div>
          <button type="button" onClick={() => confirm("حالت‌ها به پیش‌فرض برگردند؟") && setS({ ...s, imagePresets: DEFAULT_IMAGE_PRESETS })}
            className="text-xs font-bold text-gray-500 hover:text-blue-600">بازگشت به پیش‌فرض</button>
        </div>

        {s.imagePresets.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-gray-100 dark:border-white/[0.06] p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <input value={p.label} onChange={e => updatePreset(i, { label: e.target.value })}
                className={inputClass + " flex-1 font-bold"} placeholder="نام حالت" />
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500 whitespace-nowrap cursor-pointer">
                <input type="checkbox" checked={p.whiteBg} onChange={e => updatePreset(i, { whiteBg: e.target.checked })} />
                پس‌زمینه سفید خالص
              </label>
              <button type="button" onClick={() => setS({ ...s, imagePresets: s.imagePresets.filter((_, j) => j !== i) })}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 text-gray-400 hover:text-red-500 hover:border-red-300 transition-all"
                aria-label="حذف">✕</button>
            </div>
            <textarea value={p.prompt} onChange={e => updatePreset(i, { prompt: e.target.value })}
              rows={3} dir="ltr" className={inputClass + " text-xs leading-5"} placeholder="Product photo of this product ..." />
          </div>
        ))}

        <button type="button"
          onClick={() => setS({ ...s, imagePresets: [...s.imagePresets, { id: `custom-${Date.now()}`, label: "", prompt: "", whiteBg: false }] })}
          className="px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:border-blue-400 transition-all">
          + افزودن حالت
        </button>
      </div>
    </div>
  );
}
