"use client";
import { useEffect, useState } from "react";
import { slugify } from "@/lib/slugify";

interface Cat { id: string; title: string; slug: string; isActive: boolean; _count: { posts: number }; }
const inp = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500";

export default function BlogCategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [form, setForm] = useState({ title: "", slug: "" });
  const [editing, setEditing] = useState<Cat | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch("/api/admin/blog/categories").then(r => r.json()).then(setCats); }, []);

  async function save() {
    setSaving(true);
    const url = editing ? `/api/admin/blog/categories/${editing.id}` : "/api/admin/blog/categories";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (editing) setCats(c => c.map(x => x.id === editing.id ? { ...x, ...data } : x));
    else setCats(c => [...c, data]);
    setForm({ title: "", slug: "" }); setEditing(null); setShowForm(false); setSaving(false);
  }

  async function del(id: string) {
    if (!confirm("حذف شود؟")) return;
    await fetch(`/api/admin/blog/categories/${id}`, { method: "DELETE" });
    setCats(c => c.filter(x => x.id !== id));
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900 dark:text-white">دسته‌بندی‌های بلاگ</h1>
        <button onClick={() => { setEditing(null); setForm({ title: "", slug: "" }); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all">+ جدید</button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-blue-200 dark:border-blue-800 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">عنوان *</label>
              <input className={inp} value={form.title} onChange={e => { setForm(f => ({ ...f, title: e.target.value, slug: slugify(e.target.value) })); }} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Slug</label>
              <input className={inp} dir="ltr" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving || !form.title}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 hover:bg-blue-700 transition-all">
              {saving ? "..." : editing ? "ذخیره" : "افزودن"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              انصراف
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {cats.map((c, i) => (
          <div key={c.id} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}`}>
            <div className="flex-1">
              <p className="font-black text-sm text-gray-900 dark:text-white">{c.title}</p>
              <p className="text-[10px] text-gray-400" dir="ltr">{c.slug} • {(c._count.posts).toLocaleString("fa-IR")} مطلب</p>
            </div>
            <button onClick={() => { setEditing(c); setForm({ title: c.title, slug: c.slug }); setShowForm(true); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={() => del(c.id)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        ))}
        {cats.length === 0 && <p className="text-center py-10 text-gray-400 text-sm">دسته‌ای تعریف نشده</p>}
      </div>
    </div>
  );
}
