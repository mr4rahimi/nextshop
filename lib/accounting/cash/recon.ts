/**
 * تطبیق حساب بانک — docs/plans/webhesab-parity.md بخش ۲۰.
 *
 * مانده‌ی آغاز + جمع ردیف‌های دفترِ تیک‌خورده باید با مانده‌ی پایان صورت‌حساب
 * برابر شود. تطبیق هیچ سندی را عوض نمی‌کند؛ فقط می‌گوید کدام ردیف در بانک دیده شد.
 *
 * ⚠️ ردیفی که سندش بعداً باطل یا بازسازی شود «کهنه» است: در تطبیق باز شمرده نمی‌شود
 *    و با هر نوشتن پاک می‌شود؛ در تطبیق بسته با عدد کپی‌شده می‌ماند و هشدار می‌گیرد.
 */

import type { AccBankRecon, AccVoucher, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { faNum, formatAmount, toLatinDigits } from "../money";
import { NOT_CARRY } from "../ledger/balances";
import { postVoucher, type Actor } from "../ledger/post";
import { TREASURY_ACCOUNT_KEY } from "../treasury";
import { dayOf } from "./batch";
import { autoMatch, parseBankAmount, rialToToman } from "./recon-calc";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const MAX_LINES = 3000;
const MAX_ROWS = 3000;

const STALE: Prisma.AccBankReconItemWhereInput = { OR: [{ voucherLineId: null }, { line: { isVoid: true } }] };

async function lockRecon(tx: Tx, id: string): Promise<AccBankRecon> {
  await tx.$queryRaw`SELECT id FROM "AccBankRecon" WHERE id = ${id} FOR UPDATE`;
  const r = await tx.accBankRecon.findUnique({ where: { id } });
  if (!r) throw new AccError("تطبیق پیدا نشد", 404);
  return r;
}

async function lockOpen(tx: Tx, id: string): Promise<AccBankRecon> {
  const r = await lockRecon(tx, id);
  if (r.status !== "OPEN") throw new AccError("این تطبیق بسته شده است؛ اول بازش کنید", 409);
  await tx.accBankReconItem.deleteMany({ where: { reconId: id, ...STALE } });
  return r;
}

const previousClosed = (db: Db, treasuryId: string, exceptId?: string) =>
  db.accBankRecon.findFirst({
    where: { treasuryId, status: "CLOSED", ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: [{ statementDate: "desc" }, { closedAt: "desc" }],
  });

export interface ReconCreateInput {
  treasuryId: string;
  statementDate: Date;
  fromDate: Date | null;
  openingBalance: bigint;
  closingBalance: bigint;
}

export async function createRecon(tx: Tx, input: ReconCreateInput, actor: Actor): Promise<AccBankRecon> {
  if (!input.treasuryId) throw new AccError("حساب بانکی را انتخاب کنید");
  await tx.$queryRaw`SELECT id FROM "AccTreasury" WHERE id = ${input.treasuryId} FOR UPDATE`;
  const t = await tx.accTreasury.findUnique({ where: { id: input.treasuryId } });
  if (!t) throw new AccError("حساب بانکی پیدا نشد", 404);
  if (t.kind === "CASH") throw new AccError("صندوق نقدی صورت‌حساب بانکی ندارد");
  if (await tx.accBankRecon.findFirst({ where: { treasuryId: t.id, status: "OPEN" }, select: { id: true } })) {
    throw new AccError("برای این حساب یک تطبیق باز هست؛ اول همان را ببندید یا حذف کنید", 409);
  }

  const prev = await previousClosed(tx, t.id);
  let fromDate = input.fromDate;
  let openingBalance = input.openingBalance;
  if (prev) {
    if (input.statementDate.getTime() < prev.statementDate.getTime()) throw new AccError("تاریخ صورت‌حساب نباید پیش از آخرین تطبیق بسته باشد");
    fromDate = prev.fromDate;
    openingBalance = prev.closingBalance;
  } else if (!fromDate) {
    throw new AccError("تاریخ شروع تطبیق را انتخاب کنید");
  }
  if (fromDate!.getTime() > input.statementDate.getTime()) throw new AccError("تاریخ شروع نباید بعد از تاریخ صورت‌حساب باشد");

  return tx.accBankRecon.create({
    data: {
      treasuryId: t.id,
      fromDate: fromDate!,
      statementDate: input.statementDate,
      openingBalance,
      closingBalance: input.closingBalance,
      createdById: actor.id ?? null,
      createdByName: actor.name,
    },
  });
}

export interface ReconUpdateInput {
  statementDate?: Date;
  fromDate?: Date;
  openingBalance?: bigint;
  closingBalance?: bigint;
  note?: string | null;
}

export async function updateRecon(tx: Tx, id: string, input: ReconUpdateInput): Promise<void> {
  const r = await lockOpen(tx, id);
  const prev = await previousClosed(tx, r.treasuryId, id);
  if (prev && (input.fromDate || input.openingBalance !== undefined)) {
    const sameFrom = !input.fromDate || input.fromDate.getTime() === r.fromDate.getTime();
    const sameOpening = input.openingBalance === undefined || input.openingBalance === r.openingBalance;
    if (!sameFrom || !sameOpening) throw new AccError("مانده‌ی آغاز و تاریخ شروع از تطبیق قبلی می‌آیند و عوض نمی‌شوند", 409);
  }
  const statementDate = input.statementDate ?? r.statementDate;
  const fromDate = input.fromDate ?? r.fromDate;
  if (fromDate.getTime() > statementDate.getTime()) throw new AccError("تاریخ شروع نباید بعد از تاریخ صورت‌حساب باشد");
  if (prev && statementDate.getTime() < prev.statementDate.getTime()) throw new AccError("تاریخ صورت‌حساب نباید پیش از آخرین تطبیق بسته باشد");
  const outside = await tx.accBankReconItem.count({ where: { reconId: id, OR: [{ date: { lt: fromDate } }, { date: { gt: statementDate } }] } });
  if (outside) throw new AccError(`${faNum(outside)} ردیف تیک‌خورده بیرون از این بازه می‌افتد؛ اول تیکشان را بردارید`, 409);

  await tx.accBankRecon.update({
    where: { id },
    data: {
      statementDate,
      fromDate,
      openingBalance: input.openingBalance ?? r.openingBalance,
      closingBalance: input.closingBalance ?? r.closingBalance,
      ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
    },
  });
}

const openWhere = (r: AccBankRecon): Prisma.AccVoucherLineWhereInput => ({
  treasuryId: r.treasuryId,
  isVoid: false,
  date: { gte: r.fromDate, lte: r.statementDate },
  reconItem: { is: null },
  AND: [NOT_CARRY],
});

const lineText = (l: { description: string | null; voucher: { description: string } }) => l.description || l.voucher.description;

export async function tickLines(tx: Tx, id: string, lineIds: string[], rowId: string | null): Promise<number> {
  const r = await lockOpen(tx, id);
  const ids = [...new Set(lineIds)];
  if (!ids.length) throw new AccError("ردیفی انتخاب نشده");
  if (rowId && !(await tx.accBankStatementRow.findFirst({ where: { id: rowId, reconId: id }, select: { id: true } }))) throw new AccError("ردیف صورت‌حساب پیدا نشد", 404);
  const lines = await tx.accVoucherLine.findMany({ where: { id: { in: ids }, ...openWhere(r) }, include: { voucher: { select: { id: true, number: true, description: true } } } });
  if (lines.length !== ids.length) throw new AccError("بعضی ردیف‌ها دیگر قابل تطبیق نیستند؛ صفحه را تازه کنید", 409);
  await tx.accBankReconItem.createMany({
    data: lines.map((l) => ({
      reconId: id,
      voucherLineId: l.id,
      statementRowId: rowId,
      amount: l.debit - l.credit,
      date: l.date,
      description: lineText(l),
      voucherId: l.voucher.id,
      voucherNumber: l.voucher.number,
    })),
  });
  return lines.length;
}

export async function untickLines(tx: Tx, id: string, lineIds: string[]): Promise<number> {
  await lockOpen(tx, id);
  const res = await tx.accBankReconItem.deleteMany({ where: { reconId: id, voucherLineId: { in: lineIds } } });
  return res.count;
}

export async function autoMatchRecon(tx: Tx, id: string, days: number): Promise<number> {
  const r = await lockOpen(tx, id);
  if (!Number.isInteger(days) || days < 0 || days > 30) throw new AccError("فاصله‌ی تاریخ باید بین ۰ تا ۳۰ روز باشد");
  const rows = await tx.accBankStatementRow.findMany({ where: { reconId: id, items: { none: {} } } });
  if (!rows.length) return 0;
  const lines = await tx.accVoucherLine.findMany({ where: openWhere(r), include: { voucher: { select: { id: true, number: true, description: true } } } });
  const byId = new Map(lines.map((l) => [l.id, l]));
  const pairs = autoMatch(rows, lines.map((l) => ({ id: l.id, amount: l.debit - l.credit, date: l.date, text: `${l.description ?? ""} ${l.voucher.description}` })), days);
  if (pairs.length) {
    await tx.accBankReconItem.createMany({
      data: pairs.map((p) => {
        const l = byId.get(p.lineId)!;
        return { reconId: id, voucherLineId: l.id, statementRowId: p.rowId, amount: l.debit - l.credit, date: l.date, description: lineText(l), voucherId: l.voucher.id, voucherNumber: l.voucher.number };
      }),
    });
  }
  return pairs.length;
}

/** تاریخ صورت‌حساب: شمسی یا میلادی، با ساعت، یا چسبیده (۱۴۰۵۰۸۰۱) و سال دو رقمی */
export function statementDay(raw: unknown): Date | null {
  let s = toLatinDigits(String(raw ?? "")).trim().split(/[\sT]+/)[0] ?? "";
  if (/^\d{8}$/.test(s)) s = `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6)}`;
  if (/^\d{2}[/\-.]\d{1,2}[/\-.]\d{1,2}$/.test(s)) s = `14${s}`;
  const d = dayOf(s);
  return d instanceof Date ? d : null;
}

export interface StatementRowInput {
  date?: unknown;
  description?: unknown;
  refNo?: unknown;
  deposit?: unknown;
  withdrawal?: unknown;
  amount?: unknown;
  balance?: unknown;
}

export interface StatementInput {
  rows?: StatementRowInput[];
  unit?: string;
}

/** ردیف‌های صورت‌حساب را جایگزین می‌کند؛ تیک‌ها می‌مانند ولی پیوندشان به ردیف قبلی می‌رود */
export async function importStatement(tx: Tx, id: string, input: StatementInput): Promise<{ count: number; lastBalance: bigint | null; closingSet: boolean }> {
  const r = await lockOpen(tx, id);
  if (!Array.isArray(input.rows) || !input.rows.length) throw new AccError("ردیفی برای ورود نیست");
  if (input.rows.length > MAX_ROWS) throw new AccError(`حداکثر ${faNum(MAX_ROWS)} ردیف در هر صورت‌حساب`);
  const conv = input.unit === "TOMAN" ? (v: bigint) => v : rialToToman;

  const errors: string[] = [];
  const parsed: { date: Date; description: string | null; refNo: string | null; amount: bigint; balance: bigint | null }[] = [];
  input.rows.forEach((row, i) => {
    const at = `ردیف ${faNum(i + 1)}`;
    const date = statementDay(row.date);
    const amountRaw = parseBankAmount(row.amount);
    const dep = parseBankAmount(row.deposit);
    const wd = parseBankAmount(row.withdrawal);
    const bal = String(row.balance ?? "").trim() ? parseBankAmount(row.balance) : null;
    if (!date) return void errors.push(`${at}: تاریخ «${String(row.date ?? "")}» خوانده نشد`);
    if (amountRaw === null || dep === null || wd === null) return void errors.push(`${at}: مبلغ خوانده نشد`);
    // برداشت گاهی با علامت منفی می‌آید
    const signed = amountRaw !== 0n ? amountRaw : (dep < 0n ? -dep : dep) - (wd < 0n ? -wd : wd);
    if (signed === 0n) return; // ردیف‌های جمع و سرستون تکراری
    parsed.push({
      date,
      description: String(row.description ?? "").trim() || null,
      refNo: toLatinDigits(String(row.refNo ?? "")).trim() || null,
      amount: conv(signed),
      balance: bal === null ? null : conv(bal),
    });
  });
  if (errors.length) throw new AccError(`${errors.slice(0, 5).join("؛ ")}${errors.length > 5 ? ` و ${faNum(errors.length - 5)} خطای دیگر` : ""}`);
  if (!parsed.length) throw new AccError("هیچ ردیف مبلغ‌داری پیدا نشد");
  // بعضی بانک‌ها تازه‌ترین را اول می‌دهند
  if (parsed[0].date.getTime() > parsed[parsed.length - 1].date.getTime()) parsed.reverse();

  await tx.accBankStatementRow.deleteMany({ where: { reconId: id } });
  await tx.accBankStatementRow.createMany({ data: parsed.map((p, i) => ({ ...p, reconId: id, seq: i + 1 })) });

  const lastBalance = parsed[parsed.length - 1].balance;
  const closingSet = r.closingBalance === 0n && lastBalance !== null;
  if (closingSet) await tx.accBankRecon.update({ where: { id }, data: { closingBalance: lastBalance! } });
  return { count: parsed.length, lastBalance, closingSet };
}

/** برداشتی که در دفتر نیست و کارمزد است: سند می‌خورد و همان‌جا تیک می‌خورد */
export async function postBankFee(tx: Tx, id: string, rowId: string, actor: Actor): Promise<AccVoucher> {
  const r = await lockOpen(tx, id);
  const row = await tx.accBankStatementRow.findFirst({ where: { id: rowId, reconId: id }, include: { items: { select: { id: true } } } });
  if (!row) throw new AccError("ردیف صورت‌حساب پیدا نشد", 404);
  if (row.items.length) throw new AccError("این ردیف قبلاً جفت شده است", 409);
  if (row.amount >= 0n) throw new AccError("فقط برداشت می‌تواند کارمزد باشد");
  if (row.date.getTime() > r.statementDate.getTime() || row.date.getTime() < r.fromDate.getTime()) throw new AccError("تاریخ این ردیف بیرون از بازه‌ی تطبیق است");
  const t = await tx.accTreasury.findUnique({ where: { id: r.treasuryId } });
  const amount = -row.amount;
  const description = row.description ? `کارمزد بانکی — ${row.description}` : "کارمزد بانکی";
  const v = await postVoucher(tx, {
    date: row.date,
    description,
    source: "MANUAL",
    sourceId: `recon:${id}`,
    lines: [
      { accountKey: "BANK_FEE", debit: amount },
      { accountKey: TREASURY_ACCOUNT_KEY[t!.kind], treasuryId: t!.id, credit: amount },
    ],
    actor,
  });
  const line = await tx.accVoucherLine.findFirstOrThrow({ where: { voucherId: v.id, treasuryId: t!.id } });
  await tx.accBankReconItem.create({
    data: { reconId: id, voucherLineId: line.id, statementRowId: row.id, amount: -amount, date: row.date, description, voucherId: v.id, voucherNumber: v.number },
  });
  return v;
}

async function ticked(db: Db, reconId: string): Promise<bigint> {
  const s = await db.accBankReconItem.aggregate({ where: { reconId, NOT: STALE }, _sum: { amount: true } });
  return s._sum.amount ?? 0n;
}

export async function closeRecon(tx: Tx, id: string, actor: Actor): Promise<void> {
  const r = await lockOpen(tx, id);
  const diff = r.closingBalance - (r.openingBalance + (await ticked(tx, id)));
  if (diff !== 0n) throw new AccError(`هنوز ${formatAmount(diff < 0n ? -diff : diff)} اختلاف هست؛ تطبیق با اختلاف صفر بسته می‌شود`, 409);
  await tx.accBankRecon.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date(), closedByName: actor.name } });
}

