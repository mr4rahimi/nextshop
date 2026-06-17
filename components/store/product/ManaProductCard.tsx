"use client";

import Link from "next/link";
import AddToCartButton from "@/components/store/cart/AddToCartButton";
import { useWishlist } from "@/components/store/wishlist/WishlistContext";

export interface ProductCardItem {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  ratingAvg: number;
  ratingCount: number;
  image: string | null;
  brand: { title: string; slug: string } | null;
  category: { title: string; slug: string } | null;
  stock?: number;
  trackStock?: boolean;
  lowStockThreshold?: number;
}

interface Props {
  product: ProductCardItem;
}

function formatPrice(val: string | null | undefined): string {
  if (!val) return "۰";
  const n = Number(val);
  if (isNaN(n)) return "۰";
  return n.toLocaleString("fa-IR");
}

function toFarsi(n: number): string {
  return n.toLocaleString("fa-IR");
}

export default function ManaProductCard({ product }: Props) {
  const discountPercent =
    product.salePrice && Number(product.price) > 0
      ? Math.round(
          ((Number(product.price) - Number(product.salePrice)) /
            Number(product.price)) *
            100
        )
      : null;
     

  const displayPrice = product.salePrice || product.price;
  const { has, toggle } = useWishlist();
  const isOutOfStock = product.trackStock && (product.stock ?? 0) <= 0;
  const isWished = has(product.id);

  return (
    <div className="group relative h-full pt-12">
      <div className={`absolute inset-0 backdrop-blur-[20px] rounded-[3rem] border shadow-[0_20px_50px_rgba(0,0,0,0.02)] transition-all duration-700 ${
         isOutOfStock
           ? "bg-gray-100/80 dark:bg-[#0a0a0a]/60 border-gray-200 dark:border-white/[0.04] opacity-70"
           : "bg-white/80 dark:bg-[#0a0a0a]/40 border-gray-100 dark:border-white/[0.08] group-hover:border-primary-500/50 dark:group-hover:shadow-[0_0_60px_rgba(37,99,235,0.12)]"
       }`} />
       
      {discountPercent && discountPercent > 0 && (
        <div className="absolute -top-6 -right-2 z-20">
          <div className="bg-secondary-500 text-white text-[12px] font-black w-12 h-12 rounded-[1.2rem] flex items-center justify-center shadow-xl shadow-secondary-500/40 rotate-12 group-hover:rotate-0 transition-all duration-500 border-2 border-white dark:border-white/20">
            {toFarsi(discountPercent)}٪
          </div>
        </div>
      )}

      <Link
        href={`/products/${product.slug}`}
        className="relative p-7 flex flex-col h-full z-10 transition-transform duration-500 group-hover:-translate-y-4"
      >
        <div className="relative mb-8 flex items-center justify-center min-h-[180px]">
          <div className="absolute w-40 h-40 bg-primary-500/20 dark:bg-primary-500/20 blur-[70px] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-1000" />

          {product.image ? (
            <img
              src={product.image}
              alt={product.title}
              className="relative z-10 w-full h-44 object-contain transition-all duration-700 group-hover:scale-110 group-hover:drop-shadow-[0_15px_35px_rgba(37,99,235,0.3)]"
            />
          ) : (
            <div className="relative z-10 w-full h-44 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-2xl">
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          <div className="absolute top-0 -left-2 z-20 flex flex-col gap-3 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-500">
            <div className="relative group/tooltip">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(product.id); }}
                className="w-10 h-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-xl flex items-center justify-center shadow-sm border border-white dark:border-white/10 transition-all hover:scale-110"
              >
                <svg className="w-5 h-5" fill={isWished ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"
                  style={{ color: isWished ? "#ef4444" : undefined }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <span className="absolute right-full mr-3 whitespace-nowrap bg-gray-900 dark:bg-zinc-800 text-white text-[10px] py-1.5 px-3 rounded-lg opacity-0 pointer-events-none translate-x-2 group-hover/tooltip:opacity-100 group-hover/tooltip:translate-x-0 transition-all duration-300 border border-white/5">
                علاقه‌مندی
              </span>
            </div>
          </div>
        </div>

        {product.brand && (
          <span className="text-[10px] font-bold text-primary-600 bg-primary-600/10 px-2 py-0.5 rounded-lg w-fit mb-2">
            {product.brand.title}
          </span>
        )}

        <h3 className="text-[15px] font-black text-gray-800 dark:text-zinc-100 mb-6 line-clamp-2 leading-7 h-14 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {product.title}
        </h3>

        {product.ratingCount > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">{toFarsi(product.ratingAvg)}</span>
            <span className="text-[10px] text-gray-400">({toFarsi(product.ratingCount)})</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-5 border-t border-gray-100 dark:border-white/5">
          {isOutOfStock ? (
            <div className="w-full flex items-center justify-center gap-2 py-2 bg-gray-100 dark:bg-white/5 rounded-xl text-gray-400 font-black text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              ناموجود
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                {discountPercent && discountPercent > 0 && (
                  <span className="text-[11px] text-gray-400 dark:text-zinc-500 line-through tabular-nums leading-none">
                    {formatPrice(product.price)}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter tabular-nums">
                    {formatPrice(displayPrice)}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold">تومان</span>
                </div>
              </div>
              <AddToCartButton
                variant="icon"
                product={{
                  id: product.id, title: product.title, slug: product.slug,
                  price: product.price, salePrice: product.salePrice,
                  mainImage: product.image, images: [],
                }}
              />
            </>
          )}
        </div>
      </Link>
    </div>
  );
}