import { NextRequest, NextResponse } from "next/server";
import { getCreateSettings, saveCreateSettings, type CreateSettings } from "@/lib/integration/core/variant-links";

export const dynamic = "force-dynamic";

// GET /api/integration/create-products/settings?platform=basalam
export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform") ?? "basalam";
  return NextResponse.json({ ok: true, settings: await getCreateSettings(platform) });
}

// PUT { platform, settings: Partial<CreateSettings> } — categoryMap کامل جایگزین می‌شود
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { platform?: string; settings?: Partial<CreateSettings> };
  try {
    const settings = await saveCreateSettings(body.platform ?? "basalam", body.settings ?? {});
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "ذخیره نشد" });
  }
}
