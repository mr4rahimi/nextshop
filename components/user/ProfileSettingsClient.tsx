"use client";

import { useState } from "react";

interface Props {
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    nationalCode: string | null;
    avatarUrl: string | null;
    phone: string;
  };
}

export default function ProfileSettingsClient({ user }: Props) {
  const [form, setForm] = useState({
    firstName: user.firstName ?? "",
    lastName:  user.lastName  ?? "",
    email:     user.email     ?? "",
    nationalCode: user.nationalCode ?? "",
    avatarUrl: user.avatarUrl ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleAvatarUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    setForm(f => ({ ...f, avatarUrl: data.url }));
    setUploading(false);
  }

  async function handleSave() {
    setError(""); setSuccess(false); setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch { setError("خطا در ذخیره"); }
    finally { setSaving(false); }
  }

  const displayName = [form.firstName, form.lastName].filter(Boolean).join(" ") || user.phone;

  return (
    <div className="space-y-8" dir="rtl">

      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">تنظیمات پروفایل</h2>
        <p className="text-[11px] font-bold text-gray-400 mt-1">اطلاعات حساب کاربری خود را ویرایش کنید</p>
      </div>

      <div className="relative overflow-hidden bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 space-y-10">

          {/* Avatar */}
          <div className="flex items-center gap-6 pb-8 border-b border-gray-200/30 dark:border-white/5">
            <label className="relative group cursor-pointer flex-shrink-0">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-primary-500/20 to-primary-500/5 p-1 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-lg transition-transform group-hover:scale-105">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt={displayName} className="w-full h-full rounded-[1.8rem] object-cover" />
                ) : (
                  <div className="w-full h-full rounded-[1.8rem] bg-primary-500/20 flex items-center justify-center text-primary-600 text-2xl font-black">
                    {displayName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-primary-500 text-white flex items-center justify-center shadow-xl border-4 border-white dark:border-gray-900 group-hover:rotate-12 transition-all">
                {uploading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                )}
              </div>
              <input type="file" className="hidden" accept="image/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
            </label>
            <div>
              <h4 className="text-sm font-black text-gray-800 dark:text-white">{displayName}</h4>
              <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">حداکثر ۲ مگابایت — ۴۰۰×۴۰۰ پیکسل</p>
              {form.avatarUrl && (
                <button onClick={() => setForm(f => ({ ...f, avatarUrl: "" }))}
                  className="mt-2 text-[10px] font-bold text-secondary-500 hover:text-red-600 transition-colors">
                  حذف تصویر
                </button>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* نام */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 dark:text-gray-400 mr-1 uppercase tracking-wider">نام</label>
              <input type="text" placeholder="مثلاً: علی"
                className="w-full bg-white/50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-gray-800 dark:text-white outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>

            {/* نام خانوادگی */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 dark:text-gray-400 mr-1 uppercase tracking-wider">نام خانوادگی</label>
              <input type="text" placeholder="مثلاً: رضایی"
                className="w-full bg-white/50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-gray-800 dark:text-white outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>

            {/* موبایل — غیر قابل تغییر */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 dark:text-gray-400 mr-1 uppercase tracking-wider">شماره موبایل (تأیید شده)</label>
              <div className="relative">
                <input type="text" value={user.phone} disabled dir="ltr"
                  className="w-full bg-gray-50/50 dark:bg-white/[0.01] border border-gray-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-gray-400 tabular-nums cursor-not-allowed" />
                <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* ایمیل */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 dark:text-gray-400 mr-1 uppercase tracking-wider">آدرس ایمیل</label>
              <input type="email" placeholder="example@mail.com" dir="ltr"
                className="w-full bg-white/50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-gray-800 dark:text-white outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all text-left placeholder:text-gray-300 dark:placeholder:text-gray-600"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>

            {/* کد ملی */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-black text-gray-500 dark:text-gray-400 mr-1 uppercase tracking-wider">کد ملی</label>
              <input type="text" placeholder="۱۰ رقم" maxLength={10} dir="ltr"
                className="w-full md:w-1/2 bg-white/50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-gray-800 dark:text-white outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all tabular-nums placeholder:text-gray-300 dark:placeholder:text-gray-600"
                value={form.nationalCode} onChange={e => setForm(f => ({ ...f, nationalCode: e.target.value.replace(/\D/g, "") }))} />
            </div>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="px-5 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">تغییرات با موفقیت ذخیره شد</p>
            </div>
          )}

          {/* Save */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-12 py-4 bg-primary-500 text-white text-xs font-black rounded-2xl shadow-xl shadow-primary-500/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 flex items-center gap-3">
              {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
              {!saving && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}