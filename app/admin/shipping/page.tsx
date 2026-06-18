"use client";

import { useEffect, useState } from "react";
import { PROVINCES } from "@/lib/iran-cities";

interface ShippingMethod {
  id: string;
  title: string;
  type: "EXPRESS" | "STANDARD";
  isActive: boolean;
  cities: string[];
  fee: string;
  description: string | null;
  sortOrder: number;
}

interface StoreSettings {
  cardNumber: string | null;
  cardHolder: string | null;
  cardBank: string | null;
  cardReceiptInfo: string | null;
  paymentGatewayActive: boolean;
  paymentGatewayMerchant: string | null;
  senderName: string | null;
  senderPhone: string | null;
  senderProvince: string | null;
  senderCity: string | null;
  senderAddress: string | null;
  senderPostalCode: string | null;
  storeName: string | null;
  storeLogo: string | null;
}

const EMPTY_METHOD: Omit<ShippingMethod, "id"> = {
  title: "", type: "STANDARD", isActive: true,
  cities: [], fee: "0", description: null, sortOrder: 0,
};

const ALL_CITIES = PROVINCES.flatMap(p => p.cities.map(c => c.name));

export default function AdminShippingPage() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
  cardNumber: "", cardHolder: "", cardBank: "", cardReceiptInfo: "",
  paymentGatewayActive: false, paymentGatewayMerchant: "",
  senderName: null, senderPhone: null, senderProvince: null,
  senderCity: null, senderAddress: null, senderPostalCode: null,
  storeName: null, storeLogo: null,
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShippingMethod | null>(null);
  const [form, setForm] = useState({ ...EMPTY_METHOD });
  const [citySearch, setCitySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [tab, setTab] = useState<"shipping" | "payment" | "sender">("shipping");

  useEffect(() => {
    fetch("/api/admin/shipping").then(r => r.json()).then(setMethods);
    fetch("/api/admin/store-settings").then(r => r.json()).then(setSettings);
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_METHOD });
    setCitySearch("");
    setShowForm(true);
  }

  function openEdit(m: ShippingMethod) {
    setEditing(m);
    setForm({ title: m.title, type: m.type, isActive: m.isActive, cities: m.cities, fee: m.fee, description: m.description ?? "", sortOrder: m.sortOrder });
    setCitySearch("");
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    const url = editing ? `/api/admin/shipping/${editing.id}` : "/api/admin/shipping";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, fee: Number(form.fee.toString().replace(/,/g, "")) }),
    });
    const data = await res.json();
    if (editing) setMethods(prev => prev.map(m => m.id === editing.id ? data : m));
    else setMethods(prev => [...prev, data]);
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("این روش ارسال حذف شود؟")) return;
    await fetch(`/api/admin/shipping/${id}`, { method: "DELETE" });
    setMethods(prev => prev.filter(m => m.id !== id));
  }

  async function toggleActive(m: ShippingMethod) {
    const res = await fetch(`/api/admin/shipping/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...m, isActive: !m.isActive, fee: Number(m.fee) }),
    });
    const data = await res.json();
    setMethods(prev => prev.map(x => x.id === m.id ? data : x));
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    await fetch("/api/admin/store-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSavingSettings(false);
  }

  function toggleCity(city: string) {
    setForm(f => ({
      ...f,
      cities: f.cities.includes(city) ? f.cities.filter(c => c !== city) : [...f.cities, city],
    }));
  }

  const filteredCities = ALL_CITIES.filter(c =>
    c.includes(citySearch) && !form.cities.includes(c)
  ).slice(0, 20);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">تنظیمات ارسال و پرداخت</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
        {[{ key: "shipping", label: "روش‌های ارسال" }, { key: "payment", label: "روش‌های پرداخت" }, { key: "sender", label: "اطلاعات فرستنده" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${tab === t.key ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>
            {t.label}
          </button>
        ))}
        
      </div>

      {}
      {tab === "shipping" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              افزودن روش ارسال
            </button>
          </div>

          {}
          <div className="space-y-3">
            {methods.length === 0 && !showForm && (
              <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-400">
                هنوز روش ارسالی تعریف نشده
              </div>
            )}
            {methods.map(m => (
              <div key={m.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.type === "EXPRESS" ? "bg-orange-50 dark:bg-orange-900/20 text-orange-500" : "bg-blue-50 dark:bg-blue-900/20 text-blue-500"}`}>
                      {m.type === "EXPRESS" ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-sm text-gray-900 dark:text-white">{m.title}</p>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${m.type === "EXPRESS" ? "bg-orange-50 dark:bg-orange-900/20 text-orange-500" : "bg-blue-50 dark:bg-blue-900/20 text-blue-500"}`}>
                          {m.type === "EXPRESS" ? "ارسال سریع" : "ارسال عادی"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        هزینه: {Number(m.fee) === 0 ? "رایگان" : `${Number(m.fee).toLocaleString("fa-IR")} تومان`}
                        {m.cities.length > 0 && ` — فقط: ${m.cities.slice(0, 3).join("، ")}${m.cities.length > 3 ? ` و ${(m.cities.length - 3).toLocaleString("fa-IR")} شهر دیگر` : ""}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleActive(m)}
                      className={`relative w-11 h-6 rounded-full transition-all ${m.isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${m.isActive ? "right-0.5" : "left-0.5"}`} />
                    </button>
                    <button onClick={() => openEdit(m)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(m.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {}
          {showForm && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 space-y-5">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">
                {editing ? "ویرایش روش ارسال" : "افزودن روش ارسال جدید"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">عنوان *</label>
                  <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    placeholder="مثلاً: ارسال پیک موتوری تهران"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">نوع ارسال *</label>
                  <select className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                    <option value="EXPRESS">🚀 ارسال سریع (پیک موتوری)</option>
                    <option value="STANDARD">📦 ارسال عادی (پست)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">هزینه ارسال (تومان) — ۰ = رایگان</label>
                  <input type="number" min="0" className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">اولویت نمایش</label>
                  <input type="number" min="0" className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-gray-500">توضیحات (اختیاری)</label>
                  <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    placeholder="مثلاً: ارسال در همان روز تا ساعت ۱۸"
                    value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>

              {}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500">
                    محدوده ارسال
                    <span className="text-gray-400 font-normal mr-1">(خالی = همه ایران)</span>
                  </label>
                  {form.cities.length > 0 && (
                    <button onClick={() => setForm(f => ({ ...f, cities: [] }))}
                      className="text-[10px] text-red-500 font-bold hover:underline">
                      حذف همه
                    </button>
                  )}
                </div>

                {}
                {form.cities.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
                    {form.cities.map(c => (
                      <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold">
                        {c}
                        <button onClick={() => toggleCity(c)} className="text-blue-500 hover:text-red-500 transition-colors">×</button>
                      </span>
                    ))}
                  </div>
                )}

                {}
                <div className="relative">
                  <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    placeholder="جستجوی شهر برای افزودن..."
                    value={citySearch} onChange={e => setCitySearch(e.target.value)} />
                  {citySearch && filteredCities.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                      {filteredCities.map(c => (
                        <button key={c} onClick={() => { toggleCity(c); setCitySearch(""); }}
                          className="w-full text-right px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 transition-colors">
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-emerald-500 rounded-full transition-all" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all peer-checked:translate-x-5" />
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">فعال</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving || !form.title}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 hover:bg-blue-700 transition-all">
                  {saving ? "ذخیره..." : editing ? "ذخیره تغییرات" : "افزودن"}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  انصراف
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {}
      {tab === "payment" && (
        <div className="space-y-6">

          {}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h3 className="font-black text-sm text-gray-900 dark:text-white">کارت به کارت</h3>
                <p className="text-xs text-gray-400">اطلاعات کارت بانکی که به مشتری نمایش داده می‌شود</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">شماره کارت</label>
                <input dir="ltr" className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500 tracking-widest"
                  placeholder="6037-xxxx-xxxx-xxxx"
                  value={settings.cardNumber ?? ""} onChange={e => setSettings(s => ({ ...s, cardNumber: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">نام صاحب کارت</label>
                <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                  placeholder="نام و نام‌خانوادگی"
                  value={settings.cardHolder ?? ""} onChange={e => setSettings(s => ({ ...s, cardHolder: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">نام بانک</label>
                <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                  placeholder="مثلاً: ملت، صادرات، ..."
                  value={settings.cardBank ?? ""} onChange={e => setSettings(s => ({ ...s, cardBank: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">راهنمای ارسال رسید</label>
                <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                  placeholder="مثلاً: رسید را به واتساپ ۰۹۱۲... ارسال کنید"
                  value={settings.cardReceiptInfo ?? ""} onChange={e => setSettings(s => ({ ...s, cardReceiptInfo: e.target.value }))} />
              </div>
            </div>
          </div>

          {}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-black text-sm text-gray-900 dark:text-white">درگاه پرداخت آنلاین</h3>
                <p className="text-xs text-gray-400">اطلاعات درگاه بانکی (بعداً تکمیل می‌شود)</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer mr-auto">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={settings.paymentGatewayActive} onChange={e => setSettings(s => ({ ...s, paymentGatewayActive: e.target.checked }))} />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-emerald-500 rounded-full transition-all" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all peer-checked:translate-x-5" />
                </div>
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">فعال</span>
              </label>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Merchant ID (بعداً تکمیل کنید)</label>
              <input dir="ltr" className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                placeholder="merchant id"
                value={settings.paymentGatewayMerchant ?? ""} onChange={e => setSettings(s => ({ ...s, paymentGatewayMerchant: e.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleSaveSettings} disabled={savingSettings}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-60 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
              {savingSettings ? "ذخیره..." : "ذخیره تنظیمات پرداخت"}
            </button>
          </div>
        </div>
      )}

      {tab === "sender" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h3 className="font-black text-sm text-gray-900 dark:text-white">اطلاعات فرستنده (رسید پستی)</h3>
                <p className="text-xs text-gray-400">این اطلاعات روی رسید پستی سفارشات چاپ می‌شود</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "storeName",       label: "نام فروشگاه",        placeholder: "مانا شاپ" },
                { key: "senderName",      label: "نام فرستنده",        placeholder: "نام مسئول ارسال" },
                { key: "senderPhone",     label: "تلفن فرستنده",       placeholder: "021..." },
                { key: "senderPostalCode",label: "کد پستی فرستنده",    placeholder: "1234567890" },
                { key: "senderProvince",  label: "استان",              placeholder: "تهران" },
                { key: "senderCity",      label: "شهر",                placeholder: "تهران" },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">{f.label}</label>
                  <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    placeholder={f.placeholder}
                    value={(settings as any)[f.key] ?? ""}
                    onChange={e => setSettings((s: any) => ({ ...s, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-gray-500">آدرس فرستنده</label>
                <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                  placeholder="آدرس کامل"
                  value={settings.senderAddress ?? ""}
                  onChange={e => setSettings(s => ({ ...s, senderAddress: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleSaveSettings} disabled={savingSettings}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-60 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
              {savingSettings ? "ذخیره..." : "ذخیره اطلاعات فرستنده"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
