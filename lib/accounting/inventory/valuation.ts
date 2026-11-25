/**
 * ارزیابی موجودی پایان دوره — اقل بها و خالص ارزش فروش (استاندارد ۸).
 * docs/plans/webhesab-parity.md بخش ۳۴.۴.
 *
 * برای هر کالای موجود: خالص ارزش فروش هر واحد = قیمت فروش مورد انتظار × (۱ − هزینه‌ی فروش٪).
 * قیمت مورد انتظار = قیمت فروشگاه امروز، برای کالای راکد با تخفیف پیشنهادی، یا قیمتی که کاربر می‌نویسد.
 * اگر از میانگین بها کمتر باشد، تفاوت × تعداد «کاهش ارزش» است.
 *
 *   ارزیابی     بد «هزینه‌ی کاهش ارزش موجودی» / بس «ذخیره‌ی کاهش ارزش موجودی» (کاهنده‌ی موجودی کالا)
 *               — فقط تفاوت با ذخیره‌ی فعلی؛ ارزیابی کمتر از قبل ← برگشت.
 *   فروش کالا   سهم واحدهای فروش‌رفته از ذخیره برمی‌گردد (آخر هر ماه خودکار، یا «همین حالا»)
 *
 * ⚠️ کاردکس، میانگین موزون و حساب «موجودی کالا» دست نمی‌خورند — سود هر فروش همان می‌ماند.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { ensureSystemAccount } from "../ledger/accounts";
import { balanceOf } from "../ledger/balances";
import { yearForDate } from "../ledger/fiscal-year";
import { postVoucher, type Actor, type LineInput } from "../ledger/post";
import { todayKey } from "../dates";
import { faNum, formatAmount } from "../money";
import { lastClosedMonthEnd } from "../installment-income";
import { storePrices } from "./price-log";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const DAY = 86_400_000;
export const PROVISION_KEY = "INVENTORY_PROVISION";
export const WRITEDOWN_KEY = "INVENTORY_WRITEDOWN";
const IN_TYPES = ["PURCHASE", "OPENING", "TRANSFER_IN", "ADJUST_IN"] as const;
const MAX_ROWS = 3000;

export async function ensureWritedownAccounts(tx: Tx) {
  await ensureSystemAccount(tx, { key: PROVISION_KEY, name: "ذخیره‌ی کاهش ارزش موجودی", parentCode: "13", cls: "ASSET", nature: "CREDIT" });
  await ensureSystemAccount(tx, { key: WRITEDOWN_KEY, name: "هزینه‌ی کاهش ارزش موجودی", parentCode: "71", cls: "EXPENSE", nature: "BOTH" });
}

export interface ValuationOpts {
  /** هزینه‌ی فروش، درصد (۵ = ۵٪) */
  sellCostPct: number;
  staleDays: number;
  /** تخفیف کالای راکد، درصد */
  staleDiscountPct: number;
  /** قیمت فروش مورد انتظار دستی برای هر کالا */
  overrides?: Record<string, string | number | bigint>;
  /** کالاهایی که کاربر از ارزیابی بیرون گذاشت */
  exclude?: string[];
  today?: Date;
}

export type Reason = "PRICE" | "STALE" | "MANUAL";
export const REASON_LABELS: Record<Reason, string> = { PRICE: "قیمت زیر بها", STALE: "راکد", MANUAL: "قیمت دستی" };

export interface ValuationRow {
  itemId: string;
  code: string;
  title: string;
  qty: number;
  unitCost: bigint;
  value: bigint;
  price: bigint;
  daysIdle: number | null;
  discountBp: number;
  expected: bigint;
  nrv: bigint;
  perUnit: bigint;
  provision: bigint;
  reason: Reason;
}

const bp = (pct: number) => Math.round(pct * 100);

