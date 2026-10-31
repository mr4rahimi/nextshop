/**
 * قیمت فروشگاه — تغییر گروهی، ورود با اکسل و تاریخچه (docs/plans/webhesab-parity.md بخش ۱۰).
 *
 *   قیمت فروشگاه = `AccItem.salePrice`؛ نبودش ← قیمت تنوع/محصول سایت (همان `posItems`)
 *
 * هر نوشتن `salePrice` یک ردیف `AccPriceChange` می‌گذارد (فرم کالا از `updateItem`،
 * گروهی و اکسل از `applyPriceRows`). کار گروهی و اکسل یک `AccPriceBatch` هم دارند تا
 * «برگرداندن» همان دسته ممکن باشد. بعد از هر نوشتن `applyOnlinePrices` (قیمت سایت اگر
 * کلید قیمت آنلاین روشن است).
 *
 * ⚠️ `plan*` چیزی نمی‌نویسد؛ نوشتن فقط در `applyPriceRows` و `undoBatch`.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "../ledger/post";
import { AccError } from "../errors";
import { faNum, formatAmount } from "../money";
import { applyOnlinePrices } from "./online-price";
import { applyRule, type RoundMode } from "./online-price-calc";
import { exactItem, itemSearchWhere, normalizeItemCode } from "./items";
import { recordPriceChanges, storePrices, type PriceSource } from "./price-log";

export { storePrices, type PriceSource };

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const MAX_ITEMS = 20_000;
export type BatchKind = "PERCENT" | "AMOUNT" | "SET" | "EXCEL" | "UNDO";

// ── انتخاب کالاها ─────────────────────────────────────────────────────

export interface PriceFilter {
  q?: string | null;
  /** گروه با همه‌ی زیرگروه‌ها */
  groupId?: string | null;
  supplierId?: string | null;
  /** مقدار ویژگی (رنگ آبی، سایز XL) */
  valueId?: string | null;
  includeInactive?: boolean;
}

async function groupWithChildren(db: Db, groupId: string): Promise<string[]> {
  const all = await db.accItemGroup.findMany({ select: { id: true, parentId: true } });
  const out = new Set([groupId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const g of all) if (g.parentId && out.has(g.parentId) && !out.has(g.id)) (out.add(g.id), (grew = true));
  }
  return [...out];
}

export async function filterWhere(db: Db, f: PriceFilter): Promise<Prisma.AccItemWhereInput> {
  const and: Prisma.AccItemWhereInput[] = [];
  if (!f.includeInactive) and.push({ isActive: true });
  if (f.q?.trim()) and.push(await itemSearchWhere(f.q, db));
  if (f.groupId) and.push({ groupId: { in: await groupWithChildren(db, f.groupId) } });
  if (f.supplierId) and.push({ supplierId: f.supplierId });
  if (f.valueId) and.push({ attrs: { some: { valueId: f.valueId } } });
  return and.length ? { AND: and } : {};
}

// ── تغییر گروهی ───────────────────────────────────────────────────────

export type BulkOp =
  | { kind: "PERCENT"; pctBp: number }
  | { kind: "AMOUNT"; amount: bigint }
  | { kind: "SET"; price: bigint };

export interface Rounding {
  roundTo: number;
  mode: RoundMode;
}

export function checkOp(op: BulkOp, r: Rounding) {
  if (op.kind === "PERCENT" && (!Number.isInteger(op.pctBp) || op.pctBp === 0 || op.pctBp < -9000 || op.pctBp > 30000))
    throw new AccError("درصد باید بین −۹۰ و +۳۰۰ و غیر صفر باشد");
  if (op.kind === "AMOUNT" && op.amount === 0n) throw new AccError("مبلغ افزایش یا کاهش را بنویسید");
  if (op.kind === "SET" && op.price <= 0n) throw new AccError("قیمت تازه را بنویسید");
  if (!Number.isInteger(r.roundTo) || r.roundTo < 0 || r.roundTo > 1_000_000) throw new AccError("گرد کردن نامعتبر است");
}

