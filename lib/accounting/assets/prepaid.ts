/**
 * پیش‌پرداخت هزینه و ودیعه — docs/plans/webhesab-parity.md بخش ۳۴.۵.
 *
 * پیش‌پرداخت (اجاره‌ی سالانه، بیمه):
 *   پرداخت      بد «پیش‌پرداخت هزینه‌ها» / بس صندوق‌وبانک یا پرداختنی شخص (قدیمی: بی‌سند)
 *   آخر هر ماه  بد «حساب هزینه» / بس «پیش‌پرداخت هزینه‌ها» — سهم همان ماه، خودکار
 * ودیعه (رهن مغازه، سپرده‌ی ضمانت) دارایی است، نه هزینه:
 *   پرداخت      بد «ودیعه‌ی اجاره» / بس صندوق‌وبانک
 *   بازگشت      بد صندوق‌وبانک (+ کسری به حساب هزینه) / بس «ودیعه‌ی اجاره»
 */

import type { AccPrepaid, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError, toAmount } from "../errors";
import { balanceOf } from "../ledger/balances";
import { postVoucher, voidVoucher, type Actor, type LineInput } from "../ledger/post";
import { parseDay, todayKey } from "../dates";
import { faNum } from "../money";
import { TREASURY_ACCOUNT_KEY } from "../treasury";
import { monthTitle } from "../installment-income";
import { monthEndAt, monthIndex, prepaidTarget } from "./calc";
import { activeParty, activeTreasury, ensureAssetChart } from "./fixed";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const PREPAID_KEY = "PREPAID_EXPENSE";
export const DEPOSITS_KEY = "DEPOSITS";

/** حساب‌های هزینه‌ی بی‌تفصیلی و غیرسیستمی (اجاره، بیمه، …) — مقصد سهم ماهانه و کسر ودیعه */
export function expenseAccounts(db: Db) {
  return db.accAccount.findMany({
    where: { class: "EXPENSE", level: "SUBLEDGER", isActive: true, detailKind: "NONE", systemKey: null },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
}

async function expenseAccount(db: Db, id: string | null | undefined) {
  const a = id ? await db.accAccount.findUnique({ where: { id } }) : null;
  if (!a || a.class !== "EXPENSE" || a.level !== "SUBLEDGER" || !a.isActive || a.detailKind !== "NONE" || a.systemKey) throw new AccError("حساب هزینه را انتخاب کنید");
  return a;
}

const prepaidLabel = (p: { number: number; title: string }) => `${p.title} (پیش‌پرداخت ${faNum(p.number)})`;

export interface PrepaidBody {
  title?: string;
  expenseAccountId?: string;
  amount?: unknown;
  paidOn?: string;
  startOn?: string | null;
  months?: unknown;
  funding?: string;
  treasuryId?: string | null;
  partyId?: string | null;
  note?: string | null;
}

export async function createPrepaid(tx: Tx, b: PrepaidBody, actor: Actor): Promise<AccPrepaid> {
  await ensureAssetChart(tx);
  const title = String(b.title ?? "").trim();
  if (!title) throw new AccError("عنوان را بنویسید (مثلاً اجاره‌ی سالانه‌ی مغازه)");
  const acc = await expenseAccount(tx, b.expenseAccountId);
  const amount = toAmount(b.amount, "مبلغ");
  if (amount <= 0n) throw new AccError("مبلغ را وارد کنید");
  const paidOn = parseDay(b.paidOn);
  if (!paidOn) throw new AccError("تاریخ پرداخت را انتخاب کنید");
  const startOn = parseDay(b.startOn) ?? paidOn;
  const months = Number(b.months);
  if (!Number.isInteger(months) || months < 1 || months > 120) throw new AccError("تعداد ماه بین ۱ تا ۱۲۰ است");
  const funding = b.funding;
  if (funding !== "TREASURY" && funding !== "CREDIT" && funding !== "EXISTING") throw new AccError("بگویید پول از کجا پرداخت شد");
  const t = funding === "TREASURY" ? await activeTreasury(tx, b.treasuryId) : null;
  const party = funding === "CREDIT" ? await activeParty(tx, b.partyId) : null;

  const p = await tx.accPrepaid.create({
    data: {
      title,
      expenseAccountId: acc.id,
      amount,
      startOn,
      months,
      paidOn,
      funding,
      treasuryId: t?.id ?? null,
      partyId: party?.id ?? null,
      note: b.note?.trim() || null,
      createdById: actor.id ?? null,
      createdByName: actor.name,
    },
  });
  if (!t && !party) return p;
  const v = await postVoucher(tx, {
    date: paidOn,
    description: `پیش‌پرداخت — ${prepaidLabel(p)}، ${faNum(months)} ماه`,
    source: "PREPAID",
    sourceId: `prepaid:${p.id}`,
    lines: [
      { accountKey: PREPAID_KEY, debit: amount, description: title },
      t ? { accountKey: TREASURY_ACCOUNT_KEY[t.kind], treasuryId: t.id, credit: amount } : { accountKey: "AP", partyId: party!.id, credit: amount, description: title },
    ],
    actor,
  });
  return tx.accPrepaid.update({ where: { id: p.id }, data: { voucherId: v.id } });
}

async function lockPrepaid(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "AccPrepaid" WHERE id = ${id} FOR UPDATE`;
  const p = await tx.accPrepaid.findUnique({ where: { id } });
  if (!p) throw new AccError("پیش‌پرداخت پیدا نشد", 404);
  return p;
}

/** ابطال — فقط تا وقتی سهمی هزینه نشده */
export async function voidPrepaid(tx: Tx, id: string, reason: string, actor: Actor) {
  const p = await lockPrepaid(tx, id);
  if (p.status === "VOID") return p;
  if (p.recognized > 0n) throw new AccError("سهم چند ماه هزینه شده؛ به‌جای ابطال «پایان زودتر» را بزنید", 409);
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  if (p.voucherId) await voidVoucher(tx, p.voucherId, reason, actor, { fromSource: true });
  return tx.accPrepaid.update({ where: { id }, data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` } });
}

