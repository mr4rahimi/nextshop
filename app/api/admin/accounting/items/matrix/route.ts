import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { runMatrix, type MatrixInput } from "@/lib/accounting/inventory/matrix";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class Preview {
  constructor(readonly result: unknown) {}
}

/**
 * POST { commit, modelId|modelTitle, groupId, unit, salePrice, axes: [{axisId, values}], rows } —
 * ساخت ماتریسی (docs/plans/inventory-items.md بخش ۴). `commit: false` = پیش‌نمایش،
 * در تراکنشی که برگردانده می‌شود (مقدار تازه‌ی ویژگی هم نمی‌ماند).
 */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<Record<string, unknown>>(req);
    if (!Array.isArray(b.axes)) throw new AccError("ویژگی‌ها را انتخاب کنید");
    const rows: MatrixInput["rows"] = {};
    for (const [k, r] of Object.entries((b.rows ?? {}) as Record<string, Record<string, unknown>>)) {
      rows[k] = {
        title: r.title ? String(r.title) : undefined,
        code: r.code ? String(r.code) : null,
        barcode: r.barcode ? String(r.barcode) : null,
        salePrice: r.salePrice === undefined || r.salePrice === null || r.salePrice === "" ? null : toAmount(r.salePrice, "قیمت"),
        skip: !!r.skip,
      };
    }
    const input: MatrixInput = {
      modelId: b.modelId ? String(b.modelId) : null,
      modelTitle: b.modelTitle ? String(b.modelTitle) : null,
      groupId: b.groupId ? String(b.groupId) : null,
      unit: b.unit ? String(b.unit) : null,
      salePrice: b.salePrice === undefined || b.salePrice === null || b.salePrice === "" ? null : toAmount(b.salePrice, "قیمت فروش"),
      axes: (b.axes as { axisId: string; values: unknown[] }[]).map((a) => ({ axisId: String(a.axisId), values: (a.values ?? []).map(String) })),
      rows,
    };
    if (b.commit) {
      const r = await prisma.$transaction((tx) => runMatrix(tx, input, true), { timeout: 120_000 });
      return NextResponse.json(serialize({ ok: true, ...r }));
    }
    try {
      await prisma.$transaction(async (tx) => {
        throw new Preview(await runMatrix(tx, input, false));
      });
    } catch (e) {
      if (e instanceof Preview) return NextResponse.json(serialize(e.result));
      throw e;
    }
    return NextResponse.json({});
  } catch (e) {
    return accErrorResponse(e, "[acc-matrix]");
  }
}
