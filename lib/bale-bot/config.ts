import { prisma } from "@/lib/prisma";

/**
 * تنظیمات کاتالوگ محصولات در ربات بله
 *
 * ربات همان ربات باشگاه است (یک توکن، یک وب‌هوک) — بله برای هر ربات فقط یک
 * وب‌هوک می‌پذیرد. این تنظیمات فقط بخش کاتالوگ را روشن و شکل می‌دهد و در
 * `StoreSettings.baleCatalog` (JSON) نشسته است.
 *
 * ⚠️ همه‌ی فیلدها از ورودی ناشناخته خوانده می‌شوند و پیش‌فرض دارند: JSON قدیمی
 *    یا ناقص هرگز نباید ربات را بشکند. مستندات: docs/features/bale-catalog.md
 */

export const CATALOG_PLATFORMS = ["shop", "basalam", "snappshop", "tapsi_shop"] as const;
export type CatalogPlatform = (typeof CATALOG_PLATFORMS)[number];

export interface CatalogPlatformConfig {
  enabled: boolean;
  /** نامی که در ربات کنار قیمت و روی دکمه‌ی خرید می‌آید */
  label: string;
  /**
   * الگوی لینک صفحه‌ی محصول روی بازارگاه. جای‌گذاری‌ها: `{id}` شناسه‌ی نگاشت،
   * `{sku}` و کدهای عمومی ذخیره‌شده (`{hsin}` تپسی، `{number}` و `{parent}`
   * اسنپ‌شاپ). اگر مقدار یکی از جای‌گذاری‌ها نباشد، دکمه ساخته نمی‌شود.
   * برای «shop» استفاده نمی‌شود — لینک سایت از اسلاگ محصول ساخته می‌شود.
   */
  urlTemplate: string;
}

export interface BaleCatalogConfig {
  enabled: boolean;
  /** متن خوش‌آمد بالای منوی اصلی؛ خالی یعنی متن پیش‌فرض */
  welcomeText: string;
  searchEnabled: boolean;
  showImage: boolean;
  markCheapest: boolean;
  /** دکمه‌ی «باشگاه مشتریان» در منوی اصلی */
  showClubButton: boolean;
  platforms: Record<CatalogPlatform, CatalogPlatformConfig>;
}

export const DEFAULT_CATALOG: BaleCatalogConfig = {
  enabled: false,
  welcomeText: "",
  searchEnabled: true,
  showImage: true,
  markCheapest: true,
  showClubButton: true,
  platforms: {
    shop: { enabled: true, label: "سایت ما", urlTemplate: "" },
    basalam: { enabled: true, label: "باسلام", urlTemplate: "https://basalam.com/p/{id}" },
    snappshop: {
      enabled: true,
      label: "اسنپ‌شاپ",
      // شماره‌ی صفحه‌ی عمومی اسنپ‌شاپ `parent_product_number` است، نه `product_number`
      urlTemplate: "https://snappshop.ir/product/snp-{parent}",
    },
    tapsi_shop: {
      enabled: true,
      label: "تپسی‌شاپ",
      urlTemplate: "https://tapsi.shop/product/{hsin}",
    },
  },
};

/** پیش‌فرض‌های غلط نسخه‌های قبل — اگر دست‌نخورده ذخیره شده باشند، با پیش‌فرض تازه عوض می‌شوند */
const OUTDATED_TEMPLATES = new Set(["https://snappshop.ir/product/snp-{number}"]);

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function str(v: unknown, fallback: string, max = 500): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}

/** ورودی ناشناخته (از دیتابیس یا بدنه‌ی درخواست) → تنظیمات کامل و امن */
export function normalizeCatalogConfig(raw: unknown): BaleCatalogConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rp = (r.platforms && typeof r.platforms === "object" ? r.platforms : {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;

  const platforms = {} as Record<CatalogPlatform, CatalogPlatformConfig>;
  for (const code of CATALOG_PLATFORMS) {
    const d = DEFAULT_CATALOG.platforms[code];
    const p = rp[code] ?? {};
    platforms[code] = {
      enabled: bool(p.enabled, d.enabled),
      // ⚠️ برچسب خالی دکمه‌ی بی‌نام می‌سازد — خالی یعنی پیش‌فرض
      label: str(p.label, d.label, 40).trim() || d.label,
      urlTemplate: ((t) => (OUTDATED_TEMPLATES.has(t) ? d.urlTemplate : t))(
        str(p.urlTemplate, d.urlTemplate).trim(),
      ),
    };
  }

  return {
    enabled: bool(r.enabled, DEFAULT_CATALOG.enabled),
    welcomeText: str(r.welcomeText, DEFAULT_CATALOG.welcomeText, 1000),
    searchEnabled: bool(r.searchEnabled, DEFAULT_CATALOG.searchEnabled),
    showImage: bool(r.showImage, DEFAULT_CATALOG.showImage),
    markCheapest: bool(r.markCheapest, DEFAULT_CATALOG.markCheapest),
    showClubButton: bool(r.showClubButton, DEFAULT_CATALOG.showClubButton),
    platforms,
  };
}

export async function loadCatalogConfig(): Promise<BaleCatalogConfig> {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { baleCatalog: true },
  });
  return normalizeCatalogConfig(s?.baleCatalog);
}

export async function saveCatalogConfig(cfg: BaleCatalogConfig): Promise<void> {
  await prisma.storeSettings.update({
    where: { id: "singleton" },
    data: { baleCatalog: cfg as unknown as object },
  });
}
