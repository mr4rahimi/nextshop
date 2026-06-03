"use client";

import { useState } from "react";
import { PROVINCES } from "@/lib/iran-cities";

interface Address {
  id: string;
  title: string | null;
  receiver: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string | null;
  isDefault: boolean;
}

interface Props { initialAddresses: Address[]; }

const EMPTY_FORM = {
  title: "", receiver: "", phone: "", province: "", city: "",
  addressLine: "", postalCode: "", isDefault: false,
};

export default function AddressesClient({ initialAddresses }: Props) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // شهرهای استان انتخاب‌شده
  const cities = PROVINCES.find(p => p.name === form.province)?.cities ?? [];

  function openAdd() { setEditing(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }
  function openEdit(a: Address) {
    setEditing(a);
    setForm({ title: a.title ?? "", receiver: a.receiver, phone: a.phone, province: a.province, city: a.city, addressLine: a.addressLine, postalCode: a.postalCode ?? "", isDefault: a.isDefault });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditing(null); setError(""); }

  async function handleSave() {
    setError("");
    if (!form.receiver.trim()) { setError("نام گیرنده الزامی است"); return; }
    if (!form.phone.trim()) { setError("شماره تماس الزامی است"); return; }
    if (!form.province) { setError("استان را انتخاب کنید"); return; }
    if (!form.city) { setError("شهر را انتخاب کنید"); return; }
    if (!form.addressLine.trim()) { setError("نشانی دقیق را وارد کنید"); return; }

    setSaving(true);
    try {
      const url = editing ? `/api/user/addresses/${editing.id}` : "/api/user/addresses";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      // refresh list
      const listRes = await fetch("/api/user/addresses");
      setAddresses(await listRes.json());
      closeForm();
    } catch { setError("خطا در ذخیره آدرس"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("این آدرس حذف شود؟")) return;
    await fetch(`/api/user/addresses/${id}`, { method: "DELETE" });
    setAddresses(prev => prev.filter(a => a.id !== id));
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/user/addresses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addresses.find(a => a.id === id), isDefault: true }),
    });
    const listRes = await fetch("/api/user/addresses");
    setAddresses(await listRes.json());
  }

  return (
    <div className="space-y-8" dir="rtl">

      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">آدرس‌های من</h2>
        <p className="text-[11px] font-bold text-gray-400 mt-1">مدیریت آدرس‌های تحویل</p>
      </div>

      <div className="relative overflow-hidden bg-white/40 dark:bg-gray-950/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-none">
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl" />

        {/* Header کارت */}
        <div className="relative flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200/30 dark:border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center border border-primary-500/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">آدرس‌های ذخیره‌شده</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-1">{addresses.length} آدرس ثبت شده</p>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary-500 text-white text-[11px] font-black shadow-lg shadow-primary-500/30 hover:scale-[1.02] transition-all active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            افزودن آدرس جدید
          </button>
        </div>

        {/* لیست آدرس‌ها */}
        {addresses.length === 0 && !showForm ? (
          <div className="text-center py-12 relative z-10">
            <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-500 font-black text-sm">هنوز آدرسی ثبت نکرده‌اید</p>
            <button onClick={openAdd} className="mt-4 px-6 py-2.5 bg-primary-500 text-white rounded-xl text-xs font-black shadow-lg shadow-primary-500/20">
              افزودن اولین آدرس
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
            {addresses.map(a => (
              <div key={a.id}
                className={`relative p-6 rounded-[2rem] border-2 transition-all ${
                  a.isDefault
                    ? "bg-white/50 dark:bg-white/5 border-primary-500/50 dark:border-primary-500/40 shadow-xl shadow-primary-500/5"
                    : "bg-white/20 dark:bg-white/5 border-white/40 dark:border-white/10 hover:border-primary-500/30 group"
                }`}>

                {/* badge پیش‌فرض */}
                {a.isDefault && (
                  <div className="absolute top-4 left-4">
                    <span className="px-2 py-1 rounded-lg bg-primary-500 text-white text-[8px] font-black uppercase">پیش‌فرض</span>
                  </div>
                )}

                <div className="flex flex-col h-full">
                  <h4 className="text-[13px] font-black text-gray-900 dark:text-white mb-4">
                    {a.title || `${a.province}، ${a.city}`}
                  </h4>

                  <div className="space-y-3 flex-grow">
                    <div className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400 leading-6">
                        {a.province}، {a.city}، {a.addressLine}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <p className="text-[11px] font-black text-gray-500 dark:text-gray-400">{a.receiver} — {a.phone}</p>
                    </div>
                    {a.postalCode && (
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-[11px] font-black text-gray-500 dark:text-gray-400 tabular-nums">کد پستی: {a.postalCode}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-200/30 dark:border-white/5 flex items-center justify-between gap-2">
                    {!a.isDefault && (
                      <button onClick={() => handleSetDefault(a.id)}
                        className="text-[10px] font-black text-primary-500 hover:underline transition-all">
                        تنظیم به عنوان پیش‌فرض
                      </button>
                    )}
                    <div className="flex items-center gap-2 mr-auto">
                      <button onClick={() => openEdit(a)}
                        className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-primary-500 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(a.id)}
                        className="p-2.5 rounded-xl hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* فرم افزودن/ویرایش */}
        {showForm && (
          <div className="mt-8 pt-8 border-t border-gray-200/30 dark:border-white/5 relative z-10">
            <h3 className="text-base font-black text-gray-900 dark:text-white mb-6">
              {editing ? "ویرایش آدرس" : "افزودن آدرس جدید"}
            </h3>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* عنوان */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-600 dark:text-gray-400 mr-2">عنوان آدرس</label>
                  <input type="text" placeholder="مثلاً: منزل، محل کار"
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 focus:border-primary-500 outline-none text-[12px] font-bold transition-all dark:text-white"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>

                {/* گیرنده */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-600 dark:text-gray-400 mr-2">نام گیرنده *</label>
                  <input type="text" placeholder="نام و نام‌خانوادگی"
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 focus:border-primary-500 outline-none text-[12px] font-bold transition-all dark:text-white"
                    value={form.receiver} onChange={e => setForm(f => ({ ...f, receiver: e.target.value }))} />
                </div>

                {/* شماره تماس */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-600 dark:text-gray-400 mr-2">شماره تماس تحویل‌گیرنده *</label>
                  <input type="tel" placeholder="09120000000" dir="ltr"
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 focus:border-primary-500 outline-none text-[12px] font-bold tracking-widest transition-all dark:text-white"
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
                </div>

                {/* استان و شهر */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-600 dark:text-gray-400 mr-2">استان و شهر *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="px-4 py-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-[11px] font-black transition-all focus:border-primary-500 dark:text-white"
                      value={form.province}
                      onChange={e => setForm(f => ({ ...f, province: e.target.value, city: "" }))}
                    >
                      <option value="">انتخاب استان</option>
                      {PROVINCES.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <select
                      className="px-4 py-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-[11px] font-black transition-all focus:border-primary-500 dark:text-white disabled:opacity-50"
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      disabled={!form.province}
                    >
                      <option value="">انتخاب شهر</option>
                      {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* کد پستی */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-600 dark:text-gray-400 mr-2">کد پستی (۱۰ رقمی)</label>
                  <input type="text" placeholder="1234567890" dir="ltr" maxLength={10}
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 focus:border-primary-500 outline-none text-[12px] font-bold tracking-[0.3em] transition-all dark:text-white"
                    value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value.replace(/\D/g, "") }))} />
                </div>
              </div>

              {/* نشانی */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400 mr-2">نشانی دقیق پستی *</label>
                <textarea rows={3} placeholder="خیابان، کوچه، پلاک، واحد..."
                  className="w-full px-5 py-4 rounded-[1.8rem] bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 focus:border-primary-500 outline-none text-[12px] font-bold transition-all resize-none dark:text-white"
                  value={form.addressLine} onChange={e => setForm(f => ({ ...f, addressLine: e.target.value }))} />
              </div>

              {/* پیش‌فرض */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer"
                    checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-white/10 peer-checked:bg-primary-500 rounded-full transition-all" />
                  <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow transition-all peer-checked:translate-x-[-1.25rem]" />
                </div>
                <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">تنظیم به عنوان آدرس پیش‌فرض</span>
              </label>

              {error && (
                <div className="px-5 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200/30 dark:border-white/5">
                <button onClick={closeForm}
                  className="px-8 py-4 rounded-[1.5rem] text-gray-500 dark:text-gray-400 text-[11px] font-black hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                  انصراف
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-10 py-4 rounded-[1.5rem] bg-primary-500 text-white text-[12px] font-black shadow-xl shadow-primary-500/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60">
                  {saving ? "در حال ذخیره..." : editing ? "ذخیره تغییرات" : "ثبت و ذخیره آدرس"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}