"use client";

import { useState } from "react";

export default function ChangePasswordClient() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const strength = (() => {
    const p = form.newPassword;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) || /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ["", "خیلی ضعیف", "ضعیف", "متوسط", "قوی", "خیلی قوی"][strength];
  const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"][strength];

  async function handleSave() {
    setError(""); setSuccess(false);
    if (!form.currentPassword) { setError("رمز عبور فعلی را وارد کنید"); return; }
    if (form.newPassword.length < 6) { setError("رمز جدید باید حداقل ۶ کاراکتر باشد"); return; }
    if (form.newPassword !== form.confirmPassword) { setError("رمزهای جدید مطابقت ندارند"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setSuccess(false), 4000);
    } catch { setError("خطا در تغییر رمز"); }
    finally { setSaving(false); }
  }

  function PasswordInput({ label, field, placeholder }: { label: string; field: "current" | "new" | "confirm"; placeholder: string }) {
    return (
      <div className="space-y-2">
        <label className="text-[11px] font-black text-gray-500 dark:text-gray-400 mr-1 uppercase tracking-wider">{label}</label>
        <div className="relative">
          <input
            type={show[field] ? "text" : "password"}
            placeholder={placeholder}
            className="w-full bg-white/50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-gray-800 dark:text-white outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all pl-12 placeholder:text-gray-300 dark:placeholder:text-gray-600"
            value={form[field === "current" ? "currentPassword" : field === "new" ? "newPassword" : "confirmPassword"]}
            onChange={e => setForm(f => ({
              ...f,
              [field === "current" ? "currentPassword" : field === "new" ? "newPassword" : "confirmPassword"]: e.target.value,
            }))}
          />
          <button type="button" onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors">
            {show[field] ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">تغییر رمز عبور</h2>
        <p className="text-[11px] font-bold text-gray-400 mt-1">برای امنیت بیشتر، از رمز قوی استفاده کنید</p>
      </div>

      <div className="relative overflow-hidden bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 space-y-6 max-w-lg">

          <PasswordInput label="رمز عبور فعلی" field="current" placeholder="رمز عبور فعلی خود را وارد کنید" />
          <PasswordInput label="رمز عبور جدید" field="new" placeholder="رمز جدید (حداقل ۶ کاراکتر)" />

          {/* نوار قدرت */}
          {form.newPassword && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase">قدرت رمز:</span>
                <span className={`text-[10px] font-black ${strength >= 4 ? "text-emerald-500" : strength >= 3 ? "text-amber-500" : "text-red-500"}`}>
                  {strengthLabel}
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < strength ? strengthColor : "bg-gray-200 dark:bg-white/10"}`} />
                ))}
              </div>
              <ul className="grid grid-cols-2 gap-1 mt-3">
                {[
                  { label: "حداقل ۶ کاراکتر", ok: form.newPassword.length >= 6 },
                  { label: "حروف انگلیسی", ok: /[a-zA-Z]/.test(form.newPassword) },
                  { label: "عدد", ok: /\d/.test(form.newPassword) },
                  { label: "کاراکتر ویژه", ok: /[^A-Za-z0-9]/.test(form.newPassword) },
                ].map((item, i) => (
                  <li key={i} className={`flex items-center gap-1.5 text-[10px] font-bold ${item.ok ? "text-emerald-500" : "text-gray-400"}`}>
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {item.ok
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      }
                    </svg>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PasswordInput label="تکرار رمز جدید" field="confirm" placeholder="رمز جدید را مجدداً وارد کنید" />

          {/* match indicator */}
          {form.confirmPassword && (
            <div className={`flex items-center gap-2 text-[11px] font-bold ${form.newPassword === form.confirmPassword ? "text-emerald-500" : "text-red-500"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {form.newPassword === form.confirmPassword
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                }
              </svg>
              {form.newPassword === form.confirmPassword ? "رمزها مطابقت دارند" : "رمزها مطابقت ندارند"}
            </div>
          )}

          {error && (
            <div className="px-5 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">رمز عبور با موفقیت تغییر کرد</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={handleSave} disabled={saving}
              className="px-12 py-4 bg-primary-500 text-white text-xs font-black rounded-2xl shadow-xl shadow-primary-500/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 flex items-center gap-3">
              {saving ? "در حال تغییر..." : "تغییر رمز عبور"}
              {!saving && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}