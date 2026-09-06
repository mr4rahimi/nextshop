import { withPanel, readJson, intParam, requireString } from "@/lib/club/sms/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return withPanel((panel) =>
    panel.getPhonebooks(intParam(url, "page", 1), intParam(url, "limit", 30))
  );
}

export async function POST(req: Request) {
  return withPanel(async (panel) => {
    const body = await readJson(req);
    const ids = Array.isArray(body.attributeIds)
      ? body.attributeIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    return panel.createPhonebook(requireString(body, "title", "نام دفترچه"), ids);
  });
}
