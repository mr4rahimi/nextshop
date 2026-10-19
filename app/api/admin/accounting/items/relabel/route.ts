import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { commitRelabel, lookupRelabel, relabelProgress, type RelabelStatus } from "@/lib/accounting/inventory/relabel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * برچسب‌گذاری دوباره و تفکیک کد قبلی — docs/plans/inventory-items.md بخش ۱۲.
 * GET ?code=… — مدل کد اسکن‌شده با تنوع‌ها و شمار برچسب
 * GET ?status=todo|partial|done&q=… — پیشرفت کدهای قبلی
 * POST `{modelId, legacyCode?, rows:[{values:{axisId:نام}, qty}]}` — ساخت تنوع نبود + شمار برچسب
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const code = sp.get("code");
    if (code) return NextResponse.json(serialize({ view: await lookupRelabel(code) }));
    const status = (["todo", "partial", "done"] as const).find((s) => s === sp.get("status")) ?? null;
    const progress = await relabelProgress(prisma, { status: status as RelabelStatus | null, q: sp.get("q"), take: 200 });
    return NextResponse.json(serialize({ ...progress, can: { manage: can(guard.access, "ACC_INVENTORY") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-relabel]");
  }
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ modelId?: string; legacyCode?: string | null; rows?: { values: Record<string, string>; qty: number }[] }>(req);
    if (!b.modelId) return NextResponse.json({ error: "مدل را انتخاب کنید" }, { status: 400 });
    const items = await prisma.$transaction((tx) => commitRelabel(tx, { modelId: b.modelId!, legacyCode: b.legacyCode ?? null, rows: b.rows ?? [], byName: guard.access.name }), {
      timeout: 30_000,
    });
    const code = b.legacyCode ?? null;
    const view = code ? await lookupRelabel(code) : null;
    return NextResponse.json(serialize({ ok: true, items, view }));
  } catch (e) {
    return accErrorResponse(e, "[acc-relabel]");
  }
}
