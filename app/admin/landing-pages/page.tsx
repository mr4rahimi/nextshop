"use client";

import { useEffect, useState, useCallback } from "react";

type Cat = { id: string; title: string; slug: string };
type AttrOpt = { title: string; slug: string; values: { value: string; slug: string }[] };
type Row = {
  id: string; slug: string; categoryId: string; filters: Record<string, string>;
  title: string; h1: string; description: string; intro: string | null; bodyHtml: string | null;
  isActive: boolean; isIndexable: boolean; sortOrder: number;
  category: { title: string; slug: string };
};

const EMPTY = {
  id: "", slug: "", categoryId: "", filters: {} as Record<string, string>,
  title: "", h1: "", description: "", intro: "", bodyHtml: "",
  isActive: true, isIndexable: true, sortOrder: 0,
};

export default function LandingPagesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [brands, setBrands] = useState<{ title: string; slug: string }[]>([]);
  const [attrs, setAttrs] = useState<AttrOpt[]>([]);
  const [categorySlug, setCategorySlug] = useState("");
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; count: number; errors: string[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      fetch("/api/admin/landing-pages").then(r => r.json()),
      fetch("/api/admin/landing-pages/filter-options").then(r => r.json()),
    ]);
    setRows(r1); setCats(r2.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // بارگذاری فیلترهای دسته انتخاب‌شده
  useEffect(() => {
    if (!form.categoryId) { setBrands([]); setAttrs([]); setCategorySlug(""); return; }
    fetch(`/api/admin/landing-pages/filter-options?categoryId=${form.categoryId}`)
      .then(r => r.json())
      .then(d => { setBrands(d.brands ?? []); setAttrs(d.attributes ?? []); setCategorySlug(d.categorySlug ?? ""); });
  }, [form.categoryId]);

  const setFilter = (key: string, val: string) => {
    setCheck(null);
    setForm(f => {
      const next = { ...f.filters };
      if (!val) delete next[key]; else next[key] = val;
      return { ...f, filters: next };
    });
  };

  async function validate() {
    const res = await fetch("/api/admin/landing-pages/validate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug, filters: form.filters }),
    });
    setCheck(await res.json());
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const url = editing ? `/api/admin/landing-pages/${form.id}` : "/api/admin/landing-pages";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.message ?? "خطا در ذخیره"); return; }
      setForm({ ...EMPTY }); setEditing(false); setCheck(null);
      await load();
      setMsg("ذخیره شد");
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("حذف شود؟ لینک‌های ایندکس‌شده به این صفحه ۴۰۴ خواهند شد.")) return;
    await fetch(`/api/admin/landing-pages/${id}`, { method: "DELETE" });
    load();
  }

  function edit(r: Row) {
    setForm({
      id: r.id, slug: r.slug, categoryId: r.categoryId, filters: r.filters,
      title: r.title, h1: r.h1, description: r.description,
      intro: r.intro ?? "", bodyHtml: r.bodyHtml ?? "",
      isActive: r.isActive, isIndexable: r.isIndexable, sortOrder: r.sortOrder,
    });
    setEditing(true); setCheck(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const inputCls = "w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm";
  const labelCls = "block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5";

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-black">صفحات فرود سئو</h1>

      {/* فرم */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-6 space-y-5">
        <h2 className="font-black">{editing ? "ویرایش صفحه فرود" : "صفحه فرود جدید"}</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>دسته‌بندی *</label>
            <select className={inputCls} value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value, filters: {} }))}>
              <option value="">انتخاب کنید</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>نشانی (خالی = خودکار از H1)</label>
            <input className={inputCls} dir="ltr" value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="printer-laser-single-function" />
          </div>
        </div>

        {/* فیلترها */}
        {form.categoryId && (
          <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-4 space-y-3">
            <p className="text-xs font-black">فیلترها *</p>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>برند</label>
                <select className={inputCls} value={form.filters.brand ?? ""}
                  onChange={e => setFilter("brand", e.target.value)}>
                  <option value="">—</option>
                  {brands.map(b => <option key={b.slug} value={b.slug}>{b.title}</option>)}
                </select>
              </div>
              {attrs.map(a => (
                <div key={a.slug}>
                  <label className={labelCls}>{a.title}</label>
                  <select className={inputCls} value={form.filters[a.slug] ?? ""}
                    onChange={e => setFilter(a.slug, e.target.value)}>
                    <option value="">—</option>
                    {a.values.map(v => <option key={v.slug} value={v.slug}>{v.value}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={validate} type="button"
                className="rounded-xl bg-gray-900 dark:bg-white/10 text-white px-4 py-2 text-xs font-bold">
                اعتبارسنجی و شمارش محصول
              </button>
              {check && (
                <span className={`text-xs font-bold ${check.ok && check.count > 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {check.ok
                    ? (check.count > 0
                        ? `${check.count} محصول یافت شد`
                        : "هیچ محصولی ندارد — این صفحه را نساز")
                    : check.errors.join("، ")}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>عنوان صفحه (title) *</label>
            <input className={inputCls} value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <p className="text-[10px] text-gray-400 mt-1">{form.title.length} کاراکتر (بهینه: زیر ۶۰)</p>
          </div>
          <div>
            <label className={labelCls}>H1 *</label>
            <input className={inputCls} value={form.h1}
              onChange={e => setForm(f => ({ ...f, h1: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className={labelCls}>توضیحات متا *</label>
          <textarea className={inputCls} rows={2} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <p className="text-[10px] text-gray-400 mt-1">{form.description.length} کاراکتر (بهینه: ۱۲۰ تا ۱۶۰)</p>
        </div>

        <div>
          <label className={labelCls}>متن معرفی (بالای لیست)</label>
          <textarea className={inputCls} rows={3} value={form.intro}
            onChange={e => setForm(f => ({ ...f, intro: e.target.value }))} />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
            فعال
          </label>
          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={form.isIndexable}
              onChange={e => setForm(f => ({ ...f, isIndexable: e.target.checked }))} />
            قابل ایندکس
          </label>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold">ترتیب</label>
            <input type="number" className="w-20 rounded-lg border px-2 py-1 text-sm" value={form.sortOrder}
              onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} />
          </div>
        </div>

        {msg && <p className="text-xs font-bold text-primary-600">{msg}</p>}

        <div className="flex gap-3">
          <button onClick={save} disabled={saving}
            className="rounded-xl bg-primary-600 text-white px-6 py-2.5 text-sm font-black disabled:opacity-50">
            {saving ? "..." : editing ? "بروزرسانی" : "ایجاد"}
          </button>
          {editing && (
            <button onClick={() => { setForm({ ...EMPTY }); setEditing(false); setCheck(null); }}
              className="rounded-xl border px-6 py-2.5 text-sm font-bold">انصراف</button>
          )}
        </div>
      </div>

      {/* لیست */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">در حال بارگذاری...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">هنوز صفحه فرودی ساخته نشده.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/5 text-xs">
              <tr>
                <th className="p-3 text-right">H1</th>
                <th className="p-3 text-right">دسته</th>
                <th className="p-3 text-right">نشانی</th>
                <th className="p-3 text-right">وضعیت</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-white/5">
                  <td className="p-3 font-bold">{r.h1}</td>
                  <td className="p-3 text-gray-500">{r.category.title}</td>
                  <td className="p-3">
                    <a href={`/collections/${r.slug}`} target="_blank" rel="noreferrer"
                      className="text-primary-600 text-xs" dir="ltr">/collections/{r.slug}</a>
                  </td>
                  <td className="p-3 text-xs">
                    {!r.isActive ? <span className="text-gray-400">غیرفعال</span>
                      : r.isIndexable ? <span className="text-emerald-600">ایندکس</span>
                      : <span className="text-amber-600">noindex</span>}
                  </td>
                  <td className="p-3 flex gap-2 justify-end">
                    <button onClick={() => edit(r)} className="text-xs font-bold text-primary-600">ویرایش</button>
                    <button onClick={() => remove(r.id)} className="text-xs font-bold text-red-600">حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}