"use client";

import { useEffect, useMemo, useState } from "react";

type AttributeValue = {
  id: string;
  value: string;
  slug?: string | null;
  sortOrder: number;
};

type Attribute = {
  id: string;
  title: string;
  slug: string;
  isFilterable: boolean;
  sortOrder: number;
  values: AttributeValue[];
};

type AttributeGroup = {
  id: string;
  title: string;
  isActive: boolean;
  sortOrder: number;
  attributes: Attribute[];
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

export default function AttributeGroupsPage() {
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedAttribute, setSelectedAttribute] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [groupTitle, setGroupTitle] = useState("");
  const [attributeTitle, setAttributeTitle] = useState("");
  const [attributeSlug, setAttributeSlug] = useState("");
  const [valueTitle, setValueTitle] = useState("");
  const [valueSlug, setValueSlug] = useState("");

  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingAttribute, setEditingAttribute] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{
    type: "group" | "attribute" | "value";
    id: string;
    title: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/attribute-groups");
      if (!res.ok) throw new Error("خطا در دریافت داده‌ها");
      const data = await res.json();
      setGroups(data);

      if (data.length && !selectedGroup) {
        setSelectedGroup(data[0].id);
      }
    } catch (err) {
      console.error(err);
      alert("خطا در بارگذاری داده‌ها");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroup),
    [groups, selectedGroup]
  );

  const currentAttribute = useMemo(
    () => currentGroup?.attributes?.find((a) => a.id === selectedAttribute),
    [currentGroup, selectedAttribute]
  );

  async function createGroup() {
    if (!groupTitle.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/attribute-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: groupTitle }),
      });

      if (!res.ok) throw new Error("خطا در ایجاد گروه");

      setGroupTitle("");
      load();
    } catch (err) {
      console.error(err);
      alert("خطا در ایجاد گروه");
    } finally {
      setSaving(false);
    }
  }

  async function updateGroup(id: string, title: string) {
    if (!title.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/attribute-groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title }),
      });

      if (!res.ok) throw new Error("خطا در ویرایش گروه");

      setEditingGroup(null);
      load();
    } catch (err) {
      console.error(err);
      alert("خطا در ویرایش گروه");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attribute-groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("خطا در حذف گروه");

      if (selectedGroup === id) {
        setSelectedGroup("");
        setSelectedAttribute("");
      }
      setConfirmDelete(null);
      load();
    } catch (err) {
      console.error(err);
      alert("خطا در حذف گروه");
    } finally {
      setSaving(false);
    }
  }

  async function createAttribute() {
    if (!selectedGroup || !attributeTitle.trim()) return;
    setSaving(true);

    const finalSlug = attributeSlug.trim() || slugify(attributeTitle);

    try {
      const res = await fetch("/api/admin/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedGroup,
          title: attributeTitle,
          slug: finalSlug,
          isFilterable: true,
        }),
      });

      if (!res.ok) throw new Error("خطا در ایجاد ویژگی");

      setAttributeTitle("");
      setAttributeSlug("");
      load();
    } catch (err) {
      console.error(err);
      alert("خطا در ایجاد ویژگی (احتمالاً slug تکراری است)");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAttribute(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attributes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("خطا در حذف ویژگی");

      if (selectedAttribute === id) {
        setSelectedAttribute("");
      }
      setConfirmDelete(null);
      load();
    } catch (err) {
      console.error(err);
      alert("خطا در حذف ویژگی");
    } finally {
      setSaving(false);
    }
  }

  async function createValue() {
    if (!selectedAttribute || !valueTitle.trim()) return;
    setSaving(true);

    const finalSlug = valueSlug.trim() || slugify(valueTitle);

    try {
      const res = await fetch("/api/admin/attribute-values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attributeId: selectedAttribute,
          value: valueTitle,
          slug: finalSlug,
        }),
      });

      if (!res.ok) throw new Error("خطا در ایجاد مقدار");

      setValueTitle("");
      setValueSlug("");
      load();
    } catch (err) {
      console.error(err);
      alert("خطا در ایجاد مقدار");
    } finally {
      setSaving(false);
    }
  }

  async function deleteValue(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attribute-values", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("خطا در حذف مقدار");

      setConfirmDelete(null);
      load();
    } catch (err) {
      console.error(err);
      alert("خطا در حذف مقدار");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      {}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 dark:text-white mb-2">
              حذف {confirmDelete.type === "group" ? "گروه" : confirmDelete.type === "attribute" ? "ویژگی" : "مقدار"}
            </h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-bold">{confirmDelete.title}</span>
            </p>
            <p className="text-sm text-gray-500 mb-6">این عملیات برگشت‌پذیر نیست. مطمئنید؟</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={saving}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-black transition-all"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === "group") deleteGroup(confirmDelete.id);
                  else if (confirmDelete.type === "attribute") deleteAttribute(confirmDelete.id);
                  else deleteValue(confirmDelete.id);
                }}
                disabled={saving}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all"
              >
                {saving ? "در حال حذف..." : "حذف کن"}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">مدیریت ویژگی‌ها</h1>
          <p className="text-xs text-gray-500 mt-0.5">{groups.length} گروه ویژگی تعریف شده</p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">در حال بارگذاری...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4">
            <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">گروه‌های ویژگی</h2>

            <div className="flex gap-2 mb-4">
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createGroup()}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                placeholder="عنوان گروه جدید"
                disabled={saving}
              />
              <button
                onClick={createGroup}
                disabled={saving || !groupTitle.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all"
              >
                +
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {groups.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">هنوز گروهی تعریف نشده</div>
              ) : (
                groups.map((g) => (
                  <div
                    key={g.id}
                    className={`group flex items-center gap-2 p-3 rounded-xl border transition-all ${
                      selectedGroup === g.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                        : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                    }`}
                  >
                    {editingGroup === g.id ? (
                      <>
                        <input
                          defaultValue={g.title}
                          onBlur={(e) => {
                            if (e.target.value.trim()) updateGroup(g.id, e.target.value);
                            setEditingGroup(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.currentTarget.value.trim()) {
                              updateGroup(g.id, e.currentTarget.value);
                            }
                            if (e.key === "Escape") setEditingGroup(null);
                          }}
                          autoFocus
                          className="flex-1 px-2 py-1 rounded border border-blue-500 text-sm"
                        />
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setSelectedGroup(g.id);
                            setSelectedAttribute("");
                          }}
                          className="flex-1 text-right text-sm font-bold text-gray-900 dark:text-white"
                        >
                          {g.title}
                          <span className="text-xs text-gray-400 mr-2">
                            ({g.attributes?.length || 0})
                          </span>
                        </button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingGroup(g.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ type: "group", id: g.id, title: g.title })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4">
            <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">ویژگی‌ها</h2>

            {currentGroup ? (
              <>
                <div className="space-y-2 mb-4">
                  <input
                    value={attributeTitle}
                    onChange={(e) => setAttributeTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createAttribute()}
                    placeholder="عنوان ویژگی"
                    disabled={saving}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                  />
                  <input
                    value={attributeSlug}
                    onChange={(e) => setAttributeSlug(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createAttribute()}
                    placeholder="slug (اختیاری - خودکار ساخته می‌شود)"
                    disabled={saving}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                  />
                  <button
                    onClick={createAttribute}
                    disabled={saving || !attributeTitle.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-black transition-all"
                  >
                    {saving ? "در حال افزودن..." : "افزودن ویژگی"}
                  </button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {!currentGroup.attributes || currentGroup.attributes.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">هنوز ویژگی‌ای اضافه نشده</div>
                  ) : (
                    currentGroup.attributes.map((a) => (
                      <div
                        key={a.id}
                        className={`group flex items-center gap-2 p-3 rounded-xl border transition-all ${
                          selectedAttribute === a.id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                            : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                        }`}
                      >
                        <button
                          onClick={() => setSelectedAttribute(a.id)}
                          className="flex-1 text-right"
                        >
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{a.title}</p>
                          <p className="text-xs text-gray-400" dir="ltr">
                            {a.slug} • {a.values?.length || 0} مقدار
                          </p>
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ type: "attribute", id: a.id, title: a.title })}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-xs text-gray-400">ابتدا یک گروه انتخاب کنید</div>
            )}
          </div>

          {}
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4">
            <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">مقادیر</h2>

            {currentAttribute ? (
              <>
                <div className="space-y-2 mb-4">
                  <input
                    value={valueTitle}
                    onChange={(e) => setValueTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createValue()}
                    placeholder="مقدار"
                    disabled={saving}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                  />
                  <input
                    value={valueSlug}
                    onChange={(e) => setValueSlug(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createValue()}
                    placeholder="slug (اختیاری)"
                    disabled={saving}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                  />
                  <button
                    onClick={createValue}
                    disabled={saving || !valueTitle.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-black transition-all"
                  >
                    {saving ? "در حال افزودن..." : "افزودن مقدار"}
                  </button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {!currentAttribute.values || currentAttribute.values.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">هنوز مقداری اضافه نشده</div>
                  ) : (
                    currentAttribute.values.map((v) => (
                      <div
                        key={v.id}
                        className="group flex items-center gap-2 p-3 border border-gray-200 dark:border-white/10 rounded-xl hover:border-gray-300 dark:hover:border-white/20 transition-all"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{v.value}</p>
                          {v.slug && (
                            <p className="text-xs text-gray-400" dir="ltr">
                              {v.slug}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setConfirmDelete({ type: "value", id: v.id, title: v.value })}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-xs text-gray-400">ابتدا یک ویژگی انتخاب کنید</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