export function checkOpts(o: ValuationOpts) {
  if (!(o.sellCostPct >= 0 && o.sellCostPct < 100)) throw new AccError("هزینه‌ی فروش بین ۰ تا ۹۹ درصد است");
  if (!Number.isInteger(o.staleDays) || o.staleDays < 30 || o.staleDays > 3650) throw new AccError("روزهای راکد بین ۳۰ تا ۳۶۵۰ است");
  if (!(o.staleDiscountPct >= 0 && o.staleDiscountPct <= 90)) throw new AccError("تخفیف راکد بین ۰ تا ۹۰ درصد است");
}

/** تخفیف پیشنهادی کالای راکد: از `staleDays` روز ← درصد پایه؛ دو برابر روزها ← دو برابر (سقف ۹۰٪) */
export function staleDiscountBp(daysIdle: number | null, staleDays: number, baseBp: number): number {
  if (daysIdle === null || baseBp <= 0) return 0;
  if (daysIdle >= staleDays * 2) return Math.min(9000, baseBp * 2);
  if (daysIdle >= staleDays) return baseBp;
  return 0;
}

/** محاسبه‌ی یک ردیف — خالص، برای آزمون */
export function valueRow(input: { unitCost: bigint; price: bigint; discountBp: number; override: bigint | null; sellCostBp: number }) {
  const expected = input.override ?? (input.price * BigInt(10000 - input.discountBp)) / 10000n;
  const nrv = (expected * BigInt(10000 - input.sellCostBp)) / 10000n;
  const perUnit = input.unitCost > nrv ? input.unitCost - nrv : 0n;
  const plainNrv = (input.price * BigInt(10000 - input.sellCostBp)) / 10000n;
  const reason: Reason = input.override !== null ? "MANUAL" : input.discountBp > 0 && plainNrv >= input.unitCost ? "STALE" : "PRICE";
  return { expected, nrv, perUnit, reason };
}

const parseOverride = (v: string | number | bigint | undefined): bigint | null => {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[,٬\s]/g, "");
  if (!/^\d+$/.test(s)) throw new AccError(`قیمت مورد انتظار «${v}» عدد نیست`);
  return BigInt(s);
};

