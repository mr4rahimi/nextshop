/**
 * اسکن پیشخوان — docs/plans/inventory-items.md بخش ۱۳.
 *
 *   `POS12`                     ← رسید صندوق (مرجوعی)
 *   کد تازه / بارکد / کد قبلیِ یک‌به‌یک ← همان کالا، یک عدد به سبد
 *   کد قبلیِ چندرنگ/چندسایز     ← پنجره‌ی رنگ × سایزِ همان مدل (کالاهایی که با
 *                                 ویژگی‌های معلوم کد قبلی جور درمی‌آیند)
 *   متن                          ← فهرست نتیجه‌ها
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { exactItem, itemSearchWhere, normalizeItemCode } from "../inventory/items";
import { ALWAYS_ASK_AXES, baseTitleOf } from "../inventory/relabel";
import { posItems, type PosItem } from "./setup";
import { TICKET_BARCODE_PREFIX } from "./tickets";

type Db = Prisma.TransactionClient | typeof prisma;

export interface ModelPick {
  modelId: string;
  title: string;
  legacyCode: string | null;
  /** محورهای انتخاب (رنگ، سایز، …) — فقط آن‌هایی که بین کالاها فرق دارند یا همیشه پرسیده می‌شوند */
  axes: { id: string; name: string; values: { id: string; value: string }[] }[];
  /** ویژگی‌های ثابت کد قبلی (جنس، طرح پارچه …) — فقط نمایش */
  fixed: { axis: string; value: string }[];
  items: (PosItem & { attrs: Record<string, string> })[];
}

export type ScanResult =
  | { kind: "item"; item: PosItem }
  | { kind: "model"; pick: ModelPick }
  | { kind: "ticket"; code: string }
  | { kind: "list"; items: PosItem[] };

const pairs = (raw: unknown): { axisId: string; valueId: string }[] =>
  Array.isArray(raw) ? raw.filter((a): a is { axisId: string; valueId: string } => !!a && typeof a.axisId === "string" && typeof a.valueId === "string") : [];

export async function modelPick(db: Db, modelId: string, legacyCode: string | null, warehouseId: string): Promise<ModelPick> {
  const [model, legacy] = await Promise.all([
    db.accItemModel.findUnique({ where: { id: modelId }, include: { items: { where: { isActive: true }, include: { attrs: true }, orderBy: { code: "asc" } } } }),
    legacyCode ? db.accLegacyItem.findUnique({ where: { code: legacyCode } }) : null,
  ]);
  if (!model) throw new AccError("مدل پیدا نشد", 404);
  const preset = pairs(legacy?.attrs);
  // کالاهایی که با ویژگی‌های معلوم کد قبلی تناقض ندارند
  const fits = model.items.filter((i) => preset.every((p) => !i.attrs.some((a) => a.axisId === p.axisId && a.valueId !== p.valueId)));
  const priced = await posItems(fits.map((i) => i.id), warehouseId, db);
  const presetAxes = new Set(preset.map((p) => p.axisId));
  const usedAxes = new Set(fits.flatMap((i) => i.attrs.map((a) => a.axisId)));
  const axes = await db.accAxis.findMany({
    where: { OR: [{ id: { in: [...usedAxes, ...presetAxes] } }, { name: { in: ALWAYS_ASK_AXES } }] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { values: { orderBy: [{ sortOrder: "asc" }, { value: "asc" }] } },
  });
  const valueName = new Map(axes.flatMap((a) => a.values.map((v) => [v.id, v.value] as const)));
  // محوری که همه‌ی کالاها یک مقدار دارند یا از کد قبلی معلوم است، پرسیدنی نیست
  const varying = axes.filter((a) => {
    if (presetAxes.has(a.id)) return false;
    const vals = new Set(fits.map((i) => i.attrs.find((x) => x.axisId === a.id)?.valueId ?? ""));
    return vals.size > 1 || ALWAYS_ASK_AXES.includes(a.name);
  });
  return {
    modelId: model.id,
    title: baseTitleOf(model),
    legacyCode: legacy?.code ?? null,
    axes: varying.map((a) => ({ id: a.id, name: a.name, values: a.values.map((v) => ({ id: v.id, value: v.value })) })),
    fixed: preset.map((p) => ({ axis: axes.find((a) => a.id === p.axisId)?.name ?? "", value: valueName.get(p.valueId) ?? "" })).filter((f) => f.axis && f.value),
    items: fits
      .filter((i) => priced.has(i.id))
      .map((i) => ({ ...priced.get(i.id)!, attrs: Object.fromEntries(i.attrs.map((a) => [a.axisId, a.valueId])) })),
  };
}

export async function scanCode(raw: string, warehouseId: string, db: Db = prisma): Promise<ScanResult> {
  const term = raw.trim();
  if (!term) throw new AccError("کد را اسکن کنید یا بنویسید");
  const code = normalizeItemCode(term) ?? "";
  if (code.startsWith(TICKET_BARCODE_PREFIX) && /^\d+$/.test(code.slice(TICKET_BARCODE_PREFIX.length))) return { kind: "ticket", code };

  const legacy = await db.accLegacyItem.findUnique({ where: { code }, select: { code: true, modelId: true, itemId: true } });
  if (legacy?.itemId) {
    const it = (await posItems([legacy.itemId], warehouseId, db)).get(legacy.itemId);
    if (it) return { kind: "item", item: it };
  }
  if (legacy) return { kind: "model", pick: await modelPick(db, legacy.modelId, legacy.code, warehouseId) };

  const exact = await exactItem(code, db);
  if (exact) {
    const it = (await posItems([exact], warehouseId, db)).get(exact);
    if (it) return { kind: "item", item: it };
  }
  const found = await db.accItem.findMany({ where: { ...(await itemSearchWhere(term, db)), isActive: true }, orderBy: { title: "asc" }, take: 12, select: { id: true } });
  const map = await posItems(found.map((f) => f.id), warehouseId, db);
  return { kind: "list", items: found.map((f) => map.get(f.id)).filter((x): x is PosItem => !!x) };
}
