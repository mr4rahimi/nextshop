import { withPanel, readJson, requireString } from "@/lib/club/sms/route-helpers";
import { parseVars } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return withPanel(async (panel) => ({ pattern: await panel.getPattern(code) }));
}

export async function PUT(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return withPanel(async (panel) => {
    const body = await readJson(req);
    await panel.updatePattern(code, {
      text: requireString(body, "text", "متن پترن"),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      ...(typeof body.website === "string" ? { website: body.website } : {}),
      shared: body.shared === true,
      vars: parseVars(body.vars),
    });
    return { success: true };
  });
}
