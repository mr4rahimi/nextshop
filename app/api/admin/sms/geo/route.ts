import { withPanel } from "@/lib/club/sms/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * استان‌ها و شهرها
 *
 * ⚠️ این دو endpoint بیرون از `/ws/v1` هستند. فهرست استان‌ها ثابت است و در
 *    حافظه‌ی پروسه کش می‌شود تا هر بار باز شدن فرم LBS یک رفت‌وبرگشت نخورد.
 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let provinceCache: { at: number; data: unknown } | null = null;

export async function GET(req: Request) {
  const provinceId = Number(new URL(req.url).searchParams.get("provinceId"));

  if (Number.isFinite(provinceId) && provinceId > 0) {
    return withPanel(async (panel) => ({ cities: await panel.getCities(provinceId) }));
  }

  if (provinceCache && Date.now() - provinceCache.at < CACHE_TTL_MS) {
    return withPanel(async () => ({ provinces: provinceCache!.data }));
  }

  return withPanel(async (panel) => {
    const provinces = await panel.getProvinces();
    provinceCache = { at: Date.now(), data: provinces };
    return { provinces };
  });
}
