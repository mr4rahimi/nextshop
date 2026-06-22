"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProductForm, { FormState, EMPTY_FORM } from "@/components/admin/product/ProductForm";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm]       = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/products/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then(product => {
        if (!product) return;
        setForm({
          ...EMPTY_FORM,
          title:              product.title             ?? "",
          slug:               product.slug              ?? "",
          categoryId:         product.categoryId        ?? "",
          brandId:            product.brandId           ?? "",
          shortDescription:   product.shortDescription  ?? "",
          expertTitle:        product.expertTitle        ?? "",
          expertDescription:  product.expertDescription ?? "",
          expertImage:        product.expertImage        ?? "",
          summaryTitle:       product.summaryTitle       ?? "",
          summaryDescription: product.summaryDescription ?? "",
          summaryImage:       product.summaryImage       ?? "",
          summaryFeatures:    Array.isArray(product.summaryFeatures) ? product.summaryFeatures : [],
          videoUrl:           product.videoUrl           ?? "",
          mainImage:          product.mainImage          ?? "",
          features:           Array.isArray(product.features) ? product.features : [],
          colors:             Array.isArray(product.colors)   ? product.colors   : [],
          price:              product.price?.toString()       ?? "",
          salePrice:          product.salePrice?.toString()   ?? "",
          warranty:           product.warranty          ?? "",
          downloadTitle:      product.downloadTitle     ?? "",
          downloadUrl:        product.downloadUrl       ?? "",
          stock:              product.stock?.toString() ?? "0",
          trackStock:         product.trackStock ?? false,
          lowStockThreshold:  product.lowStockThreshold?.toString() ?? "3",
          faq:                Array.isArray(product.faq) ? product.faq : [],
          seoTitle:           product.seoTitle           ?? "",
          seoDescription:     product.seoDescription     ?? "",
          seoKeywords:        product.seoKeywords         ?? "",
          seoSchema:          product.seoSchema           ?? "",
          isActive:           product.isActive            ?? true,
          images: Array.isArray(product.images)
            ? product.images.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((img: any) => img.url)
            : [],
          specs: Array.isArray(product.specs)
            ? product.specs.map((s: any) => ({
                specItemId: s.specItemId,
                title:      s.specItem?.title ?? s.specItemId,
                value:      s.value,
              }))
            : [],
          relatedSettings: product.relatedSettings ?? EMPTY_FORM.relatedSettings,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh] text-gray-400 text-sm">
      در حال بارگذاری اطلاعات محصول...
    </div>
  );

  if (notFound) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4" dir="rtl">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <p className="text-sm font-bold text-gray-500">محصول یافت نشد</p>
      <button onClick={() => router.push("/admin/products")}
        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
        بازگشت به لیست
      </button>
    </div>
  );

  if (!form) return null;

  return <ProductForm mode="edit" productId={id} initialForm={form} />;
}