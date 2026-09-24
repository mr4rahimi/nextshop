/**
 * تراز آزمایشی — دو، چهار و شش ستونی؛ سطح گروه، کل، معین یا تفصیلی.
 *
 * ستون‌ها: مانده‌ی ابتدای بازه (بدهکار/بستانکار)، گردش بازه، مانده‌ی پایان.
 * نمای دو ستونی فقط مانده‌ی پایان، چهار ستونی گردش + مانده‌ی پایان. محاسبه یکی
 * است؛ رابط ستون‌ها را انتخاب می‌کند. جمع بدهکار هر جفت ستون = جمع بستانکارش.
 */

import { accountIndex, type Db, type DateRange } from "./common";

export type TrialLevel = "GROUP" | "LEDGER" | "SUBLEDGER" | "DETAIL";

export interface TrialRow {
  key: string;
  accountId: string;
  code: string;
  name: string;
  level: "GROUP" | "LEDGER" | "SUBLEDGER";
  /** سطح تفصیلی: شخص یا صندوق */
  detail: { kind: "party" | "treasury"; id: string; name: string } | null;
  openDebit: bigint;
  openCredit: bigint;
  debit: bigint;
  credit: bigint;
  closeDebit: bigint;
  closeCredit: bigint;
}

const split = (net: bigint): [bigint, bigint] => (net >= 0n ? [net, 0n] : [0n, -net]);

export async function trialBalance(db: Db, range: DateRange, level: TrialLevel) {
  const idx = await accountIndex(db);
  const detail = level === "DETAIL";
  const by = detail ? (["accountId", "partyId", "treasuryId"] as const) : (["accountId"] as const);

  const [before, during] = await Promise.all([
    range.from
      ? db.accVoucherLine.groupBy({ by: [...by], where: { isVoid: false, date: { lt: range.from } }, _sum: { debit: true, credit: true } })
      : Promise.resolve([]),
    db.accVoucherLine.groupBy({
      by: [...by],
      where: { isVoid: false, ...(range.from || range.to ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {}) },
      _sum: { debit: true, credit: true },
    }),
  ]);

  // ردیف پایه: معین (یا معین × تفصیلی)
  type Acc = { accountId: string; partyId: string | null; treasuryId: string | null; open: bigint; debit: bigint; credit: bigint };
  const base = new Map<string, Acc>();
  const keyOf = (r: { accountId: string; partyId?: string | null; treasuryId?: string | null }) =>
    detail ? `${r.accountId}|${r.partyId ?? ""}|${r.treasuryId ?? ""}` : r.accountId;
  const get = (r: { accountId: string; partyId?: string | null; treasuryId?: string | null }) => {
    const k = keyOf(r);
    let a = base.get(k);
    if (!a) base.set(k, (a = { accountId: r.accountId, partyId: r.partyId ?? null, treasuryId: r.treasuryId ?? null, open: 0n, debit: 0n, credit: 0n }));
    return a;
  };
  for (const r of before) get(r).open += (r._sum.debit ?? 0n) - (r._sum.credit ?? 0n);
  for (const r of during) {
    const a = get(r);
    a.debit += r._sum.debit ?? 0n;
    a.credit += r._sum.credit ?? 0n;
  }

  // جمع به سطح خواسته‌شده — گروه و کل از زنجیره‌ی پدران
  const target = level === "DETAIL" ? "SUBLEDGER" : level;
  const agg = new Map<string, { accountId: string; partyId: string | null; treasuryId: string | null; open: bigint; debit: bigint; credit: bigint }>();
  for (const a of base.values()) {
    const acc = idx.chain(a.accountId).find((x) => x.level === target);
    if (!acc) continue;
    const k = detail ? `${acc.id}|${a.partyId ?? ""}|${a.treasuryId ?? ""}` : acc.id;
    const t = agg.get(k) ?? { accountId: acc.id, partyId: a.partyId, treasuryId: a.treasuryId, open: 0n, debit: 0n, credit: 0n };
    t.open += a.open;
    t.debit += a.debit;
    t.credit += a.credit;
    agg.set(k, t);
  }

  const partyIds = [...new Set([...agg.values()].map((a) => a.partyId).filter((x): x is string => !!x))];
  const treasuryIds = [...new Set([...agg.values()].map((a) => a.treasuryId).filter((x): x is string => !!x))];
  const [parties, treasuries] = await Promise.all([
    partyIds.length ? db.accParty.findMany({ where: { id: { in: partyIds } }, select: { id: true, name: true } }) : [],
    treasuryIds.length ? db.accTreasury.findMany({ where: { id: { in: treasuryIds } }, select: { id: true, name: true } }) : [],
  ]);
  const pName = new Map(parties.map((p) => [p.id, p.name]));
  const tName = new Map(treasuries.map((t) => [t.id, t.name]));

  const rows: TrialRow[] = [];
  for (const [k, a] of agg) {
    const close = a.open + a.debit - a.credit;
    if (a.open === 0n && a.debit === 0n && a.credit === 0n) continue;
    const acc = idx.byId.get(a.accountId)!;
    const [od, oc] = split(a.open);
    const [cd, cc] = split(close);
    rows.push({
      key: k,
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      level: acc.level,
      detail: a.partyId
        ? { kind: "party", id: a.partyId, name: pName.get(a.partyId) ?? "—" }
        : a.treasuryId
          ? { kind: "treasury", id: a.treasuryId, name: tName.get(a.treasuryId) ?? "—" }
          : null,
      openDebit: od,
      openCredit: oc,
      debit: a.debit,
      credit: a.credit,
      closeDebit: cd,
      closeCredit: cc,
    });
  }
  rows.sort((x, y) => x.code.localeCompare(y.code) || (x.detail?.name ?? "").localeCompare(y.detail?.name ?? "", "fa"));

  const total = (f: (r: TrialRow) => bigint) => rows.reduce((s, r) => s + f(r), 0n);
  const totals = {
    openDebit: total((r) => r.openDebit),
    openCredit: total((r) => r.openCredit),
    debit: total((r) => r.debit),
    credit: total((r) => r.credit),
    closeDebit: total((r) => r.closeDebit),
    closeCredit: total((r) => r.closeCredit),
  };
  return { rows, totals, balanced: totals.debit === totals.credit && totals.closeDebit === totals.closeCredit && totals.openDebit === totals.openCredit };
}
