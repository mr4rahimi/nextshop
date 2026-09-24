/**
 * موتور کاردکس و بهای تمام‌شده — docs/plans/accounting.md بخش ۸.
 *
 * روش: میانگین موزون متحرک **سراسری** برای هر کالا (تصمیم ۷)؛ ارزش کل
 * (`balanceValue`) منبع است و خروج به نسبت از آن کم می‌شود — میانگینِ گرد‌شده
 * منبع نیست، پس خطای گرد کردن انباشته نمی‌شود.
 *
 * قواعد هر نوع حرکت:
 *   OPENING, PURCHASE, SALE_RETURN  ← ورود با بهای داده‌شده
 *   ADJUST_IN                       ← ورود با میانگین لحظه (اضافی انبار)
 *   SALE, PURCHASE_RETURN, ADJUST_OUT ← خروج با میانگین لحظه (محاسبه)
 *   TRANSFER_IN / TRANSFER_OUT      ← فقط انبار عوض می‌شود؛ موجودی و ارزش سراسری ثابت
 *
 * ⚠️ هر تغییر کاردکس از `applyMoves` / `removeMoves` می‌گذرد: قفل کالا،
 *    بازسازی از تاریخ تغییر به بعد، به‌روزرسانی `AccStock`، `AccProductCost` و
 *    `Product.stock`، و بازسازی سند منابعی که بهای خروجشان عوض شد (تله‌ی ۲).
 */

