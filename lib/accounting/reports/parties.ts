/**
 * حساب اشخاص — «کل حساب» همه‌ی اشخاص و «کل حساب» یک شخص (فاز ۱۰).
 *
 * فقط حساب‌های دارایی و بدهی (`PARTY_BALANCE`) — طلب و بدهی، نه هزینه‌ی به نام
 * شخص؛ اختتامیه/افتتاحیه‌ی خودکار کنار (`NOT_CARRY`)، همان قرارداد صورت‌حساب.
 * ستون‌ها: مانده‌ی ابتدای بازه، بدهکار، بستانکار، مانده‌ی پایان (+ = طلب ما).
 */

import type { Prisma } from "@prisma/client";
import { NOT_CARRY, PARTY_BALANCE } from "../ledger/balances";
import { dateWhere, sumBig, type Db, type DateRange } from "./common";

export type PartyRole = "all" | "customer" | "supplier" | "employee" | "marketplace";

export async function partyBalances(db: Db, range: DateRange, opts: { role: PartyRole; show: "all" | "debtor" | "creditor" | "active"; q?: string | null }) {
  const base: Prisma.AccVoucherLineWhereInput = { isVoid: false, partyId: { not: null }, AND: [PARTY_BALANCE, NOT_CARRY] };
  const [before, during] = await Promise.all([
    range.from ? db.accVoucherLine.groupBy({ by: ["partyId"], where: { ...base, date: { lt: range.from } }, _sum: { debit: true, credit: true } }) : Promise.resolve([]),
    db.accVoucherLine.groupBy({ by: ["partyId"], where: { ...base, ...dateWhere(range) }, _sum: { debit: true, credit: true } }),
  ]);
  const open = new Map(before.map((b) => [b.partyId!, (b._sum.debit ?? 0n) - (b._sum.credit ?? 0n)]));
  const flow = new Map(during.map((b) => [b.partyId!, { debit: b._sum.debit ?? 0n, credit: b._sum.credit ?? 0n }]));
  const ids = [...new Set([...open.keys(), ...flow.keys()])];
  const roleWhere: Prisma.AccPartyWhereInput =
    opts.role === "customer" ? { isCustomer: true } : opts.role === "supplier" ? { isSupplier: true } : opts.role === "employee" ? { isEmployee: true } : opts.role === "marketplace" ? { isMarketplace: true } : {};
  const q = opts.q?.trim();
  const parties = await db.accParty.findMany({
    where: { id: { in: ids }, ...roleWhere, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { mobile: { contains: q } }] } : {}) },
    select: { id: true, code: true, name: true, mobile: true },
  });
  let rows = parties.map((p) => {
    const o = open.get(p.id) ?? 0n;
    const f = flow.get(p.id) ?? { debit: 0n, credit: 0n };
    return { partyId: p.id, code: p.code, name: p.name, mobile: p.mobile, opening: o, debit: f.debit, credit: f.credit, closing: o + f.debit - f.credit };
  });
  if (opts.show === "debtor") rows = rows.filter((r) => r.closing > 0n);
  else if (opts.show === "creditor") rows = rows.filter((r) => r.closing < 0n);
  else if (opts.show === "active") rows = rows.filter((r) => r.debit > 0n || r.credit > 0n);
  else rows = rows.filter((r) => r.opening !== 0n || r.debit > 0n || r.credit > 0n);
  rows.sort((a, b) => (b.closing > a.closing ? 1 : b.closing < a.closing ? -1 : a.name.localeCompare(b.name, "fa")));
  return {
    rows,
    totals: {
      opening: sumBig(rows, (r) => r.opening),
      debit: sumBig(rows, (r) => r.debit),
      credit: sumBig(rows, (r) => r.credit),
      closing: sumBig(rows, (r) => r.closing),
      receivable: sumBig(rows.filter((r) => r.closing > 0n), (r) => r.closing),
      payable: -sumBig(rows.filter((r) => r.closing < 0n), (r) => r.closing),
    },
  };
}

/** «کل حساب» یک شخص: گردش به تفکیک نوع عملیات و به تفکیک حساب */
export async function partySummary(db: Db, partyId: string, range: DateRange) {
  const base: Prisma.AccVoucherLineWhereInput = { isVoid: false, partyId, AND: [PARTY_BALANCE, NOT_CARRY] };
  const [before, bySource, byAccount] = await Promise.all([
    range.from ? db.accVoucherLine.aggregate({ where: { ...base, date: { lt: range.from } }, _sum: { debit: true, credit: true } }) : Promise.resolve(null),
    db.accVoucherLine.findMany({ where: { ...base, ...dateWhere(range) }, select: { debit: true, credit: true, voucher: { select: { source: true } } } }),
    db.accVoucherLine.groupBy({ by: ["accountId"], where: { ...base, ...dateWhere(range) }, _sum: { debit: true, credit: true }, _count: true }),
  ]);
  const opening = before ? (before._sum.debit ?? 0n) - (before._sum.credit ?? 0n) : 0n;
  const src = new Map<string, { debit: bigint; credit: bigint; count: number }>();
  for (const l of bySource) {
    const k = l.voucher.source;
    const s = src.get(k) ?? { debit: 0n, credit: 0n, count: 0 };
    s.debit += l.debit;
    s.credit += l.credit;
    s.count++;
    src.set(k, s);
  }
  const accs = new Map((await db.accAccount.findMany({ where: { id: { in: byAccount.map((a) => a.accountId) } }, select: { id: true, code: true, name: true } })).map((a) => [a.id, a]));
  const debit = sumBig([...src.values()], (s) => s.debit);
  const credit = sumBig([...src.values()], (s) => s.credit);
  return {
    opening,
    debit,
    credit,
    closing: opening + debit - credit,
    bySource: [...src.entries()].map(([source, s]) => ({ source, ...s })).sort((a, b) => Number(b.debit + b.credit - (a.debit + a.credit))),
    byAccount: byAccount
      .map((a) => ({ accountId: a.accountId, code: accs.get(a.accountId)?.code ?? "", name: accs.get(a.accountId)?.name ?? "—", debit: a._sum.debit ?? 0n, credit: a._sum.credit ?? 0n, count: a._count }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}