/** قیمت تازه‌ی یک کالا (۰ یا منفی ← null یعنی ردیف رد می‌شود) */
export function nextPrice(from: bigint, op: BulkOp, r: Rounding): bigint | null {
  if (op.kind === "SET") return op.price;
  if (from <= 0n) return null;
  const raw = op.kind === "PERCENT" ? applyRule(from, op.pctBp, r.roundTo, r.mode) : applyRule(from + op.amount, 0, r.roundTo, r.mode);
  return raw > 0n ? raw : null;
}

export interface PlanRow {
  itemId: string;
  code: string;
  title: string;
  from: bigint;
  prevRaw: bigint | null;
  to: bigint;
}

export interface Plan {
  rows: PlanRow[];
  /** بی‌قیمت (درصد/مبلغ روی صفر معنا ندارد)، بی‌تغییر، منفی‌شده */
  noPrice: number;
  same: number;
  invalid: number;
  /** کالاهای فیلتر بیش از سقف بود */
  capped: boolean;
}

export async function planBulk(db: Db, filter: PriceFilter, op: BulkOp, r: Rounding, exclude: string[] = []): Promise<Plan> {
  checkOp(op, r);
  const where = await filterWhere(db, filter);
  const items = await db.accItem.findMany({ where, select: { id: true, code: true, title: true }, orderBy: { code: "asc" }, take: MAX_ITEMS + 1 });
  const capped = items.length > MAX_ITEMS;
  const skip = new Set(exclude);
  const picked = items.slice(0, MAX_ITEMS).filter((i) => !skip.has(i.id));
  const prices = await storePrices(db, picked.map((i) => i.id));
  const plan: Plan = { rows: [], noPrice: 0, same: 0, invalid: 0, capped };
  for (const i of picked) {
    const cur = prices.get(i.id) ?? { raw: null, price: 0n };
    if (op.kind !== "SET" && cur.price <= 0n) {
      plan.noPrice++;
      continue;
    }
    const to = nextPrice(cur.price, op, r);
    if (to === null) plan.invalid++;
    else if (to === cur.price && cur.raw !== null) plan.same++;
    else plan.rows.push({ itemId: i.id, code: i.code, title: i.title, from: cur.price, prevRaw: cur.raw, to });
  }
  return plan;
}

const ROUND_TEXT: Record<RoundMode, string> = { down: "رو به پایین", nearest: "نزدیک‌ترین", up: "رو به بالا" };

export function opSummary(op: BulkOp, r: Rounding, scope: string): string {
  const what =
    op.kind === "PERCENT"
      ? `${op.pctBp > 0 ? "+" : "−"}${faNum(Math.abs(op.pctBp) / 100)}٪`
      : op.kind === "AMOUNT"
        ? `${op.amount > 0n ? "+" : "−"}${formatAmount(op.amount < 0n ? -op.amount : op.amount)} تومان`
        : `قیمت ${formatAmount(op.price)} تومان`;
  const round = op.kind !== "SET" && r.roundTo ? ` · گرد به ${formatAmount(r.roundTo)} ${ROUND_TEXT[r.mode]}` : "";
  return `${what} · ${scope}${round}`;
}

/** نوشتن قیمت‌های تازه + دسته + تاریخچه + قیمت سایت */
export async function applyPriceRows(
  tx: Tx,
  rows: { itemId: string; from: bigint; prevRaw: bigint | null; to: bigint | null }[],
  meta: { kind: BatchKind; summary: string; source: PriceSource; actor: Actor; undoOfId?: string },
) {
  if (!rows.length) throw new AccError("قیمتی برای تغییر نیست");
  const batch = await tx.accPriceBatch.create({
    data: { kind: meta.kind, summary: meta.summary, count: rows.length, createdByName: meta.actor.name, undoOfId: meta.undoOfId ?? null },
  });
  // هم‌قیمت‌ها با یک updateMany
  const byPrice = new Map<string, string[]>();
  for (const r of rows) {
    const k = r.to === null ? "null" : String(r.to);
    byPrice.set(k, [...(byPrice.get(k) ?? []), r.itemId]);
  }
  for (const [k, ids] of byPrice)
    for (let j = 0; j < ids.length; j += 5000)
      await tx.accItem.updateMany({ where: { id: { in: ids.slice(j, j + 5000) } }, data: { salePrice: k === "null" ? null : BigInt(k) } });
  await recordPriceChanges(
    tx,
    rows.map((r) => ({ itemId: r.itemId, fromPrice: r.from, prevRaw: r.prevRaw, toPrice: r.to })),
    { source: meta.source, batchId: batch.id, actor: meta.actor },
  );
  const online = await applyOnlinePrices(tx, rows.map((r) => r.itemId));
  return { batchId: batch.id, count: rows.length, online };
}

