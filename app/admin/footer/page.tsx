"use client";

import { useEffect, useState } from "react";

type ColType = "LINKS" | "CATEGORIES" | "CONTACT" | "BRAND";

interface FooterItem {
  id: string; label: string; url: string | null;
  sortOrder: number; isActive: boolean;
}
interface FooterColumn {
  id: string; title: string; type: ColType;
  isActive: boolean; sortOrder: number;
  items: FooterItem[];
}

const TYPE_LABELS: Record<ColType, string> = {
  BRAND: "لوگو + توضیحات + شبکه‌های اجتماعی",
  LINKS: "لینک‌های دلخواه",
  CATEGORIES: "دسته‌بندی‌های محصول (خودکار)",
  CONTACT: "اطلاعات تماس + نمادها",
};

const TYPE_ICONS: Record<ColType, string> = {
  BRAND: "🏪", LINKS: "🔗", CATEGORIES: "📂", CONTACT: "📞",
};

const inp = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500";

export default function AdminFooterPage() {
  const [columns, setColumns] = useState<FooterColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCol, setExpandedCol] = useState<string | null>(null);

  // فرم ستون جدید
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColForm, setNewColForm] = useState({ title: "", type: "LINKS" as ColType });
  const [addingCol, setAddingCol] = useState(false);

  // فرم آیتم
  const [editingItem, setEditingItem] = useState<{ colId: string; item?: FooterItem } | null>(null);
  const [itemForm, setItemForm] = useState({ label: "", url: "" });

  useEffect(() => {
    fetch("/api/admin/footer").then(r => r.json()).then(d => {
      setColumns(d); setLoading(false);
    });
  }, []);

  async function addColumn() {
    if (!newColForm.title) return;
    setAddingCol(true);
    const res = await fetch("/api/admin/footer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newColForm),
    });
    const data = await res.json();
    setColumns(p => [...p, data]);
    setNewColForm({ title: "", type: "LINKS" });
    setShowAddCol(false); setAddingCol(false);
  }

  async function deleteColumn(id: string) {
    if (!confirm("این ستون حذف شود؟")) return;
    await fetch(`/api/admin/footer/${id}`, { method: "DELETE" });
    setColumns(p => p.filter(c => c.id !== id));
  }

  async function toggleColumn(col: FooterColumn) {
    const res = await fetch(`/api/admin/footer/${col.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...col, isActive: !col.isActive }),
    });
    const data = await res.json();
    setColumns(p => p.map(c => c.id === col.id ? data : c));
  }

  async function moveColumn(idx: number, dir: -1 | 1) {
    const arr = [...columns];
    const t = idx + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[idx], arr[t]] = [arr[t], arr[idx]];
    const updated = arr.map((c, i) => ({ ...c, sortOrder: i + 1 }));
    setColumns(updated);
    await Promise.all(updated.map(c =>
      fetch(`/api/admin/footer/${c.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      })
    ));
  }

  async function saveItem() {
    if (!editingItem || !itemForm.label) return;
    const { colId, item } = editingItem;
    if (item) {
      // ویرایش
      const res = await fetch(`/api/admin/footer/${colId}/items`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, label: itemForm.label, url: itemForm.url, isActive: item.isActive }),
      });
      const data = await res.json();
      setColumns(p => p.map(c => c.id === colId
        ? { ...c, items: c.items.map(i => i.id === item.id ? data : i) }
        : c
      ));
    } else {
      // افزودن
      const res = await fetch(`/api/admin/footer/${colId}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: itemForm.label, url: itemForm.url }),
      });
      const data = await res.json();
      setColumns(p => p.map(c => c.id === colId ? { ...c, items: [...c.items, data] } : c));
    }
    setEditingItem(null); setItemForm({ label: "", url: "" });
  }

  async function deleteItem(colId: string, itemId: string) {
    await fetch(`/api/admin/footer/${colId}/items`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId }),
    });
    setColumns(p => p.map(c => c.id === colId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c));
  }

  async function toggleItem(colId: string, item: FooterItem) {
    const res = await fetch(`/api/admin/footer/${colId}/items`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, label: item.label, url: item.url, isActive: !item.isActive }),
    });
    const data = await res.json();
    setColumns(p => p.map(c => c.id === colId
      ? { ...c, items: c.items.map(i => i.id === item.id ? data : i) }
      : c
    ));
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">مدیریت فوتر</h1>
          <p className="text-sm text-gray-400 mt-1">{columns.length} ستون تعریف شده — {columns.filter(c => c.isActive).length} فعال</p>
        </div>
        <button onClick={() => setShowAddCol(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          افزودن ستون
        </button>
      </div>

      {/* راهنما */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
        <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
          ستون‌های فعال در فوتر سایت نمایش داده می‌شوند. عرض هر ستون بر اساس تعداد ستون‌های فعال محاسبه می‌شود.
          ستون‌های نوع <b>دسته‌بندی</b> و <b>برند</b> اطلاعاتشان خودکار از تنظیمات سایت گرفته می‌شود.
        </p>
      </div>

      {/* فرم ستون جدید */}
      {showAddCol && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 space-y-4">
          <h3 className="font-black text-sm text-gray-900 dark:text-white">ستون جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">عنوان ستون *</label>
              <input className={inp} placeholder="مثلاً: دسترسی سریع"
                value={newColForm.title} onChange={e => setNewColForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">نوع ستون *</label>
              <select className={inp} value={newColForm.type} onChange={e => setNewColForm(f => ({ ...f, type: e.target.value as ColType }))}>
                {(Object.entries(TYPE_LABELS) as [ColType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{TYPE_ICONS[k]} {v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-xs text-gray-500">
            {newColForm.type === "BRAND" && "🏪 لوگو، توضیحات و شبکه‌های اجتماعی از تنظیمات سایت گرفته می‌شود"}
            {newColForm.type === "CATEGORIES" && "📂 دسته‌بندی‌های اصلی فعال سایت به صورت خودکار نمایش داده می‌شوند"}
            {newColForm.type === "CONTACT" && "📞 اطلاعات تماس از تنظیمات سایت + نمادهای اعتماد"}
            {newColForm.type === "LINKS" && "🔗 لینک‌های دلخواه — بعد از ذخیره می‌توانید لینک اضافه کنید"}
          </div>
          <div className="flex gap-3">
            <button onClick={addColumn} disabled={addingCol || !newColForm.title}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-60 hover:bg-blue-700 transition-all">
              {addingCol ? "افزودن..." : "افزودن ستون"}
            </button>
            <button onClick={() => setShowAddCol(false)}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              انصراف
            </button>
          </div>
        </div>
      )}

      {/* لیست ستون‌ها */}
      {columns.length === 0 && !showAddCol ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-400">
          <p className="font-bold">هنوز ستونی تعریف نشده</p>
          <p className="text-xs mt-1">با کلیک روی «افزودن ستون» شروع کنید</p>
        </div>
      ) : (
        <div className="space-y-4">
          {columns.map((col, i) => (
            <div key={col.id} className={`bg-white dark:bg-gray-900 rounded-2xl border ${col.isActive ? "border-gray-200 dark:border-gray-700" : "border-gray-100 dark:border-gray-800 opacity-60"}`}>
              {/* هدر ستون */}
              <div className="flex items-center gap-4 p-5">
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => moveColumn(i, -1)} disabled={i === 0}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 disabled:opacity-30 hover:bg-gray-200 transition-all text-xs">↑</button>
                  <button onClick={() => moveColumn(i, 1)} disabled={i === columns.length - 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 disabled:opacity-30 hover:bg-gray-200 transition-all text-xs">↓</button>
                </div>

                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-lg flex-shrink-0">
                  {TYPE_ICONS[col.type]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-sm text-gray-900 dark:text-white">{col.title}</p>
                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">{TYPE_LABELS[col.type]}</span>
                  </div>
                  {col.type === "LINKS" && (
                    <p className="text-xs text-gray-400 mt-0.5">{col.items.length} لینک — {col.items.filter(i => i.isActive).length} فعال</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {col.type === "LINKS" && (
                    <button onClick={() => { setExpandedCol(expandedCol === col.id ? null : col.id); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${expandedCol === col.id ? "bg-blue-600 text-white" : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100"}`}>
                      {expandedCol === col.id ? "بستن" : "مدیریت لینک‌ها"}
                    </button>
                  )}
                  <button onClick={() => toggleColumn(col)}
                    className={`relative w-11 h-6 rounded-full transition-all ${col.isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${col.isActive ? "right-0.5" : "left-0.5"}`} />
                  </button>
                  <button onClick={() => deleteColumn(col.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* لینک‌های LINKS */}
              {col.type === "LINKS" && expandedCol === col.id && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-5 space-y-3">
                  {/* فرم آیتم */}
                  {editingItem?.colId === col.id && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-black text-blue-700 dark:text-blue-400">
                        {editingItem.item ? "ویرایش لینک" : "افزودن لینک جدید"}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input className={inp} placeholder="عنوان *"
                          value={itemForm.label} onChange={e => setItemForm(f => ({ ...f, label: e.target.value }))} />
                        <input className={inp} dir="ltr" placeholder="آدرس لینک (/products)"
                          value={itemForm.url} onChange={e => setItemForm(f => ({ ...f, url: e.target.value }))} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveItem} disabled={!itemForm.label}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black disabled:opacity-60 hover:bg-blue-700 transition-all">
                          ذخیره
                        </button>
                        <button onClick={() => { setEditingItem(null); setItemForm({ label: "", url: "" }); }}
                          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                          انصراف
                        </button>
                      </div>
                    </div>
                  )}

                  {/* لیست آیتم‌ها */}
                  {col.items.length > 0 && (
                    <div className="space-y-2">
                      {col.items.map(item => (
                        <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl ${item.isActive ? "bg-gray-50 dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-800/50 opacity-50"}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{item.label}</p>
                            {item.url && <p className="text-[10px] text-gray-400" dir="ltr">{item.url}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => toggleItem(col.id, item)}
                              className={`relative w-9 h-5 rounded-full transition-all ${item.isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${item.isActive ? "right-0.5" : "left-0.5"}`} />
                            </button>
                            <button onClick={() => { setEditingItem({ colId: col.id, item }); setItemForm({ label: item.label, url: item.url ?? "" }); }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 transition-all">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => deleteItem(col.id, item.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!editingItem && (
                    <button onClick={() => { setEditingItem({ colId: col.id }); setItemForm({ label: "", url: "" }); }}
                      className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-xs font-black text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      افزودن لینک
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}