export async function reopenRecon(tx: Tx, id: string): Promise<void> {
  const r = await lockRecon(tx, id);
  if (r.status !== "CLOSED") throw new AccError("این تطبیق باز است", 409);
  const last = await previousClosed(tx, r.treasuryId);
  if (last?.id !== id) throw new AccError("فقط آخرین تطبیق بسته دوباره باز می‌شود", 409);
  if (await tx.accBankRecon.findFirst({ where: { treasuryId: r.treasuryId, status: "OPEN" }, select: { id: true } })) throw new AccError("برای این حساب تطبیق باز دیگری هست", 409);
  await tx.accBankRecon.update({ where: { id }, data: { status: "OPEN", closedAt: null, closedByName: null } });
}

export async function deleteRecon(tx: Tx, id: string): Promise<void> {
  const r = await lockRecon(tx, id);
  if (r.status !== "OPEN") throw new AccError("تطبیق بسته حذف نمی‌شود؛ اول بازش کنید", 409);
  await tx.accBankRecon.delete({ where: { id } });
}

export async function loadRecon(db: Db, id: string) {
  const recon = await db.accBankRecon.findUnique({ where: { id }, include: { treasury: { select: { id: true, name: true, kind: true, bankName: true } } } });
  if (!recon) throw new AccError("تطبیق پیدا نشد", 404);
  const open = recon.status === "OPEN";

  const [items, rows, candidates, prev, ledger] = await Promise.all([
    db.accBankReconItem.findMany({ where: { reconId: id }, orderBy: [{ date: "asc" }, { voucherNumber: "asc" }], include: { line: { select: { isVoid: true } } } }),
    db.accBankStatementRow.findMany({ where: { reconId: id }, orderBy: { seq: "asc" }, include: { items: { select: { amount: true, voucherLineId: true } } } }),
    open
      ? db.accVoucherLine.findMany({
          where: openWhere(recon),
          orderBy: [{ date: "asc" }, { voucher: { number: "asc" } }],
          take: MAX_LINES + 1,
          include: { voucher: { select: { id: true, number: true, description: true, source: true } } },
        })
      : Promise.resolve([]),
    previousClosed(db, recon.treasuryId, id),
    db.accVoucherLine.aggregate({ where: { treasuryId: recon.treasuryId, isVoid: false, date: { lte: recon.statementDate }, AND: [NOT_CARRY] }, _sum: { debit: true, credit: true } }),
  ]);

  const isStale = (i: (typeof items)[number]) => !i.line || i.line.isVoid;
  const live = items.filter((i) => !isStale(i));
  const stale = items.filter(isStale);
  // تطبیق بسته با عددهای همان روز می‌ماند
  const counted = open ? live : items;
  const sum = (xs: { amount: bigint }[]) => xs.reduce((s, x) => s + x.amount, 0n);
  const tickedTotal = sum(counted);
  const deposits = sum(counted.filter((i) => i.amount > 0n));
  const withdrawals = -sum(counted.filter((i) => i.amount < 0n));

  const shown = candidates.slice(0, MAX_LINES);
  const openDeposits = shown.reduce((s, l) => s + l.debit, 0n);
  const openWithdrawals = shown.reduce((s, l) => s + l.credit, 0n);
  const ledgerBalance = (ledger._sum.debit ?? 0n) - (ledger._sum.credit ?? 0n);

  return {
    recon,
    lockedOpening: !!prev,
    lines: [
      ...counted.map((i) => ({
        id: i.voucherLineId ?? i.id,
        date: i.date,
        amount: i.amount,
        description: i.description,
        voucherId: i.voucherId,
        voucherNumber: i.voucherNumber,
        ticked: true,
        rowId: i.statementRowId,
        stale: isStale(i),
      })),
      ...shown.map((l) => ({
        id: l.id,
        date: l.date,
        amount: l.debit - l.credit,
        description: lineText(l),
        voucherId: l.voucher.id,
        voucherNumber: l.voucher.number,
        ticked: false,
        rowId: null,
        stale: false,
      })),
    ],
    stale: stale.map((i) => ({ id: i.id, date: i.date, amount: i.amount, description: i.description, voucherId: i.voucherId, voucherNumber: i.voucherNumber })),
    rows: rows.map((r) => ({
      id: r.id,
      seq: r.seq,
      date: r.date,
      description: r.description,
      refNo: r.refNo,
      amount: r.amount,
      balance: r.balance,
      matched: r.items.reduce((s, i) => s + i.amount, 0n),
      matchedCount: r.items.length,
    })),
    truncated: candidates.length > MAX_LINES,
    summary: {
      openingBalance: recon.openingBalance,
      deposits,
      withdrawals,
      reconciled: recon.openingBalance + tickedTotal,
      closingBalance: recon.closingBalance,
      difference: recon.closingBalance - (recon.openingBalance + tickedTotal),
      ledgerBalance,
      openDeposits,
      openWithdrawals,
      expectedBank: ledgerBalance - openDeposits + openWithdrawals,
    },
  };
}

