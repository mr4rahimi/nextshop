/**
 * برچسب‌گذاری دوباره و تفکیک کد قبلی — docs/plans/inventory-items.md بخش ۱۲.
 *
 * نرم‌افزار قبلی کسب‌وکار اغلب همه‌ی رنگ‌ها و سایزهای یک مدل را زیر یک کد
 * می‌شمرد. هر کد قبلی (`AccLegacyItem`) یک مدل دارد؛ فروشنده کد قبلی را اسکن
 * می‌کند، رنگ/سایز هر دسته از جنس‌ها را می‌گوید و تعدادش را می‌نویسد، تنوعِ
 * نبود با کد خودکار ساخته می‌شود و برچسب همان تعداد چاپ می‌شود.
 *
 * ⚠️ اینجا موجودی جابه‌جا نمی‌شود: تا روز شروع، فروش در نرم‌افزار قبلی است و
 *    موجودی اول دوره با انبارگردانیِ برچسب‌های تازه ثبت می‌شود. شمار برچسب‌ها
 *    (`AccRelabelLog`) فقط پیشرفت کار را نشان می‌دهد.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { ensureAxisValues } from "./catalog";
import { attrKeyOf, createItem, exactItem, normalizeItemCode } from "./items";

type Db = Prisma.TransactionClient | typeof prisma;
type Tx = Prisma.TransactionClient;

/** محورهایی که برای کد قبلی همیشه پرسیده می‌شوند، حتی اگر نرم‌افزار قبلی خالی گذاشته باشد */
export const ALWAYS_ASK_AXES = ["سایز", "رنگ"];
export const RELABEL_MAX_ROWS = 200;
export const RELABEL_MAX_QTY = 500;

export interface AttrPair {
  axisId: string;
  valueId: string;
}

export interface ModelSpecs {
  /** عنوان پایه‌ی کالاها — بی پسوند یکتایی مدل */
  base?: string;
  unit?: string;
  specs?: Record<string, string>;
}

export const specsOf = (raw: unknown): ModelSpecs => (raw && typeof raw === "object" ? (raw as ModelSpecs) : {});
export const baseTitleOf = (m: { title: string; specs: unknown }) => specsOf(m.specs).base?.trim() || m.title;
const pairsOf = (raw: unknown): AttrPair[] => (Array.isArray(raw) ? raw.filter((a): a is AttrPair => !!a && typeof a.axisId === "string" && typeof a.valueId === "string") : []);

export interface RelabelView {
  legacy: {
    code: string;
    source: string;
    title: string;
    legacyQty: number;
    labeled: number;
    salePrice: bigint | null;
    attrs: Record<string, string>;
  } | null;
  model: { id: string; title: string; base: string; code: string | null; specs: Record<string, string>; unit: string; groupName: string | null };
  axes: { id: string; name: string; values: { id: string; value: string }[] }[];
  items: { id: string; code: string; title: string; salePrice: bigint | null; attrs: Record<string, string>; labeled: number; removable: boolean }[];
  /** کالای دقیقِ اسکن‌شده (کد تازه یا کد قبلیِ یک‌به‌یک) */
  hitItemId: string | null;
}

async function labeledByItem(db: Db, legacyCode: string | null, itemIds: string[]) {
  const rows = await db.accRelabelLog.groupBy({
    by: ["itemId"],
    where: { itemId: { in: itemIds }, ...(legacyCode ? { legacyCode } : {}) },
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.itemId, r._sum.qty ?? 0]));
}

