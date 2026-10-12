import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { COMPARE_MAX, loadCompare } from "@/lib/tools/compare-data";
import { toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?ids=a,b&days=30|90|180|365 — داده‌ی مقایسه‌ی ۲ تا ۴ محصول. docs/features/tools.md بخش ۲۱
 *
 * فروش، سود و بها داده‌ی مالی است: علاوه بر مجوز ابزارها، ACC_COST_VIEW لازم است
 * (docs/plans/store-tools-3.md تصمیم ۲).
 */
export async function GET(req: Request) {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  if (!can(g.access, "ACC_COST_VIEW")) {
    return NextResponse.json({ error: "مقایسه‌ی فروش و سود دسترسی «دیدن بهای تمام‌شده» در حسابداری را می‌خواهد" }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const ids = [...new Set((url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, COMPARE_MAX);
    if (!ids.length) return NextResponse.json({ items: [] });
    const items = await loadCompare(ids, Number(url.searchParams.get("days")) || 90, true);
    // همان ترتیب انتخاب کاربر
    items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    return NextResponse.json({ items });
  } catch (e) {
    return toolsError(e);
  }
}
