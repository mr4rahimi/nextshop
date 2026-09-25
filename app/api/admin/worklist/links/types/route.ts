import { can } from "@/lib/permissions";
import { createType, listTypes } from "@/lib/marketing/link-service";
import { withLinkGuard, readJson, LINK_ANY } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** انواع لینک با پلتفرم‌ها — `?all=1` غیرفعال‌ها را هم می‌آورد (فقط صفحه‌ی تنظیمات) */
export async function GET(req: Request) {
  return withLinkGuard([...LINK_ANY, "MARKETING_SETTINGS_MANAGE"], async (access) => {
    const all =
      new URL(req.url).searchParams.get("all") === "1" &&
      can(access, "MARKETING_SETTINGS_MANAGE");
    return { items: await listTypes(all) };
  });
}

export async function POST(req: Request) {
  return withLinkGuard(
    "MARKETING_SETTINGS_MANAGE",
    async () => ({ type: await createType(await readJson(req)) }),
    201,
  );
}
