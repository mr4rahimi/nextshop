export interface LandingPage {
  categorySlug: string;
  /** فیلترهای دقیق — باید کاملاً منطبق باشد */
  filters: Record<string, string>;   // مثل { "print-type": "laser", brand: "hp" }
  title: string;
  h1: string;
  description: string;
  intro?: string;
}

/** فاز ۳: این آرایه از دیتابیس می‌آید و در پنل ادمین مدیریت می‌شود */
export const LANDING_PAGES: LandingPage[] = [
  {
    categorySlug: "printer",
    filters: { "print-type": "laser", "usage-type": "single-function" },
    title: "خرید پرینتر لیزری تک کاره | قیمت و مشخصات",
    h1: "پرینتر لیزری تک کاره",
    description: "خرید انواع پرینتر لیزری تک کاره با بهترین قیمت، گارانتی معتبر و ارسال سریع.",
  },
  {
    categorySlug: "printer",
    filters: { "print-type": "laser", brand: "hp" },
    title: "خرید پرینتر لیزری اچ پی HP | قیمت روز",
    h1: "پرینتر لیزری اچ پی",
    description: "لیست کامل پرینترهای لیزری HP با قیمت روز و مقایسه مدل‌ها.",
  },
];

/** فقط اگر مجموعه فیلترها دقیقاً یکی باشد landing برمی‌گردد */
export function matchLandingPage(
  categorySlug: string,
  activeFilters: Record<string, string>
): LandingPage | null {
  const keys = Object.keys(activeFilters).sort();
  return LANDING_PAGES.find((lp) => {
    if (lp.categorySlug !== categorySlug) return false;
    const lpKeys = Object.keys(lp.filters).sort();
    if (lpKeys.length !== keys.length) return false;
    return lpKeys.every((k, i) => k === keys[i] && lp.filters[k] === activeFilters[k]);
  }) ?? null;
}