"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { slugify } from "@/lib/slugify";

const BlogEditor = dynamic(() => import("@/components/blog/BlogEditor"), { ssr: false });

interface Category { id: string; title: string; }
interface Tag { id: string; title: string; slug: string; }
interface Product { id: string; title: string; mainImage: string | null; }

interface Props {
  postId?: string;
}

const EMPTY = {
  title: "", slug: "", excerpt: "", content: "",
  coverImage: "", videoUrl: "", categoryId: "",
  status: "DRAFT" as "DRAFT" | "PUBLISHED" | "SCHEDULED",
  seoTitle: "", seoDescription: "", seoKeywords: "",
  tagIds: [] as string[], productIds: [] as string[],
  newTag: "",
};

export default function BlogPostForm({ postId }: Props) {
  const router = useRouter();
  const isEdit = !!postId;

  const [form, setForm]         = useState({ ...EMPTY });
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags]   = useState<Tag[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(isEdit);
  const [saving, setSaving]     = useState(false);
  const [tab, setTab]           = useState<"content" | "seo" | "products">("content");

  function set(key: keyof typeof EMPTY, val: any) {
    setForm(f => ({ ...f, [key]: val }));
  }

  useEffect(() => {
    fetch("/api/admin/blog/categories").then(r => r.json()).then(setCategories);
    // تگ‌ها — TODO: یه API اضافه کنیم اگه لازم شد
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/admin/blog/${postId}`).then(r => r.json()).then(data => {
      setForm({
        title:          data.title         ?? "",
        slug:           data.slug          ?? "",
        excerpt:        data.excerpt       ?? "",
        content:        data.content       ?? "",
        coverImage:     data.coverImage    ?? "",
        videoUrl:       data.videoUrl      ?? "",
        categoryId:     data.categoryId    ?? "",
        status:         data.status        ?? "DRAFT",
        seoTitle:       data.seoTitle      ?? "",
        seoDescription: data.seoDescription ?? "",
        seoKeywords:    data.seoKeywords   ?? "",
        tagIds:         data.tags?.map((t: any) => t.tag.id) ?? [],
        productIds:     data.relatedProducts?.map((p: any) => p.productId) ?? [],
        newTag:         "",
      });
      setProducts(data.relatedProducts?.map((p: any) => p.product) ?? []);
      setLoading(false);
    });
  }, [postId]);

  // جستجوی محصول
  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/store/search?q=${encodeURIComponent(productSearch)}&limit=6`)
        .then(r => r.json())
        .then(d => setProductResults(d.products ?? []));
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  function addProduct(p: Product) {
    if (form.productIds.includes(p.id)) return;
    set("productIds", [...form.productIds, p.id]);
    setProducts(prev => [...prev, p]);
    setProductSearch(""); setProductResults([]);
  }

  function removeProduct(id: string) {
    set("productIds", form.productIds.filter(i => i !== id));
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  async function addTag() {
    if (!form.newTag.trim()) return;
    // TODO: ساخت تگ جدید از API
    set("newTag", "");
  }

  async function handleSave(publish = false) {
    if (!form.title) return;
    setSaving(true);
    const body = {
      ...form,
      slug: form.slug || slugify(form.title),
      status: publish ? "PUBLISHED" : form.status,
    };
    const url    = isEdit ? `/api/admin/blog/${postId}` : "/api/admin/blog";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) router.push("/admin/blog");
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
    </div>
  );

  const inp = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin/blog")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary-600 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">
            {isEdit ? "ویرایش مطلب" : "مطلب جدید"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <select className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none"
            value={form.status} onChange={e => set("status", e.target.value)}>
            <option value="DRAFT">📝 پیش‌نویس</option>
            <option value="PUBLISHED">✅ منتشرشده</option>
            <option value="SCHEDULED">⏰ زمان‌بندی شده</option>
          </select>
          <button onClick={() => handleSave(false)} disabled={saving}
            className="px-5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-all">
            {saving ? "ذخیره..." : "ذخیره پیش‌نویس"}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 disabled:opacity-60 transition-all shadow-lg shadow-primary-500/20">
            {saving ? "..." : "انتشار"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ستون اصلی */}
        <div className="lg:col-span-2 space-y-5">
          {/* عنوان */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <input className={`${inp} text-xl font-black`} placeholder="عنوان مطلب *"
              value={form.title} onChange={e => {
              set("title", e.target.value);
              if (!isEdit) set("slug", ""); // slug رو خالی بذار تا دستی وارد بشه
            }} />
            <p className="text-[10px] text-amber-500 mt-1">⚠️ slug باید فقط حروف انگلیسی، اعداد و خط تیره باشد</p>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex-shrink-0">/mag/</span>
              <input className={`${inp} text-xs font-mono`} dir="ltr" placeholder="slug"
                value={form.slug} onChange={e => set("slug", e.target.value)} />
            </div>
            <textarea rows={2} className={`${inp} resize-none`} placeholder="خلاصه مطلب (برای کارت در صفحه اصلی بلاگ)"
              value={form.excerpt} onChange={e => set("excerpt", e.target.value)} />
          </div>

          {/* تب‌ها */}
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
            {[{ k: "content", l: "محتوا" }, { k: "seo", l: "سئو" }, { k: "products", l: "محصولات" }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k as any)}
                className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${tab === t.k ? "bg-white dark:bg-gray-900 text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>
                {t.l}
              </button>
            ))}
          </div>

          {/* محتوا */}
          {tab === "content" && (
            <div className="space-y-4">
              {/* ویدیو */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <label className="block text-xs font-bold text-gray-500 mb-2">لینک ویدیو (اختیاری — یوتیوب یا آپارات)</label>
                <input className={inp} dir="ltr" placeholder="https://youtube.com/watch?v=..."
                  value={form.videoUrl} onChange={e => set("videoUrl", e.target.value)} />
              </div>
              <BlogEditor value={form.content} onChange={val => set("content", val)} />
            </div>
          )}

          {/* سئو */}
          {tab === "seo" && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">تنظیمات سئو</h3>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">عنوان صفحه (SEO Title)</label>
                <input className={inp} placeholder={form.title} value={form.seoTitle} onChange={e => set("seoTitle", e.target.value)} />
                <p className="text-[10px] text-gray-400 mt-1">{form.seoTitle.length}/60 کاراکتر</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">توضیح متا (Meta Description)</label>
                <textarea rows={3} className={`${inp} resize-none`} placeholder={form.excerpt}
                  value={form.seoDescription} onChange={e => set("seoDescription", e.target.value)} />
                <p className="text-[10px] text-gray-400 mt-1">{form.seoDescription.length}/160 کاراکتر</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">کلمات کلیدی</label>
                <input className={inp} placeholder="بلاگ، آموزش، ..." value={form.seoKeywords} onChange={e => set("seoKeywords", e.target.value)} />
              </div>
              {/* پیش‌نمایش گوگل */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-widest">پیش‌نمایش گوگل</p>
                <p className="text-blue-700 dark:text-primary-400 text-sm font-medium">{form.seoTitle || form.title || "عنوان مطلب"}</p>
                <p className="text-green-700 dark:text-green-500 text-[11px] mt-0.5">example.com/mag/{form.slug || "slug"}</p>
                <p className="text-gray-600 dark:text-gray-400 text-xs mt-1 line-clamp-2">{form.seoDescription || form.excerpt || "توضیح متا..."}</p>
              </div>
            </div>
          )}

          {/* محصولات */}
          {tab === "products" && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">محصولات مرتبط با این مطلب</h3>
              <p className="text-xs text-gray-400">محصولاتی که در متن مطلب معرفی کرده‌اید را اینجا انتخاب کنید</p>

              <div className="relative">
                <input className={inp} placeholder="جستجوی محصول..."
                  value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                {productResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden">
                    {productResults.map(p => (
                      <button key={p.id} onClick={() => addProduct(p)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 dark:hover:bg-blue-900/20 transition-colors text-right">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.mainImage ? <img src={p.mainImage} alt={p.title} className="w-full h-full object-contain" /> : <div className="w-full h-full bg-gray-200 dark:bg-gray-700" />}
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{p.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {products.length > 0 && (
                <div className="space-y-2">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-600">
                        {p.mainImage ? <img src={p.mainImage} alt={p.title} className="w-full h-full object-contain" /> : <div className="w-full h-full bg-gray-200 dark:bg-gray-700" />}
                      </div>
                      <span className="flex-1 text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{p.title}</span>
                      <button onClick={() => removeProduct(p.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ستون کناری */}
        <div className="space-y-5">

          {/* تصویر شاخص */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <h3 className="font-black text-sm text-gray-900 dark:text-white">تصویر شاخص</h3>
            {form.coverImage && (
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-gray-100 dark:bg-gray-800">
                <img src={form.coverImage} alt="cover" className="w-full h-full object-cover" />
                <button onClick={() => set("coverImage", "")}
                  className="absolute top-2 left-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <input className={inp} dir="ltr" placeholder="آدرس تصویر"
              value={form.coverImage} onChange={e => set("coverImage", e.target.value)} />
          </div>

          {/* دسته‌بندی */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <h3 className="font-black text-sm text-gray-900 dark:text-white">دسته‌بندی</h3>
            <select className={inp} value={form.categoryId} onChange={e => set("categoryId", e.target.value)}>
              <option value="">بدون دسته</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          {/* اطلاعات */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-2">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">اطلاعات</h3>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">کلمات محتوا:</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {form.content.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length.toLocaleString("fa-IR")}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">زمان مطالعه (تقریبی):</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {Math.max(1, Math.round(form.content.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length / 200)).toLocaleString("fa-IR")} دقیقه
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">وضعیت:</span>
              <span className={`font-black text-xs px-2 py-0.5 rounded-lg ${form.status === "PUBLISHED" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : form.status === "DRAFT" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" : "bg-primary-50 dark:bg-blue-900/20 text-primary-600"}`}>
                {form.status === "PUBLISHED" ? "منتشر" : form.status === "DRAFT" ? "پیش‌نویس" : "زمان‌بندی"}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}