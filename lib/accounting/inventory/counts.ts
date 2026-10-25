/**
 * انبارگردانی — docs/plans/inventory-items.md بخش ۱۵ (و accounting.md بخش ۸).
 *
 *   پیش‌نویس ← شمارش (اسکن اتمی، چند شمارنده، بخش/قفسه، فایل) ← [شمارش دوم اختلاف‌ها] ← ثبت
 *
 * مبنای اختلاف هر کالا موجودی دفتری **لحظه‌ی اولین شمارش** آن است (`bookSnap`)، تا
 * فروش بعد از شمردن اختلاف نسازد. دامنه‌ی «کل انبار» کالای شمرده‌نشده را صفر می‌کند.
 * ثبت یا کسری/اضافی می‌سازد (سند «کسری و اضافات انبار») یا — فقط سال اول — اختلاف
 * را روی موجودی اول دوره می‌نشاند.
 */

import type { AccStockCount, AccStockCountLine, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { assertPostable, firstYear } from "../ledger/fiscal-year";
import { nextNumber } from "../ledger/sequence";
import { postVoucher, rebuildVoucher, voidVoucher, type Actor, type LineInput } from "../ledger/post";
import { hasCarriedOpening } from "../ledger/closing";
import { scanCode, type ScanResult } from "../pos/scan";
import { applyMoves, qtyAt, registerCostRebuilder, removeMoves } from "./stock";
import { toLatinDigits } from "../money";
import { exactItem, itemTitles, normalizeItemCode } from "./items";
import { OPENING_INV_SOURCE, saveOpeningInventory } from "./opening";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export type CountScope = "PARTIAL" | "FULL";
export type CountApply = "ADJUST" | "OPENING";
export type EntrySource = "scan" | "set" | "import" | "fill";

/** شمارش نهایی یک ردیف */
export const finalQty = (l: Pick<AccStockCountLine, "countedQty" | "recountQty">) => l.recountQty ?? l.countedQty;

const cleanZone = (z: string | null | undefined) => z?.trim().slice(0, 40) || null;

async function lockCount(tx: Tx, countId: string): Promise<AccStockCount> {
  await tx.$queryRaw`SELECT id FROM "AccStockCount" WHERE id = ${countId} FOR UPDATE`;
  const c = await tx.accStockCount.findUnique({ where: { id: countId } });
  if (!c) throw new AccError("انبارگردانی پیدا نشد", 404);
  return c;
}

function assertDraft(c: AccStockCount) {
  if (c.status !== "DRAFT") throw new AccError("انبارگردانی ثبت‌شده عوض نمی‌شود");
}

// ── دامنه ─────────────────────────────────────────────────────────────────

/** شناسه‌ی گروه و همه‌ی زیرگروه‌هایش */
export async function groupTree(db: Db, groupId: string): Promise<Set<string>> {
  const all = await db.accItemGroup.findMany({ select: { id: true, parentId: true } });
  const out = new Set([groupId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const g of all) {
      if (g.parentId && out.has(g.parentId) && !out.has(g.id)) {
        out.add(g.id);
        grew = true;
      }
    }
  }
  return out;
}

/** کالاهای دامنه از میان این شناسه‌ها؛ بی فیلتر گروه همه */
async function inScope(db: Db, c: Pick<AccStockCount, "groupId">, productIds: string[]): Promise<Set<string>> {
  if (!c.groupId) return new Set(productIds);
  const groups = await groupTree(db, c.groupId);
  const rows = await db.accItem.findMany({ where: { id: { in: productIds }, groupId: { in: [...groups] } }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

/** موجودی دفتری تا پایان روز برای چند کالا (یا همه‌ی کالاهای انبار) با یک کوئری */
export async function booksAt(db: Db, warehouseId: string, day: Date, productIds?: string[]): Promise<Map<string, number>> {
  const rows = await db.accStockMove.groupBy({
    by: ["productId"],
    where: { warehouseId, date: { lte: day }, ...(productIds ? { productId: { in: productIds } } : {}) },
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.qty ?? 0]));
}

/** کالاهای دامنه که موجودی دفتری غیرصفر دارند ولی شمرده نشده‌اند */
async function uncountedOf(db: Db, c: AccStockCount, counted: Set<string>): Promise<Map<string, number>> {
  const books = await booksAt(db, c.warehouseId, c.date);
  const ids = [...books].filter(([id, q]) => q !== 0 && !counted.has(id)).map(([id]) => id);
  const scoped = await inScope(db, c, ids);
  return new Map(ids.filter((id) => scoped.has(id)).map((id) => [id, books.get(id)!]));
}

// ── ساخت ──────────────────────────────────────────────────────────────────

export async function createCount(
  tx: Tx,
  input: { date: Date; warehouseId: string; note?: string | null; scope?: CountScope; groupId?: string | null },
  actor: Actor,
) {
  const year = await assertPostable(tx, input.date);
  const wh = await tx.accWarehouse.findUnique({ where: { id: input.warehouseId } });
  if (!wh?.isActive) throw new AccError("انبار پیدا نشد یا غیرفعال است");
  const scope: CountScope = input.scope === "FULL" ? "FULL" : "PARTIAL";
  const groupId = input.groupId || null;
  if (groupId && !(await tx.accItemGroup.findUnique({ where: { id: groupId } }))) throw new AccError("گروه کالا پیدا نشد");
  // دو «کل انبار» باز روی یک انبار، هر کدام کالای دیگری را صفر می‌کند
  if (scope === "FULL") {
    const open = await tx.accStockCount.findFirst({ where: { warehouseId: wh.id, status: "DRAFT", scope: "FULL" } });
    if (open) throw new AccError(`انبارگردانی کامل شماره‌ی ${open.number} روی همین انبار هنوز باز است؛ اول آن را ثبت یا حذف کنید`, 409);
  }
  return tx.accStockCount.create({
    data: {
      yearId: year.id,
      number: await nextNumber(tx, year.id, "count"),
      date: input.date,
      warehouseId: input.warehouseId,
      note: input.note?.trim() || null,
      scope,
      groupId,
      createdByName: actor.name,
    },
  });
}

// ── شمارش ─────────────────────────────────────────────────────────────────

export interface CountedLine {
  productId: string;
  countedQty: number;
  recountQty: number | null;
  final: number;
  zone: string | null;
}

const view = (l: AccStockCountLine): CountedLine => ({ productId: l.productId, countedQty: l.countedQty, recountQty: l.recountQty, final: finalQty(l), zone: l.zone });

/**
 * افزودن ± به شمارش مرحله‌ی جاری — اتمی (قفل روی انبارگردانی)، پس چند گوشی هم‌زمان
 * شمارش هم را پاک نمی‌کنند. اولین شمارش هر کالا موجودی دفتری همان لحظه را نگه می‌دارد.
 */
export async function addCount(
  tx: Tx,
  countId: string,
  input: { productId: string; qty: number; zone?: string | null; source: EntrySource },
  actor: Actor,
): Promise<CountedLine> {
  if (!Number.isInteger(input.qty) || input.qty === 0) throw new AccError("تعداد باید عدد صحیح غیرصفر باشد");
  if (Math.abs(input.qty) > 100_000) throw new AccError("تعداد بیش از حد است");
  const c = await lockCount(tx, countId);
  assertDraft(c);
  return addLocked(tx, c, input, actor);
}

async function addLocked(
  tx: Tx,
  c: AccStockCount,
  input: { productId: string; qty: number; zone?: string | null; source: EntrySource; bookSnap?: number },
  actor: Actor,
): Promise<CountedLine> {
  const zone = cleanZone(input.zone);
  const cur = await tx.accStockCountLine.findUnique({ where: { countId_productId: { countId: c.id, productId: input.productId } } });
  let line: AccStockCountLine;
  if (!cur) {
    if (!(await tx.accItem.findUnique({ where: { id: input.productId }, select: { id: true } }))) throw new AccError("کالا پیدا نشد", 404);
    if (input.qty < 0) throw new AccError("شمارش منفی نمی‌شود");
    const bookSnap = input.bookSnap ?? (await qtyAt(tx, input.productId, c.warehouseId, c.date));
    line = await tx.accStockCountLine.create({
      data: {
        countId: c.id,
        productId: input.productId,
        bookSnap,
        countedQty: c.round === 2 ? 0 : input.qty,
        recountQty: c.round === 2 ? input.qty : null,
        zone,
      },
    });
  } else {
    const next = (c.round === 2 ? (cur.recountQty ?? 0) : cur.countedQty) + input.qty;
    if (next < 0) throw new AccError("شمارش منفی نمی‌شود");
    line = await tx.accStockCountLine.update({
      where: { id: cur.id },
      data: { ...(c.round === 2 ? { recountQty: next } : { countedQty: next }), ...(zone ? { zone } : {}) },
    });
  }
  await tx.accStockCountEntry.create({
    data: { countId: c.id, productId: input.productId, round: c.round, qty: input.qty, zone, byName: actor.name, source: input.source },
  });
  return view(line);
}

/**
 * عدد مطلق شمارش مرحله‌ی جاری. `null`: در مرحله‌ی ۱ کالا از برگه حذف می‌شود؛ در
 * مرحله‌ی ۲ فقط شمارش دوم پاک می‌شود.
 */
export async function setCounted(tx: Tx, countId: string, productId: string, qty: number | null, actor: Actor, zone?: string | null): Promise<CountedLine | null> {
  const c = await lockCount(tx, countId);
  assertDraft(c);
  const cur = await tx.accStockCountLine.findUnique({ where: { countId_productId: { countId, productId } } });
  if (qty === null) {
    if (!cur) return null;
    if (c.round === 2) {
      await tx.accStockCountEntry.deleteMany({ where: { countId, productId, round: 2 } });
      // ردیفی که فقط در شمارش دوم پیدا شده بود، با پاک شدنش کامل می‌رود
      if (cur.countedQty === 0 && !(await tx.accStockCountEntry.count({ where: { countId, productId } }))) {
        await tx.accStockCountLine.delete({ where: { id: cur.id } });
        return null;
      }
      return view(await tx.accStockCountLine.update({ where: { id: cur.id }, data: { recountQty: null } }));
    }
    await tx.accStockCountEntry.deleteMany({ where: { countId, productId } });
    await tx.accStockCountLine.delete({ where: { id: cur.id } });
    return null;
  }
  if (!Number.isInteger(qty) || qty < 0) throw new AccError("شمارش باید عدد صحیح نامنفی باشد");
  const now = !cur ? null : c.round === 2 ? cur.recountQty : cur.countedQty;
  if (cur && now === qty) return view(cur);
  if (!cur && qty === 0) {
    // «صفر شمردم» هم شمارش است (در «فقط شمرده‌ها» موجودی را صفر می‌کند)
    const bookSnap = await qtyAt(tx, productId, c.warehouseId, c.date);
    const line = await tx.accStockCountLine.create({ data: { countId, productId, bookSnap, countedQty: 0, recountQty: c.round === 2 ? 0 : null, zone: cleanZone(zone) } });
    return view(line);
  }
  if (cur && now === null && qty === 0) return view(await tx.accStockCountLine.update({ where: { id: cur.id }, data: { recountQty: 0 } }));
  return addLocked(tx, c, { productId, qty: qty - (now ?? 0), zone, source: "set" }, actor);
}

/** برگرداندن آخرین اسکن همین شمارنده در مرحله‌ی جاری */
export async function undoLast(tx: Tx, countId: string, actor: Actor): Promise<{ productId: string; qty: number; line: CountedLine | null } | null> {
  const c = await lockCount(tx, countId);
  assertDraft(c);
  const e = await tx.accStockCountEntry.findFirst({ where: { countId, byName: actor.name, round: c.round }, orderBy: { createdAt: "desc" } });
  if (!e) return null;
  await tx.accStockCountEntry.delete({ where: { id: e.id } });
  const cur = await tx.accStockCountLine.findUnique({ where: { countId_productId: { countId, productId: e.productId } } });
  const done = (line: AccStockCountLine | null) => ({ productId: e.productId, qty: e.qty, line: line && view(line) });
  if (!cur) return done(null);

  const field = c.round === 2 ? "recountQty" : "countedQty";
  const next = Math.max(0, (cur[field] ?? 0) - e.qty);
  const leftAll = await tx.accStockCountEntry.count({ where: { countId, productId: e.productId } });
  const leftRound = c.round === 2 ? await tx.accStockCountEntry.count({ where: { countId, productId: e.productId, round: 2 } }) : leftAll;
  if (!leftRound && next === 0) {
    // ردیف فقط از همین اسکن‌ها ساخته شده بود ← کامل برود
    if (!leftAll && (c.round === 1 || cur.countedQty === 0)) {
      await tx.accStockCountLine.delete({ where: { id: cur.id } });
      return done(null);
    }
    if (c.round === 2) return done(await tx.accStockCountLine.update({ where: { id: cur.id }, data: { recountQty: null } }));
  }
  return done(await tx.accStockCountLine.update({ where: { id: cur.id }, data: { [field]: next } }));
}

/** اسکن در برگه: کالا ← افزوده می‌شود؛ کد چندتنوعی/متن ← نتیجه برای انتخاب برمی‌گردد */
export async function scanIntoCount(
  countId: string,
  input: { code: string; qty: number; zone?: string | null },
  actor: Actor,
): Promise<{ kind: "added"; line: CountedLine; title: string; code: string } | Exclude<ScanResult, { kind: "item" }>> {
  const c = await prisma.accStockCount.findUnique({ where: { id: countId } });
  if (!c) throw new AccError("انبارگردانی پیدا نشد", 404);
  assertDraft(c);
  const r = await scanCode(input.code, c.warehouseId);
  if (r.kind === "ticket") throw new AccError("این بارکد رسید صندوق است، نه کالا");
  if (r.kind !== "item") return r;
  const line = await prisma.$transaction((tx) => addCount(tx, countId, { productId: r.item.id, qty: input.qty, zone: input.zone, source: "scan" }, actor));
  return { kind: "added", line, title: r.item.title, code: r.item.code };
}

/** کالاهای دامنه با موجودی دفتری مثبت که شمرده نشده‌اند، با همان عدد — فقط اختلاف‌ها را عوض کنید */
export async function fillWithBook(tx: Tx, countId: string, actor: Actor): Promise<number> {
  const c = await lockCount(tx, countId);
  assertDraft(c);
  if (c.round === 2) throw new AccError("در شمارش دوم پر کردن با عدد دفتری معنا ندارد");
  const have = new Set((await tx.accStockCountLine.findMany({ where: { countId }, select: { productId: true } })).map((l) => l.productId));
  const missing = [...(await uncountedOf(tx, c, have))].filter(([, q]) => q > 0);
  for (const [productId, qty] of missing) await addLocked(tx, c, { productId, qty, source: "fill", bookSnap: qty }, actor);
  return missing.length;
}

// ── ورود از فایل ───────────────────────────────────────────────────────────

export interface ImportRow {
  code: string;
  qty: number | null;
}

/**
 * متن چسبانده از اکسل/CSV: ستون اول کد، ستون دوم تعداد اختیاری (نبود = یک عدد).
 * ردیف سرستون («کد»، «code») و خالی نادیده گرفته می‌شود.
 */
export function parseImportText(text: string): ImportRow[] {
  const rows: ImportRow[] = [];
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    // اکسل با Tab می‌چسباند؛ CSV با «,» یا «;»
    const cells = (raw.includes("\t") ? raw.split("\t") : raw.split(/[,;]/)).map((x) => x.trim().replace(/^"|"$/g, ""));
    const code = cells[0];
    if (!code) continue;
    const cell = cells[1] ? toLatinDigits(cells[1]).replace(/[,٬\s]/g, "") : "";
    const qty = cell === "" ? null : Number(cell);
    if (!rows.length && (qty === null || !Number.isFinite(qty)) && /^(کد|code|بارکد|barcode|شناسه)/i.test(code)) continue;
    rows.push({ code, qty: qty === null || Number.isFinite(qty) ? qty : NaN });
  }
  return rows;
}

export interface ImportResult {
  products: number;
  units: number;
  unknown: string[];
  /** کد قبلی چندرنگ/سایز — باید با اسکن و انتخاب شمرده شود */
  ambiguous: string[];
  invalid: string[];
}

export async function importIntoCount(countId: string, rows: ImportRow[], zone: string | null, actor: Actor): Promise<ImportResult> {
  if (rows.length > 20_000) throw new AccError("بیش از ۲۰ هزار ردیف در یک فایل نمی‌شود؛ فایل را چند تکه کنید");
  const c = await prisma.accStockCount.findUnique({ where: { id: countId } });
  if (!c) throw new AccError("انبارگردانی پیدا نشد", 404);
  assertDraft(c);

  const res: ImportResult = { products: 0, units: 0, unknown: [], ambiguous: [], invalid: [] };
  const sum = new Map<string, number>();
  const resolved = new Map<string, string | "model" | null>();
  for (const r of rows) {
    const qty = r.qty ?? 1;
    if (!Number.isInteger(qty) || qty < 0) {
      res.invalid.push(r.code);
      continue;
    }
    if (qty === 0) continue;
    const code = normalizeItemCode(r.code) ?? "";
    if (!resolved.has(code)) {
      const legacy = await prisma.accLegacyItem.findUnique({ where: { code }, select: { itemId: true } });
      resolved.set(code, legacy ? (legacy.itemId ?? "model") : await exactItem(code));
    }
    const hit = resolved.get(code);
    if (hit === "model") res.ambiguous.push(r.code);
    else if (!hit) res.unknown.push(r.code);
    else sum.set(hit, (sum.get(hit) ?? 0) + qty);
  }
  await prisma.$transaction(
    async (tx) => {
      const locked = await lockCount(tx, countId);
      assertDraft(locked);
      for (const [productId, qty] of sum) await addLocked(tx, locked, { productId, qty, zone, source: "import" }, actor);
    },
    { timeout: 300_000 },
  );
  res.products = sum.size;
  res.units = [...sum.values()].reduce((a, b) => a + b, 0);
  const uniq = (a: string[]) => [...new Set(a)];
  return { ...res, unknown: uniq(res.unknown), ambiguous: uniq(res.ambiguous), invalid: uniq(res.invalid) };
}

// ── شمارش دوم ──────────────────────────────────────────────────────────────

/** مرحله‌ی ۲: فقط کالاهای اختلاف‌دار دوباره شمرده می‌شوند */
export async function startRecount(tx: Tx, countId: string): Promise<number> {
  const c = await lockCount(tx, countId);
  assertDraft(c);
  if (c.round === 2) throw new AccError("شمارش دوم قبلاً شروع شده است");
  const lines = await tx.accStockCountLine.findMany({ where: { countId } });
  const books = await bookOfLines(tx, c, lines);
  const diffs = lines.filter((l) => finalQty(l) !== books.get(l.productId)).length;
  const uncounted = c.scope === "FULL" ? (await uncountedOf(tx, c, new Set(lines.map((l) => l.productId)))).size : 0;
  if (!diffs && !uncounted) throw new AccError("هیچ اختلافی نیست که دوباره شمرده شود");
  await tx.accStockCount.update({ where: { id: countId }, data: { round: 2 } });
  return diffs + uncounted;
}

/** موجودی دفتری مبنای هر ردیف: لحظه‌ی اولین شمارش، وگرنه پایان روز */
async function bookOfLines(db: Db, c: AccStockCount, lines: AccStockCountLine[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const missing = lines.filter((l) => l.bookSnap === null).map((l) => l.productId);
  const end = missing.length ? await booksAt(db, c.warehouseId, c.date, missing) : new Map<string, number>();
  for (const l of lines) out.set(l.productId, l.bookSnap ?? end.get(l.productId) ?? 0);
  return out;
}

// ── بازبینی ────────────────────────────────────────────────────────────────

export interface ReviewRow {
  productId: string;
  title: string;
  code: string;
  counted: number;
  recount: number | null;
  final: number;
  /** null برای شمارنده‌ی کور */
  book: number | null;
  diff: number | null;
  zone: string | null;
  /** شمرده‌نشده‌ی دامنه (فقط در «کل انبار» در ثبت صفر می‌شود) */
  uncounted: boolean;
  /** برآورد ارزش اختلاف (میانگین × اختلاف) — فقط با دیدن بها */
  value: string | null;
  updatedAt: Date | null;
}

export interface CountReview {
  rows: ReviewRow[];
  summary: {
    lines: number;
    units: number;
    diffLines: number;
    shortageUnits: number;
    surplusUnits: number;
    shortageValue: string | null;
    surplusValue: string | null;
    uncounted: number;
    uncountedUnits: number;
    zones: { zone: string; lines: number; units: number }[];
  };
}

export async function reviewCount(db: Db, countId: string, opts: { blind: boolean; costs: boolean }): Promise<CountReview> {
  const c = await db.accStockCount.findUnique({ where: { id: countId }, include: { lines: { orderBy: { updatedAt: "desc" } } } });
  if (!c) throw new AccError("انبارگردانی پیدا نشد", 404);
  const draft = c.status === "DRAFT";
  const books = draft ? await bookOfLines(db, c, c.lines) : new Map(c.lines.map((l) => [l.productId, l.systemQty ?? 0]));
  const uncounted = draft && !opts.blind ? await uncountedOf(db, c, new Set(c.lines.map((l) => l.productId))) : new Map<string, number>();
  const ids = [...c.lines.map((l) => l.productId), ...uncounted.keys()];
  const [items, costs] = await Promise.all([
    db.accItem.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, code: true } }),
    opts.costs ? db.accProductCost.findMany({ where: { productId: { in: ids } }, select: { productId: true, avgCost: true, lastCost: true } }) : [],
  ]);
  const im = new Map(items.map((i) => [i.id, i]));
  const unit = new Map(costs.map((x) => [x.productId, x.avgCost > 0n ? x.avgCost : x.lastCost]));
  const valueOf = (id: string, diff: number | null) => (opts.costs && diff ? (unit.get(id) ?? 0n) * BigInt(diff) : null);

  const rows: ReviewRow[] = c.lines.map((l) => {
    const final = finalQty(l);
    const book = books.get(l.productId) ?? 0;
    const diff = draft ? final - book : (l.diff ?? 0);
    const v = valueOf(l.productId, diff);
    return {
      productId: l.productId,
      title: im.get(l.productId)?.title ?? "کالای حذف‌شده",
      code: im.get(l.productId)?.code ?? "",
      counted: l.countedQty,
      recount: l.recountQty,
      final,
      book: opts.blind ? null : book,
      diff: opts.blind ? null : diff,
      zone: l.zone,
      uncounted: false,
      value: opts.blind || v === null ? null : v.toString(),
      updatedAt: l.updatedAt,
    };
  });
  for (const [id, book] of uncounted) {
    const diff = c.scope === "FULL" ? -book : 0;
    const v = valueOf(id, diff);
    rows.push({
      productId: id,
      title: im.get(id)?.title ?? "—",
      code: im.get(id)?.code ?? "",
      counted: 0,
      recount: null,
      final: 0,
      book,
      diff,
      zone: null,
      uncounted: true,
      value: v === null ? null : v.toString(),
      updatedAt: null,
    });
  }

  const zones = new Map<string, { lines: number; units: number }>();
  for (const r of rows) {
    if (r.uncounted) continue;
    const z = zones.get(r.zone ?? "") ?? { lines: 0, units: 0 };
    z.lines++;
    z.units += r.final;
    zones.set(r.zone ?? "", z);
  }
  const counted = rows.filter((r) => !r.uncounted);
  const sumBy = (pred: (r: ReviewRow) => boolean, f: (r: ReviewRow) => number) => rows.filter(pred).reduce((s, r) => s + f(r), 0);
  const sumValue = (sign: 1 | -1) =>
    opts.costs && !opts.blind ? rows.filter((r) => (r.diff ?? 0) * sign > 0).reduce((s, r) => s + BigInt(r.value ?? "0"), 0n) * BigInt(sign) : null;
  const sv = sumValue(-1);
  const pv = sumValue(1);
  return {
    rows,
    summary: {
      lines: counted.length,
      units: counted.reduce((s, r) => s + r.final, 0),
      diffLines: opts.blind ? 0 : rows.filter((r) => (r.diff ?? 0) !== 0).length,
      shortageUnits: opts.blind ? 0 : sumBy((r) => (r.diff ?? 0) < 0, (r) => -(r.diff ?? 0)),
      surplusUnits: opts.blind ? 0 : sumBy((r) => (r.diff ?? 0) > 0, (r) => r.diff ?? 0),
      shortageValue: sv === null ? null : sv.toString(),
      surplusValue: pv === null ? null : pv.toString(),
      uncounted: uncounted.size,
      uncountedUnits: [...uncounted.values()].reduce((s, q) => s + q, 0),
      zones: [...zones].map(([zone, z]) => ({ zone, ...z })).sort((a, b) => b.units - a.units),
    },
  };
}

