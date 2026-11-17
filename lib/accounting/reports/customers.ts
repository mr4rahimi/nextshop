/**
 * گزارش مشتریان — docs/plans/webhesab-parity.md بخش ۲۵.
 *
 * سه نما به‌جای گزارش‌های جدای وب حساب:
 *   top    نفرات برتر خرید / فروش بر مبنای مشتری (تعداد فاکتور، تخفیف، مرجوعی، آخرین خرید، کارت)
 *   first  اولین خرید مشتریان — کسی که اولین فاکتور فروشش در بازه است (و بعدش برگشت یا نه)
 *   daily  تعداد مشتری و فاکتور هر روز (نمودار میزان مشتریان به تفکیک روز)
 *
 * مبلغ‌ها مثل «تحلیل فروش»: Σ(`lineTotal − vatAmount`) ردیف‌ها — بعد از تخفیف، بی مالیات و کرایه.
 * «مشتری حضوری» (فروش بی‌نام صندوق) در فهرست‌ها نیست و جدا جمع زده می‌شود.
 */

import type { Prisma } from "@prisma/client";
import { todayKey } from "../dates";
import type { Db, DateRange } from "./common";

export type CustomerMode = "top" | "first" | "daily";
export type CustomerSort = "net" | "invoices" | "last";

export interface CustomerFilters {
  warehouseId?: string | null;
  q?: string | null;
}

const WALK_IN = "walk-in";
const MAX_ROWS = 2000;
const MAX_DAYS = 400;

interface Inv {
  id: string;
  type: "SALES" | "SALES_RETURN";
  number: number | null;
  date: Date;
  partyId: string;
  warehouseId: string | null;
  discount: bigint;
  net: bigint;
  qty: number;
}

/** فاکتورهای فروش و برگشت صادرشده با مبلغ خالص هر کدام */
async function invoicesOf(db: Db, where: Prisma.AccInvoiceWhereInput): Promise<Inv[]> {
  const invs = await db.accInvoice.findMany({
    where: { status: "ISSUED", type: { in: ["SALES", "SALES_RETURN"] }, ...where },
    select: { id: true, type: true, number: true, date: true, partyId: true, warehouseId: true, lineDiscount: true, invoiceDiscount: true },
  });
  const sums = new Map<string, { net: bigint; qty: number }>();
  for (let i = 0; i < invs.length; i += 20_000) {
    const g = await db.accInvoiceLine.groupBy({
      by: ["invoiceId"],
      where: { invoiceId: { in: invs.slice(i, i + 20_000).map((x) => x.id) } },
      _sum: { lineTotal: true, vatAmount: true, qty: true },
    });
    for (const x of g) sums.set(x.invoiceId, { net: (x._sum.lineTotal ?? 0n) - (x._sum.vatAmount ?? 0n), qty: x._sum.qty ?? 0 });
  }
  return invs.map((x) => ({
    id: x.id,
    type: x.type as Inv["type"],
    number: x.number,
    date: x.date,
    partyId: x.partyId,
    warehouseId: x.warehouseId,
    discount: x.lineDiscount + x.invoiceDiscount,
    net: sums.get(x.id)?.net ?? 0n,
    qty: sums.get(x.id)?.qty ?? 0,
  }));
}

const rangeWhere = (range: DateRange): Prisma.AccInvoiceWhereInput =>
  range.from || range.to ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {};

async function walkInId(db: Db) {
  return (await db.accParty.findUnique({ where: { platformCode: WALK_IN }, select: { id: true } }))?.id ?? null;
}

