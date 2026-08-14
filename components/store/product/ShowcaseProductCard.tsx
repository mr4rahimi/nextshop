"use client";

import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/components/store/cart/AddToCartButton";
import { useWishlist } from "@/components/store/wishlist/WishlistContext";

/**
 * کارت محصول «شوکیس» — کارت جمع‌وجور با تصویر تمام‌عرض و پنل شیشه‌ای.
 *
 * برخلاف ManaProductCard که برای یک ستون در موبایل طراحی شده، این کارت طوری
 * ساخته شده که در موبایل **دو تا کنار هم** جا شود بدون اینکه بیش از حد دراز
 * شود: تصویر با نسبت ثابت ۱:۱، عنوان دقیقاً دو خط (ارتفاع ثابت) و بلوک قیمت با
 * ارتفاع ثابت. نتیجه اینکه همه‌ی کارت‌ها در یک ردیف هم‌قد می‌شوند.
 *
 * این کامپوننت عمداً مستقل از ویجت نوشته شده تا بعداً در صفحه‌ی همه محصولات،
 * دسته‌بندی، برند و هر جای دیگری قابل استفاده باشد.
 */

export interface ShowcaseProductItem {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  image: string | null;
  brand?: { title: string; slug: string } | null;
  stock?: number;
  trackStock?: boolean;
  lowStockThreshold?: number;
}

interface Props {
  product: ShowcaseProductItem;
  /** وقتی برند از config ویجت می‌آید و API آن را برنمی‌گرداند (منبع: برند) */
  fallbackBrandTitle?: string | null;
  /** نمایش برچسب برند بالای عنوان */
  showBrand?: boolean;
  /** اندازه‌ی تصویر برای srcset — پیش‌فرض متناسب با ۲ کارت در موبایل */
  sizes?: string;
}

function formatPrice(val: string | null | undefined): string {
  if (!val) return "۰";
  const n = Number(val);
  return isNaN(n) ? "۰" : n.toLocaleString("fa-IR");
}

function discountPercent(price: string, salePrice: string | null): number | null {
  if (!salePrice) return null;
  const p = Number(price), s = Number(salePrice);
  if (!p) return null;
  const d = Math.round(((p - s) / p) * 100);
  return d > 0 ? d : null;
}

export default function ShowcaseProductCard({
  product,
  fallbackBrandTitle = null,
  showBrand = true,
  sizes = "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw",
}: Props) {
  const { has, toggle } = useWishlist();

  const discount = discountPercent(product.price, product.salePrice);
  const isOutOfStock = product.trackStock && (product.stock ?? 0) <= 0;
  const displayPrice = product.salePrice || product.price;
  const isWished = has(product.id);
  const brandTitle = product.brand?.title ?? fallbackBrandTitle;

  return (
    <div className="group/card relative h-full">
      <Link
        href={`/products/${product.slug}`}
        className={`relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-500
          bg-white dark:bg-white/[0.03] backdrop-blur-xl
          ${isOutOfStock
            ? "border-gray-200 dark:border-white/[0.05] opacity-70"
            : "border-gray-100 dark:border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:-translate-y-1.5 hover:border-primary-500/40 hover:shadow-[0_18px_40px_-12px_rgba(37,99,235,0.28)] dark:hover:shadow-[0_18px_50px_-12px_rgba(37,99,235,0.35)]"
          }`}
      >
        {/* ── تصویر ── */}
        <div className="relative aspect-square w-full overflow-hidden bg-gray-50 dark:bg-white/[0.02]">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              sizes={sizes}
              className="object-contain p-3 transition-transform duration-700 group-hover/card:scale-[1.08] sm:p-4"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* درصد تخفیف — بالا راست */}
          {discount && !isOutOfStock && (
            <span className="absolute right-2 top-2 z-10 rounded-xl bg-secondary-500 px-2 py-1 text-[10px] font-black leading-none text-white shadow-lg shadow-secondary-500/30 sm:right-3 sm:top-3 sm:text-[11px]">
              {discount.toLocaleString("fa-IR")}٪
            </span>
          )}

          {/* ناموجود */}
          {isOutOfStock && (
            <span className="absolute right-2 top-2 z-10 rounded-xl bg-gray-900/80 px-2 py-1 text-[10px] font-black leading-none text-white backdrop-blur-sm sm:right-3 sm:top-3">
              ناموجود
            </span>
          )}

          {/* علاقه‌مندی — بالا چپ، در موبایل همیشه دیده می‌شود */}
          <button
            type="button"
            aria-label={isWished ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
            aria-pressed={isWished}
            onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(product.id); }}
            className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-xl border border-white/60 bg-white/80 text-gray-500 shadow-sm backdrop-blur-md transition-all hover:scale-110 hover:text-red-500 dark:border-white/10 dark:bg-black/40 dark:text-gray-300 sm:left-3 sm:top-3 sm:h-9 sm:w-9"
          >
            <svg
              className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
              fill={isWished ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: isWished ? "#ef4444" : undefined }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* ── پنل اطلاعات ── */}
        <div className="flex flex-1 flex-col border-t border-gray-100 p-3 dark:border-white/[0.06] sm:p-4">
          {/* ردیف برند همیشه جا می‌گیرد (حتی بدون برند) تا عنوان همه‌ی کارت‌های
              یک ردیف هم‌تراز بماند */}
          {showBrand && (
            <div className="mb-1.5 h-4.5">
              {brandTitle && (
                <span className="inline-block max-w-full truncate rounded-lg bg-primary-600/10 px-2 py-0.5 text-[9px] font-black leading-3.5 text-primary-600 dark:text-primary-400 sm:text-[10px]">
                  {brandTitle}
                </span>
              )}
            </div>
          )}

          {/* ارتفاع ثابت دو خط تا کارت‌های یک ردیف هم‌قد بمانند */}
          <h3 className="mb-3 line-clamp-2 h-[2.5rem] text-[12px] font-black leading-5 text-gray-800 transition-colors group-hover/card:text-primary-600 dark:text-zinc-100 dark:group-hover/card:text-primary-400 sm:h-[2.75rem] sm:text-[13.5px] sm:leading-[1.375rem]">
            {product.title}
          </h3>

          <div className="mt-auto flex items-end justify-between gap-2">
            {isOutOfStock ? (
              <span className="text-[11px] font-black text-gray-400">فعلاً موجود نیست</span>
            ) : (
              <>
                <div className="flex min-w-0 flex-col">
                  {/* جای خط خورده همیشه رزرو می‌شود تا قیمت‌ها در یک ردیف هم‌تراز بمانند */}
                  <span className="h-4 text-[10px] leading-4 text-gray-400 line-through tabular-nums dark:text-zinc-500 sm:text-[11px]">
                    {discount ? formatPrice(product.price) : ""}
                  </span>
                  <span className="flex items-baseline gap-1 truncate">
                    <span className="text-[15px] font-black tracking-tight text-gray-900 tabular-nums dark:text-white sm:text-[17px]">
                      {formatPrice(displayPrice)}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 sm:text-[10px]">تومان</span>
                  </span>
                </div>

                <div className="flex-shrink-0">
                  <AddToCartButton
                    variant="icon"
                    size="sm"
                    product={{
                      id: product.id, title: product.title, slug: product.slug,
                      price: product.price, salePrice: product.salePrice,
                      mainImage: product.image, images: [],
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
