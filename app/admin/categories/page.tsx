"use client";

import { useEffect, useState } from "react";
import { slugify } from "@/lib/slugify";

const EMPTY_FORM = {
  title: "", slug: "", parentId: "", description: "",
  imageUrl: "", seoTitle: "", seoDescription: "",
  seoKeywords: "", sortOrder: 0, isActive: true,
};

// ── Tree builder ──────────────────────────────────────────────────────────────
function buildTree(cats: any[]) {
  const map: any = {};
  const roots: any[] = [];
  cats.forEach(c => { map[c.id] = { ...c, children: [] }; });
  cats.forEach(c => {
    if (c.parentId) map[c.parentId]?.children.push(map[c.id]);
    else roots.push(map[c.id]);
  });
  return roots;
}

// ── TreeNode ──────────────────────────────────────────────────────────────────
function TreeNode({ node, level, expanded, onToggle, onEdit, onDelete }: any) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded[node.id];

  return (
    <div>
      <div
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors ${level > 0 ? "mr-6" : ""}`}
      >
        {/* toggle */}
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="w-5 h-5 flex items-center justify-center rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all flex-shrink-0"
          >
            <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : (
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-white/20" />
          </div>
        )}

        {}
        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/[0.06] flex items-center justify-center">
          {node.imageUrl ? (
            <img src={node.imageUrl} alt={node.title} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10" />
            </svg>
          )}
        </div>

        {}
        <div className="flex-1 min-w-0">
          <p className={`font-black text-gray-900 dark:text-white truncate ${level === 0 ? "text-sm" : "text-xs"}`}>
            {node.title}
          </p>
          <p className="text-[10px] text-gray-400 truncate">{node.slug}</p>
        </div>

        {}
        {hasChildren && (
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0">
            {node.children.length} زیردسته
          </span>
        )}

        {}
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border flex-shrink-0 ${
          node.isActive
            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
            : "bg-gray-50 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10"
        }`}>
          {node.isActive ? "فعال" : "غیرفعال"}
        </span>

        {}
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onEdit(node)}
            className="w-7 h-7 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(node.id)}
            className="w-7 h-7 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-500/30 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {}
      {hasChildren && isOpen && (
        <div className="border-r border-gray-100 dark:border-white/[0.06] mr-[22px]">
          {node.children.map((child: any) => (
            <TreeNode key={child.id} node={child} level={level + 1}
              expanded={expanded} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── CategoryAttributeGroups component ─────────────────────────────────────────
function CategoryAttributeGroups({ categoryId }: { categoryId: string }) {
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [linkedGroups, setLinkedGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [categoryId]);

  async function loadData() {
    setLoading(true);
    try {
      const [allRes, linkedRes] = await Promise.all([
        fetch("/api/admin/attribute-groups"),
        fetch(`/api/admin/categories/${categoryId}/attribute-groups`),
      ]);

      const all = await allRes.json();
      const linked = await linkedRes.json();

      setAllGroups(all);
      setLinkedGroups(linked);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleGroup(groupId: string) {
    const isLinked = linkedGroups.some(lg => lg.attributeGroupId === groupId);

    setSaving(true);
    try {
      if (isLinked) {
        await fetch(`/api/admin/categories/${categoryId}/attribute-groups`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attributeGroupId: groupId }),
        });
      } else {
        await fetch(`/api/admin/categories/${categoryId}/attribute-groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attributeGroupId: groupId }),
        });
      }
      loadData();
    } catch (err) {
      alert("خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        در حال بارگذاری...
      </div>
    );
  }

  if (allGroups.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/[0.06]">
        هنوز گروه ویژگی‌ای تعریف نشده.{" "}
        <a href="/admin/attribute-groups" className="text-blue-600 hover:underline">
          ایجاد گروه جدید
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/[0.06]">
      {allGroups.map(group => {
        const isLinked = linkedGroups.some(lg => lg.attributeGroupId === group.id);
        return (
          <label
            key={group.id}
            className="flex items-center gap-3 p-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl cursor-pointer hover:border-blue-300 dark:hover:border-blue-500/30 transition-all"
          >
            <input
              type="checkbox"
              checked={isLinked}
              disabled={saving}
              onChange={() => toggleGroup(group.id)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {group.title}
              </p>
              <p className="text-xs text-gray-400">
                {group.attributes?.length || 0} ویژگی
              </p>
            </div>
            {isLinked && (
              <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-lg">
                متصل
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSeo, setShowSeo] = useState(false);

  async function fetchCategories() {
    const res = await fetch("/api/admin/categories");
    setCategories(await res.json());
  }

  useEffect(() => { fetchCategories(); }, []);

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
    await fetch("/api/admin/categories", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
    });
    setSaving(false);
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
    setShowSeo(false);
    fetchCategories();
  }

  function handleEdit(cat: any) {
    setEditing(cat);
    setForm({ ...cat, parentId: cat.parentId || "" });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!confirm("این دسته‌بندی حذف شود؟")) return;
    await fetch("/api/admin/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchCategories();
  }

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function cancelForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
    setShowSeo(false);
  }

  const tree = buildTree(categories);
  const rootCount = categories.filter(c => !c.parentId).length;
  const childCount = categories.filter(c => c.parentId).length;

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      {}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">دسته‌بندی‌ها</h1>
          <p className="text-xs text-gray-500 mt-0.5">{rootCount} دسته اصلی — {childCount} زیردسته</p>
        </div>
        <button
          onClick={() => { cancelForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-500/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          دسته جدید
        </button>
      </div>

      {}
      {showForm && (
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
            <h2 className="text-sm font-black text-gray-900 dark:text-white">
              {editing ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}
            </h2>
            <button onClick={cancelForm} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">عنوان *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => handleChange("title", e.target.value)}
                  placeholder="نام دسته‌بندی"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">Slug *</label>
                <input
                  required
                  value={form.slug}
                  onChange={e => handleChange("slug", slugify(e.target.value))}
                  placeholder="category-slug"
                  dir="ltr"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">دسته والد</label>
                <select
                  value={form.parentId}
                  onChange={e => handleChange("parentId", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">بدون والد (ریشه)</option>
                  {categories.filter(c => !c.parentId && c.id !== editing?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">ترتیب نمایش</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={e => handleChange("sortOrder", +e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">توضیحات</label>
              <textarea
                value={form.description}
                onChange={e => handleChange("description", e.target.value)}
                rows={2}
                placeholder="توضیح کوتاه درباره دسته‌بندی..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all resize-none"
              />
            </div>

            {}
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">تصویر دسته‌بندی</label>
                <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-white/10 cursor-pointer hover:border-blue-400 transition-all">
                  {uploading ? (
                    <span className="text-xs text-gray-400">در حال آپلود...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-gray-500">انتخاب تصویر</span>
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
                      handleChange("imageUrl", data.url);
                      setUploading(false);
                    }} />
                </label>
              </div>
              {form.imageUrl && (
                <div className="relative flex-shrink-0">
                  <img src={form.imageUrl} alt="" className="w-16 h-16 object-cover rounded-xl border border-gray-100 dark:border-white/[0.06]" />
                  <button type="button" onClick={() => handleChange("imageUrl", "")}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">
                    ×
                  </button>
                </div>
              )}
            </div>

            {}
            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <div
                onClick={() => handleChange("isActive", !form.isActive)}
                className={`w-12 h-6 rounded-full transition-colors ${form.isActive ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"} relative`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "-translate-x-1" : "-translate-x-7"}`} />
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">دسته‌بندی فعال باشد</span>
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
            {editing && (
              <div className="mt-6">
                <h3 className="text-sm font-black text-gray-700 dark:text-gray-300 mb-3">
                  گروه‌های ویژگی مرتبط
                </h3>
                <CategoryAttributeGroups categoryId={editing.id} />
              </div>
            )}

            {}
            <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all">
                {saving ? "در حال ذخیره..." : editing ? "بروزرسانی" : "ذخیره دسته‌بندی"}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
          </svg>
          <span className="text-sm font-black text-gray-900 dark:text-white">ساختار دسته‌بندی‌ها</span>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full mr-auto">
            {categories.length} دسته کل
          </span>
        </div>

        <div className="p-3">
          {tree.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 12h10M4 18h7" />
              </svg>
              <p className="text-sm">هنوز دسته‌بندی‌ای ثبت نشده</p>
            </div>
          ) : (
            tree.map(node => (
              <TreeNode key={node.id} node={node} level={0}
                expanded={expanded} onToggle={toggle}
                onEdit={handleEdit} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
