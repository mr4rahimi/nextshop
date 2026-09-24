/**
 * دریافت، پرداخت، انتقال وجه — docs/plans/accounting.md بخش ۵، ۶.۷ و ۹.۱.
 *
 * یک فرم، چند روش: «بخشی نقد، بخشی کارت‌به‌کارت، بخشی چک». هر سند:
 *   دریافت:  بدهکار صندوق/بانک/کارتخوان/درگاه یا اسناد دریافتنی (چک)  —  بستانکار طلب از شخص
 *   پرداخت:  بدهکار بدهی به شخص  —  بستانکار صندوق/بانک، اسناد پرداختنی (چک ما)
 *            یا اسناد دریافتنی صاحب چک (خرج چک دریافتی)
 *   انتقال:  بدهکار مقصد + کارمزد بانکی  —  بستانکار مبدأ
 *
 * تخصیص به فاکتورها اختیاری است؛ مازاد روی شخص می‌ماند (پیش‌دریافت/پیش‌پرداخت).
 *
 * ⚠️ ویرایش ندارد — ابطال و ثبت دوباره. ابطال چک‌های ساخته‌شده را حذف و چک
 *    خرج‌شده را به «نزد ما» برمی‌گرداند، به شرط اینکه گذار دیگری نخورده باشند.
 */

