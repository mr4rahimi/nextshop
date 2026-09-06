import { withPanel, readJson, intParam, requireString } from "@/lib/club/sms/route-helpers";
import type { AttributeType } from "@/lib/club/sms/panel-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: AttributeType[] = ["string", "number", "date"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  return withPanel((panel) =>
    panel.getAttributes(intParam(url, "page", 1), intParam(url, "limit", 50))
  );
}

export async function POST(req: Request) {
  return withPanel(async (panel) => {
    const body = await readJson(req);
    const type = typeof body.type === "string" && TYPES.includes(body.type as AttributeType)
      ? (body.type as AttributeType)
      : "string";
    return panel.createAttribute(requireString(body, "title", "نام ویژگی"), type);
  });
}