/** کد، نام، موبایل، کارت فعال و سطح باشگاه، سابقه در نرم‌افزار قبلی */
async function partyInfo(db: Db, ids: string[]) {
  const parties = await db.accParty.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true, mobile: true, userId: true } });
  const userIds = parties.map((p) => p.userId).filter((x): x is string => !!x);
  const [profiles, legacy] = await Promise.all([
    userIds.length
      ? db.clubProfile.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, tier: { select: { title: true } }, cards: { where: { isActive: true }, select: { number: true }, take: 1 } },
        })
      : Promise.resolve([]),
    db.legacyCustomer.findMany({ where: { partyId: { in: ids } }, select: { partyId: true, invoiceCount: true, spent: true, lastPurchaseAt: true } }),
  ]);
  const profOf = new Map(profiles.map((p) => [p.userId, p]));
  const legOf = new Map<string, { invoices: number; spent: bigint; last: Date | null }>();
  for (const l of legacy) {
    const cur = legOf.get(l.partyId!) ?? { invoices: 0, spent: 0n, last: null };
    cur.invoices += l.invoiceCount;
    cur.spent += l.spent;
    if (l.lastPurchaseAt && (!cur.last || l.lastPurchaseAt > cur.last)) cur.last = l.lastPurchaseAt;
    legOf.set(l.partyId!, cur);
  }
  return new Map(
    parties.map((p) => {
      const prof = p.userId ? profOf.get(p.userId) : undefined;
      return [
        p.id,
        { code: p.code, name: p.name, mobile: p.mobile, card: prof?.cards[0]?.number ?? null, tier: prof?.tier?.title ?? null, legacy: legOf.get(p.id) ?? null },
      ] as const;
    }),
  );
}

const matches = (q: string | null | undefined, p: { name: string; mobile: string | null; code: number; card: string | null }) => {
  const t = q?.trim();
  if (!t) return true;
  return p.name.includes(t) || (p.mobile ?? "").includes(t) || String(p.code) === t || (p.card ?? "") === t;
};

// ───────────────────────── نفرات برتر ─────────────────────────

export async function topCustomers(db: Db, range: DateRange, f: CustomerFilters & { sort: CustomerSort; limit: number }) {
  const walkIn = await walkInId(db);
  const invs = await invoicesOf(db, { ...rangeWhere(range), ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}) });
  type Row = { partyId: string; invoices: number; returns: number; sales: bigint; discount: bigint; returned: bigint; qty: number; first: Date; last: Date | null };
  const by = new Map<string, Row>();
  const walk = { invoices: 0, net: 0n };
  for (const i of invs) {
    if (i.partyId === walkIn) {
      if (i.type === "SALES") walk.invoices++;
      walk.net += i.type === "SALES" ? i.net : -i.net;
      continue;
    }
    const r = by.get(i.partyId) ?? { partyId: i.partyId, invoices: 0, returns: 0, sales: 0n, discount: 0n, returned: 0n, qty: 0, first: i.date, last: null };
    if (i.type === "SALES") {
      r.invoices++;
      r.sales += i.net;
      r.discount += i.discount;
      r.qty += i.qty;
      if (!r.last || i.date > r.last) r.last = i.date;
      if (i.date < r.first) r.first = i.date;
    } else {
      r.returns++;
      r.returned += i.net;
      r.qty -= i.qty;
    }
    by.set(i.partyId, r);
  }
  const info = await partyInfo(db, [...by.keys()]);
  const all = [...by.values()]
    .filter((r) => info.has(r.partyId))
    .map((r) => ({ ...r, net: r.sales - r.returned, avg: r.invoices ? (r.sales - r.returned) / BigInt(r.invoices) : 0n, ...info.get(r.partyId)! }))
    .filter((r) => matches(f.q, r));
  const cmp = {
    net: (a: (typeof all)[number], b: (typeof all)[number]) => (b.net > a.net ? 1 : b.net < a.net ? -1 : b.invoices - a.invoices),
    invoices: (a: (typeof all)[number], b: (typeof all)[number]) => b.invoices - a.invoices || (b.net > a.net ? 1 : b.net < a.net ? -1 : 0),
    last: (a: (typeof all)[number], b: (typeof all)[number]) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0),
  }[f.sort];
  all.sort(cmp);
  const sum = (k: "net" | "sales" | "returned" | "discount") => all.reduce((s, r) => s + r[k], 0n);
  const net = sum("net");
  const limit = Math.min(f.limit > 0 ? f.limit : MAX_ROWS, MAX_ROWS);
  const rows = all.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1, shareBp: net > 0n ? Number((r.net * 10_000n) / net) : 0 }));
  const topNet = rows.reduce((s, r) => s + r.net, 0n);
  return {
    rows,
    totals: {
      customers: all.length,
      invoices: all.reduce((s, r) => s + r.invoices, 0),
      sales: sum("sales"),
      discount: sum("discount"),
      returned: sum("returned"),
      net,
      shown: rows.length,
      shownNet: topNet,
      shownShareBp: net > 0n ? Number((topNet * 10_000n) / net) : 0,
    },
    walkIn: walk,
  };
}

