"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category { id: string; title: string }
interface Brand    { id: string; title: string }
interface SpecGroup { id: string; title: string; items: { id: string; title: string }[] }
interface FaqItem  { q: string; a: string }
interface SpecRow  { specItemId: string; title: string; value: string }
interface RelatedSettings {
  categoryEnabled: boolean;
  categorySort: "newest" | "popular";
  brandEnabled: boolean;
  brandSort: "newest" | "popular";
}

export interface FormState {
  title: string; slug: string; categoryId: string; brandId: string;
  shortDescription: string;
  expertTitle: string; expertDescription: string; expertImage: string;
  summaryTitle: string; summaryDescription: string; summaryImage: string; summaryFeatures: string[];
  videoUrl: string; mainImage: string;
  features: string[]; colors: string[];
  price: string; salePrice: string; warranty: string;
  stock: string; trackStock: boolean; lowStockThreshold: string;
  faq: FaqItem[];
  seoTitle: string; seoDescription: string; seoKeywords: string; seoSchema: string;
  isActive: boolean;
  images: string[]; specs: SpecRow[];
  relatedSettings: RelatedSettings;
  downloadTitle: string;
  downloadUrl: string;
}

export const EMPTY_FORM: FormState = {
  title: "", slug: "", categoryId: "", brandId: "",
  shortDescription: "",
  expertTitle: "", expertDescription: "", expertImage: "",
  summaryTitle: "", summaryDescription: "", summaryImage: "", summaryFeatures: [],
  videoUrl: "", mainImage: "",
  features: [], colors: [],
  price: "", salePrice: "", warranty: "",
  downloadTitle: "", downloadUrl: "",
  stock: "", trackStock: false, lowStockThreshold: "3",
  faq: [],
  seoTitle: "", seoDescription: "", seoKeywords: "", seoSchema: "",
  isActive: true,
  images: [], specs: [],
  relatedSettings: { categoryEnabled: false, categorySort: "newest", brandEnabled: false, brandSort: "newest" },
};

function slugify(str: string) {
  return str.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^\w\-]/g, "");
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-black text-gray-900 dark:text-white flex-1 text-right">{title}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-white/[0.04] pt-4">{children}</div>}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-black text-gray-700 dark:text-gray-300">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

// ── Input styles ──────────────────────────────────────────────────────────────
const inp = "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all";
const ta  = `${inp} resize-none`;