async function buildView(db: Db, modelId: string, legacyCode: string | null, hitItemId: string | null): Promise<RelabelView> {
  const [model, legacy] = await Promise.all([
    db.accItemModel.findUnique({
      where: { id: modelId },
      include: { group: { select: { name: true } }, items: { where: { isActive: true }, include: { attrs: true }, orderBy: { code: "asc" } } },
    }),
    legacyCode ? db.accLegacyItem.findUnique({ where: { code: legacyCode } }) : null,
  ]);
  if (!model) throw new AccError("مدل پیدا نشد", 404);
  const preset = pairsOf(legacy?.attrs);
  const used = new Set([...preset.map((p) => p.axisId), ...model.items.flatMap((i) => i.attrs.map((a) => a.axisId))]);
  const axes = await db.accAxis.findMany({
    where: { OR: [{ id: { in: [...used] } }, { name: { in: ALWAYS_ASK_AXES } }] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { values: { orderBy: [{ sortOrder: "asc" }, { value: "asc" }] } },
  });
  const labeled = await labeledByItem(db, legacyCode, model.items.map((i) => i.id));
  const removable = new Set(legacyCode ? await removableItems(db, legacyCode, model.items.map((i) => i.id)) : []);
  const legacyLabeled = legacyCode ? ((await db.accRelabelLog.aggregate({ where: { legacyCode }, _sum: { qty: true } }))._sum.qty ?? 0) : 0;
  const sp = specsOf(model.specs);
  return {
    legacy: legacy
      ? {
          code: legacy.code,
          source: legacy.source,
          title: legacy.title,
          legacyQty: legacy.legacyQty,
          labeled: legacyLabeled,
          salePrice: legacy.salePrice,
          attrs: Object.fromEntries(preset.map((p) => [p.axisId, p.valueId])),
        }
      : null,
    model: { id: model.id, title: model.title, base: baseTitleOf(model), code: model.code, specs: sp.specs ?? {}, unit: sp.unit ?? "عدد", groupName: model.group?.name ?? null },
    axes: axes.map((a) => ({ id: a.id, name: a.name, values: a.values.map((v) => ({ id: v.id, value: v.value })) })),
    items: model.items.map((i) => ({
      id: i.id,
      code: i.code,
      title: i.title,
      salePrice: i.salePrice,
      attrs: Object.fromEntries(i.attrs.map((a) => [a.axisId, a.valueId])),
      labeled: labeled.get(i.id) ?? 0,
      removable: removable.has(i.id),
    })),
    hitItemId,
  };
}

/**
 * اسکن: کد قبلی ← مدلش؛ کد تازه/بارکد ← مدل همان کالا (و کد قبلیِ وصل به آن اگر بود).
 * کالای بی‌مدل اینجا جایی ندارد (برچسبش از کاردکس چاپ می‌شود).
 */
export async function lookupRelabel(raw: string, db: Db = prisma): Promise<RelabelView> {
  const code = normalizeItemCode(raw);
  if (!code) throw new AccError("کد را اسکن کنید یا بنویسید");
  const legacy = await db.accLegacyItem.findUnique({ where: { code }, select: { code: true, modelId: true, itemId: true } });
  if (legacy) return buildView(db, legacy.modelId, legacy.code, legacy.itemId);
  const itemId = await exactItem(code, db);
  if (!itemId) throw new AccError(`کد «${code}» نه کد قبلی است نه کالا`, 404);
  const item = await db.accItem.findUnique({ where: { id: itemId }, select: { modelId: true, title: true } });
  if (!item?.modelId) throw new AccError(`«${item?.title ?? code}» مدل ندارد — برچسبش را از صفحه‌ی کالا چاپ کنید`, 409);
  // کد قبلیِ یک‌به‌یکِ همین کالا، وگرنه کد قبلیِ چندتنوعیِ همان مدل (اگر فقط یکی است)
  const viaLegacy =
    (await db.accLegacyItem.findFirst({ where: { itemId }, select: { code: true } })) ??
    (await db.accLegacyItem.findMany({ where: { modelId: item.modelId, itemId: null }, select: { code: true }, take: 2 }).then((l) => (l.length === 1 ? l[0] : null)));
  return buildView(db, item.modelId, viaLegacy?.code ?? null, itemId);
}

export interface RelabelInput {
  modelId: string;
  legacyCode?: string | null;
  /** هر ردیف: نام مقدار برای هر محور (`axisId` ← «آبی») و تعداد برچسب */
  rows: { values: Record<string, string>; qty: number }[];
  byName?: string | null;
}

/**
 * ساخت تنوع‌های نبود + ثبت شمار برچسب. خروجی: کالا و تعداد برای صفحه‌ی چاپ.
 * ردیف هم‌ترکیب جمع می‌شود؛ ردیف بی‌تعداد فقط کالا را می‌سازد.
 */
export async function commitRelabel(tx: Tx, input: RelabelInput) {
  const model = await tx.accItemModel.findUnique({ where: { id: input.modelId }, include: { items: { select: { id: true, attrKey: true, isActive: true } } } });
  if (!model) throw new AccError("مدل پیدا نشد", 404);
  const legacy = input.legacyCode ? await tx.accLegacyItem.findUnique({ where: { code: normalizeItemCode(input.legacyCode) ?? "" } }) : null;
  if (input.legacyCode && !legacy) throw new AccError("کد قبلی پیدا نشد", 404);
  if (legacy && legacy.modelId !== model.id) throw new AccError("کد قبلی مال مدل دیگری است");
  const rows = (input.rows ?? []).filter((r) => Object.values(r.values ?? {}).some((v) => String(v ?? "").trim()) || r.qty > 0);
  if (!rows.length) throw new AccError("دست‌کم یک ردیف با رنگ/سایز و تعداد بنویسید");
  if (rows.length > RELABEL_MAX_ROWS) throw new AccError(`حداکثر ${RELABEL_MAX_ROWS} ردیف در یک بار`);

  const sp = specsOf(model.specs);
  const base = baseTitleOf(model);
  const axes = await tx.accAxis.findMany({ select: { id: true, sortOrder: true, name: true } });
  const axisOrder = new Map(axes.map((a) => [a.id, a.sortOrder]));
  const byKey = new Map(model.items.map((i) => [i.attrKey, i]));
  const merged = new Map<string, { itemId: string; qty: number }>();

  for (const r of rows) {
    const qty = Math.floor(Number(r.qty) || 0);
    if (qty < 0 || qty > RELABEL_MAX_QTY) throw new AccError(`تعداد هر ردیف بین ۰ تا ${RELABEL_MAX_QTY}`);
    const attrs: (AttrPair & { value: string })[] = [];
    for (const [axisId, raw] of Object.entries(r.values ?? {})) {
      const name = String(raw ?? "").replace(/\s+/g, " ").trim();
      if (!name) continue;
      if (!axisOrder.has(axisId)) throw new AccError("ویژگی پیدا نشد");
      const { values } = await ensureAxisValues(tx, axisId, [name]);
      attrs.push({ axisId, valueId: values[0].id, value: values[0].value });
    }
    const key = attrKeyOf(attrs);
    let hit = byKey.get(key);
    if (hit && !hit.isActive) await tx.accItem.update({ where: { id: hit.id }, data: { isActive: true } });
    if (!hit) {
      const values = [...attrs].sort((a, b) => (axisOrder.get(a.axisId) ?? 0) - (axisOrder.get(b.axisId) ?? 0)).map((a) => a.value);
      const created = await createItem(
        tx,
        {
          title: [base, ...values].join(" "),
          groupId: model.groupId,
          unit: sp.unit,
          salePrice: legacy?.salePrice ?? null,
          sellOnline: true,
        },
        { modelId: model.id, attrs },
      );
      hit = { id: created.id, attrKey: key, isActive: true };
      byKey.set(key, hit);
    }
    const m = merged.get(hit.id) ?? { itemId: hit.id, qty: 0 };
    m.qty += qty;
    merged.set(hit.id, m);
  }

  const out = [...merged.values()];
  if (legacy) {
    const logs = out.filter((o) => o.qty > 0).map((o) => ({ legacyCode: legacy.code, itemId: o.itemId, qty: o.qty, byName: input.byName ?? null }));
    if (logs.length) await tx.accRelabelLog.createMany({ data: logs });
  }
  return out;
}

/** کالا جای دیگری به کار نرفته؟ (فقط کالای ساخته‌شده‌ی اشتباه پاک می‌شود) */
async function itemUnused(tx: Tx, itemId: string, legacyCode: string) {
  const [moves, lines, counts, transfers, stock, cost, variant, product, legacy, otherLogs] = await Promise.all([
    tx.accStockMove.count({ where: { productId: itemId } }),
    tx.accInvoiceLine.count({ where: { productId: itemId } }),
    tx.accStockCountLine.count({ where: { productId: itemId } }),
    tx.accTransferLine.count({ where: { productId: itemId } }),
    tx.accStock.count({ where: { productId: itemId, qty: { not: 0 } } }),
    tx.accProductCost.count({ where: { productId: itemId, qtyOnHand: { not: 0 } } }),
    tx.productVariant.count({ where: { accItemId: itemId } }),
    tx.product.count({ where: { id: itemId } }),
    tx.accLegacyItem.count({ where: { itemId } }),
    tx.accRelabelLog.count({ where: { itemId, legacyCode: { not: legacyCode } } }),
  ]);
  return moves + lines + counts + transfers + stock + cost + variant + product + legacy + otherLogs === 0;
}

export interface RelabelEditInput {
  legacyCode: string;
  /** تعداد درست برچسب هر کالای این کد قبلی؛ ۰ = هیچ */
  rows: { itemId: string; qty: number; remove?: boolean }[];
  byName?: string | null;
}

/**
 * اصلاح شمار ثبت‌شده‌ی یک کد قبلی — تعداد اشتباه یا رنگ/سایز اشتباه.
 * شمار هر کالا جایگزین می‌شود (موجودی و کاردکس دست نمی‌خورد، مثل خود ثبت).
 * `remove` کالایی را که با همین صفحه ساخته شده و هیچ جای دیگری به کار نرفته پاک می‌کند.
 */
export async function editRelabel(tx: Tx, input: RelabelEditInput) {
  const legacy = await tx.accLegacyItem.findUnique({ where: { code: normalizeItemCode(input.legacyCode) ?? "" } });
  if (!legacy) throw new AccError("کد قبلی پیدا نشد", 404);
  const ids = [...new Set(input.rows.map((r) => r.itemId))];
  const items = await tx.accItem.findMany({ where: { id: { in: ids } }, select: { id: true, modelId: true, code: true, title: true } });
  if (items.length !== ids.length || items.some((i) => i.modelId !== legacy.modelId)) throw new AccError("کالا مال همین کد قبلی نیست");
  let removed = 0;
  for (const r of input.rows) {
    const qty = Math.floor(Number(r.qty) || 0);
    if (qty < 0 || qty > RELABEL_MAX_QTY) throw new AccError(`تعداد هر ردیف بین ۰ تا ${RELABEL_MAX_QTY}`);
    await tx.accRelabelLog.deleteMany({ where: { legacyCode: legacy.code, itemId: r.itemId } });
    if (r.remove) {
      const it = items.find((i) => i.id === r.itemId)!;
      if (!(await itemUnused(tx, r.itemId, legacy.code))) throw new AccError(`«${it.title}» (${it.code}) جای دیگری به کار رفته و پاک نمی‌شود — فقط تعدادش را صفر کنید`, 409);
      await tx.accItem.delete({ where: { id: r.itemId } });
      removed++;
      continue;
    }
    if (qty > 0) await tx.accRelabelLog.create({ data: { legacyCode: legacy.code, itemId: r.itemId, qty, byName: input.byName ?? null } });
  }
  return { removed };
}

/** کدام کالاهای یک کد قبلی پاک‌شدنی‌اند (برای نمایش دکمه) */
export async function removableItems(db: Db, legacyCode: string, itemIds: string[]) {
  const out: string[] = [];
  for (const id of itemIds) if (await itemUnused(db as Tx, id, legacyCode)) out.push(id);
  return out;
}

export type RelabelStatus = "todo" | "partial" | "done";

/** فهرست کدهای قبلی با پیشرفت — برای مدیر فروشگاه */
export async function relabelProgress(db: Db, opts: { status?: RelabelStatus | null; q?: string | null; take?: number }) {
  const [legacies, sums] = await Promise.all([
    db.accLegacyItem.findMany({ select: { code: true, title: true, legacyQty: true, itemId: true, model: { select: { group: { select: { name: true } } } } } }),
    db.accRelabelLog.groupBy({ by: ["legacyCode"], _sum: { qty: true } }),
  ]);
  const done = new Map(sums.map((s) => [s.legacyCode, s._sum.qty ?? 0]));
  const rows = legacies.map((l) => {
    const labeled = done.get(l.code) ?? 0;
    const status: RelabelStatus = labeled <= 0 ? "todo" : labeled >= l.legacyQty ? "done" : "partial";
    return { code: l.code, title: l.title, group: l.model.group?.name ?? null, legacyQty: l.legacyQty, labeled, status, mixed: !l.itemId };
  });
  const stats = {
    codes: rows.length,
    mixed: rows.filter((r) => r.mixed).length,
    legacyQty: rows.reduce((s, r) => s + r.legacyQty, 0),
    labeled: rows.reduce((s, r) => s + r.labeled, 0),
    todo: rows.filter((r) => r.status === "todo").length,
    partial: rows.filter((r) => r.status === "partial").length,
    done: rows.filter((r) => r.status === "done").length,
  };
  const term = opts.q?.trim();
  const lat = normalizeItemCode(term) ?? "";
  const list = rows
    .filter((r) => !opts.status || r.status === opts.status)
    .filter((r) => !term || r.title.includes(term) || r.code.includes(lat) || (r.group ?? "").includes(term))
    .sort((a, b) => (a.status === b.status ? b.legacyQty - a.legacyQty : a.status === "partial" ? -1 : b.status === "partial" ? 1 : a.status === "todo" ? -1 : 1))
    .slice(0, opts.take ?? 100);
  return { stats, list };
}