// ───────────────────────── اولین خرید ─────────────────────────

export async function firstPurchases(db: Db, range: DateRange, f: CustomerFilters & { withLegacy: boolean }) {
  const walkIn = await walkInId(db);
  // کسانی که در بازه فاکتور فروش دارند ← اولین فاکتور فروش هر کدام در کل دفتر
  const inRange = await db.accInvoice.findMany({
    where: { status: "ISSUED", type: "SALES", ...rangeWhere(range), ...(walkIn ? { partyId: { not: walkIn } } : {}) },
    select: { partyId: true },
    distinct: ["partyId"],
  });
  const ids = inRange.map((x) => x.partyId);
  if (!ids.length) return { rows: [], totals: { customers: 0, firstNet: 0n, returning: 0, laterNet: 0n, legacyHidden: 0 } };
  const firsts = await db.accInvoice.findMany({
    where: { status: "ISSUED", type: "SALES", partyId: { in: ids } },
    orderBy: [{ partyId: "asc" }, { date: "asc" }, { number: "asc" }],
    distinct: ["partyId"],
    select: { id: true, partyId: true },
  });
  const firstIds = new Set(firsts.map((x) => x.id));
  // فقط آن‌هایی که اولین فاکتورشان در بازه است
  const firstInvs = (await invoicesOf(db, { id: { in: [...firstIds] }, ...rangeWhere(range), ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}) })).filter((i) => i.type === "SALES");
  const partyIds = firstInvs.map((i) => i.partyId);
  // خریدهای بعد از اولین فاکتور تا امروز (فروش منهای برگشت)
  const later = await invoicesOf(db, { partyId: { in: partyIds } });
  const afterOf = new Map<string, { invoices: number; net: bigint; last: Date | null }>();
  for (const i of later) {
    if (firstIds.has(i.id)) continue;
    const a = afterOf.get(i.partyId) ?? { invoices: 0, net: 0n, last: null };
    if (i.type === "SALES") {
      a.invoices++;
      a.net += i.net;
      if (!a.last || i.date > a.last) a.last = i.date;
    } else a.net -= i.net;
    afterOf.set(i.partyId, a);
  }
  const [info, warehouses] = await Promise.all([partyInfo(db, partyIds), db.accWarehouse.findMany({ select: { id: true, name: true } })]);
  const whName = new Map(warehouses.map((w) => [w.id, w.name]));
  let legacyHidden = 0;
  const rows = firstInvs
    .filter((i) => info.has(i.partyId))
    .map((i) => {
      const p = info.get(i.partyId)!;
      const a = afterOf.get(i.partyId) ?? { invoices: 0, net: 0n, last: null };
      return {
        partyId: i.partyId,
        ...p,
        invoiceId: i.id,
        number: i.number,
        date: i.date,
        amount: i.net,
        qty: i.qty,
        warehouse: i.warehouseId ? (whName.get(i.warehouseId) ?? "—") : null,
        laterInvoices: a.invoices,
        laterNet: a.net,
        lastDate: a.last,
      };
    })
    .filter((r) => {
      if (!matches(f.q, r)) return false;
      if (!f.withLegacy && r.legacy && r.legacy.invoices > 0) {
        legacyHidden++;
        return false;
      }
      return true;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime() || (a.number ?? 0) - (b.number ?? 0));
  return {
    rows: rows.slice(0, MAX_ROWS),
    totals: {
      customers: rows.length,
      firstNet: rows.reduce((s, r) => s + r.amount, 0n),
      returning: rows.filter((r) => r.laterInvoices > 0).length,
      laterNet: rows.reduce((s, r) => s + r.laterNet, 0n),
      legacyHidden,
    },
  };
}

