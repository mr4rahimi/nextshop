/**
 * دریافت، پرداخت، انتقال وجه — docs/plans/accounting.md بخش ۵، ۶.۷ و ۹.۱.
 *
 * یک فرم، چند روش: «بخشی نقد، بخشی کارت‌به‌کارت، بخشی چک». هر سند:
 *   دریافت:  بدهکار صندوق/بانک/کارتخوان/درگاه یا اسناد دریافتنی (چک)  —  بستانکار طلب از شخص
 *   پرداخت:  بدهکار بدهی به شخص  —  بستانکار صندوق/بانک، اسناد پرداختنی (چک ما)
 *            یا اسناد دریافتنی صاحب چک (خرج چک دریافتی)
 *   انتقال:  بدهکار مقصد + کارمزد بانکی  —  بستانکار مبدأ
 *   هزینه:   بدهکار حساب‌های هزینه (+ مالیات خرید)  —  بستانکار صندوق/بانک/چک،
 *            و بخش پرداخت‌نشده بدهی به شخص (نسیه) — فاز ۶
 *   درآمد:   آینه‌ی هزینه — بستانکار حساب‌های درآمد (+ مالیات فروش)  —  بدهکار
 *            صندوق/بانک/چک دریافتی، و بخش دریافت‌نشده طلب از شخص — فاز ۱۰
 *
 *   بن و کارت هدیه: روی صندوق یا بانک، مثل نقد. تهاتر: بی‌خزانه — دریافت/درآمد
 *   بدهی ما به همان شخص را کم می‌کند، پرداخت/هزینه طلب ما از او را (فاز ۱۰).
 *
 *   کیف پول (فقط دریافت خودکار سفارش): بدهکار «کیف پول مشتریان» همان شخص.
 *   تسویه‌ی بازارگاه: دریافت از شخصِ بازارگاه با «کارمزد کسرشده» — بانک خالص
 *   واریزی را می‌گیرد، کارمزد به «کارمزد بازارگاه»، طلب به‌اندازه‌ی ناخالص کم می‌شود.
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
  EXPENSE: "هزینه",
  INCOME: "درآمد",
};

export const METHOD_LABELS: Record<AccMoneyMethod, string> = {
  CASH: "نقد",
  CARD_TRANSFER: "کارت‌به‌کارت",
  BANK_TRANSFER: "واریز بانکی",
  POS: "کارتخوان",
  GATEWAY: "درگاه اینترنتی",
  CHEQUE: "چک",
  WALLET: "کیف پول",
  GIFT_CARD: "بن و کارت هدیه",
  OFFSET: "تهاتر",
};

/** هر روش روی کدام نوع خزانه می‌نشیند */
const METHOD_TREASURY: Record<Exclude<AccMoneyMethod, "CHEQUE" | "WALLET" | "OFFSET">, AccTreasuryKind[]> = {
  CASH: ["CASH"],
  CARD_TRANSFER: ["BANK"],
  BANK_TRANSFER: ["BANK"],
  POS: ["POS", "BANK"],
  GATEWAY: ["GATEWAY", "BANK"],
  GIFT_CARD: ["CASH", "BANK"],
};

/** پولی که به ما می‌رسد — چک دریافتی، خزانه بدهکار */
const INBOUND: AccMoneyKind[] = ["RECEIPT", "INCOME"];

export interface MoneyItemInput {
  method: AccMoneyMethod;
  treasuryId?: string | null;
  toTreasuryId?: string | null;
  amount: bigint;
  /** انتقال: کارمزد بانکی از مبدأ. دریافت از بازارگاه: کارمزد کسرشده از واریزی */
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
  /** هزینه/درآمد: بابت چه — هر ردیف یک حساب هزینه یا درآمد */
  lines?: { accountId: string; amount: bigint; description?: string | null }[];
  /** هزینه: مالیات بر ارزش افزوده‌ی قابل کسر؛ درآمد: مالیات فروش */
  vatAmount?: bigint;
}

/** حساب‌هایی که «هزینه» نیستند و فقط از مسیر خودشان سند می‌گیرند */
const NOT_EXPENSE_KEYS = ["COGS", "INVENTORY_ADJUSTMENT"];
/** درآمدهایی که فقط از فاکتور می‌آیند — فروش، برگشت، تخفیف */
const NOT_INCOME_KEYS = ["SALES", "SALES_RETURN", "SALES_DISCOUNT", "ROUNDING"];

