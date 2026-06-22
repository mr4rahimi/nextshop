"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/components/store/cart/AddToCartButton";
import { useWishlist } from "@/components/store/wishlist/WishlistContext";
import { addToLastVisited } from "@/lib/lastVisited";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SpecItem {
  id: string;
  title: string;
  group: { id: string; title: string };
}
interface Spec {
  id: string;
  value: string;
  specItem: SpecItem;
}
interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
}
interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  user: { firstName: string | null; lastName: string | null };
}
interface FaqItem {
  q: string;
  a: string;
}
interface Product {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  mainImage: string | null;
  videoUrl: string | null;
  features: string[];
  colors: string[];
  warranty: string | null;
  stock: number;
  trackStock: boolean;
  lowStockThreshold: number;
  price: string;
  salePrice: string | null;
  ratingAvg: number;
  ratingCount: number;
  summaryTitle: string | null;
  summaryDescription: string | null;
  summaryImage: string | null;
  summaryFeatures: string[];
  expertTitle: string | null;
  expertDescription: string | null;
  expertImage: string | null;
  faq: FaqItem[];
  brand: { id: string; title: string; slug: string; logoUrl: string | null } | null;
  category: { id: string; title: string; slug: string } | null;
  images: ProductImage[];
  specs: Spec[];
  reviews: Review[];
  downloadTitle: string | null;
  downloadUrl: string | null;
}

interface RelatedProduct {
  id: string; title: string; slug: string;
  mainImage: string | null; price: string; salePrice: string | null;
  stock?: number; trackStock?: boolean;
  category?: { title: string; slug: string } | null;
  brand?: { title: string } | null;
}

