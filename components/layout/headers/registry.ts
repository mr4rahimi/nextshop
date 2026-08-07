export type HomeHeaderVariant = "DEFAULT" | "UNIQUE_STAR";

export interface HeaderVariantMeta {
  id: HomeHeaderVariant;
  label: string;
  desc: string;
  /** آیا این هدر شفاف است و روی اولین ویجت می‌افتد؟ */
  overlay: boolean;
  /** نکته‌ای که در پنل ادمین به مدیر نشان داده می‌شود */
  hint?: string;
}

export const HEADER_VARIANTS: HeaderVariantMeta[] = [
  {
    id: "DEFAULT",
    label: "هدر پیش‌فرض",
    desc: "هدر استاندارد فروشگاه با لوگو، جستجو، مگامنو و سبد خرید",
    overlay: false,
  },
  {
    id: "UNIQUE_STAR",
    label: "هدر یونیک استار (شفاف)",
    desc: "هدر شفاف تیره که روی بنر هرو می‌نشیند و با اسکرول تیره می‌شود",
    overlay: true,
    hint: "برای بهترین نتیجه، اولین ویجت فعال صفحه اصلی را «بنر هرو یونیک استار» قرار دهید و گزینه «فضای هدر شفاف» را در آن ویجت روشن بگذارید.",
  },
];

export function isOverlayVariant(v: string | null | undefined): boolean {
  return HEADER_VARIANTS.find(h => h.id === v)?.overlay ?? false;
}

export function normalizeVariant(v: string | null | undefined): HomeHeaderVariant {
  return HEADER_VARIANTS.some(h => h.id === v) ? (v as HomeHeaderVariant) : "DEFAULT";
}