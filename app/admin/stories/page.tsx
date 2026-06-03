"use client";

import { useEffect, useRef, useState } from "react";

interface Story {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  duration: number;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_FORM = { title: "", imageUrl: "", linkUrl: "", duration: 5000, isActive: true };

export default function StoriesAdminPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Story | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  async function fetchStories() {
    setLoading(true);
    const res = await fetch("/api/admin/stories");
    setStories(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchStories(); }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    setForm(f => ({ ...f, imageUrl: data.url }));
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.imageUrl) return;
    setSaving(true);
    const payload = { ...form, linkUrl: form.linkUrl || null, ...(editing ? { id: editing.id } : {}) };
    await fetch("/api/admin/stories", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    closeModal();
    fetchStories();
  }

  async function toggleActive(s: Story) {
    await fetch("/api/admin/stories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, isActive: !s.isActive }),
    });
    fetchStories();
  }

  async function handleDelete(id: string) {
    if (!confirm("این استوری حذف شود؟")) return;
    await fetch("/api/admin/stories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchStories();
  }

  async function onDrop() {
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from === null || to === null || from === to) return;
    const reordered = [...stories];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updated = reordered.map((s, i) => ({ ...s, sortOrder: i }));
    setStories(updated);
    await fetch("/api/admin/stories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated.map(s => ({ id: s.id, sortOrder: s.sortOrder }))),
    });
    dragIndex.current = null;
    dragOverIndex.current = null;
  }

  function openAdd() { setEditing(null); setForm({ ...EMPTY_FORM }); setShowModal(true); }
  function openEdit(s: Story) {
    setEditing(s);
    setForm({ title: s.title, imageUrl: s.imageUrl, linkUrl: s.linkUrl || "", duration: s.duration, isActive: s.isActive });
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditing(null); setForm({ ...EMPTY_FORM }); }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">مدیریت استوری‌ها</h1>
          <p className="text-sm text-gray-500 mt-1">برای تغییر ترتیب، درگ کنید</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/30">
          <span className="text-lg leading-none">+</span>استوری جدید
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-black mb-5 text-gray-900 dark:text-white">
              {editing ? "ویرایش استوری" : "استوری جدید"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">تصویر استوری *</label>
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  {form.imageUrl ? (
                    <div className="relative">
                      <img src={form.imageUrl} alt="" className="w-full h-48 object-cover" />
                      <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}
                        className="absolute top-2 left-2 w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all">×</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-32 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                      {uploading ? (
                        <div className="flex items-center gap-2 text-gray-400">
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          <span className="text-sm">آپلود...</span>
                        </div>
                      ) : (
                        <>
                          <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                          </svg>
                          <span className="text-xs text-gray-400 font-bold">کلیک کنید برای آپلود</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}/>
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">عنوان *</label>
                <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
                  placeholder="مثلاً: جشنواره بهاره" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">لینک (اختیاری)</label>
                <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
                  placeholder="https://..." value={form.linkUrl}
                  onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}/>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  مدت نمایش: <span className="text-blue-600 font-black">{form.duration / 1000} ثانیه</span>
                </label>
                <input type="range" min="2000" max="15000" step="1000" className="w-full accent-blue-600"
                  value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}/>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>۲ ثانیه</span><span>۱۵ ثانیه</span>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}/>
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-green-500 rounded-full transition-all"/>
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all peer-checked:translate-x-5"/>
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">فعال</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving || !form.title.trim() || !form.imageUrl}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all">
                  {saving ? "ذخیره..." : editing ? "ویرایش" : "افزودن"}
                </button>
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse"/>)}
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <div className="text-5xl mb-4">📸</div>
          <p className="text-gray-500 font-bold">هیچ استوری‌ای وجود ندارد</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {stories.map((s, index) => (
            <div key={s.id} draggable
              onDragStart={() => { dragIndex.current = index; }}
              onDragOver={e => { e.preventDefault(); dragOverIndex.current = index; }}
              onDrop={onDrop}
              className={`relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing group border-2 transition-all ${s.isActive ? "border-transparent" : "border-gray-300 dark:border-gray-600 opacity-60"}`}>
              <img src={s.imageUrl} alt={s.title} className="w-full aspect-square object-cover"/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"/>
              <span className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white text-[10px] font-black rounded-lg flex items-center justify-center">{index + 1}</span>
              <span className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ${s.isActive ? "bg-green-400" : "bg-gray-400"}`}/>
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-xs font-bold truncate">{s.title}</p>
                <p className="text-white/60 text-[10px]">{s.duration / 1000} ثانیه</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all bg-black/30">
                <button onClick={() => toggleActive(s)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm ${s.isActive ? "bg-yellow-500 hover:bg-yellow-600" : "bg-green-500 hover:bg-green-600"}`}>
                  {s.isActive ? "⏸" : "▶"}
                </button>
                <button onClick={() => openEdit(s)}
                  className="w-9 h-9 rounded-xl bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button onClick={() => handleDelete(s.id)}
                  className="w-9 h-9 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}