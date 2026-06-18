"use client";

import { useEffect, useState } from "react";
import { slugify } from "@/lib/slugify";

const EMPTY_FORM = {
  title: "", slug: "", logoUrl: "", description: "",
  seoTitle: "", seoDescription: "", seoKeywords: "", isActive: true,
};

export default function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  const [search, setSearch] = useState("");

  async function fetchBrands() {
    const res = await fetch("/api/admin/brands");
    setBrands(await res.json());
  }

  useEffect(() => { fetchBrands(); }, []);

  function handleChange(key: string, value: any) {
    if (key === "title") {
      setForm((prev: any) => ({ ...prev, title: value, slug: prev.slug || slugify(value) }));
      return;
    }
    setForm((prev: any) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/brands", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
    });
    setSaving(false);
    cancelForm();
    fetchBrands();
  }

  function cancelForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
    setShowSeo(false);
  }

  function handleEdit(item: any) {
    setEditing(item);
    setForm(item);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!confirm("این برند حذف شود؟")) return;
    await fetch("/api/admin/brands", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchBrands();
  }

  const filtered = brands.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.slug.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = brands.filter(b => b.isActive).length;

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      {}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">مدیریت برندها</h1>
          <p className="text-xs text-gray-500 mt-0.5">{brands.length} برند — {activeCount} فعال</p>
        </div>
        <button
          onClick={() => { cancelForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-500/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          برند جدید
        </button>
      </div>

      {}
      {showForm && (
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              {editing ? `ویرایش — ${editing.title}` : "برند جدید"}
            </h2>
            <button onClick={cancelForm} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">نام برند *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => handleChange("title", e.target.value)}
                  placeholder="مثلاً: سامسونگ"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">Slug *</label>
                <input
                  required
                  value={form.slug}
                  onChange={e => handleChange("slug", slugify(e.target.value))}
                  placeholder="samsung"
                  dir="ltr"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {}
            <div>
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">لوگوی برند</label>
              <div className="flex items-center gap-4">
                <label className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-gray-200 dark:border-white/10 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500/50 transition-all">
                  {uploading ? (
                    <span className="text-xs text-gray-400">در حال آپلود...</span>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-gray-500">
                        {form.logoUrl ? "تغییر لوگو" : "انتخاب لوگو (PNG/SVG توصیه می‌شود)"}
                      </span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                      const data = await res.json();
                      handleChange("logoUrl", data.url);
                      setUploading(false);
                    }} />
                </label>
                {form.logoUrl && (
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/5 flex items-center justify-center overflow-hidden p-2">
                      <img src={form.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                    <button type="button" onClick={() => handleChange("logoUrl", "")}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {}
            <div>
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">توضیحات برند</label>
              <textarea
                value={form.description}
                onChange={e => handleChange("description", e.target.value)}
                rows={3}
                placeholder="معرفی کوتاه برند..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all resize-none"
              />
            </div>

            {}
            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <div
                onClick={() => handleChange("isActive", !form.isActive)}
                className={`w-12 h-6 rounded-full transition-colors ${form.isActive ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"} relative`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "-translate-x-1" : "-translate-x-7"}`} />
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">برند فعال باشد</span>
            </label>

            {/* SEO */}
            <div className="mt-8" dir="rtl">
              <button type="button" onClick={() => setShowSeo(!showSeo)}
                className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                <svg className={`w-5.5 h-5.5 mb-4 transition-transform ${showSeo ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
               <h3 className="text-lg font-bold mb-4">
                 تنظیمات سئو
               </h3>
              </button>

              {showSeo && (
                <div className="mt-3 space-y-3 p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/[0.06]">
                  <div>
                    <label className="block text-xs font-black text-gray-600 dark:text-gray-400 mb-1">عنوان SEO</label>
                    <input  value={form.seoTitle} onChange={e => handleChange("seoTitle", e.target.value)}
                      placeholder="SEO Title" dir="ltr"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all text-right" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-600 dark:text-gray-400 mb-1">کلمات کلیدی</label>
                    <input value={form.seoKeywords} onChange={e => handleChange("seoKeywords", e.target.value)}
                      placeholder="keyword1, keyword2" dir="ltr"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all text-right" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-600 dark:text-gray-400 mb-1">توضیحات SEO</label>
                    <textarea value={form.seoDescription} onChange={e => handleChange("seoDescription", e.target.value)}
                      rows={2} dir="ltr"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all resize-none text-right" />
                  </div>
                </div>
              )}
            </div>

            {}
            <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all">
                {saving ? "در حال ذخیره..." : editing ? "بروزرسانی برند" : "ذخیره برند"}
              </button>
              <button type="button" onClick={cancelForm}
                className="px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black transition-all">
                انصراف
              </button>
            </div>
          </form>
        </div>
      )}

      {}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.06] flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="جستجوی برند..."
              className="w-full pr-9 pl-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-full">
            {filtered.length} برند
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-400">
              {search ? "برندی با این نام یافت نشد" : "هنوز برندی ثبت نشده"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {filtered.map(b => (
              <div key={b.id} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">

                {}
                <div className="w-12 h-12 rounded-xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/5 flex items-center justify-center overflow-hidden p-1.5 flex-shrink-0">
                  {b.logoUrl ? (
                    <img src={b.logoUrl} alt={b.title} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                </div>

                {}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-900 dark:text-white truncate">{b.title}</p>
                  <p className="text-[11px] text-gray-400 truncate" dir="ltr">{b.slug}</p>
                  {b.description && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{b.description}</p>
                  )}
                </div>

                {}
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border flex-shrink-0 ${
                  b.isActive
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                    : "bg-gray-50 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10"
                }`}>
                  {b.isActive ? "فعال" : "غیرفعال"}
                </span>

                {}
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => handleEdit(b)}
                    className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(b.id)}
                    className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-500/30 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