/** پایان زودتر (قرارداد زودتر تمام شد): باقی مانده امروز یک‌جا هزینه می‌شود */
export async function finishPrepaid(tx: Tx, id: string, actor: Actor) {
  const p = await lockPrepaid(tx, id);
  if (p.status !== "ACTIVE") throw new AccError("این پیش‌پرداخت فعال نیست", 409);
  const rest = p.amount - p.recognized;
  if (rest > 0n) {
    await postVoucher(tx, {
      date: todayKey(),
      description: `پایان زودتر پیش‌پرداخت — ${prepaidLabel(p)}`,
      source: "PREPAID",
      sourceId: `prepaid:${p.id}:finish`,
      lines: [
        { accountId: p.expenseAccountId, debit: rest, description: p.title },
        { accountKey: PREPAID_KEY, credit: rest, description: prepaidLabel(p) },
      ],
      actor,
    });
  }
  return tx.accPrepaid.update({ where: { id }, data: { status: "DONE", recognized: p.amount } });
}

/** سهم ماه‌های تمام‌شده‌ی پیش‌پرداخت‌ها — از `runMonthly` */
export async function runPrepaidMonthly(tx: Tx, actor: Actor, L: Date, postable: (d: Date) => Promise<boolean>) {
  const items = await tx.accPrepaid.findMany({ where: { status: "ACTIVE" }, orderBy: { number: "asc" } });
  const months = new Map<string, { end: Date; items: { p: AccPrepaid; amount: bigint }[] }>();
  const added = new Map<string, bigint>();
  for (const p of items) {
    const n0 = p.recognizedThrough ? monthIndex(p.startOn, p.recognizedThrough) + 1 : 1;
    const nL = monthIndex(p.startOn, L);
    if (nL < n0) continue;
    let done = p.recognized;
    for (let n = n0; n <= nL; n++) {
      const E = monthEndAt(p.startOn, n);
      if (!(await postable(E))) continue;
      const d = prepaidTarget(p.amount, p.months, n) - done;
      if (d <= 0n) continue;
      done += d;
      const k = E.toISOString().slice(0, 10);
      const m = months.get(k) ?? { end: E, items: [] };
      m.items.push({ p, amount: d });
      months.set(k, m);
    }
    added.set(p.id, done - p.recognized);
  }
  const vouchers: string[] = [];
  let total = 0n;
  for (const k of [...months.keys()].sort()) {
    const m = months.get(k)!;
    const sum = m.items.reduce((s, i) => s + i.amount, 0n);
    const lines: LineInput[] = [
      ...m.items.map((i) => ({ accountId: i.p.expenseAccountId, debit: i.amount, description: `سهم ${monthTitle(m.end)} — ${prepaidLabel(i.p)}` })),
      { accountKey: PREPAID_KEY, credit: sum, description: `سهم ${monthTitle(m.end)}` },
    ];
    const v = await postVoucher(tx, {
      date: m.end,
      description: `سهم ماه پیش‌پرداخت‌ها — ${monthTitle(m.end)} (${faNum(m.items.length)} مورد)`,
      source: "PREPAID",
      sourceId: `prepaid-month:${k}`,
      lines,
      actor,
    });
    vouchers.push(v.id);
    total += sum;
  }
  for (const p of items) {
    if (!added.has(p.id)) continue;
    const rec = p.recognized + added.get(p.id)!;
    await tx.accPrepaid.update({ where: { id: p.id }, data: { recognized: rec, recognizedThrough: L, ...(rec >= p.amount ? { status: "DONE" as const } : {}) } });
  }
  return { vouchers, amount: total, items: [...added.values()].filter((x) => x > 0n).length };
}