// ── اکسل ──────────────────────────────────────────────────────────────

export interface SheetPlan {
  rows: (PlanRow & { line: number })[];
  unknown: string[];
  invalid: string[];
  same: number;
  /** کد قبلی/کد مدل که به چند تنوع رسید: «کد ← n کالا» */
  expanded: { code: string; items: number }[];
}

/** «۱۲۳٬۰۰۰»، «123,000 تومان» ← عدد؛ نامعتبر ← null */
export function parsePriceCell(v: string): bigint | null {
  const t = v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬،\s]|تومان|ریال/g, "");
  if (!/^\d+(\.0+)?$/.test(t)) return null;
  const n = BigInt(t.split(".")[0]);
  return n > 0n ? n : null;
}

/**
 * ردیف‌های (کد، قیمت) ← کالا. کد کالا، بارکد یا کد قبلی؛ کد قبلی چندتنوعی و کد مدل همه‌ی
 * تنوع‌های همان مدل را می‌گیرند (قیمت در نرم‌افزار قبلی برای مدل بود). ردیف تکراری: آخری.
 */
export async function planSheet(db: Db, input: { code: string; price: string; line: number }[]): Promise<SheetPlan> {
  const out: SheetPlan = { rows: [], unknown: [], invalid: [], same: 0, expanded: [] };
  const want = new Map<string, { to: bigint; line: number }>();
  const cache = new Map<string, string[]>();
  for (const r of input.slice(0, MAX_ITEMS)) {
    const code = normalizeItemCode(r.code);
    // قیمت خالی = این ردیف بی‌تغییر (خروجی CSV ستون «قیمت تازه» را خالی می‌دهد)
    if (!code || !r.price.trim()) continue;
    const to = parsePriceCell(r.price);
    if (to === null) {
      out.invalid.push(r.code);
      continue;
    }
    if (!cache.has(code)) {
      let ids: string[] = [];
      const one = await exactItem(code, db);
      if (one) ids = [one];
      else {
        const legacy = await db.accLegacyItem.findUnique({ where: { code }, select: { itemId: true, modelId: true } });
        const modelId = legacy ? (legacy.itemId ? null : legacy.modelId) : (await db.accItemModel.findUnique({ where: { code }, select: { id: true } }))?.id;
        if (legacy?.itemId) ids = [legacy.itemId];
        else if (modelId) {
          ids = (await db.accItem.findMany({ where: { modelId, isActive: true }, select: { id: true } })).map((i) => i.id);
          if (ids.length) out.expanded.push({ code: r.code, items: ids.length });
        }
      }
      cache.set(code, ids);
    }
    const ids = cache.get(code)!;
    if (!ids.length) out.unknown.push(r.code);
    for (const id of ids) want.set(id, { to, line: r.line });
  }
  const ids = [...want.keys()];
  const [items, prices] = await Promise.all([
    db.accItem.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, title: true } }),
    storePrices(db, ids),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const [id, w] of want) {
    const i = byId.get(id);
    if (!i) continue;
    const cur = prices.get(id) ?? { raw: null, price: 0n };
    if (cur.raw === w.to) out.same++;
    else out.rows.push({ itemId: id, code: i.code, title: i.title, from: cur.price, prevRaw: cur.raw, to: w.to, line: w.line });
  }
  out.rows.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
  out.unknown = [...new Set(out.unknown)];
  out.invalid = [...new Set(out.invalid)];
  return out;
}

// ── برگرداندن ─────────────────────────────────────────────────────────

/**
 * قیمت پیشین کالاهای یک دسته برمی‌گردد — فقط کالایی که از آن موقع دست نخورده
 * (قیمت فعلی همان قیمت دسته است). بقیه رد و شمرده می‌شوند.
 */
