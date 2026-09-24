/**
 * چک — ماشین وضعیت و سند هر گذار. docs/plans/accounting.md بخش ۹.۲.
 *
 * ```
 * دریافتی:
 *   IN_HAND ─واگذاری به بانک─▶ IN_COLLECTION ─وصول─▶ CLEARED
 *      │ ─وصول مستقیم─▶ CLEARED            └─برگشت─▶ BOUNCED ─▶ IN_HAND | RETURNED
 *      ├─برگشت─▶ BOUNCED
 *      ├─خرج به دیگری (فقط از فرم پرداخت)─▶ ENDORSED ─برگشت─▶ BOUNCED | ─پاس شد─▶ CLEARED
 *      └─عودت─▶ RETURNED
 * صادره:
 *   ISSUED ─پاس شد─▶ CLEARED
 *      ├─برگشت خورد─▶ BOUNCED ─▶ ISSUED | RETURNED
 *      └─ابطال/پس گرفتن─▶ RETURNED
 * ```
 *
 * هر گذار یک `AccChequeEvent` و (جز گذارهای بی‌اثر مالی) یک سند `CHEQUE` با
 * `sourceId = eventId` دارد. گذاری که در `RULES` نیست رد می‌شود. آخرین گذار
 * قابل برگرداندن است (سندش باطل می‌شود) — برای اشتباه.
 *
 * ⚠️ ساخت چک و خرج آن فقط از دریافت/پرداخت (`docs.ts`) است؛ سندش جزو سند همان
 *    دریافت/پرداخت است و از اینجا برنمی‌گردد — با ابطال همان سند برمی‌گردد.
 */