// ── ثبت و ابطال ────────────────────────────────────────────────────────────

/** آیا اختلاف این انبارگردانی را می‌شود روی موجودی اول دوره نشاند؟ دلیل نشدن یا null */
export async function openingBlocker(db: Db, c: Pick<AccStockCount, "yearId">): Promise<string | null> {
  const first = await firstYear(db);
  if (!first || first.id !== c.yearId) return "فقط در سال مالی اول — بعد از آن موجودی از سال قبل می‌آید";
  if (await hasCarriedOpening(db, c.yearId)) return "موجودی این سال از سال قبل ادامه دارد";
  return null;
}

export async function postCount(tx: Tx, countId: string, actor: Actor, opts: { applyTo?: CountApply } = {}) {
  const c = await lockCount(tx, countId);
  if (c.status !== "DRAFT") throw new AccError("این انبارگردانی قبلاً ثبت شده است");
  await assertPostable(tx, c.date);
  const applyTo: CountApply = opts.applyTo === "OPENING" ? "OPENING" : "ADJUST";
  if (applyTo === "OPENING") {
    const why = await openingBlocker(tx, c);
    if (why) throw new AccError(`اعمال روی اول دوره نمی‌شود: ${why}`, 409);
  }

  let lines = await tx.accStockCountLine.findMany({ where: { countId } });
  const books = await bookOfLines(tx, c, lines);
  // «کل انبار»: کالای شمرده‌نشده‌ی دامنه یعنی صفر — ردیفش ثبت می‌شود تا سابقه کامل بماند
  if (c.scope === "FULL") {
    const zeros = await uncountedOf(tx, c, new Set(lines.map((l) => l.productId)));
    if (zeros.size) {
      await tx.accStockCountLine.createMany({ data: [...zeros].map(([productId, book]) => ({ countId, productId, countedQty: 0, bookSnap: book })) });
      for (const [id, book] of zeros) books.set(id, book);
      lines = await tx.accStockCountLine.findMany({ where: { countId } });
    }
  }
  if (!lines.length) throw new AccError("هیچ کالایی شمرده نشده است");

  const diffs = new Map<string, number>();
  for (const l of lines) {
    const systemQty = books.get(l.productId) ?? 0;
    const diff = finalQty(l) - systemQty;
    diffs.set(l.id, diff);
    await tx.accStockCountLine.update({ where: { id: l.id }, data: { systemQty, diff } });
  }

  // سهم اول دوره: اضافی همه‌اش؛ کسری تا جایی که اول دوره دارد. باقی کسری/اضافی عادی است
  const adjust = new Map(diffs);
  if (applyTo === "OPENING") {
    const opening = await tx.accStockMove.findMany({ where: { sourceType: OPENING_INV_SOURCE, sourceId: c.yearId } });
    const byKey = new Map(opening.map((m) => [`${m.productId}|${m.warehouseId}`, { productId: m.productId, warehouseId: m.warehouseId, qty: m.qty, unitCost: m.unitCost }]));
    const costs = new Map(
      (await tx.accProductCost.findMany({ where: { productId: { in: lines.map((l) => l.productId) } } })).map((x) => [x.productId, x.avgCost > 0n ? x.avgCost : x.lastCost]),
    );
    for (const l of lines) {
      const diff = diffs.get(l.id)!;
      if (!diff) continue;
      const key = `${l.productId}|${c.warehouseId}`;
      const cur = byKey.get(key);
      const openingDelta = diff > 0 ? diff : -Math.min(cur?.qty ?? 0, -diff);
      if (!openingDelta) continue;
      const unitCost = cur?.unitCost ?? costs.get(l.productId) ?? 0n;
      byKey.set(key, { productId: l.productId, warehouseId: c.warehouseId, qty: (cur?.qty ?? 0) + openingDelta, unitCost });
      adjust.set(l.id, diff - openingDelta);
      await tx.accStockCountLine.update({ where: { id: l.id }, data: { openingDelta, openingCost: unitCost } });
    }
    await saveOpeningInventory(tx, c.yearId, [...byKey.values()], actor);
  }

  const moves = lines
    .filter((l) => adjust.get(l.id))
    .map((l) => {
      const d = adjust.get(l.id)!;
      return {
        productId: l.productId,
        warehouseId: c.warehouseId,
        date: c.date,
        type: d > 0 ? ("ADJUST_IN" as const) : ("ADJUST_OUT" as const),
        qty: Math.abs(d),
        sourceType: "AccStockCount",
        sourceId: c.id,
        sourceLineId: l.id,
      };
    });
  await applyMoves(tx, moves, actor);
  await tx.accStockCount.update({ where: { id: c.id }, data: { status: "POSTED", applyTo, postedAt: new Date(), postedByName: actor.name } });
  await buildCountVoucher(tx, c.id, actor);
}

