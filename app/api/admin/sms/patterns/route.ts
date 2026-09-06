import { withPanel, readJson, intParam, strParam, requireString } from "@/lib/club/sms/route-helpers";
import { SmsApiError } from "@/lib/club/sms";
import type { PatternStatus, PatternVar, PatternVarType } from "@/lib/club/sms/panel-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: PatternStatus[] = ["pending", "active", "rejected"];
const VAR_TYPES: PatternVarType[] = ["int", "str", "date"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = strParam(url, "status");

  return withPanel((panel) =>
    panel.getPatterns({
      page: intParam(url, "page", 1),
      limit: intParam(url, "limit", 20),
      search: strParam(url, "search"),
      ...(status && STATUSES.includes(status as PatternStatus)
        ? { status: status as PatternStatus }
        : {}),
    })
  );
}

export async function POST(req: Request) {
  return withPanel(async (panel) => {
    const body = await readJson(req);
    return panel.createPattern({
      text: requireString(body, "text", "متن پترن"),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      ...(typeof body.website === "string" ? { website: body.website } : {}),
      shared: body.shared === true,
      ...(Number.isFinite(Number(body.category)) ? { category: Number(body.category) } : {}),
      vars: parseVars(body.vars),
    });
  });
}

/**
 * متغیرهای پترن باید با `%var%`های داخل متن بخوانند. اعتبارسنجی اینجا انجام
 * می‌شود چون پیام خطای پنل برای این حالت گنگ است.
 */
export function parseVars(raw: unknown): PatternVar[] {
  if (!Array.isArray(raw)) return [];

  const out: PatternVar[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.var === "string" ? r.var.trim() : "";
    if (!name) continue;

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new SmsApiError(
        "VALIDATION",
        `نام متغیر «${name}» نامعتبر است — فقط حروف انگلیسی، عدد و زیرخط`
      );
    }

    const type = typeof r.type === "string" && VAR_TYPES.includes(r.type as PatternVarType)
      ? (r.type as PatternVarType)
      : "str";

    const length = Number(r.length);
    out.push({
      var: name,
      length: Number.isFinite(length) && length > 0 ? Math.floor(length) : 20,
      type,
    });
  }
  return out;
}