export async function createMoneyDoc(tx: Tx, input: MoneyDocInput, actor: Actor): Promise<AccMoneyDoc> {
  const year = await assertPostable(tx, input.date);
  const kind = input.kind;
  const withLines = kind === "EXPENSE" || kind === "INCOME";
  const inbound = INBOUND.includes(kind);
  if (!input.items.length && !withLines) throw new AccError("دست‌کم یک روش و مبلغ لازم است");

  const party = input.partyId ? await tx.accParty.findUnique({ where: { id: input.partyId } }) : null;
  if (kind === "RECEIPT" || kind === "PAYMENT") {
    if (!party) throw new AccError(kind === "RECEIPT" ? "از چه کسی دریافت شد؟" : "به چه کسی پرداخت شد؟");
  }
  if (party && !party.isActive) throw new AccError(`«${party.name}» غیرفعال است`);

  // ── ردیف‌های هزینه / درآمد ──
  const expLines: { accountId: string; partyId: string | null; amount: bigint; description: string | null; name: string }[] = [];
  const vat = withLines ? input.vatAmount ?? 0n : 0n;
  if (withLines) {
    const noun = kind === "EXPENSE" ? "هزینه" : "درآمد";
    if (!input.lines?.length) throw new AccError(`بابت چه ${kind === "EXPENSE" ? "هزینه‌ای" : "درآمدی"}؟ دست‌کم یک ردیف لازم است`);
    if (vat < 0n) throw new AccError("مالیات منفی نمی‌شود");
    const accs = new Map((await tx.accAccount.findMany({ where: { id: { in: input.lines.map((l) => l.accountId) } } })).map((a) => [a.id, a]));
    input.lines.forEach((l, i) => {
      const at = `ردیف ${kind === "EXPENSE" ? "هزینه‌ی" : "درآمد"} ${faNum(i + 1)}`;
      const a = accs.get(l.accountId);
      if (!a) throw new AccError(`${at}: بابت چه؟ یک سرفصل ${noun} انتخاب کنید`);
      const cls = kind === "EXPENSE" ? "EXPENSE" : "REVENUE";
      const banned = kind === "EXPENSE" ? NOT_EXPENSE_KEYS : NOT_INCOME_KEYS;
      if (a.class !== cls || a.level !== "SUBLEDGER" || (a.systemKey && banned.includes(a.systemKey))) throw new AccError(`${at}: «${a.name}» سرفصل ${noun} نیست`);
      if (!a.isActive) throw new AccError(`${at}: «${a.name}» غیرفعال است`);
      if (a.detailKind === "TREASURY") throw new AccError(`${at}: «${a.name}» تفصیلی صندوق می‌خواهد و در ${noun} نمی‌آید`);
      if (a.detailKind === "PARTY" && !party) throw new AccError(`${at}: «${a.name}» به نام یک شخص ثبت می‌شود — «به چه کسی» را انتخاب کنید`);
      if (l.amount <= 0n) throw new AccError(`${at}: مبلغ باید بیشتر از صفر باشد`);
      expLines.push({ accountId: a.id, partyId: a.detailKind === "PARTY" ? party!.id : null, amount: l.amount, description: l.description?.trim() || null, name: a.name });
    });
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
    if (it.fee) {
      if (kind !== "RECEIPT" || !party?.isMarketplace) throw new AccError(`${at}: کارمزد فقط در انتقال وجه و تسویه‌ی بازارگاه است`);
      if (it.method === "CHEQUE" || it.method === "WALLET") throw new AccError(`${at}: کارمزد بازارگاه روی واریز به بانک یا صندوق است`);
      if (it.fee >= it.amount) throw new AccError(`${at}: کارمزد باید کمتر از مبلغ تسویه باشد`);
    }
    if (it.method === "WALLET") {
      if (kind !== "RECEIPT") throw new AccError(`${at}: کیف پول فقط روش دریافت است`);
      return;
    }
    if (it.method === "OFFSET") {
      if (!party) throw new AccError(`${at}: تهاتر با یک شخص است — شخص را انتخاب کنید`);
      return;
    }
    if (it.method === "CHEQUE") {
      if (!party) throw new AccError(`${at}: چک به نام یک شخص است — ${inbound ? "«از چه کسی»" : "«به چه کسی»"} را انتخاب کنید`);
      if (inbound && !it.cheque) throw new AccError(`${at}: مشخصات چک را وارد کنید`);
      if (!inbound && !it.cheque && !it.endorseChequeId) throw new AccError(`${at}: چک تازه صادر کنید یا یک چک دریافتی را خرج کنید`);
      if (!inbound && it.cheque) {
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

  const paid = input.items.reduce((s, i) => s + i.amount, 0n);
  const total = withLines ? expLines.reduce((s, l) => s + l.amount, 0n) + vat : paid;
  // هزینه: بخش پرداخت‌نشده بدهی به شخص؛ درآمد: بخش دریافت‌نشده طلب از شخص
  const payable = withLines ? total - paid : 0n;
  if (payable < 0n) {
    throw new AccError(`جمع ${kind === "INCOME" ? "دریافت" : "پرداخت"} (${formatAmount(paid)}) از مبلغ ${kind === "INCOME" ? "درآمد" : "هزینه"} (${formatAmount(total)}) بیشتر است`);
  }
  if (payable > 0n && !party) {
    throw new AccError(
      kind === "INCOME"
        ? `${formatAmount(payable)} تومان دریافت نشده — «از چه کسی» طلبکار می‌شوید؟`
        : `${formatAmount(payable)} تومان پرداخت نشده — «به چه کسی» بدهکار می‌شوید؟`,
    );
  }
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
      payable,
      vatAmount: vat,
      createdById: actor.id ?? null,
      createdByName: actor.name,
    },
  });

  // ── چک‌ها و ردیف‌ها ──
  const lines: LineInput[] = [];
  const pName = party?.name ?? "";
  if (withLines) {
    const side = kind === "EXPENSE" ? "debit" : "credit";
    for (const l of expLines) lines.push({ accountId: l.accountId, partyId: l.partyId, [side]: l.amount, description: l.description ?? l.name });
    if (vat > 0n) {
      lines.push(
        kind === "EXPENSE"
          ? { accountKey: "VAT_PURCHASE", debit: vat, description: "مالیات بر ارزش افزوده‌ی هزینه" }
          : { accountKey: "VAT_SALES", credit: vat, description: "مالیات بر ارزش افزوده‌ی درآمد" },
      );
    }
    await tx.accMoneyLine.createMany({
      data: expLines.map((l, i) => ({ moneyDocId: doc.id, seq: i + 1, accountId: l.accountId, amount: l.amount, description: l.description })),
    });
  }
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
        { ...it.cheque!, direction: inbound ? "RECEIVED" : "ISSUED", amount: it.amount, partyId: party!.id, treasuryId: it.treasuryId, moneyDocId: doc.id, date: input.date },
        actor,
      );
      chequeId = c.id;
      lines.push(
        inbound
          ? { accountKey: "CHEQUE_RECEIVABLE", partyId: party!.id, debit: it.amount, description: `چک ${faNum(c.serialNo)} سررسید ${formatJalali(c.dueDate)}` }
          : { accountKey: "CHEQUE_PAYABLE", partyId: party!.id, credit: it.amount, description: `چک ${faNum(c.serialNo)}` },
      );
    } else if (it.method === "OFFSET") {
      // دریافت با تهاتر: بدهی ما به او کم می‌شود؛ پرداخت با تهاتر: طلب ما از او کم می‌شود
      lines.push(
        inbound
          ? { accountKey: "AP", partyId: party!.id, debit: it.amount, description: "تهاتر با بدهی ما" }
          : { accountKey: "AR", partyId: party!.id, credit: it.amount, description: "تهاتر با طلب ما" },
      );
    } else if (it.method === "WALLET") {
      lines.push({ accountKey: "WALLET_LIABILITY", partyId: party!.id, debit: it.amount, description: "پرداخت از کیف پول" });
    } else {
      const t = tr(it.treasuryId, "");
      const fee = it.fee ?? 0n;
      const desc = [METHOD_LABELS[it.method], it.trackingCode && `پیگیری ${it.trackingCode}`].filter(Boolean).join(" — ");
      lines.push({ accountKey: TREASURY_ACCOUNT_KEY[t.kind], treasuryId: t.id, [inbound ? "debit" : "credit"]: it.amount - fee, description: desc });
      if (fee > 0n) lines.push({ accountKey: "MARKETPLACE_FEE", debit: fee, description: `کارمزد ${pName}` });
    }
    await tx.accMoneyItem.create({
      data: {
        moneyDocId: doc.id,
        seq: i + 1,
        method: kind === "TRANSFER" ? "BANK_TRANSFER" : it.method,
        treasuryId: (it.method === "CHEQUE" && inbound) || it.method === "WALLET" || it.method === "OFFSET" ? null : it.treasuryId ?? null,
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
  if (payable > 0n) {
    lines.push(
      kind === "INCOME"
        ? { accountKey: "AR", partyId: party!.id, debit: payable, description: "درآمد دریافت‌نشده" }
        : { accountKey: "AP", partyId: party!.id, credit: payable, description: "هزینه‌ی پرداخت‌نشده" },
    );
  }

  // ── تخصیص ──
  if ((kind === "RECEIPT" || kind === "PAYMENT") && input.allocations) {
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
    description:
      `${label} ${faNum(number)}` +
      (withLines ? ` — ${[...new Set(expLines.map((l) => l.name))].join("، ")}` : "") +
      (pName ? (inbound ? ` از ${pName}` : ` به ${pName}`) : "") +
      (input.description ? ` — ${input.description.trim()}` : ""),
    source: kind,
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
  if (!doc || doc.status !== "POSTED" || (doc.kind !== "RECEIPT" && doc.kind !== "PAYMENT") || !doc.partyId) throw new AccError("پیدا نشد", 404);
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
