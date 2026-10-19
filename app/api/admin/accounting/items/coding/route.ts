import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { getAccSettings } from "@/lib/accounting/settings";
import { CODE_PRESETS, autoGroupCodes, parsePattern, patternExample } from "@/lib/accounting/inventory/codes";
import { normalizeLabelConfig } from "@/lib/accounting/inventory/label-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * کدگذاری کالا و تنظیم برچسب — docs/plans/inventory-items.md بخش ۱۲.
 * GET — الگوی کد، نمونه، گروه‌های بی‌کد، تنظیم برچسب
 * PATCH `{pattern?, labelConfig?, autoGroupCodes?}` — فقط کدهای بعدی عوض می‌شوند
 */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [s, groups, noCode] = await Promise.all([getAccSettings(), prisma.accItemGroup.count(), prisma.accItemGroup.count({ where: { code: null } })]);
  return NextResponse.json(
    serialize({
      pattern: s.itemCodePattern,
      example: safeExample(s.itemCodePattern),
      presets: CODE_PRESETS.map((p) => ({ ...p, example: patternExample(p.pattern) })),
      groups: { total: groups, noCode },
      labelConfig: normalizeLabelConfig(s.labelConfig),
      can: { manage: can(guard.access, "ACC_INVENTORY") },
    }),
  );
}

function safeExample(p: string) {
  try {
    return patternExample(p);
  } catch {
    return null;
  }
}

export async function PATCH(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ pattern?: unknown; labelConfig?: unknown; autoGroupCodes?: unknown }>(req);
    const before = await getAccSettings();
    const data: { itemCodePattern?: string; labelConfig?: object } = {};
    if (b.pattern !== undefined) {
      const p = String(b.pattern ?? "").replace(/\s+/g, "");
      parsePattern(p);
      data.itemCodePattern = p;
    }
    if (b.labelConfig !== undefined) data.labelConfig = normalizeLabelConfig(b.labelConfig) as unknown as object;
    let coded = 0;
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.accSettings.update({ where: { id: "singleton" }, data });
      if (b.autoGroupCodes === true) coded = await autoGroupCodes(tx);
    });
    if (data.itemCodePattern && data.itemCodePattern !== before.itemCodePattern) {
      await logActivity({
        action: "UPDATE",
        entity: "SETTINGS",
        entityId: "accounting",
        entityTitle: "الگوی کد کالا",
        summary: `الگوی کد کالا: ${before.itemCodePattern} ← ${data.itemCodePattern}`,
        changes: [{ field: "itemCodePattern", label: "الگوی کد کالا", before: before.itemCodePattern, after: data.itemCodePattern }],
      });
    }
    return NextResponse.json({ ok: true, coded });
  } catch (e) {
    return accErrorResponse(e, "[acc-item-coding]");
  }
}
