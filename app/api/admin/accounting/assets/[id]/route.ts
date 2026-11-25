import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { assetDetail } from "@/lib/accounting/assets/fixed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** جزئیات یک دارایی: سندها، استهلاک هر ماه، جدول آینده (در فرم ساخته می‌شود) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_EXPENSE", "ACC_REPORTS", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await ctx.params;
    return NextResponse.json(serialize({ ...(await assetDetail(prisma, id)), can: { manage: can(guard.access, "ACC_EXPENSE") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-assets]");
  }
}