import type { AccMoneyDoc, AccMoneyKind, AccMoneyMethod, AccTreasury, AccTreasuryKind, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { assertPostable } from "../ledger/fiscal-year";
import { postVoucher, voidVoucher, type Actor, type LineInput } from "../ledger/post";
import { nextNumber } from "../ledger/sequence";
import { faNum, formatAmount } from "../money";
import { formatJalali } from "@/lib/club/jalali";
import { TREASURY_ACCOUNT_KEY } from "../treasury";
import { autoAllocate, invoiceOpenAmounts, openInvoicesOf, recalcPaid } from "./allocation";
import { chequeStatusLabel, createCheque, endorseCheque, type NewChequeInput } from "./cheques";

type Tx = Prisma.TransactionClient;

export const MONEY_KIND_LABELS: Record<AccMoneyKind, string> = {
  RECEIPT: "دریافت",
  PAYMENT: "پرداخت",
  TRANSFER: "انتقال وجه",
};

export const METHOD_LABELS: Record<AccMoneyMethod, string> = {
  CASH: "نقد",
  CARD_TRANSFER: "کارت‌به‌کارت",
  BANK_TRANSFER: "واریز بانکی",
  POS: "کارتخوان",
  GATEWAY: "درگاه اینترنتی",
  CHEQUE: "چک",
};

/** هر روش روی کدام نوع خزانه می‌نشیند */
const METHOD_TREASURY: Record<Exclude<AccMoneyMethod, "CHEQUE">, AccTreasuryKind[]> = {
  CASH: ["CASH"],
  CARD_TRANSFER: ["BANK"],
  BANK_TRANSFER: ["BANK"],
  POS: ["POS", "BANK"],
  GATEWAY: ["GATEWAY", "BANK"],
};

export interface MoneyItemInput {
  method: AccMoneyMethod;
  treasuryId?: string | null;
  toTreasuryId?: string | null;
  amount: bigint;
  fee?: bigint;
  trackingCode?: string | null;
  /** چک تازه — دریافت: چک مشتری؛ پرداخت: چک ما (`treasuryId` = حساب چک) */
  cheque?: NewChequeInput | null;
  /** پرداخت: خرج یک چک دریافتیِ نزد ما */
  endorseChequeId?: string | null;
}

export interface MoneyDocInput {
  kind: AccMoneyKind;
  date: Date;
  partyId?: string | null;
  description?: string | null;
  items: MoneyItemInput[];
  /** تخصیص دستی؛ `"auto"` = از قدیمی‌ترین فاکتور باز؛ خالی = بی‌تخصیص */
  allocations?: { invoiceId: string; amount: bigint }[] | "auto";
  paymentId?: string | null;
  sourceKey?: string | null;
}

export async function createMoneyDoc(tx: Tx, input: MoneyDocInput, actor: Actor): Promise<AccMoneyDoc> {
  const year = await assertPostable(tx, input.date);
  const kind = input.kind;
  if (!input.items.length) throw new AccError("دست‌کم یک روش و مبلغ لازم است");

  const party = input.partyId ? await tx.accParty.findUnique({ where: { id: input.partyId } }) : null;
  if (kind !== "TRANSFER") {
    if (!party) throw new AccError(kind === "RECEIPT" ? "از چه کسی دریافت شد؟" : "به چه کسی پرداخت شد؟");
    if (!party.isActive) throw new AccError(`«${party.name}» غیرفعال است`);
  }

  const treasuryIds = [...new Set(input.items.flatMap((i) => [i.treasuryId, i.toTreasuryId]).filter((x): x is string => !!x))];
  const treasuries = new Map((await tx.accTreasury.findMany({ where: { id: { in: treasuryIds } } })).map((t) => [t.id, t]));
  const tr = (id: string | null | undefined, at: string): AccTreasury => {
    const t = id ? treasuries.get(id) : null;
    if (!t) throw new AccError(`${at}: صندوق یا بانک را انتخاب کنید`);
    if (!t.isActive) throw new AccError(`${at}: «${t.name}» غیرفعال است`);
    return t;
  };

  // ── اعتبارسنجی ردیف‌ها ──
  input.items.forEach((it, i) => {
    const at = `ردیف ${faNum(i + 1)}`;
    if (it.amount <= 0n) throw new AccError(`${at}: مبلغ باید بیشتر از صفر باشد`);
    if ((it.fee ?? 0n) < 0n) throw new AccError(`${at}: کارمزد منفی نمی‌شود`);
    if (kind === "TRANSFER") {
      const from = tr(it.treasuryId, at);
      const to = tr(it.toTreasuryId, at);
      if (from.id === to.id) throw new AccError("مبدأ و مقصد یکی‌اند");
      return;
    }
    if (it.fee) throw new AccError(`${at}: کارمزد فقط در انتقال وجه است`);
    if (it.method === "CHEQUE") {
      if (kind === "RECEIPT" && !it.cheque) throw new AccError(`${at}: مشخصات چک را وارد کنید`);
      if (kind === "PAYMENT" && !it.cheque && !it.endorseChequeId) throw new AccError(`${at}: چک تازه صادر کنید یا یک چک دریافتی را خرج کنید`);
      if (kind === "PAYMENT" && it.cheque) {
        const bank = tr(it.treasuryId, at);
        if (bank.kind !== "BANK") throw new AccError(`${at}: چک از حساب بانکی صادر می‌شود`);
      }
      return;
    }
    const t = tr(it.treasuryId, at);
    const ok = METHOD_TREASURY[it.method];
    if (!ok.includes(t.kind)) throw new AccError(`${at}: «${METHOD_LABELS[it.method]}» روی «${t.name}» نمی‌نشیند`);
  });
  if (kind === "TRANSFER" && input.items.length !== 1) throw new AccError("انتقال وجه یک ردیف دارد");

  const total = input.items.reduce((s, i) => s + i.amount, 0n);
  const number = await nextNumber(tx, year.id, `money:${kind}`);
  const doc = await tx.accMoneyDoc.create({
    data: {
      kind,
      yearId: year.id,
      number,
      date: input.date,
      partyId: party?.id ?? null,
      total,
      description: input.description?.trim() || null,
      paymentId: input.paymentId ?? null,
      sourceKey: input.sourceKey ?? null,
      createdById: actor.id ?? null,
      createdByName: actor.name,
    },
  });

  // ── چک‌ها و ردیف‌ها ──
  const lines: LineInput[] = [];
  const pName = party?.name ?? "";
  for (const [i, it] of input.items.entries()) {
    let chequeId: string | null = null;
    if (kind === "TRANSFER") {
      const from = tr(it.treasuryId, "");
      const to = tr(it.toTreasuryId, "");
      lines.push({ accountKey: TREASURY_ACCOUNT_KEY[to.kind], treasuryId: to.id, debit: it.amount, description: `انتقال از ${from.name}` });
      if (it.fee) lines.push({ accountKey: "BANK_FEE", debit: it.fee, description: "کارمزد انتقال" });
      lines.push({ accountKey: TREASURY_ACCOUNT_KEY[from.kind], treasuryId: from.id, credit: it.amount + (it.fee ?? 0n), description: `انتقال به ${to.name}` });
    } else if (it.method === "CHEQUE" && it.endorseChequeId) {
      const c = await endorseCheque(tx, it.endorseChequeId, party!.id, doc.id, input.date, actor);
      if (c.amount !== it.amount) throw new AccError(`مبلغ ردیف چک ${faNum(c.serialNo)} باید همان مبلغ چک (${formatAmount(c.amount)}) باشد`);
      chequeId = c.id;
      lines.push({ accountKey: "CHEQUE_RECEIVABLE", partyId: c.partyId, credit: it.amount, description: `خرج چک ${faNum(c.serialNo)} به ${pName}` });
    } else if (it.method === "CHEQUE") {
      const c = await createCheque(
        tx,
        { ...it.cheque!, direction: kind === "RECEIPT" ? "RECEIVED" : "ISSUED", amount: it.amount, partyId: party!.id, treasuryId: it.treasuryId, moneyDocId: doc.id, date: input.date },
        actor,
      );
      chequeId = c.id;
      lines.push(
        kind === "RECEIPT"
          ? { accountKey: "CHEQUE_RECEIVABLE", partyId: party!.id, debit: it.amount, description: `چک ${faNum(c.serialNo)} سررسید ${formatJalali(c.dueDate)}` }
          : { accountKey: "CHEQUE_PAYABLE", partyId: party!.id, credit: it.amount, description: `چک ${faNum(c.serialNo)}` },
      );
    } else {
      const t = tr(it.treasuryId, "");
      const desc = [METHOD_LABELS[it.method], it.trackingCode && `پیگیری ${it.trackingCode}`].filter(Boolean).join(" — ");
      lines.push({ accountKey: TREASURY_ACCOUNT_KEY[t.kind], treasuryId: t.id, [kind === "RECEIPT" ? "debit" : "credit"]: it.amount, description: desc });
    }
    await tx.accMoneyItem.create({
      data: {
        moneyDocId: doc.id,
        seq: i + 1,
        method: kind === "TRANSFER" ? "BANK_TRANSFER" : it.method,
        treasuryId: it.method === "CHEQUE" && kind === "RECEIPT" ? null : it.treasuryId ?? null,
        toTreasuryId: it.toTreasuryId ?? null,
        chequeId,
        amount: it.amount,
        fee: it.fee ?? 0n,
        trackingCode: it.trackingCode?.trim() || null,
      },
    });
  }
  if (kind === "RECEIPT") lines.push({ accountKey: "AR", partyId: party!.id, credit: total, description: "دریافت" });
  if (kind === "PAYMENT") lines.unshift({ accountKey: "AP", partyId: party!.id, debit: total, description: "پرداخت" });

  // ── تخصیص ──
  if (kind !== "TRANSFER" && input.allocations) {
    const side = kind === "RECEIPT" ? "sales" : "purchase";
    const allocs = input.allocations === "auto" ? autoAllocate(total, await openInvoicesOf(tx, party!.id, side)) : input.allocations.filter((a) => a.amount > 0n);
    const sum = allocs.reduce((s, a) => s + a.amount, 0n);
    if (sum > total) throw new AccError(`جمع تخصیص (${formatAmount(sum)}) از مبلغ ${MONEY_KIND_LABELS[kind]} بیشتر است`);
    const open = await invoiceOpenAmounts(tx, allocs.map((a) => a.invoiceId));
    const invs = new Map((await tx.accInvoice.findMany({ where: { id: { in: allocs.map((a) => a.invoiceId) } }, select: { id: true, partyId: true, type: true, number: true } })).map((x) => [x.id, x]));
    for (const a of allocs) {
      const inv = invs.get(a.invoiceId);
      const o = open.get(a.invoiceId);
      if (!inv || !o) throw new AccError("فاکتور تخصیص پیدا نشد");
      if (inv.partyId !== party!.id) throw new AccError(`فاکتور ${faNum(inv.number ?? 0)} مال شخص دیگری است`);
      if (inv.type !== (kind === "RECEIPT" ? "SALES" : "PURCHASE")) throw new AccError(`فاکتور ${faNum(inv.number ?? 0)} به این ${MONEY_KIND_LABELS[kind]} نمی‌خورد`);
      if (a.amount > o.open) throw new AccError(`مانده‌ی فاکتور ${faNum(inv.number ?? 0)} فقط ${formatAmount(o.open)} است`);
    }
    if (allocs.length) {
      await tx.accAllocation.createMany({ data: allocs.map((a) => ({ moneyDocId: doc.id, invoiceId: a.invoiceId, amount: a.amount })) });
      await recalcPaid(tx, allocs.map((a) => a.invoiceId));
    }
  }

  const label = MONEY_KIND_LABELS[kind];
  const v = await postVoucher(tx, {
    date: input.date,
    description: `${label} ${faNum(number)}${pName ? (kind === "RECEIPT" ? ` از ${pName}` : ` به ${pName}`) : ""}${input.description ? ` — ${input.description.trim()}` : ""}`,
    source: kind === "RECEIPT" ? "RECEIPT" : kind === "PAYMENT" ? "PAYMENT" : "TRANSFER",
    sourceId: doc.id,
    lines,
    actor,
  });
  return tx.accMoneyDoc.update({ where: { id: doc.id }, data: { voucherId: v.id } });
}

export async function voidMoneyDoc(tx: Tx, id: string, reason: string, actor: Actor): Promise<AccMoneyDoc> {
  const doc = await tx.accMoneyDoc.findUnique({ where: { id }, include: { items: true, allocations: true } });
  if (!doc) throw new AccError("پیدا نشد", 404);
  if (doc.status === "VOID") return doc;
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  await assertPostable(tx, doc.date);

  for (const it of doc.items) {
    if (!it.chequeId) continue;
    const c = await tx.accCheque.findUniqueOrThrow({ where: { id: it.chequeId }, include: { events: { orderBy: { createdAt: "desc" } } } });
    if (c.moneyDocId === doc.id) {
      // چکی که همین سند ساخت — فقط اگر هنوز گذاری نخورده
      if (c.events.length > 1) {
        throw new AccError(`چک ${faNum(c.serialNo)} بعد از این ثبت «${chequeStatusLabel(c.direction, c.status)}» شده؛ اول آن گذار را برگردانید`, 409);
      }
      await tx.accCheque.delete({ where: { id: c.id } });
    } else {
      // چکی که با همین پرداخت خرج شد ← دوباره نزد ما
      const last = c.events[0];
      if (c.status !== "ENDORSED" || last?.moneyDocId !== doc.id) {
        throw new AccError(`چک ${faNum(c.serialNo)} بعد از خرج «${chequeStatusLabel(c.direction, c.status)}» شده؛ اول آن گذار را برگردانید`, 409);
      }
      await tx.accChequeEvent.delete({ where: { id: last.id } });
      await tx.accCheque.update({ where: { id: c.id }, data: { status: "IN_HAND", holderPartyId: null } });
    }
  }
  if (doc.voucherId) await voidVoucher(tx, doc.voucherId, `ابطال ${MONEY_KIND_LABELS[doc.kind]}: ${reason.trim()}`, actor, { fromSource: true });
  const invoiceIds = doc.allocations.map((a) => a.invoiceId);
  await tx.accAllocation.deleteMany({ where: { moneyDocId: doc.id } });
  const out = await tx.accMoneyDoc.update({ where: { id }, data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` } });
  await recalcPaid(tx, invoiceIds);
  return out;
}

/** تخصیص بعدی — دریافت ثبت‌شده‌ی بی‌تخصیص (یا با مازاد) را به فاکتور وصل می‌کند */
export async function allocateExisting(tx: Tx, moneyDocId: string, allocations: { invoiceId: string; amount: bigint }[]): Promise<void> {
  const doc = await tx.accMoneyDoc.findUnique({ where: { id: moneyDocId }, include: { allocations: true } });
  if (!doc || doc.status !== "POSTED" || doc.kind === "TRANSFER" || !doc.partyId) throw new AccError("پیدا نشد", 404);
  const wanted = allocations.filter((a) => a.amount > 0n);
  const sum = wanted.reduce((s, a) => s + a.amount, 0n);
  if (sum > doc.total) throw new AccError(`جمع تخصیص از مبلغ ${formatAmount(doc.total)} بیشتر است`);
  const open = await invoiceOpenAmounts(tx, wanted.map((a) => a.invoiceId), doc.id);
  for (const a of wanted) {
    const o = open.get(a.invoiceId);
    const inv = await tx.accInvoice.findUnique({ where: { id: a.invoiceId }, select: { partyId: true, type: true, number: true } });
    if (!o || !inv || inv.partyId !== doc.partyId || inv.type !== (doc.kind === "RECEIPT" ? "SALES" : "PURCHASE")) throw new AccError("فاکتور به این سند نمی‌خورد");
    if (a.amount > o.open) throw new AccError(`مانده‌ی فاکتور ${faNum(inv.number ?? 0)} فقط ${formatAmount(o.open)} است`);
  }
  const touched = [...doc.allocations.map((a) => a.invoiceId), ...wanted.map((a) => a.invoiceId)];
  await tx.accAllocation.deleteMany({ where: { moneyDocId } });
  if (wanted.length) await tx.accAllocation.createMany({ data: wanted.map((a) => ({ moneyDocId, invoiceId: a.invoiceId, amount: a.amount })) });
  await recalcPaid(tx, touched);
}
