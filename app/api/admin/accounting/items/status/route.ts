import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";
import { planRetire, resolveCodes, retireItems, type RetireAction } from "@/lib/accounting/inventory/retire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: RetireAction[] = ["activate", "deactivate", "delete"];
const LABEL: Record<RetireAction, string> = { activate: "فعال کردن", deactivate: "غیرفعال کردن", delete: "حذف" };

/**
 * حذف و فعال/غیرفعال دسته‌ای کالا — docs/plans/webhesab-parity.md بخش ۱۲.
 * POST { action: "check", ids } — پیش‌نمایش (پاک‌شدنی، گردش‌دار با دلیل)
 * POST { action: "codes", codes } — فهرست کد اکسل ← شناسه‌ی کالا
 * POST { action: "activate"|"deactivate"|"delete", ids, strict? } — انجام؛ حذفِ گردش‌دار = غیرفعال
 */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ action?: string; ids?: unknown; codes?: unknown; strict?: boolean }>(req);
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    if (b.action === "check") return NextResponse.json(serialize(await planRetire(prisma, ids)));
    if (b.action === "codes") {
      const codes = Array.isArray(b.codes) ? b.codes.map(String) : [];
      const r = await resolveCodes(prisma, codes);
      return NextResponse.json(serialize({ ...r, plan: r.ids.length ? await planRetire(prisma, r.ids) : null }));
    }
    const action = b.action as RetireAction;
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: "کار نامعتبر" }, { status: 400 });
    const res = await prisma.$transaction((tx) => retireItems(tx, ids, action, { strict: !!b.strict }), { timeout: 60_000 });
    if (res.changed) {
      const parts = action === "delete" ? [res.deleted && `${faNum(res.deleted)} پاک`, res.deactivated && `${faNum(res.deactivated)} غیرفعال (گردش‌دار)`] : [`${faNum(res.changed)} کالا`];
      await logActivity({
        action: action === "delete" ? "DELETE" : "UPDATE",
        entity: "OTHER",
        entityTitle: "کالای حسابداری",
        summary: `${LABEL[action]} دسته‌ای کالا: ${parts.filter(Boolean).join("، ")}${res.codes.length ? ` — کدهای پاک‌شده: ${res.codes.slice(0, 50).join("، ")}${res.codes.length > 50 ? "…" : ""}` : ""}`,
      });
    }
    return NextResponse.json(serialize({ ok: true, ...res }));
  } catch (e) {
    return accErrorResponse(e, "[acc-item-status]");
  }
}