export async function voidCount(tx: Tx, countId: string, reason: string, actor: Actor) {
  const c = await lockCount(tx, countId);
  if (c.status === "VOID") return;
  if (c.status === "DRAFT") {
    await tx.accStockCount.delete({ where: { id: countId } });
    return;
  }
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  if (c.applyTo === "OPENING") {
    const shares = await tx.accStockCountLine.findMany({ where: { countId, openingDelta: { not: null } } });
    if (shares.length) {
      const opening = await tx.accStockMove.findMany({ where: { sourceType: OPENING_INV_SOURCE, sourceId: c.yearId } });
      const byKey = new Map(opening.map((m) => [`${m.productId}|${m.warehouseId}`, { productId: m.productId, warehouseId: m.warehouseId, qty: m.qty, unitCost: m.unitCost }]));
      const titles = await itemTitles(shares.map((s) => s.productId), tx);
      for (const s of shares) {
        const key = `${s.productId}|${c.warehouseId}`;
        const cur = byKey.get(key);
        // اول دوره‌ای که به صفر رسیده بود از فهرست افتاده — با بهای نگه‌داشته برمی‌گردد
        const qty = (cur?.qty ?? 0) - s.openingDelta!;
        if (qty < 0) throw new AccError(`موجودی اول دوره‌ی «${titles.get(s.productId) ?? "یک کالا"}» بعد از این انبارگردانی دستی عوض شده؛ اول آن را در صفحه‌ی اول دوره درست کنید`, 409);
        byKey.set(key, { productId: s.productId, warehouseId: c.warehouseId, qty, unitCost: cur?.unitCost ?? s.openingCost ?? 0n });
      }
      await saveOpeningInventory(tx, c.yearId, [...byKey.values()], actor);
    }
  }
  await removeMoves(tx, "AccStockCount", c.id, actor);
  if (c.voucherId) await voidVoucher(tx, c.voucherId, `ابطال انبارگردانی: ${reason.trim()}`, actor, { fromSource: true });
  await tx.accStockCount.update({ where: { id: countId }, data: { status: "VOID", voucherId: null, voidReason: `${reason.trim()} — ${actor.name}` } });
}

