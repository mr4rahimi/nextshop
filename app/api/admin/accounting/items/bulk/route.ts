import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { checkBulk, commitBulk, type BulkRow } from "@/lib/accounting/inventory/bulk";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { commit, rows: [{title, code, barcode, unit, salePrice, group}] } — ورود گروهی، همه یا هیچ */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ commit?: boolean; rows?: unknown }>(req);
    if (!Array.isArray(b.rows) || !b.rows.length) throw new AccError("ردیفی نیست");
    const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
    const rows: BulkRow[] = (b.rows as Record<string, unknown>[]).map((r) => ({
      title: str(r.title),
      code: str(r.code),
      barcode: str(r.barcode),
      unit: str(r.unit),
      salePrice: str(r.salePrice),
      group: str(r.group),
    }));
    if (!b.commit) return NextResponse.json({ checks: await checkBulk(prisma as never, rows) });
    const created = await prisma.$transaction((tx) => commitBulk(tx, rows), { timeout: 300_000 });
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    return accErrorResponse(e, "[acc-item-bulk]");
  }
}
