"use client";

import { useEffect, useState } from "react";

interface Category {
  id: string; title: string; slug: string; imageUrl: string | null;
  children: { id: string; title: string; slug: string; imageUrl: string | null }[];
}
interface MegaMenuCat {
  id: string; sortOrder: number; isActive: boolean;
  category: Category;
}
interface MenuItem {
  id: string; title: string; url: string | null;
  sortOrder: number; isActive: boolean; openInNewTab: boolean;
}
interface AllCategories {
  id: string; title: string; slug: string; imageUrl: string | null; parentId: string | null;
}

const EMPTY_ITEM = { title: "", url: "", openInNewTab: false };

export default function AdminMenuPage() {
  const [megaMenuCats, setMegaMenuCats] = useState<MegaMenuCat[]>([]);
  const [menuItems, setMenuItems]       = useState<MenuItem[]>([]);
  const [allCats, setAllCats]           = useState<AllCategories[]>([]);
  const [tab, setTab]                   = useState<"mega" | "links">("mega");
  const [loading, setLoading]           = useState(true);

  const [selectedCatId, setSelectedCatId] = useState("");
  const [addingMega, setAddingMega]       = useState(false);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingItem, setEditingItem]   = useState<MenuItem | null>(null);
  const [linkForm, setLinkForm]         = useState({ ...EMPTY_ITEM });
  const [savingLink, setSavingLink]     = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/menu").then(r => r.json()),
      fetch("/api/admin/categories").then(r => r.json()),
    ]).then(([menu, cats]) => {
      setMegaMenuCats(menu.megaMenuCats ?? []);
      setMenuItems(menu.menuItems ?? []);
      setAllCats(cats ?? []);
      setLoading(false);
    });
  }, []);

  const availableCats = allCats.filter(c =>
    c.parentId === null && !megaMenuCats.find(m => m.category.id === c.id)
  );

  async function addMegaCat() {
    if (!selectedCatId) return;
    setAddingMega(true);
    const res = await fetch("/api/admin/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "megaMenu", categoryId: selectedCatId }),
    });
    const data = await res.json();
    if (res.ok) { setMegaMenuCats(prev => [...prev, data]); setSelectedCatId(""); }
    setAddingMega(false);
  }

  async function removeMegaCat(id: string) {
    await fetch("/api/admin/menu", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type: "megaMenu" }) });
    setMegaMenuCats(prev => prev.filter(m => m.id !== id));
  }

  async function toggleMegaCat(item: MegaMenuCat) {
    const res = await fetch("/api/admin/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "toggleMega", id: item.id, isActive: !item.isActive }),
    });
    const data = await res.json();
    setMegaMenuCats(prev => prev.map(m => m.id === item.id ? { ...m, isActive: data.isActive } : m));
  }

  async function moveMega(index: number, dir: -1 | 1) {
    const arr = [...megaMenuCats];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    const updated = arr.map((m, i) => ({ ...m, sortOrder: i + 1 }));
    setMegaMenuCats(updated);
    await fetch("/api/admin/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "reorderMega", items: updated.map(m => ({ id: m.id, sortOrder: m.sortOrder })) }),
    });
  }

  async function saveLink() {
    if (!linkForm.title) return;
    setSavingLink(true);
    if (editingItem) {
      const res = await fetch("/api/admin/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "updateMenuItem", id: editingItem.id, ...linkForm, isActive: editingItem.isActive }),
      });
      const data = await res.json();
      setMenuItems(prev => prev.map(m => m.id === editingItem.id ? data : m));
    } else {
      const res = await fetch("/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...linkForm }),
      });
      const data = await res.json();
      setMenuItems(prev => [...prev, data]);
    }
    setShowLinkForm(false); setEditingItem(null); setLinkForm({ ...EMPTY_ITEM });
    setSavingLink(false);
  }

  async function removeLink(id: string) {
    await fetch("/api/admin/menu", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type: "link" }) });
    setMenuItems(prev => prev.filter(m => m.id !== id));
  }

  async function moveLink(index: number, dir: -1 | 1) {
    const arr = [...menuItems];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    const updated = arr.map((m, i) => ({ ...m, sortOrder: i + 1 }));
    setMenuItems(updated);
    await fetch("/api/admin/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "reorderMenu", items: updated.map(m => ({ id: m.id, sortOrder: m.sortOrder })) }),
    });
  }

  if (loading) return <div className="p-6 text-gray-400">در حال بارگذاری...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">مدیریت منوی هدر</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
        {[{ key: "mega", label: "مگامنو (دسته‌بندی‌ها)" }, { key: "links", label: "لینک‌های منو" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${tab === t.key ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {}
      {tab === "mega" && (
        <div className="space-y-6">
          {}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-xs text-blue-700 dark:text-blue-300 font-bold">
            دسته‌بندی‌های اصلی که انتخاب می‌کنید در مگامنو نمایش داده می‌شوند. زیردسته‌های هر کدام به صورت خودکار نمایش داده می‌شوند.
          </div>

          {}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">افزودن دسته‌بندی به مگامنو</h3>
            <div className="flex gap-3">
              <select className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)}>
                <option value="">انتخاب دسته‌بندی اصلی...</option>
                {availableCats.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button onClick={addMegaCat} disabled={!selectedCatId || addingMega}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black disabled:opacity-60 hover:bg-blue-700 transition-all">
                {addingMega ? "افزودن..." : "افزودن"}
              </button>
            </div>
            {availableCats.length === 0 && (
              <p className="text-xs text-gray-400 mt-2">همه دسته‌های اصلی در مگامنو هستند.</p>
            )}
          </div>

          {}
          <div className="space-y-3">
            {megaMenuCats.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-400">
                هنوز دسته‌ای اضافه نشده
              </div>
            ) : megaMenuCats.map((item, i) => (
              <div key={item.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-4">
                  {}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex-shrink-0">
                    {item.category.imageUrl
                      ? <img src={item.category.imageUrl} alt={item.category.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-black">{item.category.title.charAt(0)}</div>
                    }
                  </div>

                  {}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm text-gray-900 dark:text-white">{item.category.title}</p>
                      <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                        {item.category.children.length} زیردسته
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.category.children.slice(0, 5).map(c => (
                        <span key={c.id} className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-100 dark:border-gray-700">
                          {c.title}
                        </span>
                      ))}
                      {item.category.children.length > 5 && (
                        <span className="text-[10px] text-gray-400">+{item.category.children.length - 5} بیشتر</span>
                      )}
                    </div>
                  </div>

                  {}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveMega(i, -1)} disabled={i === 0}
                        className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-xs flex items-center justify-center">↑</button>
                      <button onClick={() => moveMega(i, 1)} disabled={i === megaMenuCats.length - 1}
                        className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-xs flex items-center justify-center">↓</button>
                    </div>
                    <button onClick={() => toggleMegaCat(item)}
                      className={`relative w-11 h-6 rounded-full transition-all ${item.isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${item.isActive ? "right-0.5" : "left-0.5"}`} />
                    </button>
                    <button onClick={() => removeMegaCat(item.id)}
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
        </div>
      )}

      {}
      {tab === "links" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setEditingItem(null); setLinkForm({ ...EMPTY_ITEM }); setShowLinkForm(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              افزودن لینک
            </button>
          </div>

          {}
          {showLinkForm && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 space-y-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">
                {editingItem ? "ویرایش لینک" : "افزودن لینک جدید"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">عنوان *</label>
                  <input className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    placeholder="مثلاً: پرفروش‌ترین‌ها"
                    value={linkForm.title} onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">آدرس لینک</label>
                  <input dir="ltr" className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500"
                    placeholder="/products یا https://..."
                    value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={linkForm.openInNewTab} onChange={e => setLinkForm(f => ({ ...f, openInNewTab: e.target.checked }))} />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-blue-500 rounded-full transition-all" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all peer-checked:translate-x-5" />
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">باز شدن در تب جدید</span>
              </label>
              <div className="flex gap-3">
                <button onClick={saveLink} disabled={savingLink || !linkForm.title}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 hover:bg-blue-700 transition-all">
                  {savingLink ? "ذخیره..." : editingItem ? "ذخیره" : "افزودن"}
                </button>
                <button onClick={() => { setShowLinkForm(false); setEditingItem(null); }}
                  className="px-6 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  انصراف
                </button>
              </div>
            </div>
          )}

          {}
          <div className="space-y-3">
            {menuItems.length === 0 && !showLinkForm ? (
              <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-400">
                هنوز لینکی اضافه نشده
              </div>
            ) : menuItems.map((item, i) => (
              <div key={item.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => moveLink(i, -1)} disabled={i === 0}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 disabled:opacity-30 hover:bg-gray-200 transition-all text-xs flex items-center justify-center">↑</button>
                    <button onClick={() => moveLink(i, 1)} disabled={i === menuItems.length - 1}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 disabled:opacity-30 hover:bg-gray-200 transition-all text-xs flex items-center justify-center">↓</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-gray-900 dark:text-white">{item.title}</p>
                    {item.url && <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{item.url}</p>}
                    {item.openInNewTab && <span className="text-[10px] text-blue-500 font-bold">↗ تب جدید</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${item.isActive ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                      {item.isActive ? "فعال" : "غیرفعال"}
                    </span>
                    <button onClick={() => { setEditingItem(item); setLinkForm({ title: item.title, url: item.url ?? "", openInNewTab: item.openInNewTab }); setShowLinkForm(true); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => removeLink(item.id)}
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
        </div>
      )}
    </div>
  );
}
