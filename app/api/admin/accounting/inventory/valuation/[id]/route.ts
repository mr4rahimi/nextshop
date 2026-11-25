import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { valuationLines } from "@/lib/accounting/inventory/valuation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ردیف‌های یک ارزیابی ثبت‌شده */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_REPORTS", "ACC_INVENTORY", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!can(guard.access, "ACC_COST_VIEW")) return NextResponse.json({ error: "دیدن بهای تمام‌شده مجوز می‌خواهد" }, { status: 403 });
  try {
    const { id } = await ctx.params;
    return NextResponse.json(serialize(await valuationLines(prisma, id)));
  } catch (e) {
    return accErrorResponse(e, "[acc-inv-valuation]");
  }
}