// ── ودیعه ──

export interface DepositBody {
  title?: string;
  counterparty?: string;
  amount?: unknown;
  paidOn?: string;
  funding?: string;
  treasuryId?: string | null;
  note?: string | null;
}

export async function createDeposit(tx: Tx, b: DepositBody, actor: Actor) {
  await ensureAssetChart(tx);
  const title = String(b.title ?? "").trim();
  if (!title) throw new AccError("عنوان را بنویسید (مثلاً رهن مغازه‌ی خیابان …)");
  const counterparty = String(b.counterparty ?? "").trim();
  if (!counterparty) throw new AccError("ودیعه نزد کیست؟ (موجر، بانک، …)");
  const amount = toAmount(b.amount, "مبلغ");
  if (amount <= 0n) throw new AccError("مبلغ را وارد کنید");
  const paidOn = parseDay(b.paidOn);
  if (!paidOn) throw new AccError("تاریخ پرداخت را انتخاب کنید");
  if (b.funding !== "TREASURY" && b.funding !== "EXISTING") throw new AccError("بگویید پول از کجا پرداخت شد");
  const t = b.funding === "TREASURY" ? await activeTreasury(tx, b.treasuryId) : null;
  const d = await tx.accDeposit.create({
    data: {
      title,
      counterparty,
      amount,
      paidOn,
      funding: b.funding,
      treasuryId: t?.id ?? null,
      note: b.note?.trim() || null,
      createdById: actor.id ?? null,
      createdByName: actor.name,
    },
  });
  if (!t) return d;
  const v = await postVoucher(tx, {
    date: paidOn,
    description: `پرداخت ودیعه — ${title} (نزد ${counterparty})`,
    source: "PREPAID",
    sourceId: `deposit:${d.id}`,
    lines: [
      { accountKey: DEPOSITS_KEY, debit: amount, description: `${title} — ${counterparty}` },
      { accountKey: TREASURY_ACCOUNT_KEY[t.kind], treasuryId: t.id, credit: amount },
    ],
    actor,
  });
  return tx.accDeposit.update({ where: { id: d.id }, data: { voucherId: v.id } });
}

