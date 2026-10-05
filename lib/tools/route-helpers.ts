/**
 * نگهبان و پاسخ خطای APIهای ابزارها — docs/features/tools.md
 *
 * `proxy.ts` فقط «به بخش ابزارها دسترسی دارد» را می‌سنجد (یکی از دو مجوز)؛
 * هر route خودش می‌گوید دیدن کافی است یا ساختن و ویرایش لازم است.
 */

import { NextResponse } from "next/server";
import { requirePermission, type StaffAccess } from "@/lib/permissions";
import { ToolError } from "./common";

export async function toolsGuard(
  level: "view" | "manage",
): Promise<{ ok: true; access: StaffAccess } | { ok: false; res: NextResponse }> {
  const g = await requirePermission(level === "manage" ? "TOOLS_MANAGE" : ["TOOLS_VIEW", "TOOLS_MANAGE"]);
  if (!g.ok) return { ok: false, res: NextResponse.json({ error: g.error }, { status: g.status }) };
  return { ok: true, access: g.access };
}

export function toolsError(e: unknown): NextResponse {
  if (e instanceof ToolError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[tools]", e);
  return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    throw new ToolError("بدنه‌ی درخواست نامعتبر است");
  }
}
