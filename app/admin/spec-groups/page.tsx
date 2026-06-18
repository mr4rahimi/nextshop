"use client";

import { useEffect, useState } from "react";

const EMPTY_FORM = { title: "", items: [{ title: "" }] };

export default function SpecGroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  async function fetchData() {
    const res = await fetch("/api/admin/spec-groups");
    setGroups(await res.json());
  }

  useEffect(() => { fetchData(); }, []);

  function handleItemChange(index: number, value: string) {
    const newItems = [...form.items];
    newItems[index].title = value;
    setForm({ ...form, items: newItems });
  }

  function addItem() {
    setForm({ ...form, items: [...form.items, { title: "" }] });
  }

  function removeItem(index: number) {
    setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== index) });
  }

  function moveItem(index: number, dir: -1 | 1) {
    const items = [...form.items];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    setForm({ ...form, items });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/spec-groups", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
    });
    setSaving(false);
    cancelForm();
    fetchData();
  }

  function cancelForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
  }

  function handleEdit(group: any) {
    setEditing(group);
    setForm({ title: group.title, items: group.items.map((i: any) => ({ title: i.title })) });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!confirm("این جدول مشخصات حذف شود؟")) return;
    await fetch("/api/admin/spec-groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  }

  function toggleGroup(id: string) {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      {}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">جداول مشخصات فنی</h1>
          <p className="text-xs text-gray-500 mt-0.5">{groups.length} جدول تعریف شده</p>
        </div>
        <button
          onClick={() => { cancelForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-500/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          جدول جدید
        </button>
      </div>

      {}
      {showForm && (
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              {editing ? `ویرایش — ${editing.title}` : "جدول مشخصات جدید"}
            </h2>
            <button onClick={cancelForm} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {}
            <div>
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">نام جدول *</label>
              <input
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="مثلاً: مشخصات موبایل"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            {}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-gray-700 dark:text-gray-300">
                  مشخصه‌ها
                  <span className="text-gray-400 font-bold mr-1">({form.items.length} مورد)</span>
                </label>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  افزودن مشخصه
                </button>
              </div>

              <div className="space-y-2 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/[0.06] p-3">
                {form.items.map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 group">
                    {}
                    <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-gray-400 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg flex-shrink-0">
                      {index + 1}
                    </span>

                    {}
                    <input
                      value={item.title}
                      onChange={e => handleItemChange(index, e.target.value)}
                      placeholder={`مشخصه ${index + 1}`}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                    />

                    {}
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-20 transition-all">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => moveItem(index, 1)} disabled={index === form.items.length - 1}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-white disabled:opacity-20 transition-all">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {}
                    <button type="button" onClick={() => removeItem(index)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-500/30 opacity-0 group-hover:opacity-100 transition-all">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {form.items.length === 0 && (
                  <div className="py-4 text-center text-xs text-gray-400">هنوز مشخصه‌ای اضافه نشده</div>
                )}
              </div>
            </div>

            {}
            <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all">
                {saving ? "در حال ذخیره..." : editing ? "بروزرسانی جدول" : "ذخیره جدول"}
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
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.06]">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
          </svg>
          <span className="text-sm font-black text-gray-900 dark:text-white">جداول تعریف شده</span>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full mr-auto">
            {groups.length} جدول
          </span>
        </div>

        {groups.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M3 14h18M10 3v18M14 3v18" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-400">هنوز جدولی تعریف نشده</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {groups.map(g => {
              const isOpen = expandedGroups[g.id];
              return (
                <div key={g.id}>
                  <div className="group flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    {/* toggle */}
                    <button onClick={() => toggleGroup(g.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all flex-shrink-0">
                      <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {}
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
                      </svg>
                    </div>

                    {}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-900 dark:text-white">{g.title}</p>
                      <p className="text-[11px] text-gray-400">{g.items.length} مشخصه</p>
                    </div>

                    {}
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/10 flex-shrink-0">
                      {g.items.length} فیلد
                    </span>

                    {}
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => handleEdit(g)}
                        className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(g.id)}
                        className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-500/30 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {}
                  {isOpen && (
                    <div className="px-5 pb-3 bg-gray-50 dark:bg-white/[0.01]">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-2">
                        {g.items.map((item: any, idx: number) => (
                          <div key={item.id}
                            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/[0.06] rounded-lg">
                            <span className="w-5 h-5 flex items-center justify-center text-[9px] font-black text-gray-400 bg-gray-100 dark:bg-white/5 rounded-md flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