// ── AttributesSection component ───────────────────────────────────────────────
function AttributesSection({ categoryId, productId }: { categoryId: string; productId?: string }) {
  const [attributeGroups, setAttributeGroups] = useState<any[]>([]);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setAttributeGroups([]);
      return;
    }

    setLoading(true);
    fetch(`/api/admin/categories/${categoryId}/attribute-groups`)
      .then(r => r.json())
      .then(data => {
        setAttributeGroups(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [categoryId]);

  useEffect(() => {
    if (!productId) return;

    fetch(`/api/admin/products/${productId}/attributes`)
      .then(r => r.json())
      .then((attrs: any[]) => {
        const values: Record<string, string> = {};
        attrs.forEach(attr => {
          values[attr.attributeId] = attr.attributeValueId;
        });
        setSelectedValues(values);
      })
      .catch(() => {});
  }, [productId]);

  async function saveAttributes() {
    if (!productId) {
      alert("ابتدا محصول را ذخیره کنید");
      return;
    }

    setSaving(true);
    try {
      const attributes = Object.entries(selectedValues)
        .filter(([_, valueId]) => valueId)
        .map(([attributeId, attributeValueId]) => ({
          attributeId,
          attributeValueId,
        }));

      await fetch(`/api/admin/products/${productId}/attributes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes }),
      });

      alert("ویژگی‌ها ذخیره شد");
    } catch (err) {
      alert("خطا در ذخیره ویژگی‌ها");
    } finally {
      setSaving(false);
    }
  }

  if (!categoryId) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        ابتدا دسته‌بندی را انتخاب کنید
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        در حال بارگذاری ویژگی‌ها...
      </div>
    );
  }

  if (attributeGroups.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        این دسته‌بندی هیچ گروه ویژگی ندارد
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {attributeGroups.map(group => (
        <div key={group.id} className="space-y-3">
          <h4 className="text-sm font-black text-gray-700 dark:text-gray-300">
            {group.attributeGroup.title}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.attributeGroup.attributes.map((attr: any) => (
              <Field key={attr.id} label={attr.title}>
                <select
                  value={selectedValues[attr.id] || ""}
                  onChange={e => setSelectedValues(prev => ({ ...prev, [attr.id]: e.target.value }))}
                  className={inp}
                >
                  <option value="">انتخاب کنید...</option>
                  {attr.values.map((val: any) => (
                    <option key={val.id} value={val.id}>
                      {val.value}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        </div>
      ))}

      {productId && (
        <button
          type="button"
          onClick={saveAttributes}
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all"
        >
          {saving ? "در حال ذخیره..." : "ذخیره ویژگی‌ها"}
        </button>
      )}

      {!productId && (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl">
          ⚠️ ابتدا محصول را ذخیره کنید تا بتوانید ویژگی‌ها را انتخاب کنید
        </p>
      )}
    </div>
  );
}

// ── RelatedSearch component ───────────────────────────────────────────────────
function RelatedSearch({ productId, currentProductTitle }: { productId?: string; currentProductTitle: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/admin/products/related?productId=${productId}`)
      .then(r => r.json()).then(setSelected).catch(() => {});
  }, [productId]);

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/store/search?q=${encodeURIComponent(q)}&limit=8`);
    const data = await res.json();
    setResults((data.products || []).filter((p: any) => p.id !== productId));
    setSearching(false);
  }

  async function addRelated(p: any) {
    if (!productId) return;
    if (selected.find(s => s.id === p.id)) return;
    await fetch("/api/admin/products/related", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, relatedId: p.id }),
    });
    setSelected(prev => [...prev, p]);
    setQuery(""); setResults([]);
  }

  async function removeRelated(id: string) {
    if (!productId) return;
    await fetch("/api/admin/products/related", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, relatedId: id }),
    });
    setSelected(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="space-y-3">
      {}
      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/[0.06] rounded-xl">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-white/10 flex-shrink-0">
                {p.mainImage ? <img src={p.mainImage} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-gray-900 dark:text-white truncate">{p.title}</p>
                {p.category && <p className="text-[10px] text-gray-400">{p.category.title}</p>}
              </div>
              <button type="button" onClick={() => removeRelated(p.id)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {}
      {productId ? (
        <div className="relative">
          <input value={query} onChange={e => search(e.target.value)}
            placeholder="جستجو و افزودن محصول مرتبط..."
            className={inp} />
          {searching && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">جستجو...</span>}
          {results.length > 0 && (
            <div className="absolute top-full mt-1 right-0 left-0 z-20 bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl shadow-xl overflow-hidden">
              {results.map(p => (
                <button key={p.id} type="button" onClick={() => addRelated(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-right">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-white/10 flex-shrink-0">
                    {p.mainImage ? <img src={p.mainImage} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-gray-900 dark:text-white truncate">{p.title}</p>
                    {p.category && <p className="text-[10px] text-gray-400">{p.category.title}</p>}
                  </div>
                  <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2.5">
          ابتدا محصول را ذخیره کنید تا بتوانید محصولات مرتبط اضافه کنید
        </p>
      )}
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
interface Props {
  mode: "create" | "edit";
  productId?: string;
  initialForm?: FormState;
}

export default function ProductForm({ mode, productId, initialForm }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands]         = useState<Brand[]>([]);
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>([]);
  const [form, setForm]             = useState<FormState>(initialForm ?? EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  useEffect(() => {
    if (initialForm) setForm(initialForm);
  }, [initialForm]);

  useEffect(() => {
    const safe = (r: Response) => r.ok ? r.json() : [];
    Promise.all([
      fetch("/api/admin/categories").then(safe).catch(() => []),
      fetch("/api/admin/brands").then(safe).catch(() => []),
      fetch("/api/admin/spec-groups").then(safe).catch(() => []),
    ]).then(([cats, brs, sgs]) => {
      setCategories(cats); setBrands(brs); setSpecGroups(sgs);
    });
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function setRelated<K extends keyof RelatedSettings>(key: K, value: RelatedSettings[K]) {
    setForm(prev => ({ ...prev, relatedSettings: { ...prev.relatedSettings, [key]: value } }));
  }

  async function upload(file: File, key: string): Promise<string> {
    setUploadingKey(key);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      return (await res.json()).url as string;
    } finally { setUploadingKey(null); }
  }

  function addStr(key: "summaryFeatures" | "features" | "colors" | "images") {
    set(key, [...(form[key] as string[]), ""]);
  }
  function updateStr(key: "summaryFeatures" | "features" | "colors" | "images", i: number, val: string) {
    const arr = [...(form[key] as string[])]; arr[i] = val; set(key, arr);
  }
  function removeStr(key: "summaryFeatures" | "features" | "colors" | "images", i: number) {
    const arr = [...(form[key] as string[])]; arr.splice(i, 1); set(key, arr);
  }

  function addFaq() { set("faq", [...form.faq, { q: "", a: "" }]); }
  function updateFaq(i: number, k: "q" | "a", v: string) {
    const arr = [...form.faq]; arr[i] = { ...arr[i], [k]: v }; set("faq", arr);
  }
  function removeFaq(i: number) {
    const arr = [...form.faq]; arr.splice(i, 1); set("faq", arr);
  }

  function selectSpecGroup(groupId: string) {
    const g = specGroups.find(x => x.id === groupId);
    if (!g) return;
    set("specs", g.items.map(it => ({
      specItemId: it.id, title: it.title,
      value: form.specs.find(e => e.specItemId === it.id)?.value ?? "",
    })));
  }
  function updateSpec(i: number, val: string) {
    const arr = [...form.specs]; arr[i] = { ...arr[i], value: val }; set("specs", arr);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaving(true);
    try {
      const url = mode === "create" ? "/api/admin/products" : `/api/admin/products/${productId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.text()) || `خطا: ${res.status}`);
      setSuccess(true);
      setTimeout(() => router.push("/admin/products"), 1500);
    } catch (err: any) {
      setError(err.message || "خطای ناشناخته");
    } finally { setSaving(false); }
  }

  // ── UploadField helper ────────────────────────────────────────────────────
  function UploadField({ label, fieldKey, value }: { label: string; fieldKey: string; value: string }) {
    return (
      <Field label={label}>
        {uploadingKey === fieldKey ? (
          <div className={`${inp} text-gray-400`}>در حال آپلود...</div>
        ) : (
          <div className="space-y-2">
            <label className={`${inp} cursor-pointer flex items-center gap-2`}>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-gray-500 text-sm">{value ? "تغییر تصویر" : "انتخاب تصویر"}</span>
              <input type="file" accept="image/*" className="hidden"
                onChange={async e => {
                  if (!e.target.files?.[0]) return;
                  const url = await upload(e.target.files[0], fieldKey);
                  set(fieldKey as any, url);
                }} />
            </label>
            {value && (
              <div className="relative w-24">
                <img src={value} alt="" className="w-24 h-24 object-cover rounded-xl border border-gray-100 dark:border-white/[0.06]" />
                <button type="button" onClick={() => set(fieldKey as any, "")}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
              </div>
            )}
          </div>
        )}
      </Field>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      {}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push("/admin/products")}
            className="p-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">
              {mode === "create" ? "محصول جدید" : "ویرایش محصول"}
            </h1>
            {productId && <p className="text-[11px] text-gray-400 font-mono mt-0.5">{productId}</p>}
          </div>
        </div>

        {}
        <button type="button" onClick={handleSubmit as any} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-blue-500/30">
          {saving ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {saving ? "در حال ذخیره..." : mode === "create" ? "ذخیره محصول" : "بروزرسانی"}
        </button>
      </div>

      {}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 font-bold">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-600 dark:text-emerald-400 font-bold">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          محصول با موفقیت {mode === "create" ? "ذخیره" : "بروزرسانی"} شد. در حال انتقال...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {}
        <Section title="اطلاعات پایه" icon="📋">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="عنوان محصول *">
              <input required value={form.title} className={inp}
                onChange={e => { set("title", e.target.value); if (mode === "create") set("slug", slugify(e.target.value)); }}
                placeholder="نام محصول را وارد کنید" />
            </Field>
            <Field label="Slug (آدرس) *">
              <input required value={form.slug} dir="ltr" className={inp}
                onChange={e => set("slug", slugify(e.target.value))}
                placeholder="product-slug" />
            </Field>
            <Field label="دسته‌بندی *">
              <select required value={form.categoryId} className={inp}
                onChange={e => set("categoryId", e.target.value)}>
                <option value="">انتخاب دسته‌بندی...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
            <Field label="برند">
              <select value={form.brandId} className={inp}
                onChange={e => set("brandId", e.target.value)}>
                <option value="">بدون برند</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </Field>
          </div>
          <Field label="توضیح کوتاه">
            <textarea rows={3} value={form.shortDescription} className={ta}
              onChange={e => set("shortDescription", e.target.value)}
              placeholder="توضیح مختصر محصول..." />
          </Field>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => set("isActive", !form.isActive)}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.isActive ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-1"}`} />
            </button>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">محصول فعال باشد</span>
          </div>
        </Section>

        {}
        <Section title="قیمت‌گذاری و موجودی" icon="💰">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="قیمت اصلی (تومان) *">
              <input required type="number" min="0" dir="ltr" value={form.price} className={inp}
                onChange={e => set("price", e.target.value)} placeholder="0" />
            </Field>
            <Field label="قیمت با تخفیف (تومان)">
              <input type="number" min="0" dir="ltr" value={form.salePrice} className={inp}
                onChange={e => set("salePrice", e.target.value)} placeholder="اختیاری" />
            </Field>
            <Field label="گارانتی">
              <input value={form.warranty} className={inp}
                onChange={e => set("warranty", e.target.value)}
                placeholder="مثلاً: ۱۸ ماه گارانتی آواژنگ" />
            </Field>
            <Field label="آستانه هشدار موجودی" hint="وقتی موجودی به این عدد رسید هشدار نمایش داده می‌شود">
              <input type="number" min="1" dir="ltr" value={form.lowStockThreshold} className={inp}
                onChange={e => set("lowStockThreshold", e.target.value)} placeholder="3" />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => set("trackStock", !form.trackStock)}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.trackStock ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.trackStock ? "translate-x-5" : "translate-x-1"}`} />
            </button>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">ردیابی موجودی فعال باشد</span>
          </div>
          {form.trackStock && (
            <Field label="موجودی انبار (تعداد)">
              <input type="number" min="0" dir="ltr" value={form.stock} className={inp}
                onChange={e => set("stock", e.target.value)} placeholder="0" />
            </Field>
          )}
        </Section>

        {}
        <Section title="تصاویر" icon="🖼️">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UploadField label="تصویر اصلی" fieldKey="mainImage" value={form.mainImage} />
            <Field label="لینک ویدیو">
              <input dir="ltr" value={form.videoUrl} className={inp}
                onChange={e => set("videoUrl", e.target.value)} placeholder="https://..." />
            </Field>
          </div>
          <Field label="گالری تصاویر">
            <div className="space-y-2">
              {form.images.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  {url && <img src={url} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-100 dark:border-white/[0.06] flex-shrink-0" />}
                  <input dir="ltr" value={url} className={`${inp} flex-1`}
                    placeholder="https://..." onChange={e => updateStr("images", i, e.target.value)} />
                  <label className="flex-shrink-0 px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-white/10 cursor-pointer hover:border-blue-400 transition-all text-xs text-gray-500">
                    {uploadingKey === `gallery-${i}` ? "آپلود..." : "📎"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async e => {
                        if (!e.target.files?.[0]) return;
                        updateStr("images", i, await upload(e.target.files[0], `gallery-${i}`));
                      }} />
                  </label>
                  <button type="button" onClick={() => removeStr("images", i)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 text-gray-400 hover:text-red-500 hover:border-red-300 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" onClick={() => addStr("images")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:border-blue-400 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  افزودن با لینک
                </button>
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:border-blue-400 transition-all cursor-pointer">
                  📎 آپلود تصویر جدید
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async e => {
                      if (!e.target.files?.[0]) return;
                      set("images", [...form.images, await upload(e.target.files[0], `gallery-new-${Date.now()}`)]);
                    }} />
                </label>
              </div>
            </div>
          </Field>
        </Section>

        {}
        <Section title="پیوست فایل دانلودی" icon="📎" defaultOpen={false}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            اگر فایلی (کاتالوگ، درایور، راهنما، ...) همراه این محصول قرار می‌گیرد اینجا آپلود کنید.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="عنوان دکمه دانلود">
              <input
                value={form.downloadTitle} className={inp}
                onChange={e => set("downloadTitle", e.target.value)}
                placeholder="مثلاً: دانلود کاتالوگ، دانلود درایور، دانلود راهنما" />
            </Field>
            <Field label="فایل دانلودی">
              <div className="flex items-center gap-3">
                {form.downloadUrl ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2">
                      <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold truncate">
                        {form.downloadUrl.split("/").pop()}
                      </span>
                    </div>
                    <button type="button" onClick={() => { set("downloadUrl", ""); set("downloadTitle", ""); }}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 text-gray-400 hover:text-red-500 hover:border-red-300 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${uploadingKey === "download" ? "border-blue-400 bg-blue-50 dark:bg-blue-500/10" : "border-gray-200 dark:border-white/10 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/5"}`}>
                    {uploadingKey === "download" ? (
                      <div className="flex items-center gap-2 text-blue-500">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        <span className="text-sm font-bold">در حال آپلود...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span className="text-sm font-bold">انتخاب فایل</span>
                        <span className="text-xs text-gray-400">(PDF، ZIP، RAR، ...)</span>
                      </div>
                    )}
                    <input type="file" className="hidden"
                      accept=".pdf,.zip,.rar,.doc,.docx,.xls,.xlsx,.txt,.7z,.tar,.gz"
                      onChange={async e => {
                        if (!e.target.files?.[0]) return;
                        const fd = new FormData();
                        fd.append("file", e.target.files[0]);
                        fd.append("type", "download");
                        setUploadingKey("download");
                        try {
                          const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                          const data = await res.json();
                          if (data.url) set("downloadUrl", data.url);
                        } finally { setUploadingKey(null); }
                      }} />
                  </label>
                )}
              </div>
            </Field>
          </div>
        </Section>

        {}
        <Section title="ویژگی‌ها، رنگ‌ها و گارانتی" icon="✨" defaultOpen={false}>
          {(["features", "colors", "summaryFeatures"] as const).map(key => (
            <Field key={key} label={key === "features" ? "ویژگی‌های اصلی" : key === "colors" ? "رنگ‌های موجود" : "ویژگی‌های اجمالی"}>
              <div className="space-y-2">
                {(form[key] as string[]).map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={v} className={`${inp} flex-1`}
                      placeholder={key === "colors" ? "مثلاً: مشکی / #000000" : `مورد ${i + 1}`}
                      onChange={e => updateStr(key, i, e.target.value)} />
                    <button type="button" onClick={() => removeStr(key, i)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 text-gray-400 hover:text-red-500 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addStr(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:border-blue-400 transition-all">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  افزودن
                </button>
              </div>
            </Field>
          ))}
        </Section>

        {}
        <Section title="بررسی اجمالی (Summary)" icon="📝" defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="عنوان">
              <input value={form.summaryTitle} className={inp} onChange={e => set("summaryTitle", e.target.value)} />
            </Field>
            <UploadField label="تصویر" fieldKey="summaryImage" value={form.summaryImage} />
          </div>
          <Field label="توضیحات">
            <textarea rows={3} value={form.summaryDescription} className={ta} onChange={e => set("summaryDescription", e.target.value)} />
          </Field>
        </Section>

        {}
        <Section title="بررسی تخصصی (Expert)" icon="🔬" defaultOpen={false}>
          <Field label="عنوان">
            <input value={form.expertTitle} className={inp} onChange={e => set("expertTitle", e.target.value)} />
          </Field>
          <Field label="متن کامل">
            <textarea rows={5} value={form.expertDescription} className={ta} onChange={e => set("expertDescription", e.target.value)} />
          </Field>
          <UploadField label="تصویر" fieldKey="expertImage" value={form.expertImage} />
        </Section>

        {}
        <Section title="مشخصات فنی (Specs)" icon="⚙️" defaultOpen={false}>
          <Field label="انتخاب گروه مشخصات">
            <select className={inp} defaultValue=""
              onChange={e => e.target.value && selectSpecGroup(e.target.value)}>
              <option value="">انتخاب گروه...</option>
              {specGroups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </Field>
          {form.specs.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/[0.06]">
                    <th className="text-right text-xs font-black text-gray-500 px-4 py-2.5">مشخصه</th>
                    <th className="text-right text-xs font-black text-gray-500 px-4 py-2.5">مقدار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                  {form.specs.map((s, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 w-40">{s.title}</td>
                      <td className="px-4 py-2">
                        <input value={s.value} className={`${inp} py-1.5`}
                          placeholder="مقدار را وارد کنید"
                          onChange={e => updateSpec(i, e.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        {}
        <Section title="ویژگی‌های قابل فیلتر" icon="🏷️" defaultOpen={false}>
          <AttributesSection 
            categoryId={form.categoryId} 
            productId={productId}
          />
        </Section>

        {}
        <Section title="سوالات متداول (FAQ)" icon="❓" defaultOpen={false}>
          <div className="space-y-3">
            {form.faq.map((item, i) => (
              <div key={i} className="bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-500">سوال {i + 1}</span>
                  <button type="button" onClick={() => removeFaq(i)}
                    className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors">حذف</button>
                </div>
                <input value={item.q} className={inp} placeholder="سوال..." onChange={e => updateFaq(i, "q", e.target.value)} />
                <textarea rows={2} value={item.a} className={ta} placeholder="پاسخ..." onChange={e => updateFaq(i, "a", e.target.value)} />
              </div>
            ))}
            <button type="button" onClick={addFaq}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:border-blue-400 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              افزودن سوال
            </button>
          </div>
        </Section>

        {}
        <Section title="محصولات مرتبط" icon="🔗" defaultOpen={false}>
          {}
          <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-white">محصولات همین دسته‌بندی</p>
                <p className="text-[11px] text-gray-400 mt-0.5">محصولات دیگر از همین دسته زیر محصول نمایش داده می‌شود</p>
              </div>
              <button type="button" onClick={() => setRelated("categoryEnabled", !form.relatedSettings.categoryEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${form.relatedSettings.categoryEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.relatedSettings.categoryEnabled ? "translate-x-5" : "translate-x-1"}`} />
              </button>
            </div>
            {form.relatedSettings.categoryEnabled && (
              <div className="flex gap-2">
                {[{ v: "newest", l: "جدیدترین" }, { v: "popular", l: "پرفروش‌ترین" }].map(o => (
                  <button key={o.v} type="button"
                    onClick={() => setRelated("categorySort", o.v as "newest" | "popular")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                      form.relatedSettings.categorySort === o.v
                        ? "bg-blue-600 text-white border-primary-600"
                        : "bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10"
                    }`}>
                    {o.l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {}
          <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-white">محصولات همین برند</p>
                <p className="text-[11px] text-gray-400 mt-0.5">محصولات دیگر از همین برند زیر محصول نمایش داده می‌شود</p>
              </div>
              <button type="button" onClick={() => setRelated("brandEnabled", !form.relatedSettings.brandEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative ${form.relatedSettings.brandEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.relatedSettings.brandEnabled ? "translate-x-5" : "translate-x-1"}`} />
              </button>
            </div>
            {form.relatedSettings.brandEnabled && (
              <div className="flex gap-2">
                {[{ v: "newest", l: "جدیدترین" }, { v: "popular", l: "پرفروش‌ترین" }].map(o => (
                  <button key={o.v} type="button"
                    onClick={() => setRelated("brandSort", o.v as "newest" | "popular")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                      form.relatedSettings.brandSort === o.v
                        ? "bg-blue-600 text-white border-primary-600"
                        : "bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10"
                    }`}>
                    {o.l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {}
          <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/[0.06] space-y-3">
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white">محصولات دستی</p>
              <p className="text-[11px] text-gray-400 mt-0.5">محصولات خاصی که می‌خواهید نمایش داده شود</p>
            </div>
            <RelatedSearch productId={productId} currentProductTitle={form.title} />
          </div>
        </Section>

        {}
        <Section title="بهینه‌سازی موتورهای جستجو (SEO)" icon="🔍" defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="عنوان SEO">
              <input dir="ltr" value={form.seoTitle} className={inp} onChange={e => set("seoTitle", e.target.value)} />
            </Field>
            <Field label="کلمات کلیدی">
              <input dir="ltr" value={form.seoKeywords} className={inp}
                placeholder="keyword1, keyword2" onChange={e => set("seoKeywords", e.target.value)} />
            </Field>
          </div>
          <Field label="توضیحات SEO">
            <textarea rows={2} dir="ltr" value={form.seoDescription} className={ta} onChange={e => set("seoDescription", e.target.value)} />
          </Field>
          <Field label="Schema JSON-LD">
            <textarea rows={4} dir="ltr" value={form.seoSchema} className={`${ta} font-mono text-xs`}
              placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "Product"\n}`}
              onChange={e => set("seoSchema", e.target.value)} />
          </Field>
        </Section>

        {}
        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => router.push("/admin/products")}
            className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-black transition-all">
            انصراف
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-blue-500/30">
            {saving ? "در حال ذخیره..." : mode === "create" ? "ذخیره محصول" : "بروزرسانی محصول"}
          </button>
        </div>
      </form>
    </div>
  );
}
