import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { commitSplit, splitCandidates, splitView } from "@/lib/accounting/inventory/split";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تفکیک ردیف خرید به رنگ و سایز — docs/plans/inventory-items.md بخش ۱۶.
 * GET ?line=… — کارگاه یک ردیف (محورها، تنوع‌های موجود مدل، موجودی)
 * GET ?invoice=…&q=… — ردیف‌های تفکیک‌شدنی فاکتورهای خرید
 * POST `{lineId, rows:[{values:{axisId:نام}, qty}]}` — شکستن ردیف، ساخت تنوع نبود، کاردکس و سند دوباره
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const lineId = sp.get("line");
    if (lineId) return NextResponse.json(serialize({ view: await splitView(prisma, lineId) }));
    const list = await splitCandidates(prisma, { q: sp.get("q"), invoiceId: sp.get("invoice") });
    const manage = can(guard.access, "ACC_PURCHASE") && can(guard.access, "ACC_INVENTORY");
    return NextResponse.json(serialize({ list, can: { manage } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-split]");
  }
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_PURCHASE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!can(guard.access, "ACC_INVENTORY")) return NextResponse.json({ error: "تفکیک خرید مجوز «کالا و انبار» هم می‌خواهد" }, { status: 403 });
  try {
    const b = await readJson<{ lineId?: string; rows?: { values: Record<string, string>; qty: number }[] }>(req);
    if (!b.lineId) return NextResponse.json({ error: "ردیف فاکتور را انتخاب کنید" }, { status: 400 });
    const res = await prisma.$transaction((tx) => commitSplit(tx, { lineId: b.lineId!, rows: b.rows ?? [] }, actorOf(guard.access)), {
      timeout: 60_000,
    });
    await logActivity({
      action: "UPDATE",
      entity: "OTHER",
      entityTitle: "تفکیک خرید",
      summary: `تفکیک ردیف خرید به ${res.items.length} رنگ/سایز (${res.items.reduce((s, i) => s + i.qty, 0)} عدد)`,
    });
    const view = res.remainder > 0 ? await splitView(prisma, b.lineId) : null;
    return NextResponse.json(serialize({ ok: true, ...res, view }));
  } catch (e) {
    return accErrorResponse(e, "[acc-split]");
  }
}
