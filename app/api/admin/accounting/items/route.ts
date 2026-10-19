import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { createItem } from "@/lib/accounting/inventory/items";
import { peekCodeHint } from "@/lib/accounting/inventory/codes";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { parseItemInput } from "./parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * کالای حسابداری — docs/plans/inventory-items.md.
 * GET — کد خودکار بعدی (پیش‌نمایش؛ شمارنده فقط با ثبت جلو می‌رود؛ الگوی غیرساده «خودکار»)
 * POST — کالای تازه بی‌محصول
 */
export async function GET() {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ code: await peekCodeHint(prisma) });
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const input = parseItemInput(await readJson(req));
    const item = await prisma.$transaction((tx) => createItem(tx, input));
    return NextResponse.json(serialize({ ok: true, item }));
  } catch (e) {
    return accErrorResponse(e, "[acc-item]");
  }
}