/** سند انبارگردانی از روی بهای محاسبه‌شده‌ی حرکت‌ها — کسری و اضافی جدا */
async function buildCountVoucher(tx: Tx, countId: string, actor: Actor) {
  const c = await tx.accStockCount.findUnique({ where: { id: countId } });
  if (!c || c.status !== "POSTED") return;
  const moves = await tx.accStockMove.findMany({ where: { sourceType: "AccStockCount", sourceId: countId } });
  const shortage = moves.filter((m) => m.type === "ADJUST_OUT").reduce((s, m) => s + m.totalCost, 0n);
  const surplus = moves.filter((m) => m.type === "ADJUST_IN").reduce((s, m) => s + m.totalCost, 0n);

  const lines: LineInput[] = [];
  if (shortage > 0n) {
    lines.push({ accountKey: "INVENTORY_ADJUSTMENT", debit: shortage, description: "کسری انبار" });
    lines.push({ accountKey: "INVENTORY", credit: shortage, description: "کسری انبار" });
  }
  if (surplus > 0n) {
    lines.push({ accountKey: "INVENTORY", debit: surplus, description: "اضافی انبار" });
    lines.push({ accountKey: "INVENTORY_ADJUSTMENT", credit: surplus, description: "اضافی انبار" });
  }
  const input = { date: c.date, description: `انبارگردانی شماره‌ی ${c.number}`, lines, actor };

  if (!lines.length) {
    if (c.voucherId) {
      await voidVoucher(tx, c.voucherId, "اختلاف ارزشی نماند", actor, { fromSource: true });
      await tx.accStockCount.update({ where: { id: countId }, data: { voucherId: null } });
    }
    return;
  }
  if (c.voucherId) {
    const v = await rebuildVoucher(tx, c.voucherId, input);
    if (v.id !== c.voucherId) await tx.accStockCount.update({ where: { id: countId }, data: { voucherId: v.id } });
  } else {
    const v = await postVoucher(tx, { ...input, source: "INVENTORY", sourceId: countId });
    await tx.accStockCount.update({ where: { id: countId }, data: { voucherId: v.id } });
  }
}

registerCostRebuilder("AccStockCount", (tx, id, actor) => buildCountVoucher(tx, id, actor));
