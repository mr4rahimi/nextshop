"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  salePrice?: number;
  mainImage?: string;
  isActive: boolean;
  stock?: number;
  trackStock?: boolean;
  category?: { title: string };
  brand?: { title: string };
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }

export default function BulkEditPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [attributeGroups, setAttributeGroups] = useState<any[]>([]);
  const [selectedAttributeValues, setSelectedAttributeValues] = useState<string[]>([]);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<"price" | "stock" | "status">("price");
  
  // Price edit
  const [priceType, setPriceType] = useState<"percent" | "amount">("percent");
  const [priceValue, setPriceValue] = useState("");
  const [priceField, setPriceField] = useState<"price" | "salePrice" | "both">("price");
  
  // Stock edit
  const [stockType, setStockType] = useState<"set" | "increase" | "decrease">("set");
  const [stockValue, setStockValue] = useState("");
  
  // Status edit
  const [statusValue, setStatusValue] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const [prodRes, catRes, brandRes] = await Promise.all([
        fetch("/api/admin/products"),
        fetch("/api/admin/categories"),
        fetch("/api/admin/brands"),
      ]);
      const data = await prodRes.json();
      setProducts(Array.isArray(data) ? data : []);
      setCategories(await catRes.json());
      setBrands(await brandRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  // Load attributes when category changes
  useEffect(() => {
    if (!filterCategory) {
      setAttributeGroups([]);
      setSelectedAttributeValues([]);
      return;
    }

    const selectedCat = categories.find(c => c.title === filterCategory);
    if (selectedCat) {
      fetch(`/api/admin/categories/${selectedCat.id}/attribute-groups`)
        .then(r => r.json())
        .then(setAttributeGroups)
        .catch(() => setAttributeGroups([]));
    }
  }, [filterCategory, categories]);

  const filtered = products.filter(p => {
    const matchCat = !filterCategory || p.category?.title === filterCategory;
    const matchBrand = !filterBrand || p.brand?.title === filterBrand;
    const matchAttributes = selectedAttributeValues.length === 0 || 
      (p as any).attributes?.some((attr: any) => 
        selectedAttributeValues.includes(attr.attributeValueId)
      );
    return matchCat && matchBrand && matchAttributes;
  });

  function toggleSelect(id: string) {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(p => p.id));
    }
  }

  async function handleBulkUpdate() {
    if (selectedIds.length === 0) {
      alert("هیچ محصولی انتخاب نشده");
      return;
    }

    setSaving(true);
    try {
      if (editMode === "price") {
        await fetch("/api/admin/products/bulk-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: selectedIds,
            type: priceType,
            value: parseFloat(priceValue) || 0,
            field: priceField,
          }),
        });
      } else if (editMode === "stock") {
        await fetch("/api/admin/products/bulk-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: selectedIds,
            type: stockType,
            value: parseInt(stockValue) || 0,
          }),
        });
      } else if (editMode === "status") {
        await Promise.all(
          selectedIds.map(id =>
            fetch(`/api/admin/products/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isActive: statusValue }),
            })
          )
        );
      }

      alert(`${toFa(selectedIds.length)} محصول با موفقیت بروزرسانی شد`);
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      alert("خطا در بروزرسانی");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      {/* هدر */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">ویرایش گروهی محصولات</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {toFa(selectedIds.length)} از {toFa(filtered.length)} محصول انتخاب شده
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/products")}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          بازگشت
        </button>
      </div>

      {/* فیلترها */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
        <p className="text-sm font-black text-gray-900 dark:text-white mb-3">فیلتر محصولات</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">همه دسته‌بندی‌ها</option>
            {categories.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
          </select>

          <select
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">همه برندها</option>
            {brands.map(b => <option key={b.id} value={b.title}>{b.title}</option>)}
          </select>
        </div>

        {/* فیلتر ویژگی‌ها */}
        {attributeGroups.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
            <p className="text-xs font-black text-gray-500 mb-2">فیلتر با ویژگی‌ها:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {attributeGroups.map(group => (
                <div key={group.id}>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">
                    {group.attributeGroup.title}
                  </label>
                  {group.attributeGroup.attributes.map((attr: any) => (
                    <select
                      key={attr.id}
                      value={selectedAttributeValues.find(v => 
                        attr.values.some((val: any) => val.id === v)
                      ) || ""}
                      onChange={e => {
                        const newValue = e.target.value;
                        setSelectedAttributeValues(prev => {
                          const filtered = prev.filter(v => 
                            !attr.values.some((val: any) => val.id === v)
                          );
                          return newValue ? [...filtered, newValue] : filtered;
                        });
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all mb-2"
                    >
                      <option value="">{attr.title}: همه</option>
                      {attr.values.map((val: any) => (
                        <option key={val.id} value={val.id}>
                          {val.value}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* پنل ویرایش */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
        <p className="text-sm font-black text-gray-900 dark:text-white mb-3">نوع ویرایش</p>
        
        <div className="flex gap-2 mb-4">
          {[
            { value: "price", label: "قیمت", icon: "💰" },
            { value: "stock", label: "موجودی", icon: "📦" },
            { value: "status", label: "وضعیت", icon: "🔄" },
          ].map(m => (
            <button
              key={m.value}
              onClick={() => setEditMode(m.value as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                editMode === m.value
                  ? "bg-blue-600 text-white shadow shadow-blue-500/20"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              <span>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* فرم قیمت */}
        {editMode === "price" && (
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={priceType}
                onChange={e => setPriceType(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
              >
                <option value="percent">درصد</option>
                <option value="amount">مبلغ</option>
              </select>

              <input
                type="number"
                value={priceValue}
                onChange={e => setPriceValue(e.target.value)}
                placeholder={priceType === "percent" ? "مثلاً: 10 (افزایش 10%)" : "مثلاً: 50000"}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
              />

              <select
                value={priceField}
                onChange={e => setPriceField(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
              >
                <option value="price">قیمت اصلی</option>
                <option value="salePrice">قیمت فروش</option>
                <option value="both">هر دو</option>
              </select>
            </div>
            <p className="text-xs text-gray-400">
              💡 برای کاهش قیمت، عدد منفی وارد کنید (مثلاً: -10)
            </p>
          </div>
        )}

        {/* فرم موجودی */}
        {editMode === "stock" && (
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={stockType}
                onChange={e => setStockType(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
              >
                <option value="set">تنظیم مقدار</option>
                <option value="increase">افزایش</option>
                <option value="decrease">کاهش</option>
              </select>

              <input
                type="number"
                value={stockValue}
                onChange={e => setStockValue(e.target.value)}
                placeholder="تعداد"
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* فرم وضعیت */}
        {editMode === "status" && (
          <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl">
            <div className="flex gap-3">
              {[
                { value: true, label: "فعال", color: "emerald" },
                { value: false, label: "غیرفعال", color: "gray" },
              ].map(s => (
                <button
                  key={String(s.value)}
                  onClick={() => setStatusValue(s.value)}
                  className={`flex-1 py-2 rounded-xl text-sm font-black transition-all ${
                    statusValue === s.value
                      ? `bg-${s.color}-600 text-white`
                      : "bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleBulkUpdate}
          disabled={saving || selectedIds.length === 0}
          className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all"
        >
          {saving ? "در حال اعمال تغییرات..." : `اعمال تغییرات روی ${toFa(selectedIds.length)} محصول`}
        </button>
      </div>

      {/* لیست محصولات */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/[0.06]">
          <input
            type="checkbox"
            checked={selectedIds.length === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm font-black text-gray-900 dark:text-white">
            انتخاب همه ({toFa(filtered.length)})
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">در حال بارگذاری...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            محصولی با این فیلترها یافت نشد
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
            {filtered.map(p => (
              <label
                key={p.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />

                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 flex-shrink-0">
                  {p.mainImage ? (
                    <img src={p.mainImage} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-900 dark:text-white truncate">{p.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {p.category && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {p.category.title}
                      </span>
                    )}
                    {p.brand && (
                      <span className="text-[10px] text-gray-400">{p.brand.title}</span>
                    )}
                  </div>
                </div>

                <div className="text-left">
                  <p className="text-sm font-black text-gray-900 dark:text-white">{toFa(Number(p.price))}</p>
                  {p.salePrice && (
                    <p className="text-xs text-emerald-500">{toFa(Number(p.salePrice))}</p>
                  )}
                </div>

                <div className="text-left">
                  {p.trackStock && (
                    <p className="text-xs text-gray-500">موجودی: {toFa(p.stock || 0)}</p>
                  )}
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                    p.isActive
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                      : "bg-gray-50 dark:bg-white/5 text-gray-400"
                  }`}>
                    {p.isActive ? "فعال" : "غیرفعال"}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}