export async function reconHub(db: Db) {
  const [treasuries, recons, staleGroups, balances] = await Promise.all([
    db.accTreasury.findMany({ where: { kind: { not: "CASH" }, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, kind: true, bankName: true } }),
    db.accBankRecon.findMany({ orderBy: [{ statementDate: "desc" }, { createdAt: "desc" }], take: 200, include: { treasury: { select: { id: true, name: true } } } }),
    db.accBankReconItem.findMany({ where: { recon: { status: "CLOSED" }, ...STALE }, select: { reconId: true } }),
    db.accVoucherLine.groupBy({ by: ["treasuryId"], where: { treasuryId: { not: null }, isVoid: false, AND: [NOT_CARRY] }, _sum: { debit: true, credit: true } }),
  ]);
  const staleBy = new Map<string, number>();
  for (const s of staleGroups) staleBy.set(s.reconId, (staleBy.get(s.reconId) ?? 0) + 1);
  const balance = new Map(balances.map((b) => [b.treasuryId!, (b._sum.debit ?? 0n) - (b._sum.credit ?? 0n)]));
  return {
    treasuries: treasuries.map((t) => {
      const mine = recons.filter((r) => r.treasuryId === t.id);
      const lastClosed = mine.find((r) => r.status === "CLOSED") ?? null;
      const open = mine.find((r) => r.status === "OPEN") ?? null;
      return { ...t, balance: balance.get(t.id) ?? 0n, lastClosed: lastClosed && { id: lastClosed.id, statementDate: lastClosed.statementDate, closingBalance: lastClosed.closingBalance, fromDate: lastClosed.fromDate }, openId: open?.id ?? null };
    }),
    recons: recons.map((r) => ({ id: r.id, status: r.status, statementDate: r.statementDate, closingBalance: r.closingBalance, closedByName: r.closedByName, treasury: r.treasury, stale: staleBy.get(r.id) ?? 0 })),
  };
}