// ───────────────────────── روزانه ─────────────────────────

export async function dailyCustomers(db: Db, range: DateRange, f: CustomerFilters) {
  const walkIn = await walkInId(db);
  const to = range.to ?? todayKey();
  let from = range.from ?? new Date(to.getTime() - 29 * 86_400_000);
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_DAYS) from = new Date(to.getTime() - MAX_DAYS * 86_400_000);
  const invs = await invoicesOf(db, { date: { gte: from, lte: to }, ...(f.warehouseId ? { warehouseId: f.warehouseId } : {}) });

  // اولین فاکتور فروش کل دفتر برای کسانی که در بازه خریده‌اند ← «مشتری تازه» همان روز
  const ids = [...new Set(invs.filter((i) => i.type === "SALES" && i.partyId !== walkIn).map((i) => i.partyId))];
  const firsts = ids.length
    ? await db.accInvoice.findMany({
        where: { status: "ISSUED", type: "SALES", partyId: { in: ids } },
        orderBy: [{ partyId: "asc" }, { date: "asc" }, { number: "asc" }],
        distinct: ["partyId"],
        select: { id: true, partyId: true },
      })
    : [];
  // خریدار نرم‌افزار قبلی «تازه» نیست — مثل پیش‌فرض زبانه‌ی «اولین خرید»
  const old = ids.length ? await db.legacyCustomer.findMany({ where: { partyId: { in: ids }, invoiceCount: { gt: 0 } }, select: { partyId: true } }) : [];
  const oldIds = new Set(old.map((x) => x.partyId));
  const firstIds = new Set(firsts.filter((x) => !oldIds.has(x.partyId)).map((x) => x.id));

  const key = (d: Date) => d.toISOString().slice(0, 10);
  type Day = { day: string; invoices: number; customers: Set<string>; walkIn: number; fresh: number; net: bigint; returns: number };
  const days = new Map<string, Day>();
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    const k = key(new Date(t));
    days.set(k, { day: k, invoices: 0, customers: new Set(), walkIn: 0, fresh: 0, net: 0n, returns: 0 });
  }
  for (const i of invs) {
    const d = days.get(key(i.date));
    if (!d) continue;
    if (i.type === "SALES_RETURN") {
      d.returns++;
      d.net -= i.net;
      continue;
    }
    d.invoices++;
    d.net += i.net;
    if (i.partyId === walkIn) d.walkIn++;
    else d.customers.add(i.partyId);
    if (firstIds.has(i.id)) d.fresh++;
  }
  const rows = [...days.values()].map((d) => ({
    day: d.day,
    date: new Date(d.day),
    invoices: d.invoices,
    customers: d.customers.size,
    walkIn: d.walkIn,
    fresh: d.fresh,
    returns: d.returns,
    net: d.net,
    avg: d.invoices ? d.net / BigInt(d.invoices) : 0n,
  }));
  const distinct = new Set(invs.filter((i) => i.type === "SALES" && i.partyId !== walkIn).map((i) => i.partyId));
  const active = rows.filter((r) => r.invoices > 0);
  return {
    from,
    to,
    rows,
    totals: {
      invoices: rows.reduce((s, r) => s + r.invoices, 0),
      customers: distinct.size,
      walkIn: rows.reduce((s, r) => s + r.walkIn, 0),
      fresh: rows.reduce((s, r) => s + r.fresh, 0),
      returns: rows.reduce((s, r) => s + r.returns, 0),
      net: rows.reduce((s, r) => s + r.net, 0n),
      activeDays: active.length,
      maxInvoices: Math.max(0, ...rows.map((r) => r.invoices)),
    },
  };
}