import type { AccCheque, AccChequeDir, AccChequeStatus, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { postVoucher, voidVoucher, type Actor, type LineInput } from "../ledger/post";
import { faNum, formatAmount, toLatinDigits } from "../money";

type Tx = Prisma.TransactionClient;

export const CHEQUE_STATUS_LABELS: Record<AccChequeStatus, string> = {
  IN_HAND: "نزد ما",
  IN_COLLECTION: "در جریان وصول",
  CLEARED: "وصول شد",
  BOUNCED: "برگشتی",
  ENDORSED: "خرج شد",
  RETURNED: "عودت داده شد",
  ISSUED: "منتظر سررسید",
};

/** برچسب وضعیت با جهت — «وصول شد» برای دریافتی، «پاس شد» برای صادره */
export function chequeStatusLabel(direction: AccChequeDir, status: AccChequeStatus): string {
  if (direction === "ISSUED" && status === "CLEARED") return "پاس شد";
  if (direction === "ISSUED" && status === "RETURNED") return "باطل / پس گرفته شد";
  return CHEQUE_STATUS_LABELS[status];
}

/** ردیف سند: کلید حساب، سمت، تفصیلی (صاحب چک، دارنده‌ی خرجی، یا بانک) */
type Leg = [accountKey: string, side: "debit" | "credit", detail: "owner" | "holder" | "bank"];

export interface Rule {
  from: AccChequeStatus;
  to: AccChequeStatus;
  label: string;
  /** بانک لازم است (واگذاری/وصول مستقیم) — روی چک ذخیره می‌شود */
  needsBank?: boolean;
  legs: Leg[];
}

export const RULES: Record<AccChequeDir, Rule[]> = {
  RECEIVED: [
    { from: "IN_HAND", to: "IN_COLLECTION", label: "واگذاری به بانک", needsBank: true, legs: [["CHEQUE_IN_COLLECTION", "debit", "owner"], ["CHEQUE_RECEIVABLE", "credit", "owner"]] },
    { from: "IN_COLLECTION", to: "CLEARED", label: "وصول شد", legs: [["BANK", "debit", "bank"], ["CHEQUE_IN_COLLECTION", "credit", "owner"]] },
    { from: "IN_HAND", to: "CLEARED", label: "وصول مستقیم به بانک", needsBank: true, legs: [["BANK", "debit", "bank"], ["CHEQUE_RECEIVABLE", "credit", "owner"]] },
    { from: "IN_COLLECTION", to: "BOUNCED", label: "برگشت خورد", legs: [["AR", "debit", "owner"], ["CHEQUE_IN_COLLECTION", "credit", "owner"]] },
    { from: "IN_HAND", to: "BOUNCED", label: "برگشت خورد", legs: [["AR", "debit", "owner"], ["CHEQUE_RECEIVABLE", "credit", "owner"]] },
    { from: "ENDORSED", to: "BOUNCED", label: "دارنده برگرداند (برگشتی)", legs: [["AR", "debit", "owner"], ["AP", "credit", "holder"]] },
    { from: "ENDORSED", to: "CLEARED", label: "نزد دارنده پاس شد", legs: [] },
    { from: "BOUNCED", to: "IN_HAND", label: "دوباره نزد ما برای وصول", legs: [["CHEQUE_RECEIVABLE", "debit", "owner"], ["AR", "credit", "owner"]] },
    { from: "BOUNCED", to: "RETURNED", label: "عودت به صاحب چک", legs: [] },
    { from: "IN_HAND", to: "RETURNED", label: "عودت به صاحب چک", legs: [["AR", "debit", "owner"], ["CHEQUE_RECEIVABLE", "credit", "owner"]] },
  ],
  ISSUED: [
    { from: "ISSUED", to: "CLEARED", label: "پاس شد", legs: [["CHEQUE_PAYABLE", "debit", "owner"], ["BANK", "credit", "bank"]] },
    { from: "ISSUED", to: "BOUNCED", label: "برگشت خورد", legs: [["CHEQUE_PAYABLE", "debit", "owner"], ["AP", "credit", "owner"]] },
    { from: "BOUNCED", to: "ISSUED", label: "دوباره به جریان افتاد", legs: [["AP", "debit", "owner"], ["CHEQUE_PAYABLE", "credit", "owner"]] },
    { from: "BOUNCED", to: "RETURNED", label: "پس گرفته شد", legs: [] },
    { from: "ISSUED", to: "RETURNED", label: "ابطال / پس گرفتن", legs: [["CHEQUE_PAYABLE", "debit", "owner"], ["AP", "credit", "owner"]] },
  ],
};

export function allowedMoves(c: Pick<AccCheque, "direction" | "status">): Rule[] {
  return RULES[c.direction].filter((r) => r.from === c.status);
}

export interface NewChequeInput {
  serialNo: string;
  sayadId?: string | null;
  bankName?: string | null;
  branch?: string | null;
  ownerName?: string | null;
  issueDate?: Date | null;
  dueDate: Date;
  chequeBookId?: string | null;
  note?: string | null;
}

function cleanSerial(v: string) {
  return toLatinDigits(v).replace(/[\s-]/g, "");
}

/** ساخت چک از دریافت (RECEIVED/IN_HAND) یا پرداخت (ISSUED) — فقط `docs.ts` صدا می‌زند */
export async function createCheque(
  tx: Tx,
  input: NewChequeInput & { direction: AccChequeDir; amount: bigint; partyId: string; treasuryId?: string | null; moneyDocId: string; date: Date },
  actor: Actor,
): Promise<AccCheque> {
  const serialNo = cleanSerial(input.serialNo ?? "");
  if (!serialNo) throw new AccError("شماره‌ی چک را بنویسید");
  const sayadId = input.sayadId ? cleanSerial(input.sayadId) : null;
  if (sayadId && !/^\d{16}$/.test(sayadId)) throw new AccError("شناسه‌ی صیادی ۱۶ رقم است");
  if (!input.dueDate) throw new AccError(`سررسید چک ${faNum(serialNo)} را انتخاب کنید`);
  if (input.amount <= 0n) throw new AccError("مبلغ چک باید بیشتر از صفر باشد");

  let bankName = input.bankName?.trim() || null;
  if (input.direction === "ISSUED") {
    const bank = input.treasuryId ? await tx.accTreasury.findUnique({ where: { id: input.treasuryId } }) : null;
    if (!bank || bank.kind !== "BANK") throw new AccError("چک صادره از کدام حساب بانکی است؟");
    bankName = bankName ?? bank.bankName ?? bank.name;
    const dup = await tx.accCheque.findFirst({ where: { direction: "ISSUED", treasuryId: bank.id, serialNo } });
    if (dup) throw new AccError(`چک شماره‌ی ${faNum(serialNo)} از این حساب قبلاً صادر شده است`, 409);
  }
  if (!bankName) throw new AccError(`بانک چک ${faNum(serialNo)} را بنویسید`);

  const status: AccChequeStatus = input.direction === "RECEIVED" ? "IN_HAND" : "ISSUED";
  const cheque = await tx.accCheque.create({
    data: {
      direction: input.direction,
      status,
      serialNo,
      sayadId,
      bankName,
      branch: input.branch?.trim() || null,
      ownerName: input.ownerName?.trim() || null,
      amount: input.amount,
      issueDate: input.issueDate ?? null,
      dueDate: input.dueDate,
      partyId: input.partyId,
      treasuryId: input.direction === "ISSUED" ? input.treasuryId! : null,
      chequeBookId: input.chequeBookId ?? null,
      moneyDocId: input.moneyDocId,
      note: input.note?.trim() || null,
      createdById: actor.id ?? null,
      createdByName: actor.name,
    },
  });
  await tx.accChequeEvent.create({
    data: { chequeId: cheque.id, from: null, to: status, date: input.date, moneyDocId: input.moneyDocId, byName: actor.name },
  });
  return cheque;
}

/** خرج چک دریافتی به شخص دیگر — از فرم پرداخت؛ سندش جزو سند پرداخت است */
export async function endorseCheque(tx: Tx, chequeId: string, holderPartyId: string, moneyDocId: string, date: Date, actor: Actor): Promise<AccCheque> {
  const c = await tx.accCheque.findUnique({ where: { id: chequeId } });
  if (!c) throw new AccError("چک پیدا نشد", 404);
  if (c.direction !== "RECEIVED" || c.status !== "IN_HAND") throw new AccError(`چک ${faNum(c.serialNo)} نزد ما نیست و خرج نمی‌شود`);
  if (c.partyId === holderPartyId) throw new AccError("چک به صاحب خودش خرج نمی‌شود؛ «عودت» بزنید");
  // تصاحب اتمی — دو پرداخت هم‌زمان یک چک را خرج نکنند
  const claimed = await tx.accCheque.updateMany({ where: { id: chequeId, status: "IN_HAND" }, data: { status: "ENDORSED", holderPartyId } });
  if (!claimed.count) throw new AccError("این چک هم‌زمان جای دیگری خرج شد", 409);
  await tx.accChequeEvent.create({
    data: { chequeId, from: "IN_HAND", to: "ENDORSED", date, partyId: holderPartyId, moneyDocId, byName: actor.name },
  });
  return tx.accCheque.findUniqueOrThrow({ where: { id: chequeId } });
}

/** یک گذار چک با سندش */
export async function moveCheque(
  tx: Tx,
  chequeId: string,
  to: AccChequeStatus,
  input: { date: Date; treasuryId?: string | null; note?: string | null },
  actor: Actor,
): Promise<AccCheque> {
  const c = await tx.accCheque.findUnique({ where: { id: chequeId } });
  if (!c) throw new AccError("چک پیدا نشد", 404);
  const rule = RULES[c.direction].find((r) => r.from === c.status && r.to === to);
  if (!rule) {
    throw new AccError(`چک «${chequeStatusLabel(c.direction, c.status)}» نمی‌تواند «${chequeStatusLabel(c.direction, to)}» شود`);
  }
  if (to === "ENDORSED") throw new AccError("خرج چک از فرم پرداخت ثبت می‌شود");

  const last = await tx.accChequeEvent.findFirst({ where: { chequeId }, orderBy: { createdAt: "desc" } });
  if (last && input.date < last.date) throw new AccError("تاریخ این گذار پیش از گذار قبلی چک است");

  // بانک: واگذاری/وصول مستقیم می‌پرسد؛ وصولِ در جریان و پاس صادره از خود چک
  let bankId = c.treasuryId;
  if (rule.needsBank) {
    const bank = input.treasuryId ? await tx.accTreasury.findUnique({ where: { id: input.treasuryId } }) : null;
    if (!bank || bank.kind !== "BANK" || !bank.isActive) throw new AccError("حساب بانکی را انتخاب کنید");
    bankId = bank.id;
  }
  if (rule.legs.some((l) => l[2] === "bank") && !bankId) throw new AccError("بانک این چک معلوم نیست");
  if (rule.legs.some((l) => l[2] === "holder") && !c.holderPartyId) throw new AccError("دارنده‌ی چک خرج‌شده معلوم نیست");

  const event = await tx.accChequeEvent.create({
    data: {
      chequeId,
      from: c.status,
      to,
      date: input.date,
      treasuryId: rule.needsBank ? bankId : null,
      note: input.note?.trim() || null,
      byName: actor.name,
    },
  });

  if (rule.legs.length) {
    const lines: LineInput[] = rule.legs.map(([key, side, detail]) => ({
      accountKey: key,
      partyId: detail === "owner" ? c.partyId : detail === "holder" ? c.holderPartyId : null,
      treasuryId: detail === "bank" ? bankId : null,
      [side]: c.amount,
      description: `چک ${faNum(c.serialNo)} — ${rule.label}`,
    }));
    const party = await tx.accParty.findUnique({ where: { id: c.partyId }, select: { name: true } });
    const v = await postVoucher(tx, {
      date: input.date,
      description: `چک ${c.direction === "RECEIVED" ? "دریافتی" : "صادره"} ${faNum(c.serialNo)} (${formatAmount(c.amount)}) ${party?.name ?? ""} — ${rule.label}`,
      source: "CHEQUE",
      sourceId: event.id,
      lines,
      actor,
    });
    await tx.accChequeEvent.update({ where: { id: event.id }, data: { voucherId: v.id } });
  }

  return tx.accCheque.update({
    where: { id: chequeId },
    data: {
      status: to,
      ...(rule.needsBank ? { treasuryId: bankId } : {}),
      // چکی که دوباره به جریان افتاد، یادآوری تازه می‌خواهد
      ...(to === "IN_HAND" || to === "ISSUED" ? { reminderSentAt: null, followUpTaskId: null } : {}),
    },
  });
}

/** برگرداندن آخرین گذار (اشتباه ثبت) — سندش باطل و وضعیت قبلی برمی‌گردد */
export async function undoLastMove(tx: Tx, chequeId: string, actor: Actor): Promise<AccCheque> {
  const c = await tx.accCheque.findUnique({ where: { id: chequeId } });
  if (!c) throw new AccError("چک پیدا نشد", 404);
  const last = await tx.accChequeEvent.findFirst({ where: { chequeId }, orderBy: { createdAt: "desc" } });
  if (!last || !last.from) throw new AccError("این چک گذاری برای برگرداندن ندارد؛ برای حذفش همان دریافت یا پرداخت را باطل کنید");
  if (last.moneyDocId) throw new AccError("خرج چک از پرداخت آمده؛ برای برگرداندنش همان پرداخت را باطل کنید");
  if (last.voucherId) await voidVoucher(tx, last.voucherId, "برگرداندن گذار چک", actor, { fromSource: true });
  await tx.accChequeEvent.delete({ where: { id: last.id } });
  // بانکِ واگذاری با برگرداندن واگذاری پاک می‌شود (صادره بانک خودش را دارد)
  const prevBank = c.direction === "RECEIVED" && last.treasuryId
    ? (await tx.accChequeEvent.findFirst({ where: { chequeId, treasuryId: { not: null } }, orderBy: { createdAt: "desc" } }))?.treasuryId ?? null
    : c.treasuryId;
  return tx.accCheque.update({ where: { id: chequeId }, data: { status: last.from, treasuryId: prevBank } });
}

/** شماره‌ی چک بعدی دسته‌چک‌های فعال یک حساب — پیشنهاد فرم پرداخت */
export async function nextChequeSerial(tx: Tx, treasuryId: string): Promise<{ serial: string; bookId: string } | null> {
  const books = await tx.accChequeBook.findMany({ where: { treasuryId, isActive: true }, orderBy: { createdAt: "asc" } });
  if (!books.length) return null;
  const used = new Set((await tx.accCheque.findMany({ where: { direction: "ISSUED", treasuryId }, select: { serialNo: true } })).map((c) => c.serialNo));
  for (const b of books) {
    const from = BigInt(b.fromSerial);
    const to = BigInt(b.toSerial);
    for (let n = from; n <= to; n++) {
      const s = n.toString().padStart(b.fromSerial.length, "0");
      if (!used.has(s)) return { serial: s, bookId: b.id };
    }
  }
  return null;
}

export async function saveChequeBook(tx: Tx, input: { treasuryId: string; fromSerial: string; toSerial: string }) {
  const bank = await tx.accTreasury.findUnique({ where: { id: input.treasuryId } });
  if (!bank || bank.kind !== "BANK") throw new AccError("دسته‌چک مال یک حساب بانکی است");
  const from = cleanSerial(input.fromSerial);
  const to = cleanSerial(input.toSerial);
  if (!/^\d+$/.test(from) || !/^\d+$/.test(to)) throw new AccError("شماره‌ی اول و آخر دسته‌چک عددی است");
  if (BigInt(to) < BigInt(from)) throw new AccError("شماره‌ی آخر از اول کوچک‌تر است");
  if (BigInt(to) - BigInt(from) > 500n) throw new AccError("دسته‌چک بیش از ۵۰۰ برگ نمی‌شود؛ شماره‌ها را بررسی کنید");
  return tx.accChequeBook.create({ data: { treasuryId: bank.id, fromSerial: from, toSerial: to } });
}
