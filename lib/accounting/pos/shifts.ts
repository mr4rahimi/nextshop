/**
 * شیفت صندوق: باز کردن با شمردن پول خرد، خلاصه‌ی زنده، و «بستن صندوق»
 * (در وب حساب «صفر کردن صندوق») — docs/plans/inventory-items.md بخش ۱۳.
 *
 * نقد مورد انتظار = مانده‌ی **دفتری** صندوق نقد همین پیشخوان، نه جمع رسیدها؛ پس
 * هزینه‌ای که از همین صندوق پرداخت شده هم حساب می‌شود. بستن:
 *   ۱. مغایرت (شمرده − دفتری) ← سند `POS`: کسری بدهکار «کسری و اضافه‌ی صندوق»،
 *      اضافه بستانکار آن؛ طرف دیگر خود صندوق
 *   ۲. شمرده − پول خرد ماندنی ← «انتقال وجه» به صندوق/بانک اصلی
 * بعد از بستن، مانده‌ی دفتری صندوق = پول خرد ماندنی = پیش‌فرض باز کردن شیفت بعد.
 */

import type { AccPosShift, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { postVoucher, type Actor } from "../ledger/post";
import { createMoneyDoc } from "../cash/docs";
import { createAccount } from "../ledger/accounts";
import { TREASURY_ACCOUNT_KEY } from "../treasury";
import { todayKey } from "../dates";
import { faNum, formatAmount } from "../money";
import { treasuryBook } from "./setup";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export async function openShift(tx: Tx, terminalId: string, openingFloat: bigint, actor: Actor): Promise<AccPosShift> {
  const terminal = await tx.accPosTerminal.findUnique({ where: { id: terminalId } });
  if (!terminal || !terminal.isActive) throw new AccError("صندوق پیدا نشد یا غیرفعال است", 404);
  // قفل ردیف صندوق تا دو «باز کردن» هم‌زمان دو شیفت باز نسازند
  await tx.$queryRaw`SELECT id FROM "AccPosTerminal" WHERE id = ${terminal.id} FOR UPDATE`;
  const open = await tx.accPosShift.findFirst({ where: { terminalId, status: "OPEN" } });
  if (open) throw new AccError(`شیفت ${faNum(open.number)} این صندوق هنوز باز است`, 409);
  if (openingFloat < 0n) throw new AccError("پول خرد منفی نمی‌شود");
  const last = await tx.accPosShift.aggregate({ where: { terminalId }, _max: { number: true } });
  return tx.accPosShift.create({
    data: {
      terminalId,
      number: (last._max.number ?? 0) + 1,
      openedById: actor.id ?? null,
      openedByName: actor.name,
      openingFloat,
      openingBook: await treasuryBook(tx, terminal.cashTreasuryId),
    },
  });
}

export interface ShiftSummary {
  shift: AccPosShift & { terminal: { id: string; name: string; cashTreasuryId: string; cardTreasuryId: string | null } };
  counts: { sale: number; ret: number; exchange: number; tickets: number };
  saleTotal: bigint;
  returnTotal: bigint;
  net: bigint;
  discount: bigint;
  saleQty: number;
  returnQty: number;
  cashIn: bigint;
  cashOut: bigint;
  cardIn: bigint;
  cardOut: bigint;
  credit: bigint;
  /** گردش‌های دیگر صندوق نقد در این شیفت (هزینه، انتقال، …) */
  otherCash: bigint;
  expectedCash: bigint;
  expectedCard: bigint;
  sellers: { sellerId: string | null; name: string; tickets: number; saleTotal: bigint; returnTotal: bigint; net: bigint; qty: number }[];
}

export async function shiftSummary(db: Db, shiftId: string): Promise<ShiftSummary> {
  const shift = await db.accPosShift.findUnique({
    where: { id: shiftId },
    include: { terminal: { select: { id: true, name: true, cashTreasuryId: true, cardTreasuryId: true } } },
  });
  if (!shift) throw new AccError("شیفت پیدا نشد", 404);
  const tickets = await db.accPosTicket.findMany({ where: { shiftId } });
  const sum = (f: (t: (typeof tickets)[number]) => bigint) => tickets.reduce((s, t) => s + f(t), 0n);
  const cashIn = sum((t) => (t.cash > 0n ? t.cash : 0n));
  const cashOut = sum((t) => (t.cash < 0n ? -t.cash : 0n));
  const cardIn = sum((t) => (t.card > 0n ? t.card : 0n));
  const cardOut = sum((t) => (t.card < 0n ? -t.card : 0n));
  const book = shift.status === "OPEN" ? await treasuryBook(db, shift.terminal.cashTreasuryId) : shift.expectedCash ?? 0n;
  const bySeller = new Map<string, ShiftSummary["sellers"][number]>();
  for (const t of tickets) {
    const k = t.sellerId ?? "";
    const row = bySeller.get(k) ?? { sellerId: t.sellerId, name: t.sellerName ?? "بی‌فروشنده", tickets: 0, saleTotal: 0n, returnTotal: 0n, net: 0n, qty: 0 };
    row.tickets++;
    row.saleTotal += t.saleTotal;
    row.returnTotal += t.returnTotal;
    row.net += t.saleTotal - t.returnTotal;
    row.qty += t.saleQty - t.returnQty;
    bySeller.set(k, row);
  }
  const saleTotal = sum((t) => t.saleTotal);
  const returnTotal = sum((t) => t.returnTotal);
  return {
    shift,
    counts: {
      sale: tickets.filter((t) => t.kind === "SALE").length,
      ret: tickets.filter((t) => t.kind === "RETURN").length,
      exchange: tickets.filter((t) => t.kind === "EXCHANGE").length,
      tickets: tickets.length,
    },
    saleTotal,
    returnTotal,
    net: saleTotal - returnTotal,
    discount: sum((t) => t.discount),
    saleQty: tickets.reduce((s, t) => s + t.saleQty, 0),
    returnQty: tickets.reduce((s, t) => s + t.returnQty, 0),
    cashIn,
    cashOut,
    cardIn,
    cardOut,
    credit: sum((t) => t.credit),
    otherCash: book - shift.openingBook - (cashIn - cashOut),
    expectedCash: book,
    expectedCard: shift.status === "OPEN" ? cardIn - cardOut : shift.expectedCard ?? cardIn - cardOut,
    sellers: [...bySeller.values()].sort((a, b) => (b.net > a.net ? 1 : b.net < a.net ? -1 : 0)),
  };
}

export interface CloseInput {
  countedCash: bigint;
  countedCard: bigint | null;
  keepFloat: bigint;
  transferToId: string | null;
  note: string | null;
}

/** حساب «کسری و اضافه‌ی صندوق» — اگر سرفصل قدیمی آن را ندارد، زیر «هزینه‌های اداری» ساخته می‌شود */
async function ensureOverShortAccount(tx: Tx) {
  const hit = await tx.accAccount.findUnique({ where: { systemKey: "CASH_OVER_SHORT" } });
  if (hit) return hit;
  const parent = await tx.accAccount.findFirst({ where: { code: "82" } });
  if (!parent) throw new AccError("سرفصل «هزینه‌های اداری» (۸۲) نیست؛ حساب «کسری و اضافه‌ی صندوق» را دستی بسازید");
  const acc = await createAccount(tx, { parentId: parent.id, name: "کسری و اضافه‌ی صندوق" });
  return tx.accAccount.update({ where: { id: acc.id }, data: { systemKey: "CASH_OVER_SHORT", nature: "BOTH" } });
}

export async function closeShift(tx: Tx, shiftId: string, input: CloseInput, opts: { manage: boolean }, actor: Actor) {
  await tx.$queryRaw`SELECT id FROM "AccPosShift" WHERE id = ${shiftId} FOR UPDATE`;
  const sum = await shiftSummary(tx, shiftId);
  const { shift } = sum;
  if (shift.status !== "OPEN") throw new AccError("این شیفت قبلاً بسته شده", 409);
  const { countedCash, keepFloat } = input;
  if (countedCash < 0n || keepFloat < 0n) throw new AccError("مبلغ منفی نمی‌شود");
  if (keepFloat > countedCash) throw new AccError("پول خرد ماندنی از پول شمرده‌شده بیشتر است");
  const diff = countedCash - sum.expectedCash;
  if (diff !== 0n && !opts.manage) {
    throw new AccError(`صندوق ${formatAmount(diff < 0n ? -diff : diff)} تومان ${diff < 0n ? "کسری" : "اضافه"} دارد؛ دوباره بشمارید یا مدیر صندوق را ببندد`, 403);
  }
  const transfer = countedCash - keepFloat;
  const date = todayKey();
  const cash = await tx.accTreasury.findUniqueOrThrow({ where: { id: shift.terminal.cashTreasuryId } });
  const title = `${shift.terminal.name} — بستن شیفت ${faNum(shift.number)}`;

  let diffVoucherId: string | null = null;
  if (diff !== 0n) {
    const acc = await ensureOverShortAccount(tx);
    const amt = diff < 0n ? -diff : diff;
    const cashLine = { accountKey: TREASURY_ACCOUNT_KEY[cash.kind], treasuryId: cash.id, description: diff < 0n ? "کسری صندوق" : "اضافه‌ی صندوق" };
    const v = await postVoucher(tx, {
      date,
      description: `${title} — ${diff < 0n ? "کسری" : "اضافه"}ی صندوق`,
      source: "POS",
      sourceId: shift.id,
      lines:
        diff < 0n
          ? [{ accountId: acc.id, debit: amt, description: "کسری صندوق" }, { ...cashLine, credit: amt }]
          : [{ ...cashLine, debit: amt }, { accountId: acc.id, credit: amt, description: "اضافه‌ی صندوق" }],
      actor,
    });
    diffVoucherId = v.id;
  }

  let transferDocId: string | null = null;
  if (transfer > 0n) {
    if (!input.transferToId) throw new AccError("پول به کدام صندوق یا بانک منتقل شود؟");
    const doc = await createMoneyDoc(
      tx,
      { kind: "TRANSFER", date, description: title, items: [{ method: "CASH", treasuryId: cash.id, toTreasuryId: input.transferToId, amount: transfer }] },
      actor,
    );
    transferDocId = doc.id;
  }

  return tx.accPosShift.update({
    where: { id: shift.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: actor.id ?? null,
      closedByName: actor.name,
      expectedCash: sum.expectedCash,
      countedCash,
      cashDiff: diff,
      expectedCard: sum.expectedCard,
      countedCard: input.countedCard,
      keptFloat: keepFloat,
      transferred: transfer > 0n ? transfer : 0n,
      transferToId: transfer > 0n ? input.transferToId : null,
      transferDocId,
      diffVoucherId,
      note: input.note?.trim() || null,
    },
  });
}
