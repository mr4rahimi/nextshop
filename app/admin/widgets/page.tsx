"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type WidgetType =
  | "STORY" | "HERO_SLIDER" | "CATEGORIES" | "AMAZING_DEALS"
  | "BEST_SELLERS" | "PRODUCTS_BY_CATEGORY" | "PRODUCTS_BY_BRAND"
  | "NEWEST_PRODUCTS" | "SPECIAL_OFFERS" | "LAST_VISITED"
  | "FULL_BANNER" | "DOUBLE_BANNER" | "CALL_TO_ACTION"
  | "IMAGE_CONTENT" | "IMAGE_CONTENT_DOUBLE" | "LATEST_ARTICLES";

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  isActive: boolean;
  sortOrder: number;
  config: Record<string, any>;
  createdAt: string;
}

// ─── Meta info برای هر نوع ویجت ──────────────────────────────────────────────
const WIDGET_META: Record<WidgetType, { label: string; icon: string; color: string; desc: string }> = {
  STORY:                { label: "استوری",                  icon: "📸", color: "bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800",    desc: "نمایش استوری‌های تصویری" },
  HERO_SLIDER:          { label: "اسلایدر اصلی",            icon: "🖼️", color: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",    desc: "اسلایدر بنر صفحه اصلی" },
  CATEGORIES:           { label: "دسته‌بندی‌ها",            icon: "📂", color: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800", desc: "نمایش دسته‌بندی‌های محبوب" },
  AMAZING_DEALS:        { label: "پیشنهاد شگفت‌انگیز",      icon: "⚡", color: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800", desc: "محصولات با تایمر شمارش معکوس" },
  BEST_SELLERS:         { label: "پرفروش‌ترین‌ها",          icon: "🏆", color: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",  desc: "محصولات پرفروش" },
  PRODUCTS_BY_CATEGORY: { label: "محصولات بر اساس دسته",   icon: "🗂️", color: "bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800",     desc: "اسلایدر محصولات یک دسته" },
  PRODUCTS_BY_BRAND:    { label: "محصولات بر اساس برند",   icon: "🏷️", color: "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800", desc: "اسلایدر محصولات یک برند" },
  NEWEST_PRODUCTS:      { label: "جدیدترین محصولات",        icon: "🆕", color: "bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-800",     desc: "محصولات جدید با فیلتر دسته" },
  SPECIAL_OFFERS:       { label: "پیشنهاد ویژه",            icon: "🎁", color: "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800",    desc: "محصولات انتخابی پیشنهادی" },
  LAST_VISITED:         { label: "آخرین بازدیدها",          icon: "👁️", color: "bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-800",  desc: "محصولات اخیراً بازدیدشده" },
  FULL_BANNER:          { label: "بنر تمام عرض",            icon: "🖼️", color: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800", desc: "یک بنر با لینک" },
  DOUBLE_BANNER:        { label: "بنر دوتایی",              icon: "📰", color: "bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-900/20 dark:border-fuchsia-800", desc: "دو بنر کنار هم" },
  CALL_TO_ACTION:       { label: "دعوت به اقدام",           icon: "📢", color: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",  desc: "متن + دکمه با لینک" },
  IMAGE_CONTENT:        { label: "عکس و محتوا",             icon: "📝", color: "bg-lime-50 border-lime-200 dark:bg-lime-900/20 dark:border-lime-800",     desc: "عکس + عنوان + توضیحات + دکمه" },
  IMAGE_CONTENT_DOUBLE: { label: "عکس و محتوا دوتایی",     icon: "📋", color: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800", desc: "دو آیتم عکس + محتوا" },
  LATEST_ARTICLES:      { label: "آخرین مقالات",            icon: "📰", color: "bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800",        desc: "آخرین پست‌های وبلاگ" },
};

const ALL_TYPES = Object.keys(WIDGET_META) as WidgetType[];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // drag state
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  // form
  const [form, setForm] = useState({ type: "HERO_SLIDER" as WidgetType, title: "" });

  async function fetchWidgets() {
    setLoading(true);
    const res = await fetch("/api/admin/widgets");
    const data = await res.json();
    setWidgets(data);
    setLoading(false);
  }

  useEffect(() => { fetchWidgets(); }, []);

  // ── Toggle active ─────────────────────────────────────────────────────────
  async function toggleActive(w: Widget) {
    await fetch("/api/admin/widgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: w.id, title: w.title, isActive: !w.isActive, config: w.config }),
    });
    fetchWidgets();
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("این ویجت حذف شود؟")) return;
    await fetch("/api/admin/widgets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchWidgets();
  }

  // ── Add ───────────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/admin/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: form.type, title: form.title, config: {} }),
    });
    setSaving(false);
    setShowAdd(false);
    setForm({ type: "HERO_SLIDER", title: "" });
    fetchWidgets();
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  function onDragStart(index: number) {
    dragIndex.current = index;
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    dragOverIndex.current = index;
  }

  async function onDrop() {
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from === null || to === null || from === to) return;

    const reordered = [...widgets];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const updated = reordered.map((w, i) => ({ ...w, sortOrder: i }));
    setWidgets(updated);

    await fetch("/api/admin/widgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated.map(w => ({ id: w.id, sortOrder: w.sortOrder }))),
    });

    dragIndex.current = null;
    dragOverIndex.current = null;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">مدیریت ویجت‌ها</h1>
          <p className="text-sm text-gray-500 mt-1">ویجت‌ها را با درگ کردن مرتب کنید</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/30"
        >
          <span className="text-lg leading-none">+</span>
          ویجت جدید
        </button>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-black mb-4 text-gray-900 dark:text-white">افزودن ویجت جدید</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">نوع ویجت</label>
                <select
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as WidgetType }))}
                >
                  {ALL_TYPES.map(t => (
                    <option key={t} value={t}>
                      {WIDGET_META[t].icon} {WIDGET_META[t].label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">{WIDGET_META[form.type].desc}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">نام نمایشی در ادمین</label>
                <input
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
                  placeholder="مثلاً: اسلایدر اصلی صفحه"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving || !form.title.trim()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all">
                  {saving ? "در حال ذخیره..." : "افزودن"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Widget List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : widgets.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <div className="text-5xl mb-4">📦</div>
          <p className="text-gray-500 font-bold">هیچ ویجتی وجود ندارد</p>
          <p className="text-gray-400 text-sm mt-1">با کلیک روی «ویجت جدید» شروع کنید</p>
        </div>
      ) : (
        <div className="space-y-3">
          {widgets.map((w, index) => {
            const meta = WIDGET_META[w.type];
            return (
              <div
                key={w.id}
                draggable
                onDragStart={() => onDragStart(index)}
                onDragOver={e => onDragOver(e, index)}
                onDrop={onDrop}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-grab active:cursor-grabbing select-none ${meta.color} ${!w.isActive ? "opacity-50" : ""}`}
              >
                {/* Drag handle */}
                <div className="text-gray-400 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>

                {/* Sort number */}
                <span className="w-7 h-7 rounded-lg bg-white/60 dark:bg-black/20 flex items-center justify-center text-xs font-black text-gray-500 flex-shrink-0">
                  {index + 1}
                </span>

                {/* Icon */}
                <span className="text-2xl flex-shrink-0">{meta.icon}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-gray-900 dark:text-white truncate">{w.title}</span>
                    <span className="text-[10px] font-bold text-gray-400 bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{meta.desc}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle active */}
                  <button
                    onClick={() => toggleActive(w)}
                    className={`relative w-11 h-6 rounded-full transition-all ${w.isActive ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                    title={w.isActive ? "غیرفعال کن" : "فعال کن"}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${w.isActive ? "right-0.5" : "left-0.5"}`} />
                  </button>

                  {/* Edit */}
                  <a
                    href={`/admin/widgets/${w.id}`}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/60 dark:bg-black/20 hover:bg-blue-500 hover:text-white text-gray-500 transition-all"
                    title="ویرایش"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </a>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/60 dark:bg-black/20 hover:bg-red-500 hover:text-white text-gray-500 transition-all"
                    title="حذف"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* راهنما */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
        <p className="text-xs text-blue-700 dark:text-blue-300 font-bold flex items-center gap-2">
          <span>💡</span>
          برای تغییر ترتیب ویجت‌ها، آن‌ها را بکشید و در جای دلخواه رها کنید. ترتیب به صورت خودکار ذخیره می‌شود.
        </p>
      </div>
    </div>
  );
}