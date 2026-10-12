import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { ToolError } from "@/lib/tools/common";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

/**
 * POST { items: [{ id, reorderPoint }] } — ثبت نقطه‌ی سفارش پیشنهادی روی کالاهای حسابداری
 * (`AccItem.reorderPoint`، همان فیلد فرم کالا). فقط با ACC_INVENTORY، مثل ویرایش کالا.
 * `null` نقطه را پاک می‌کند. docs/features/tools.md بخش ۱۴
 */
export async function POST(req: Request) {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  if (!can(g.access, "ACC_INVENTORY")) return NextResponse.json({ error: "ثبت نقطه‌ی سفارش دسترسی انبار حسابداری می‌خواهد" }, { status: 403 });
  try {
    const body = await readJson(req);
    const raw = Array.isArray(body.items) ? body.items : [];
    if (!raw.length || raw.length > 1000) throw new ToolError("فهرست کالاها نامعتبر است");
    // یک updateMany برای هر مقدار — ثبت گروهی صدها کالا یک تراکنش کوتاه می‌ماند
    const byValue = new Map<number | null, string[]>();
    for (const x of raw as { id?: unknown; reorderPoint?: unknown }[]) {
      if (typeof x?.id !== "string" || !x.id) throw new ToolError("شناسه‌ی کالا نامعتبر است");
      const v = x.reorderPoint === null ? null : Number(x.reorderPoint);
      if (v !== null && (!Number.isInteger(v) || v < 0 || v > 1_000_000)) throw new ToolError("نقطه‌ی سفارش باید عدد صحیح مثبت باشد");
      byValue.set(v, [...(byValue.get(v) ?? []), x.id]);
    }
    const counts = await prisma.$transaction(
      [...byValue].map(([reorderPoint, ids]) => prisma.accItem.updateMany({ where: { id: { in: ids } }, data: { reorderPoint } })),
    );
    return NextResponse.json({ ok: true, updated: counts.reduce((s, c) => s + c.count, 0) });
  } catch (e) {
    return toolsError(e);
  }
}