export async function undoBatch(tx: Tx, batchId: string, actor: Actor) {
  const b = await tx.accPriceBatch.findUnique({ where: { id: batchId }, include: { changes: true } });
  if (!b) throw new AccError("این تغییر پیدا نشد", 404);
  if (b.undoneAt) throw new AccError("این تغییر قبلاً برگردانده شده", 409);
  if (b.kind === "UNDO") throw new AccError("برگرداندن را نمی‌شود دوباره برگرداند؛ تغییر تازه بدهید", 409);
  const cur = await storePrices(tx, b.changes.map((c) => c.itemId));
  const rows: { itemId: string; from: bigint; prevRaw: bigint | null; to: bigint | null }[] = [];
  let moved = 0;
  for (const c of b.changes) {
    const now = cur.get(c.itemId);
    if (!now) continue;
    if (now.raw !== c.toPrice) moved++;
    else rows.push({ itemId: c.itemId, from: now.price, prevRaw: now.raw, to: c.prevRaw });
  }
  if (!rows.length) throw new AccError("قیمت همه‌ی کالاهای این تغییر بعداً دوباره عوض شده؛ چیزی برای برگرداندن نماند", 409);
  const res = await applyPriceRows(tx, rows, { kind: "UNDO", summary: `برگرداندن: ${b.summary}`, source: "UNDO", actor, undoOfId: b.id });
  await tx.accPriceBatch.update({ where: { id: b.id }, data: { undoneAt: new Date() } });
  return { ...res, moved };
}

// ── تاریخچه ───────────────────────────────────────────────────────────

export interface HistoryFilter {
  since?: Date | null;
  until?: Date | null;
  itemId?: string | null;
  batchId?: string | null;
  source?: PriceSource | null;
}

/**
 * «کالاهای با تغییر قیمت»: هر کالا یک ردیف — قیمت پیش از اولین تغییرِ بازه و قیمت
 * بعد از آخرینش؛ کالایی که برگشت به همان قیمت `back` دارد (برچسب تازه نمی‌خواهد).
 */
export async function priceHistory(db: Db, f: HistoryFilter, limit = 2000) {
  const where: Prisma.AccPriceChangeWhereInput = {
    ...(f.since || f.until ? { createdAt: { ...(f.since ? { gte: f.since } : {}), ...(f.until ? { lt: f.until } : {}) } } : {}),
    ...(f.itemId ? { itemId: f.itemId } : {}),
    ...(f.batchId ? { batchId: f.batchId } : {}),
    ...(f.source ? { source: f.source } : {}),
  };
  const [total, changes] = await Promise.all([
    db.accPriceChange.count({ where }),
    db.accPriceChange.findMany({ where, orderBy: { createdAt: "asc" }, take: limit * 5, include: { item: { select: { code: true, title: true } } } }),
  ]);
  const byItem = new Map<string, { itemId: string; code: string; title: string; from: bigint; to: bigint | null; times: number; last: Date; by: string; source: string }>();
  for (const c of changes) {
    const cur = byItem.get(c.itemId);
    if (cur) Object.assign(cur, { to: c.toPrice, times: cur.times + 1, last: c.createdAt, by: c.createdByName, source: c.source });
    else byItem.set(c.itemId, { itemId: c.itemId, code: c.item.code, title: c.item.title, from: c.fromPrice, to: c.toPrice, times: 1, last: c.createdAt, by: c.createdByName, source: c.source });
  }
  const now = await storePrices(db, [...byItem.keys()]);
  const items = [...byItem.values()]
    .sort((a, b) => b.last.getTime() - a.last.getTime())
    .slice(0, limit)
    .map((r) => {
      const price = now.get(r.itemId)?.price ?? 0n;
      return { ...r, now: price, back: price === r.from };
    });
  return { total, items, truncated: byItem.size > limit || changes.length >= limit * 5 };
}

/** ردیف‌های تاریخچه‌ی یک کالا (برای صفحه‌ی کالا) */
export async function itemPriceLog(db: Db, itemId: string, take = 50) {
  return db.accPriceChange.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, fromPrice: true, toPrice: true, source: true, createdByName: true, createdAt: true, batch: { select: { id: true, summary: true } } },
  });
}

export async function listBatches(db: Db, take = 30) {
  return db.accPriceBatch.findMany({ orderBy: { createdAt: "desc" }, take });
}