/** پیش‌نمایش ارزیابی — چیزی نمی‌نویسد */
export async function planValuation(db: Db, o: ValuationOpts) {
  checkOpts(o);
  const today = o.today ?? todayKey();
  const sellCostBp = bp(o.sellCostPct);
  const baseBp = bp(o.staleDiscountPct);
  const exclude = new Set(o.exclude ?? []);
  const overrides = new Map(Object.entries(o.overrides ?? {}).map(([k, v]) => [k, parseOverride(v)] as const));

  const costs = await db.accProductCost.findMany({ where: { qtyOnHand: { gt: 0 }, totalValue: { gt: 0n } }, select: { productId: true, qtyOnHand: true, totalValue: true } });
  const ids = costs.map((c) => c.productId);
  const [items, prices, lastSales, lastIns] = await Promise.all([
    db.accItem.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, title: true } }),
    storePrices(db, ids),
    db.accStockMove.groupBy({ by: ["productId"], where: { productId: { in: ids }, type: "SALE" }, _max: { date: true } }),
    db.accStockMove.groupBy({ by: ["productId"], where: { productId: { in: ids }, type: { in: [...IN_TYPES] } }, _max: { date: true } }),
  ]);
  const info = new Map(items.map((i) => [i.id, i]));
  const lastSale = new Map(lastSales.map((x) => [x.productId, x._max.date]));
  const lastIn = new Map(lastIns.map((x) => [x.productId, x._max.date]));

  const rows: ValuationRow[] = [];
  let kardexValue = 0n;
  const unpriced: { itemId: string; code: string; title: string; qty: number; value: bigint }[] = [];
  for (const c of costs) {
    kardexValue += c.totalValue;
    const it = info.get(c.productId);
    if (!it || exclude.has(c.productId)) continue;
    const unitCost = c.totalValue / BigInt(c.qtyOnHand);
    const price = prices.get(c.productId)?.price ?? 0n;
    const override = overrides.get(c.productId) ?? null;
    if (price <= 0n && override === null) {
      unpriced.push({ itemId: it.id, code: it.code, title: it.title, qty: c.qtyOnHand, value: c.totalValue });
      continue;
    }
    const since = lastSale.get(c.productId) ?? lastIn.get(c.productId) ?? null;
    const daysIdle = since ? Math.max(0, Math.round((today.getTime() - since.getTime()) / DAY)) : null;
    const discountBp = staleDiscountBp(daysIdle, o.staleDays, baseBp);
    const r = valueRow({ unitCost, price, discountBp, override, sellCostBp });
    if (r.perUnit <= 0n) continue;
    // perUnit ≤ بهای واحد (گرد به پایین) ← ذخیره هیچ‌وقت از ارزش دفتری بیشتر نمی‌شود
    const provision = r.perUnit * BigInt(c.qtyOnHand);
    rows.push({ itemId: it.id, code: it.code, title: it.title, qty: c.qtyOnHand, unitCost, value: c.totalValue, price, daysIdle, discountBp, ...r, provision });
  }
  rows.sort((a, b) => (b.provision > a.provision ? 1 : b.provision < a.provision ? -1 : 0));
  unpriced.sort((a, b) => (b.value > a.value ? 1 : -1));
  const active = await db.accInvValuation.findFirst({ where: { status: "ACTIVE" }, select: { id: true, number: true, booked: true } });
  const total = rows.reduce((s, r) => s + r.provision, 0n);
  const booked = active?.booked ?? 0n;
  const by = (k: Reason) => rows.filter((r) => r.reason === k).reduce((s, r) => s + r.provision, 0n);
  return {
    rows: rows.slice(0, MAX_ROWS),
    truncated: rows.length > MAX_ROWS,
    count: rows.length,
    total,
    byReason: { PRICE: by("PRICE"), STALE: by("STALE"), MANUAL: by("MANUAL") },
    affectedValue: rows.reduce((s, r) => s + r.value, 0n),
    kardexValue,
    items: costs.length,
    unpriced: { count: unpriced.length, value: unpriced.reduce((s, r) => s + r.value, 0n), top: unpriced.slice(0, 30) },
    booked,
    /** سند این ارزیابی: + = کاهش ارزش بیشتر، − = برگشت */
    delta: total - booked,
  };
}

function lines(delta: bigint, what: string): LineInput[] {
  if (delta === 0n) return [];
  const a = delta > 0n ? delta : -delta;
  return delta > 0n
    ? [
        { accountKey: WRITEDOWN_KEY, debit: a, description: what },
        { accountKey: PROVISION_KEY, credit: a, description: what },
      ]
    : [
        { accountKey: PROVISION_KEY, debit: a, description: what },
        { accountKey: WRITEDOWN_KEY, credit: a, description: what },
      ];
}