async function lockDeposit(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "AccDeposit" WHERE id = ${id} FOR UPDATE`;
  const d = await tx.accDeposit.findUnique({ where: { id } });
  if (!d) throw new AccError("ودیعه پیدا نشد", 404);
  return d;
}

export async function returnDeposit(tx: Tx, id: string, b: { date?: string; amount?: unknown; treasuryId?: string | null; shortfallAccountId?: string | null }, actor: Actor) {
  const d = await lockDeposit(tx, id);
  if (d.status !== "HELD") throw new AccError(d.status === "VOID" ? "این ودیعه باطل شده است" : "این ودیعه قبلاً برگشته است", 409);
  const date = parseDay(b.date);
  if (!date) throw new AccError("تاریخ بازگشت را انتخاب کنید");
  if (date.getTime() < d.paidOn.getTime()) throw new AccError("بازگشت پیش از پرداخت نمی‌شود");
  const amount = toAmount(b.amount, "مبلغ برگشتی");
  if (amount < 0n || amount > d.amount) throw new AccError("مبلغ برگشتی بیش از ودیعه است");
  const t = amount > 0n ? await activeTreasury(tx, b.treasuryId) : null;
  const short = d.amount - amount;
  const acc = short > 0n ? await expenseAccount(tx, b.shortfallAccountId) : null;
  const v = await postVoucher(tx, {
    date,
    description: `بازگشت ودیعه — ${d.title} (از ${d.counterparty})`,
    source: "PREPAID",
    sourceId: `deposit:${d.id}:return`,
    lines: [
      ...(t ? [{ accountKey: TREASURY_ACCOUNT_KEY[t.kind], treasuryId: t.id, debit: amount }] : []),
      ...(acc ? [{ accountId: acc.id, debit: short, description: `کسر از ودیعه — ${d.title}` }] : []),
      { accountKey: DEPOSITS_KEY, credit: d.amount, description: `${d.title} — ${d.counterparty}` },
    ],
    actor,
  });
  return tx.accDeposit.update({
    where: { id },
    data: { status: "RETURNED", returnedOn: date, returnedAmount: amount, returnTreasuryId: t?.id ?? null, shortfallAccountId: acc?.id ?? null, returnVoucherId: v.id },
  });
}

/** برگرداندن «بازگشت» (اشتباه ثبت شده) */
export async function unreturnDeposit(tx: Tx, id: string, actor: Actor) {
  const d = await lockDeposit(tx, id);
  if (d.status !== "RETURNED" || !d.returnVoucherId) throw new AccError("این ودیعه برنگشته است");
  await voidVoucher(tx, d.returnVoucherId, "برگشت ثبت بازگشت ودیعه", actor, { fromSource: true });
  return tx.accDeposit.update({
    where: { id },
    data: { status: "HELD", returnedOn: null, returnedAmount: null, returnTreasuryId: null, shortfallAccountId: null, returnVoucherId: null },
  });
}

export async function voidDeposit(tx: Tx, id: string, reason: string, actor: Actor) {
  const d = await lockDeposit(tx, id);
  if (d.status === "VOID") return d;
  if (d.status === "RETURNED") throw new AccError("اول ثبت بازگشت را برگردانید");
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  if (d.voucherId) await voidVoucher(tx, d.voucherId, reason, actor, { fromSource: true });
  return tx.accDeposit.update({ where: { id }, data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` } });
}

// ── فهرست ──

export async function prepaidOverview(db: Db) {
  const [prepaids, deposits, keys] = await Promise.all([
    db.accPrepaid.findMany({ orderBy: [{ status: "asc" }, { number: "desc" }], take: 300 }),
    db.accDeposit.findMany({ orderBy: [{ status: "asc" }, { number: "desc" }], take: 300 }),
    db.accAccount.findMany({ where: { systemKey: { in: [PREPAID_KEY, DEPOSITS_KEY] } }, select: { id: true, name: true, systemKey: true } }),
  ]);
  const accIds = [...new Set(prepaids.map((p) => p.expenseAccountId))];
  const names = new Map((await db.accAccount.findMany({ where: { id: { in: accIds } }, select: { id: true, name: true } })).map((a) => [a.id, a.name]));
  const vIds = [...prepaids.map((p) => p.voucherId), ...deposits.flatMap((d) => [d.voucherId, d.returnVoucherId])].filter((x): x is string => !!x);
  const vnum = new Map((await db.accVoucher.findMany({ where: { id: { in: vIds } }, select: { id: true, number: true } })).map((v) => [v.id, v.number]));
  const acc = (k: string) => keys.find((a) => a.systemKey === k) ?? null;
  const book = async (k: string) => {
    const a = acc(k);
    return a ? (await balanceOf(db, { accountId: a.id })).balance : null;
  };
  return {
    prepaids: prepaids.map((p) => ({
      ...p,
      expenseAccount: names.get(p.expenseAccountId) ?? "—",
      remaining: p.status === "VOID" ? 0n : p.amount - p.recognized,
      voucherNumber: p.voucherId ? vnum.get(p.voucherId) ?? null : null,
    })),
    deposits: deposits.map((d) => ({
      ...d,
      voucherNumber: d.voucherId ? vnum.get(d.voucherId) ?? null : null,
      returnVoucherNumber: d.returnVoucherId ? vnum.get(d.returnVoucherId) ?? null : null,
    })),
    ledgerAccounts: { prepaid: acc(PREPAID_KEY), deposits: acc(DEPOSITS_KEY) },
    book: { prepaid: await book(PREPAID_KEY), deposits: await book(DEPOSITS_KEY) },
    prepaidTotals: {
      prepaid: prepaids.filter((p) => p.status === "ACTIVE").reduce((s, p) => s + p.amount - p.recognized, 0n),
      deposits: deposits.filter((d) => d.status === "HELD").reduce((s, d) => s + d.amount, 0n),
    },
  };
}
