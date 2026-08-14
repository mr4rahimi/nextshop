"use client";

import { createContext, useContext } from "react";
import ManaProductCard, { type ProductCardItem } from "@/components/store/product/ManaProductCard";
import ShowcaseProductCard from "@/components/store/product/ShowcaseProductCard";
import type { ProductGridMode } from "@/lib/productGrid";

/**
 * چیدمان لیست محصولات در کل سایت.
 *
 * - `single` (پیش‌فرض): همان چیدمان قبلی — در موبایل یک ستون با کارت ManaProductCard
 * - `double`: در موبایل دو ستون با کارت جمع‌وجور ShowcaseProductCard
 *
 * مقدار از `StoreSettings.productGridMobile` می‌آید و در `app/(shop)/layout.tsx`
 * یک‌بار برای همه‌ی صفحات فراهم می‌شود، تا صفحه‌های لیست مجبور نباشند این تنظیم را
 * تک‌تک به‌صورت prop رد کنند.
 */

const ProductLayoutContext = createContext<ProductGridMode>("single");

export function ProductLayoutProvider({
  mode,
  children,
}: {
  mode: ProductGridMode;
  children: React.ReactNode;
}) {
  return (
    <ProductLayoutContext.Provider value={mode}>
      {children}
    </ProductLayoutContext.Provider>
  );
}

export function useProductGridMode(): ProductGridMode {
  return useContext(ProductLayoutContext);
}

/**
 * کلاس گرید لیست محصولات بر اساس چیدمان انتخابی.
 * `single` دقیقاً همان کلاس قبلی صفحات لیست است تا چیزی تغییر نکند.
 */
export function useProductGridClass(
  variant: "listing" | "widget" = "listing",
): string {
  const mode = useProductGridMode();
  if (mode === "double") {
    return variant === "widget"
      ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
      : "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4";
  }
  return variant === "widget"
    ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
    : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6";
}

/** ارتفاع اسکلت لودینگ متناسب با چیدمان، تا هنگام لود پرش نداشته باشیم */
export function useProductSkeletonClass(): string {
  const mode = useProductGridMode();
  return mode === "double"
    ? "h-64 sm:h-72 bg-white/60 dark:bg-white/5 rounded-3xl animate-pulse"
    : "h-96 bg-white/60 dark:bg-white/5 rounded-[3rem] animate-pulse";
}

/**
 * کارت محصول متناسب با چیدمان انتخاب‌شده.
 * ورودی همان `ProductCardItem` است؛ فیلدهای اضافی‌اش برای کارت شوکیس بی‌اثرند.
 */
export function ProductCardAuto({
  product,
  variant = "listing",
}: {
  product: ProductCardItem;
  variant?: "listing" | "widget";
}) {
  const mode = useProductGridMode();

  if (mode === "double") {
    return (
      <ShowcaseProductCard
        product={product}
        sizes={
          variant === "widget"
            ? "(max-width: 768px) 45vw, (max-width: 1280px) 30vw, 22vw"
            : "(max-width: 640px) 45vw, (max-width: 1280px) 30vw, 22vw"
        }
      />
    );
  }

  return <ManaProductCard product={product} />;
}