import type { AccMoveType, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { assertPostable } from "../ledger/fiscal-year";
import type { Actor } from "../ledger/post";
import { faNum } from "../money";

type Tx = Prisma.TransactionClient;

const INBOUND_GIVEN: AccMoveType[] = ["OPENING", "PURCHASE", "SALE_RETURN"];
const INBOUND_AVG: AccMoveType[] = ["ADJUST_IN"];
const OUTBOUND: AccMoveType[] = ["SALE", "PURCHASE_RETURN", "ADJUST_OUT"];
const TRANSFER: AccMoveType[] = ["TRANSFER_IN", "TRANSFER_OUT"];

export const MOVE_LABELS: Record<AccMoveType, string> = {
  OPENING: "موجودی اول دوره",
  PURCHASE: "خرید",
  PURCHASE_RETURN: "برگشت از خرید",
  SALE: "فروش",
  SALE_RETURN: "برگشت از فروش",
  TRANSFER_IN: "حواله — ورود",
  TRANSFER_OUT: "حواله — خروج",
  ADJUST_IN: "انبارگردانی — اضافی",
  ADJUST_OUT: "انبارگردانی — کسری",
};

export interface MoveInput {
  productId: string;
  warehouseId: string;
  date: Date;
  type: AccMoveType;
  /** همیشه مثبت؛ علامت از نوع حرکت می‌آید */
  qty: number;
  /** فقط برای ورود با بهای داده‌شده */
  unitCost?: bigint;
  sourceType: string;
  sourceId: string;
  sourceLineId?: string | null;
  note?: string | null;
}

/** منبعی که بهای خروجش با بازسازی عوض شد و سندش باید دوباره ساخته شود */
export interface AffectedSource {
  sourceType: string;
  sourceId: string;
}

type Rebuilder = (tx: Tx, sourceId: string, actor: Actor) => Promise<void>;
const REBUILDERS = new Map<string, Rebuilder>();

/** هر نوع منبعی که از کاردکس سند می‌سازد، بازساز سندش را اینجا ثبت می‌کند */
export function registerCostRebuilder(sourceType: string, fn: Rebuilder) {
  REBUILDERS.set(sourceType, fn);
}

function signedQty(type: AccMoveType, qty: number): number {
  if (!Number.isInteger(qty) || qty <= 0) throw new AccError("تعداد باید عدد صحیح مثبت باشد");
  return OUTBOUND.includes(type) || type === "TRANSFER_OUT" ? -qty : qty;
}

/** قفل تراکنشی روی کالا — دو ثبت هم‌زمان یک کاردکس را درهم نمی‌کنند. به ترتیب قفل می‌شود تا بن‌بست نشود. */
async function lockProducts(tx: Tx, productIds: string[]) {
  for (const id of [...new Set(productIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"accstock:" + id}))`;
  }
}

/**
 * بازسازی کاردکس یک کالا از `fromDate` به بعد. برمی‌گرداند منابعی که بهای
 * خروجشان عوض شد.
 *
 * **کسری و جبرانش:** خروجی که از موجودی بیشتر است، بخشِ بی‌پشتوانه‌اش را با
 * آخرین بها «برآورد» می‌کند و در صف کسری می‌گذارد. اولین ورود بعدی (خرید،
 * برگشت از فروش) آن واحدها را با بهای واقعی خودش **جبران** می‌کند: بهای همان
 * خروج قبلی اصلاح و سندش بازسازی می‌شود. بدون این، کالایی که بعد از فروش
 * خریده می‌شود (سفارشی/دراپ‌شیپ) بهای تمام‌شده‌ی صفر می‌گرفت و ارزشش با
 * موجودی صفر در دفتر می‌ماند.
 */
export async function recalcProduct(tx: Tx, productId: string, fromDate: Date | null): Promise<AffectedSource[]> {
  const prevOf = (d: Date) =>
    tx.accStockMove.findFirst({
      where: { productId, date: { lt: d } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });

  // اگر پیش از شروع موجودی منفی است، کسری‌های باز آنجا هستند — از عقب‌تر
  // شروع می‌شود تا دیده شوند. کسریِ پیش از تاریخ قفل دیگر جبران نمی‌شود.
  let start = fromDate;
  let prev = start ? await prevOf(start) : null;
  if (prev && prev.balanceQty < 0) {
    const lock = (await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { lockDate: true } }))?.lockDate;
    while (prev && prev.balanceQty < 0 && !(lock && prev.date <= lock)) {
      start = prev.date;
      prev = await prevOf(start);
    }
  }

  let qty = 0;
  let value = 0n;
  let lastCost = 0n;
  if (start && prev) {
    qty = prev.balanceQty;
    value = prev.balanceValue;
    const lastIn = await tx.accStockMove.findFirst({
      where: { productId, date: { lt: start }, type: { in: [...INBOUND_GIVEN, ...INBOUND_AVG] }, unitCost: { gt: 0 } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { unitCost: true },
    });
    lastCost = lastIn?.unitCost ?? 0n;
  }

  const moves = await tx.accStockMove.findMany({
    where: { productId, ...(start ? { date: { gte: start } } : {}) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  const rows = moves.map((m) => ({ m, unitCost: m.unitCost, totalCost: m.totalCost, balanceQty: m.balanceQty, balanceValue: m.balanceValue }));
  /** واحدهایی که بی‌موجودی خارج شدند و هنوز جبران نشده‌اند — به ترتیب */
  const deficits: { row: (typeof rows)[number]; units: number; est: bigint }[] = [];

  const settleDeficits = (units: number, unitCost: bigint) => {
    while (units > 0 && deficits.length) {
      const d = deficits[0];
      const k = Math.min(units, d.units);
      const delta = (unitCost - d.est) * BigInt(k);
      d.row.totalCost += delta;
      value -= delta;
      d.units -= k;
      units -= k;
      if (!d.units) deficits.shift();
    }
  };

  for (const r of rows) {
    const m = r.m;
    const avg = qty > 0 ? value / BigInt(qty) : lastCost;

    if (INBOUND_GIVEN.includes(m.type)) {
      settleDeficits(m.qty, m.unitCost);
      r.totalCost = m.unitCost * BigInt(m.qty);
      qty += m.qty;
      value += r.totalCost;
      if (m.unitCost > 0n) lastCost = m.unitCost;
    } else if (INBOUND_AVG.includes(m.type)) {
      r.unitCost = avg;
      r.totalCost = avg * BigInt(m.qty);
      settleDeficits(m.qty, avg);
      qty += m.qty;
      value += r.totalCost;
    } else if (OUTBOUND.includes(m.type)) {
      const out = -m.qty;
      // بخش پوشش‌داده به نسبت از ارزش کل؛ باقی با آخرین بها (موجودی منفی — هشدار، نه منع)
      const covered = Math.max(0, Math.min(out, qty));
      const short = out - covered;
      const coveredCost = covered === 0 ? 0n : covered === qty ? value : (value * BigInt(covered) + BigInt(qty) / 2n) / BigInt(qty);
      r.totalCost = coveredCost + lastCost * BigInt(short);
      if (short > 0) deficits.push({ row: r, units: short, est: lastCost });
      qty -= out;
      value -= r.totalCost;
    } else if (TRANSFER.includes(m.type)) {
      r.unitCost = avg;
      r.totalCost = avg * BigInt(Math.abs(m.qty));
    }
    r.balanceQty = qty;
    r.balanceValue = value;
  }

  const affected = new Map<string, AffectedSource>();
  for (const r of rows) {
    const m = r.m;
    if (OUTBOUND.includes(m.type)) r.unitCost = m.qty ? r.totalCost / BigInt(-m.qty) : 0n;
    if (r.unitCost === m.unitCost && r.totalCost === m.totalCost && r.balanceQty === m.balanceQty && r.balanceValue === m.balanceValue) continue;
    if (OUTBOUND.includes(m.type) && r.totalCost !== m.totalCost) {
      affected.set(`${m.sourceType}|${m.sourceId}`, { sourceType: m.sourceType, sourceId: m.sourceId });
    }
    await tx.accStockMove.update({
      where: { id: m.id },
      data: { unitCost: r.unitCost, totalCost: r.totalCost, balanceQty: r.balanceQty, balanceValue: r.balanceValue },
    });
  }

  await tx.accProductCost.upsert({
    where: { productId },
    update: { qtyOnHand: qty, totalValue: value, avgCost: qty > 0 ? value / BigInt(qty) : lastCost, lastCost },
    create: { productId, qtyOnHand: qty, totalValue: value, avgCost: qty > 0 ? value / BigInt(qty) : lastCost, lastCost },
  });
  return [...affected.values()];
}

/** `AccStock` هر انبار = جمع حرکت‌های همان انبار */
async function syncStockRows(tx: Tx, productId: string) {
  const sums = await tx.accStockMove.groupBy({ by: ["warehouseId"], where: { productId }, _sum: { qty: true } });
  const seen = new Set<string>();
  for (const s of sums) {
    seen.add(s.warehouseId);
    await tx.accStock.upsert({
      where: { productId_warehouseId: { productId, warehouseId: s.warehouseId } },
      update: { qty: s._sum.qty ?? 0 },
      create: { productId, warehouseId: s.warehouseId, qty: s._sum.qty ?? 0 },
    });
  }
  await tx.accStock.deleteMany({ where: { productId, warehouseId: { notIn: [...seen] } } });
}

/**
 * `Product.stock` در حالت داخلی.
 *
 * ⚠️ **تفاضلی**، نه مطلق (تله‌ی ۳ و ۱۵): فروش سایت خودش مستقیم از
 *    `Product.stock` کم می‌کند و فاکتورش با `shopStock: false` می‌آید. نوشتن
 *    مطلق جمع کاردکس، کسرهای بیرون از کاردکس را پاک می‌کرد. استثنا: موجودی اول دوره که `absolute` می‌فرستد.
 */
async function syncShopStock(tx: Tx, deltas: Map<string, number>, absolute: Set<string>) {
  const mode = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } });
  if (mode?.mode !== "INTERNAL") return;
  const sellable = new Set((await tx.accWarehouse.findMany({ where: { sellable: true }, select: { id: true } })).map((w) => w.id));

  for (const productId of absolute) {
    const rows = await tx.accStock.findMany({ where: { productId } });
    const total = rows.filter((r) => sellable.has(r.warehouseId)).reduce((s, r) => s + r.qty, 0);
    await tx.product.updateMany({ where: { id: productId }, data: { stock: Math.max(0, total) } });
  }
  for (const [productId, d] of deltas) {
    if (absolute.has(productId) || d === 0) continue;
    // موجودی سایت منفی نمی‌شود — کاردکس خودش منفی را نگه می‌دارد و هشدار می‌دهد
    const p = await tx.product.findUnique({ where: { id: productId }, select: { stock: true } });
    if (p) await tx.product.update({ where: { id: productId }, data: { stock: Math.max(0, p.stock + d) } });
  }
}

async function finish(
  tx: Tx,
  touched: Map<string, Date>,
  deltas: Map<string, number>,
  absolute: Set<string>,
  actor: Actor,
  skipSource?: AffectedSource,
) {
  const affected = new Map<string, AffectedSource>();
  for (const [productId, from] of touched) {
    for (const a of await recalcProduct(tx, productId, from)) affected.set(`${a.sourceType}|${a.sourceId}`, a);
    await syncStockRows(tx, productId);
  }
  await syncShopStock(tx, deltas, absolute);

  // سند منابع دیگری که بهای خروجشان عوض شد — منبع جاری سندش را خودش می‌سازد
  for (const a of affected.values()) {
    if (skipSource && a.sourceType === skipSource.sourceType && a.sourceId === skipSource.sourceId) continue;
    const fn = REBUILDERS.get(a.sourceType);
    if (fn) await fn(tx, a.sourceId, actor);
  }
}

/**
 * ثبت حرکت‌ها. همه‌ی تاریخ‌ها باید باز باشند. `sellableDelta` خودکار از انبار
 * قابل فروش حساب می‌شود.
 */
export interface ShopStockOpts {
  /** اول دوره: `Product.stock` مطلق با جمع کاردکس یکی می‌شود */
  absoluteShopStock?: boolean;
  /**
   * `false` = موجودی سایت دست نمی‌خورد. فقط برای حرکتی که فروشگاه خودش
   * موجودی‌اش را جابه‌جا کرده (کسر سفارش، سفارش بازارگاه) — تله‌ی ۱۵.
   */
  shopStock?: boolean;
}

export async function applyMoves(tx: Tx, moves: MoveInput[], actor: Actor, opts: ShopStockOpts = {}): Promise<void> {
  if (!moves.length) return;
  for (const d of new Set(moves.map((m) => m.date.getTime()))) await assertPostable(tx, new Date(d));
  await lockProducts(tx, moves.map((m) => m.productId));

  const warehouses = new Map((await tx.accWarehouse.findMany()).map((w) => [w.id, w]));
  const touched = new Map<string, Date>();
  const deltas = new Map<string, number>();
  for (const m of moves) {
    const wh = warehouses.get(m.warehouseId);
    if (!wh) throw new AccError("انبار پیدا نشد");
    if (!wh.isActive) throw new AccError(`انبار «${wh.name}» غیرفعال است`);
    const qty = signedQty(m.type, m.qty);
    if (INBOUND_GIVEN.includes(m.type) && (m.unitCost === undefined || m.unitCost < 0n)) {
      throw new AccError("بهای واحد ورود کالا لازم است");
    }
    await tx.accStockMove.create({
      data: {
        productId: m.productId,
        warehouseId: m.warehouseId,
        date: m.date,
        type: m.type,
        qty,
        unitCost: INBOUND_GIVEN.includes(m.type) ? m.unitCost! : 0n,
        sourceType: m.sourceType,
        sourceId: m.sourceId,
        sourceLineId: m.sourceLineId ?? null,
        note: m.note ?? null,
        createdByName: actor.name,
      },
    });
    const prev = touched.get(m.productId);
    if (!prev || m.date < prev) touched.set(m.productId, m.date);
    if (wh.sellable && opts.shopStock !== false) deltas.set(m.productId, (deltas.get(m.productId) ?? 0) + qty);
  }
  const absolute = opts.absoluteShopStock ? new Set(moves.map((m) => m.productId)) : new Set<string>();
  await finish(tx, touched, deltas, absolute, actor, { sourceType: moves[0].sourceType, sourceId: moves[0].sourceId });
}

/** حذف همه‌ی حرکت‌های یک منبع (ابطال حواله، انبارگردانی، بازسازی اول دوره) */
export async function removeMoves(tx: Tx, sourceType: string, sourceId: string, actor: Actor, opts: ShopStockOpts = {}) {
  const moves = await tx.accStockMove.findMany({ where: { sourceType, sourceId } });
  if (!moves.length) return;
  for (const d of new Set(moves.map((m) => m.date.getTime()))) await assertPostable(tx, new Date(d));
  await lockProducts(tx, moves.map((m) => m.productId));
  const sellable = new Set((await tx.accWarehouse.findMany({ where: { sellable: true }, select: { id: true } })).map((w) => w.id));

  const touched = new Map<string, Date>();
  const deltas = new Map<string, number>();
  for (const m of moves) {
    const prev = touched.get(m.productId);
    if (!prev || m.date < prev) touched.set(m.productId, m.date);
    if (sellable.has(m.warehouseId) && opts.shopStock !== false) deltas.set(m.productId, (deltas.get(m.productId) ?? 0) - m.qty);
  }
  await tx.accStockMove.deleteMany({ where: { sourceType, sourceId } });
  const absolute = opts.absoluteShopStock ? new Set(touched.keys()) : new Set<string>();
  await finish(tx, touched, deltas, absolute, actor, { sourceType, sourceId });
}

/** موجودی یک کالا در یک انبار تا پایان یک روز (شامل) */
export async function qtyAt(tx: Tx, productId: string, warehouseId: string, day: Date): Promise<number> {
  const s = await tx.accStockMove.aggregate({ where: { productId, warehouseId, date: { lte: day } }, _sum: { qty: true } });
  return s._sum.qty ?? 0;
}

/**
 * بررسی کافی بودن موجودی انبار برای خروج (حواله) — هم در تاریخ حواله، هم امروز.
 * `day = null` یعنی فقط موجودی فعلی (ابطال حواله).
 */
export async function assertAvailable(tx: Tx, lines: { productId: string; qty: number; title?: string }[], warehouseId: string, day: Date | null) {
  const need = new Map<string, number>();
  for (const l of lines) need.set(l.productId, (need.get(l.productId) ?? 0) + l.qty);
  for (const [productId, qty] of need) {
    const now = (await tx.accStock.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } }))?.qty ?? 0;
    const available = day ? Math.min(await qtyAt(tx, productId, warehouseId, day), now) : now;
    if (available < qty) {
      const title = lines.find((l) => l.productId === productId)?.title ?? "یک کالا";
      throw new AccError(`موجودی «${title}» در انبار مبدأ ${faNum(Math.max(0, available))} است؛ ${faNum(qty)} نمی‌شود منتقل کرد`);
    }
  }
}
