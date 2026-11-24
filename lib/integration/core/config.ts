import { prisma } from "@/lib/prisma";
import { getAdapter } from "./adapter-registry";
import { HIDEABLE_SECTIONS, INTEG_SECTIONS, type IntegSectionKey } from "./sections";

/**
 * پیکربندی یکپارچه‌سازی این کسب‌وکار — سرویس‌های فعال و بخش‌های روشن.
 * docs/integrations/settings-and-guide.md
 *
 * «سرویس فعال» یعنی `IntegPlatform.isActive` و داشتن آداپتور. سرویس خاموش در
 * هیچ فهرستی نمی‌آید، worker کارهایش را برنمی‌دارد و موجودی/قیمت به آن ارسال
 * نمی‌شود. حسابان وب تا وقتی حالت حسابداری «حسابان» است خاموش‌شدنی نیست.
 */

export interface IntegPlatformInfo {
  code: string;
  name: string;
  type: "ACCOUNTING" | "MARKETPLACE";
  isActive: boolean;
  /** آداپتور دارد — بی‌آداپتور یعنی هنوز پشتیبانی نمی‌شود */
  supported: boolean;
  canCreateProduct: boolean;
}

export interface PlatformPref {
  panelUrl?: string;
}

export async function getIntegSettingsRow() {
  return prisma.integSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export async function listPlatforms(): Promise<IntegPlatformInfo[]> {
  const rows = await prisma.integPlatform.findMany({ orderBy: [{ type: "asc" }, { code: "asc" }] });
  return rows.map((p) => {
    const adapter = getAdapter(p.code);
    return {
      code: p.code,
      name: p.name,
      type: p.type,
      isActive: p.isActive,
      supported: !!adapter,
      canCreateProduct: !!adapter?.createProduct,
    };
  });
}

/** پلتفرم‌هایی که در پنل دیده می‌شوند: روشن و پشتیبانی‌شده */
export async function activePlatformCodes(): Promise<string[]> {
  return (await listPlatforms()).filter((p) => p.isActive && p.supported).map((p) => p.code);
}

export async function isPlatformActive(code: string): Promise<boolean> {
  if (code === "shop") return true;
  const p = await prisma.integPlatform.findUnique({ where: { code }, select: { isActive: true } });
  return !!p?.isActive;
}

export async function getHiddenSections(): Promise<Set<IntegSectionKey>> {
  const row = await getIntegSettingsRow();
  const valid = new Set(HIDEABLE_SECTIONS.map((s) => s.key));
  return new Set(row.hiddenSections.filter((k): k is IntegSectionKey => valid.has(k as IntegSectionKey)));
}

/** مسیرهای خاموش — برای پنهان کردن آیکن در پیشخوان */
export async function hiddenIntegrationHrefs(): Promise<Set<string>> {
  const hidden = await getHiddenSections().catch(() => new Set<IntegSectionKey>());
  return new Set(INTEG_SECTIONS.filter((s) => hidden.has(s.key)).map((s) => s.href));
}

export async function getPlatformPrefs(): Promise<Record<string, PlatformPref>> {
  const row = await getIntegSettingsRow();
  const raw = (row.platformPrefs ?? {}) as Record<string, PlatformPref>;
  return typeof raw === "object" && raw ? raw : {};
}

/**
 * منبع موجودی و قیمت خرید محصولات نگاشت‌شده — راهنمای نگاشت بر همین پایه است.
 *
 * - `internal`: حسابداری داخلی؛ موجودی سایت از کاردکس انبارهای فروش می‌آید.
 * - `hesaban`: حسابان وب روشن و متصل؛ موجودی و قیمت خرید از حسابان خوانده می‌شود.
 * - `site`: بدون حسابداری؛ موجودی خود محصول سایت مرجع است و در «موجودی» یا صفحه‌ی
 *   محصول ویرایش می‌شود، قیمت خرید دستی.
 */
export type StockSource = "internal" | "hesaban" | "site";

export async function getStockSource(): Promise<StockSource> {
  const [mode, hesaban] = await Promise.all([
    prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } }),
    prisma.integConnection.findFirst({
      where: { platformCode: "hesaban", status: { in: ["CONNECTED", "SYNCING"] }, platform: { isActive: true } },
      select: { id: true },
    }),
  ]);
  if (mode?.mode === "INTERNAL") return "internal";
  return hesaban ? "hesaban" : "site";
}