interface Props {
  product: Product;
  categoryRelated?: RelatedProduct[];
  brandRelated?: RelatedProduct[];
  manualRelated?: RelatedProduct[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(val: string | null | undefined): string {
  if (!val) return "۰";
  const n = Number(val);
  if (isNaN(n)) return "۰";
  return n.toLocaleString("fa-IR");
}

function toFarsiNum(n: number): string {
  return n.toLocaleString("fa-IR");
}

function userInitials(user: Review["user"]): string {
  const f = user.firstName?.[0] || "";
  const l = user.lastName?.[0] || "";
  return (f + (l ? "." + l : "")) || "ک";
}

function userName(user: Review["user"]): string {
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(" ");
  return "کاربر ناشناس";
}

function persianDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function starPercent(rating: number): number {
  return Math.round((rating / 5) * 100);
}

// ─── Stars Component ──────────────────────────────────────────────────────────
function Stars({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-${size} h-${size} ${i <= Math.round(rating) ? "text-yellow-400" : "text-gray-300 dark:text-gray-700"} fill-current`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function RelatedSection({ title, products }: { title: string; products: RelatedProduct[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-1.5 h-8 bg-primary-600 rounded-full" />
        <h2 className="text-xl font-black text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {products.map(p => {
          const price = Number(p.salePrice || p.price);
          const orig  = Number(p.price);
          const disc  = p.salePrice && price < orig ? Math.round(((orig - price) / orig) * 100) : 0;
          const outOfStock = p.trackStock && (p.stock ?? 0) <= 0;
          return (
            <Link key={p.id} href={`/products/${p.slug}`}
              className={`group bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col ${outOfStock ? "opacity-60" : ""}`}>
              <div className="relative aspect-square bg-gray-50 dark:bg-white/5 overflow-hidden">
                {(p.mainImage) ? (
                  <Image src={p.mainImage} alt={p.title} fill className="object-contain p-2 group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 50vw, 16vw" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-200 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {disc > 0 && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg">
                    {disc.toLocaleString("fa-IR")}٪
                  </span>
                )}
                {outOfStock && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-black rounded-2xl">
                    ناموجود
                  </span>
                )}
              </div>
              <div className="p-3 flex flex-col gap-1.5 flex-1">
                <p className="text-xs font-black text-gray-800 dark:text-white line-clamp-2 leading-relaxed">{p.title}</p>
                <div className="mt-auto">
                  {outOfStock ? (
                    <span className="text-xs font-black text-gray-400">ناموجود</span>
                  ) : (
                    <span className="text-sm font-black text-primary-600 dark:text-primary-400 tabular-nums">
                      {price.toLocaleString("fa-IR")} <span className="text-[10px] font-bold text-gray-400">تومان</span>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProductDetailClient({ product, categoryRelated = [], brandRelated = [], manualRelated = [] }: Props) {
  useEffect(() => { addToLastVisited(product.id); }, [product.id]);

  const [activeTab, setActiveTab] = useState<"overview" | "expert" | "specs" | "reviews" | "faq">("specs");
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  // Build gallery: videoUrl first if exists, then mainImage, then images
  const gallery: { type: "video" | "image"; url: string }[] = [];
  if (product.videoUrl) gallery.push({ type: "video", url: product.videoUrl });
  if (product.mainImage) gallery.push({ type: "image", url: product.mainImage });
  product.images.forEach((img) => {
    if (img.url !== product.mainImage) gallery.push({ type: "image", url: img.url });
  });

  const currentMedia = gallery[selectedImageIdx];

  const discountPercent =
    product.salePrice && Number(product.price) > 0
      ? Math.round(
          ((Number(product.price) - Number(product.salePrice)) /
            Number(product.price)) *
            100
        )
      : null;

  const displayPrice = product.salePrice || product.price;

  // Group specs by group title
  const specGroups: Record<string, { title: string; value: string }[]> = {};
  product.specs.forEach((s) => {
    const g = s.specItem.group.title;
    if (!specGroups[g]) specGroups[g] = [];
    specGroups[g].push({ title: s.specItem.title, value: s.value });
  });

  const faqItems = Array.isArray(product.faq) ? (product.faq as FaqItem[]) : [];
  const { has, toggle } = useWishlist();

  const isOutOfStock = product.trackStock && product.stock <= 0;
  const isLowStock = product.trackStock && product.stock > 0 && product.stock <= product.lowStockThreshold;
  const isWished = has(product.id);

  // Add to cart handler (stub)
  function handleAddToCart() {
    fetch("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, qty: 1 }),
    });
  }

  return (
    <div className="bg-gray-100 dark:bg-[#050505] min-h-screen" dir="rtl">

      {/* ── Breadcrumb ── */}
      <section className="product-hero relative pt-8 overflow-hidden">
        <div className="container relative z-10 px-4">
          <nav className="flex items-center gap-2 mb-8 text-[11px] font-bold text-gray-400 dark:text-gray-500">
            <Link href="/" className="hover:text-primary-600 transition-colors">خانه</Link>
            <span className="text-[8px] opacity-40">‹</span>
            {product.category && (
              <>
                <Link href={`/categories/${product.category.slug}`} className="hover:text-primary-600 transition-colors">
                  {product.category.title}
                </Link>
                <span className="text-[8px] opacity-40">‹</span>
              </>
            )}
            <span className="text-gray-900 dark:text-white font-black line-clamp-1">{product.title}</span>
          </nav>

          {/* ── Main Product Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

            {/* ── Gallery ── */}
            <div className="lg:col-span-5 space-y-6 flex flex-col items-center justify-center">
              <div className="relative group bg-white/40 dark:bg-black/20 backdrop-blur-2xl rounded-[3rem] border border-white/60 dark:border-white/5 shadow-2xl p-6 overflow-hidden w-full">
                <div className="relative flex items-center justify-center h-[380px] md:h-[450px]">
                  {currentMedia?.type === "video" ? (
                    <video
                      src={currentMedia.url}
                      controls
                      className="max-h-full w-auto object-contain rounded-2xl"
                    />
                  ) : currentMedia ? (
                    <Image
                      src={currentMedia.url}
                      alt={product.title}
                      fill
                      priority
                      className="object-contain transition-transform duration-700"
                      sizes="(max-width: 1024px) 100vw, 42vw"
                    />
                  ) : (
                    <div className="w-40 h-40 bg-gray-100 dark:bg-gray-800 rounded-3xl flex items-center justify-center text-gray-300">
                      <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Thumbnails */}
              {gallery.length > 1 && (
                <div className="w-full max-w-[400px]">
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {gallery.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImageIdx(i)}
                        className={`flex-shrink-0 w-16 h-16 rounded-2xl border-2 overflow-hidden bg-white/40 dark:bg-white/5 transition-all ${
                          i === selectedImageIdx
                            ? "border-primary-600 opacity-100"
                            : "border-transparent opacity-50 hover:opacity-80"
                        }`}
                      >
                        {item.type === "video" ? (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                            <svg className="w-6 h-6 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="relative w-full h-full">
                            <Image src={item.url} alt={`${product.title} - تصویر ${i + 1}`} fill className="object-contain p-1" sizes="64px" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Product Info ── */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {product.brand && (
                    <span className="text-[10px] font-black text-primary-600 bg-primary-600/10 px-3 py-1 rounded-lg">
                      {product.brand.title}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-gray-400">
                    دسته: {product.category?.title || "—"}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-relaxed">
                  {product.title}
                </h1>
                {product.ratingCount > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-yellow-400 text-xs font-black">
                      <Stars rating={product.ratingAvg} />
                      <span className="text-gray-700 dark:text-gray-300 mr-1">
                        {toFarsiNum(product.ratingAvg)}
                      </span>
                      <span className="text-gray-400 font-bold">
                        ({toFarsiNum(product.ratingCount)} دیدگاه)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Features */}
                <div className="xl:col-span-7 space-y-6">
                  {product.shortDescription && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-7">
                      {product.shortDescription}
                    </p>
                  )}

                  {(product.features as string[]).length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[13px] font-black text-gray-900 dark:text-white">ویژگی‌های اصلی کالا:</p>
                      <div className="grid grid-cols-1 gap-2">
                        {(product.features as string[]).map((f, i) => (
                          <div key={i} className="flex items-center gap-3 group">
                            <div className="w-6 h-6 rounded-lg bg-primary-600/10 flex items-center justify-center text-primary-600 flex-shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(product.colors as string[]).length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[13px] font-black text-gray-900 dark:text-white">رنگ‌های موجود:</p>
                      <div className="flex flex-wrap gap-2">
                        {(product.colors as string[]).map((c, i) => (
                          <span key={i} className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-white/10">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Card */}
                <div className="xl:col-span-5 space-y-4">
                  <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-6 space-y-6">

                    {/* Warranty & Delivery */}
                    <div className="space-y-4">
                      {product.warranty && (
                        <div className="flex items-center gap-4 group">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-white/[0.03] text-gray-400 group-hover:bg-primary-50 dark:group-hover:bg-primary-500/10 group-hover:text-primary-600 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                          </div>
                          <p className="text-[12px] font-bold text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                            {product.warranty}
                          </p>
                        </div>
                      )}

                      {/* Download button */}
                      {product.downloadTitle && product.downloadUrl && (
                        <a
                          href={product.downloadUrl}
                          download
                          className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/5 hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10 transition-all group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/30 transition-all">
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-blue-700 dark:text-blue-300">{product.downloadTitle}</p>
                            <p className="text-[10px] text-blue-500 dark:text-blue-400/70 font-bold mt-0.5">
                              {product.downloadUrl.split(".").pop()?.toUpperCase()} · دانلود رایگان
                            </p>
                          </div>
                          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </a>
                      )}
                    </div>

                    {isOutOfStock ? (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-secondary-500">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-secondary-500">ناموجود</p>
                          <p className="text-[10px] font-bold text-gray-400">این محصول موجود نیست</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 group">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.129-1.125V11.25" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">ارسال سریع</p>
                          <p className="text-[10px] font-bold text-gray-400">موجود در انبار</p>
                        </div>
                      </div>
                    )}
                    {isLowStock && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-[11px] font-black text-amber-600 dark:text-amber-400">
                          تنها {product.stock.toLocaleString("fa-IR")} عدد از این محصول باقی مانده
                        </p>
                      </div>
                    )}

                    {/* Price */}
                    <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-white/5">
                      {discountPercent && (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-400 line-through tabular-nums">
                            {formatPrice(product.price)} تومان
                          </span>
                          <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">
                            {toFarsiNum(discountPercent)}٪-
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline justify-end gap-1.5">
                        <span className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">
                          {formatPrice(displayPrice)}
                        </span>
                        <span className="text-[11px] font-bold text-gray-500">تومان</span>
                      </div>
                    </div>

                    {/* Add to cart */}
                    
                   {isOutOfStock ? (
                      <div className="w-full py-4 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl flex items-center justify-center gap-2 text-gray-400 font-black text-sm cursor-not-allowed">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        ناموجود
                      </div>
                    ) : (
                      <AddToCartButton variant="full" product={{
                        id: product.id,
                        title: product.title,
                        slug: product.slug,
                        price: String(product.price),
                        salePrice: product.salePrice ? String(product.salePrice) : null,
                        mainImage: product.mainImage,
                        images: product.images ?? [],
                      }} />
                    )}
                    {}
                     
                      
                  

                    {/* Actions row */}
                    <div className="flex items-center justify-center gap-4 pt-2">
                      <button
                        onClick={() => toggle(product.id)}
                        className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${isWished ? "text-secondary-500" : "text-gray-500 hover:text-secondary-500"}`}>
                        <svg className="w-4 h-4" fill={isWished ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {isWished ? "در علاقه‌مندی‌ها" : "علاقه‌مندی"}
                      </button>
                      <div className="w-px h-4 bg-gray-200 dark:bg-white/10" />
                      <button className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-teal-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3h5v5M8 21H3v-5M21 3l-7 7M3 21l7-7" />
                        </svg>
                        مقایسه
                      </button>
                      <div className="w-px h-4 bg-gray-200 dark:bg-white/10" />
                      <button className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-primary-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                        </svg>
                        اشتراک‌گذاری
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Shop Features ── */}
      <section className="py-12">
        <div className="container px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "ارسال فوری", desc: "تحویل در کمتر از ۲۴ ساعت", color: "blue" },
              { icon: "M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z", label: "۷ روز ضمانت بازگشت", desc: "بازگشت در صورت عدم رضایت", color: "secondary" },
              { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "پرداخت امن", desc: "درگاه‌های پرداخت معتبر", color: "emerald" },
              { icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z", label: "ضمانت اصالت", desc: "تضمین ۱۰۰٪ کالا", color: "indigo" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center group">
                <div className={`relative w-16 h-16 mb-4 flex items-center justify-center`}>
                  <div className={`relative z-10 w-full h-full bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-500 group-hover:-translate-y-2 flex items-center justify-center`}>
                    <svg className="w-7 h-7 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                  </div>
                </div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-1">{item.label}</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-5 max-w-[140px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Detail Tabs ── */}
      <section className="pb-16">
        <div className="container px-4">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[3rem] shadow-2xl">

            {/* Tab Bar */}
            <div className="flex items-center gap-2 p-4 bg-gray-50/50 dark:bg-white/[0.02] border-b rounded-[3rem] border-gray-100 dark:border-white/5 overflow-x-auto">
             {[
                { key: "specs", label: "مشخصات فنی", icon: "M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 12h11.25", show: true },
                { key: "overview", label: "بررسی اجمالی", icon: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z", show: !!(product.summaryTitle || product.summaryDescription || product.summaryFeatures?.length) },
                { key: "expert", label: "بررسی تخصصی", icon: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6", show: !!(product.expertTitle || product.expertDescription) },
                { key: "reviews", label: "نظرات کاربران", icon: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z", show: true },
                { key: "faq", label: "پرسش و پاسخ", icon: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z", show: faqItems.length > 0 },
              ].filter(tab => tab.show).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-white"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-8 lg:p-12">

              {/* ── Overview Tab ── */}
              {activeTab === "overview" && (
                <div className="space-y-12">
                  {(product.summaryTitle || product.summaryDescription || (product.summaryFeatures as string[]).length > 0) ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                      <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
                        {product.summaryTitle && (
                          <div className="flex items-center gap-3">
                            <span className="w-2 h-8 bg-primary-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)]" />
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{product.summaryTitle}</h3>
                          </div>
                        )}
                        {product.summaryDescription && (
                          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-9 text-justify">
                            {product.summaryDescription}
                          </p>
                        )}
                        {(product.summaryFeatures as string[]).length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 pt-6 border-t border-white/20 dark:border-white/5">
                            {(product.summaryFeatures as string[]).map((f, i) => (
                              <div key={i} className="flex items-center gap-3 group">
                                <div className="w-8 h-8 rounded-lg bg-primary-600/10 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                                <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">{f}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {product.summaryImage && (
                        <div className="lg:col-span-5 order-1 lg:order-2 relative group">
                          <div className="absolute -inset-4 bg-gradient-to-tr from-primary-600/20 to-primary-600/20 rounded-[3.5rem] blur-2xl opacity-50 group-hover:opacity-80 transition duration-1000" />
                          <img
                            src={product.summaryImage}
                            alt={product.summaryTitle || product.title}
                            className="relative rounded-[3rem] w-full h-[350px] object-cover border border-white/30 shadow-2xl"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-gray-400">
                      <p className="text-sm">اطلاعات بررسی اجمالی برای این محصول ثبت نشده است.</p>
                    </div>
                  )}

                  {/* Trust Badges */}
                  <div className="flex flex-wrap justify-center gap-8 py-8 border-y border-white/20 dark:border-white/5 bg-white/10 dark:bg-white/[0.01] rounded-3xl">
                    {[
                      { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "۷ روز ضمانت بازگشت" },
                      { icon: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4", label: "ارسال سریع اکسپرس" },
                      { icon: "M9 12l2 2 4-4", label: "ضمانت ۱۰۰٪ اصالت کالا" },
                    ].map((b, i) => (
                      <div key={i} className="flex items-center gap-3 group cursor-default">
                        <div className="w-11 h-11 rounded-full bg-white/50 dark:bg-white/5 flex items-center justify-center transition-all group-hover:bg-primary-600 group-hover:text-white text-primary-600 shadow-sm border border-white/40 dark:border-white/5">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={b.icon} />
                          </svg>
                        </div>
                        <span className="text-[11px] font-black text-zinc-600 dark:text-zinc-400 group-hover:text-primary-600 transition-colors">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Expert Tab ── */}
              {activeTab === "expert" && (
                <div className="space-y-12">
                  {product.expertTitle || product.expertDescription ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                      <div className="lg:col-span-7 space-y-6">
                        {product.expertTitle && (
                          <div className="flex items-center gap-3">
                            <span className="w-12 h-1.5 bg-primary-600 rounded-full" />
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{product.expertTitle}</h3>
                          </div>
                        )}
                        {product.expertDescription && (
                          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-9 text-justify whitespace-pre-line">
                            {product.expertDescription}
                          </p>
                        )}
                      </div>
                      {product.expertImage && (
                        <div className="lg:col-span-5 relative">
                          <div className="absolute -inset-4 bg-primary-600/10 rounded-[4rem] -rotate-3" />
                          <img
                            src={product.expertImage}
                            alt={product.expertTitle || "بررسی تخصصی"}
                            className="relative rounded-[3rem] shadow-2xl object-cover h-[350px] w-full border border-white/20"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-gray-400">
                      <p className="text-sm">بررسی تخصصی برای این محصول ثبت نشده است.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Specs Tab ── */}
              {activeTab === "specs" && (
                <div className="space-y-10" dir="rtl">
                  {Object.keys(specGroups).length > 0 ? (
                    Object.entries(specGroups).map(([groupTitle, items]) => (
                      <div key={groupTitle} className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="w-1.5 h-8 bg-primary-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.6)]" />
                          <h4 className="text-lg font-black text-zinc-900 dark:text-white">{groupTitle}</h4>
                        </div>
                        <div className="relative p-8 rounded-[2.5rem] bg-white/30 dark:bg-[#0c0c0c]/40 backdrop-blur-3xl border border-white/50 dark:border-white/10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                            {items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between pb-4 border-b border-zinc-200/50 dark:border-white/5">
                                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{item.title}</span>
                                <span className="text-xs font-black text-zinc-900 dark:text-white">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-16 text-gray-400">
                      <p className="text-sm">مشخصات فنی برای این محصول ثبت نشده است.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Reviews Tab ── */}
              {activeTab === "reviews" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                  {/* Summary */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="relative overflow-hidden p-10 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-3xl border border-white dark:border-white/10 rounded-[3rem] shadow-2xl">
                      <div className="flex flex-col items-center pt-4">
                        <span className="text-[13px] font-black text-zinc-400 mb-3 uppercase tracking-widest">امتیاز کلی</span>
                        <h4 className="text-7xl font-black text-zinc-900 dark:text-white tracking-tighter mb-4">
                          {toFarsiNum(product.ratingAvg)}
                        </h4>
                        <Stars rating={product.ratingAvg} size={6} />
                        <p className="text-[13px] font-bold text-zinc-500 mt-4">
                          بر اساس {toFarsiNum(product.ratingCount)} نظر ثبت شده
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reviews List */}
                  <div className="lg:col-span-8 space-y-6" dir="rtl">
                    {product.reviews.length > 0 ? (
                      product.reviews.map((r) => (
                        <div key={r.id} className="group relative p-8 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[3rem] transition-all hover:shadow-2xl hover:-translate-y-1">
                          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-[1.5rem] bg-primary-600/10 flex items-center justify-center text-primary-600 font-black text-lg border border-primary-600/20">
                                {userInitials(r.user)}
                              </div>
                              <div>
                                <p className="text-[14px] font-black text-zinc-900 dark:text-white">{userName(r.user)}</p>
                                <p className="text-[12px] font-bold text-zinc-400 mt-1">{persianDate(r.createdAt)}</p>
                              </div>
                            </div>
                            <Stars rating={r.rating} size={5} />
                          </div>
                          {r.title && (
                            <p className="mt-4 text-[15px] font-black text-zinc-800 dark:text-zinc-200">{r.title}</p>
                          )}
                          {r.body && (
                            <p className="mt-3 text-[14px] font-medium text-zinc-600 dark:text-zinc-300 leading-8">{r.body}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-16 text-gray-400">
                        <p className="text-sm">هنوز نظری ثبت نشده است.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── FAQ Tab ── */}
              {activeTab === "faq" && (
                <div className="space-y-6" dir="rtl">
                  {faqItems.length > 0 ? (
                    faqItems.map((item, i) => (
                      <div key={i} className="relative group p-1 lg:p-2">
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-shrink-0 flex md:flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center text-[18px] font-black shadow-xl">
                              Q
                            </div>
                            <div className="w-1 h-12 bg-primary-600/20 rounded-full hidden md:block" />
                          </div>
                          <div className="flex-1 space-y-4">
                            <button
                              className="text-[17px] font-black text-zinc-900 dark:text-white leading-7 text-right w-full flex items-center justify-between"
                              onClick={() => setOpenFaqIdx(openFaqIdx === i ? null : i)}
                            >
                              <span>{item.q}</span>
                              <svg className={`w-5 h-5 text-primary-600 transition-transform flex-shrink-0 mr-2 ${openFaqIdx === i ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {openFaqIdx === i && (
                              <div className="relative bg-white/40 dark:bg-zinc-900/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-[2.5rem] p-8">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px] font-black rounded-lg">
                                    پاسخ
                                  </div>
                                </div>
                                <p className="text-[14px] font-bold text-zinc-600 dark:text-zinc-300 leading-8">{item.a}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-16 text-gray-400">
                      <p className="text-sm">سوالی برای این محصول ثبت نشده است.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </section>

      {}
      {(categoryRelated.length > 0 || brandRelated.length > 0 || manualRelated.length > 0) && (
        <section className="pb-16">
          <div className="container px-4 space-y-12">
      
            {categoryRelated.length > 0 && (
              <RelatedSection title="محصولات مشابه در این دسته‌بندی" products={categoryRelated} />
            )}
      
            {brandRelated.length > 0 && (
              <RelatedSection title={`سایر محصولات ${product.brand?.title || "این برند"}`} products={brandRelated} />
            )}
      
            {manualRelated.length > 0 && (
              <RelatedSection title="محصولات پیشنهادی" products={manualRelated} />
            )}
      
          </div>
        </section>
      )}

    </div>
  );
}