/** ثبت ارزیابی: جای ارزیابی فعلی را می‌گیرد و تفاوت ذخیره را سند می‌زند */
export async function commitValuation(tx: Tx, o: ValuationOpts & { note?: string | null }, actor: Actor) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('acc-inv-valuation'))`;
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } });
  if (s?.mode !== "INTERNAL") throw new AccError("ارزیابی موجودی فقط با حسابداری داخلی است");
  const today = o.today ?? todayKey();
  const p = await planValuation(tx, { ...o, today });
  if (p.truncated) throw new AccError(`بیش از ${faNum(MAX_ROWS)} کالا کاهش ارزش دارد؛ درصدها را بازبینی کنید`);
  const last = await tx.accInvValuation.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const number = (last?.number ?? 0) + 1;
  await tx.accInvValuation.updateMany({ where: { status: "ACTIVE" }, data: { status: "SUPERSEDED" } });
  const run = await tx.accInvValuation.create({
    data: {
      number,
      date: today,
      sellCostBp: bp(o.sellCostPct),
      staleDays: o.staleDays,
      staleDiscountBp: bp(o.staleDiscountPct),
      total: p.total,
      booked: p.total,
      note: o.note?.trim() || null,
      createdByName: actor.name,
      lines: {
        create: p.rows.map((r) => ({
          itemId: r.itemId,
          qty: r.qty,
          unitCost: r.unitCost,
          price: r.price,
          expected: r.expected,
          nrv: r.nrv,
          perUnit: r.perUnit,
          reason: r.reason,
          daysIdle: r.daysIdle,
        })),
      },
    },
  });
  let voucherId: string | null = null;
  if (p.delta !== 0n) {
    await ensureWritedownAccounts(tx);
    const v = await postVoucher(tx, {
      date: today,
      description:
        p.delta > 0n
          ? `ارزیابی موجودی ${faNum(number)} — کاهش ارزش ${faNum(p.count)} کالا (اقل بها و خالص ارزش فروش)`
          : `ارزیابی موجودی ${faNum(number)} — برگشت ذخیره‌ی کاهش ارزش (${faNum(p.count)} کالا هنوز زیر بها)`,
      source: "INVENTORY_WRITEDOWN",
      sourceId: run.id,
      lines: lines(p.delta, `ارزیابی موجودی ${faNum(number)}`),
      actor,
    });
    voucherId = v.id;
    await tx.accInvValuation.update({ where: { id: run.id }, data: { voucherId } });
  }
  return { id: run.id, number, total: p.total, delta: p.delta, count: p.count, voucherId };
}

/** ذخیره‌ی لازمِ ارزیابی فعال با موجودی روز `asOf` (null = همین حالا): هر کالا تا تعداد روز ارزیابی */
async function requiredAt(db: Db, runId: string, asOf: Date | null) {
  const ls = await db.accInvValuationLine.findMany({ where: { valuationId: runId }, select: { itemId: true, qty: true, perUnit: true } });
  const ids = ls.map((l) => l.itemId);
  const [now, after] = await Promise.all([
    db.accProductCost.findMany({ where: { productId: { in: ids } }, select: { productId: true, qtyOnHand: true } }),
    asOf ? db.accStockMove.groupBy({ by: ["productId"], where: { productId: { in: ids }, date: { gt: asOf } }, _sum: { qty: true } }) : [],
  ]);
  const qNow = new Map(now.map((c) => [c.productId, c.qtyOnHand]));
  const qAfter = new Map(after.map((m) => [m.productId, m._sum.qty ?? 0]));
  let req = 0n;
  let sold = 0;
  for (const l of ls) {
    const q = Math.max(0, (qNow.get(l.itemId) ?? 0) - (qAfter.get(l.itemId) ?? 0));
    const keep = Math.min(q, l.qty);
    sold += l.qty - keep;
    req += l.perUnit * BigInt(keep);
  }
  return { required: req, soldUnits: sold, lines: ls.length };
}

async function postable(db: Db, day: Date) {
  const y = await yearForDate(db, day);
  if (!y || y.status === "CLOSED") return false;
  const s = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { lockDate: true } });
  return !(s?.lockDate && day.getTime() <= s.lockDate.getTime());
}

/**
 * برگشت سهم کالاهای فروش‌رفته از ذخیره. worker: یک بار برای هر ماه تمام‌شده بعد از روز ارزیابی، به تاریخ
 * آخر همان ماه و با موجودی همان روز. `now`: همین حالا با موجودی فعلی (دکمه‌ی صفحه).
 */
export async function releaseSold(tx: Tx, actor: Actor, opts: { now?: boolean; today?: Date } = {}) {
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } });
  if (s?.mode !== "INTERNAL") return null;
  const run = await tx.accInvValuation.findFirst({ where: { status: "ACTIVE" } });
  if (!run || run.booked === 0n && run.total === 0n) return null;
  const today = opts.today ?? todayKey();
  const day = opts.now ? today : lastClosedMonthEnd(today);
  if (!opts.now && (day.getTime() <= run.date.getTime() || (run.releasedThrough && run.releasedThrough.getTime() >= day.getTime()))) return null;
  if (!(await postable(tx, day))) return null;
  const r = await requiredAt(tx, run.id, opts.now ? null : day);
  const delta = r.required - run.booked;
  let voucherId: string | null = null;
  if (delta !== 0n) {
    await ensureWritedownAccounts(tx);
    const v = await postVoucher(tx, {
      date: day,
      description: delta < 0n ? `برگشت ذخیره‌ی کاهش ارزش کالاهای فروش‌رفته — ارزیابی ${faNum(run.number)}` : `ذخیره‌ی کاهش ارزش کالاهای برگشتی به انبار — ارزیابی ${faNum(run.number)}`,
      source: "INVENTORY_WRITEDOWN",
      sourceId: `${run.id}:release:${day.toISOString().slice(0, 10)}:${Date.now()}`,
      lines: lines(delta, `ارزیابی موجودی ${faNum(run.number)} — ${faNum(r.soldUnits)} واحد فروش‌رفته`),
      actor,
    });
    voucherId = v.id;
  }
  await tx.accInvValuation.update({ where: { id: run.id }, data: { booked: r.required, releasedThrough: day } });
  return { delta, voucherId, soldUnits: r.soldUnits };
}

/** وضعیت صفحه: ارزیابی فعال، ذخیره در دفتر، سهم فروش‌رفته‌ی هنوز برنگشته، تاریخچه */
export async function valuationStatus(db: Db) {
  const s = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } });
  const runs = await db.accInvValuation.findMany({ orderBy: { number: "desc" }, take: 20, include: { _count: { select: { lines: true } } } });
  const active = runs.find((r) => r.status === "ACTIVE") ?? null;
  const acc = await db.accAccount.findUnique({ where: { systemKey: PROVISION_KEY }, select: { id: true, code: true, name: true } });
  const book = acc ? -(await balanceOf(db, { accountId: acc.id })).balance : 0n;
  const now = active ? await requiredAt(db, active.id, null) : null;
  return {
    mode: s?.mode ?? "NONE",
    account: acc,
    /** مانده‌ی بستانکار «ذخیره‌ی کاهش ارزش» */
    book,
    active: active && {
      id: active.id,
      number: active.number,
      date: active.date,
      total: active.total,
      booked: active.booked,
      lines: active._count.lines,
      releasedThrough: active.releasedThrough,
      sellCostPct: active.sellCostBp / 100,
      staleDays: active.staleDays,
      staleDiscountPct: active.staleDiscountBp / 100,
      /** سهم واحدهای فروش‌رفته که هنوز برنگشته */
      pendingRelease: now ? active.booked - now.required : 0n,
      soldUnits: now?.soldUnits ?? 0,
    },
    diff: book - (active?.booked ?? 0n),
    runs: runs.map((r) => ({ id: r.id, number: r.number, date: r.date, total: r.total, booked: r.booked, status: r.status, lines: r._count.lines, voucherId: r.voucherId, createdByName: r.createdByName, note: r.note })),
  };
}

export async function valuationLines(db: Db, id: string) {
  const run = await db.accInvValuation.findUnique({ where: { id }, include: { lines: { orderBy: { perUnit: "desc" } } } });
  if (!run) throw new AccError("ارزیابی پیدا نشد", 404);
  const items = new Map((await db.accItem.findMany({ where: { id: { in: run.lines.map((l) => l.itemId) } }, select: { id: true, code: true, title: true } })).map((i) => [i.id, i]));
  return {
    ...run,
    lines: run.lines
      .map((l) => ({ ...l, code: items.get(l.itemId)?.code ?? "", title: items.get(l.itemId)?.title ?? "—", provision: l.perUnit * BigInt(l.qty) }))
      .sort((a, b) => (b.provision > a.provision ? 1 : -1)),
  };
}

export const releaseSummary = (r: { delta: bigint; soldUnits: number } | null) =>
  !r ? "چیزی برای برگشت نبود" : r.delta === 0n ? "ذخیره به‌روز است" : `${formatAmount(r.delta < 0n ? -r.delta : r.delta)} تومان ${r.delta < 0n ? "از ذخیره برگشت" : "به ذخیره اضافه شد"} (${faNum(r.soldUnits)} واحد فروش‌رفته)`;
