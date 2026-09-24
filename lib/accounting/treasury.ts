/**
 * صندوق، بانک، کارتخوان، درگاه — docs/plans/accounting.md بخش ۶.۳ و ۹.
 *
 * هر نوع خزانه روی معین سیستمی خودش می‌نشیند (`TREASURY_ACCOUNT_KEY`)؛ فرم‌ها
 * حساب را نمی‌پرسند، فقط خزانه را.
 */

import type { AccTreasury, AccTreasuryKind, Prisma } from "@prisma/client";
import { AccError } from "./errors";
import { GLOBAL_SEQ, nextNumber } from "./ledger/sequence";
import { toLatinDigits } from "./money";

type Tx = Prisma.TransactionClient;

export const TREASURY_ACCOUNT_KEY: Record<AccTreasuryKind, string> = {
  CASH: "CASH",
  BANK: "BANK",
  POS: "POS_CLEARING",
  GATEWAY: "GATEWAY_CLEARING",
};

export const TREASURY_KIND_LABELS: Record<AccTreasuryKind, string> = {
  CASH: "صندوق",
  BANK: "حساب بانکی",
  POS: "کارتخوان",
  GATEWAY: "درگاه پرداخت اینترنتی",
};

export interface TreasuryInput {
  kind?: AccTreasuryKind;
  name?: string;
  bankName?: string | null;
  accountNo?: string | null;
  sheba?: string | null;
  cardNo?: string | null;
  settleToId?: string | null;
  providers?: string[];
  isActive?: boolean;
}

const clean = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
const digits = (v: string | null | undefined) => {
  const t = clean(v);
  return t ? toLatinDigits(t).replace(/[\s-]/g, "") : null;
};

async function normalize(tx: Tx, input: TreasuryInput, current?: AccTreasury) {
  const kind = input.kind ?? current?.kind;
  if (!kind) throw new AccError("نوع را انتخاب کنید");
  const name = input.name !== undefined ? clean(input.name) : current?.name;
  if (!name) throw new AccError("نام را بنویسید؛ مثلاً «ملت جاری ۱۲۳۴»");

  const data: Prisma.AccTreasuryUncheckedUpdateInput = { kind, name };
  if (input.bankName !== undefined) data.bankName = clean(input.bankName);
  if (input.accountNo !== undefined) data.accountNo = digits(input.accountNo);
  if (input.cardNo !== undefined) {
    const c = digits(input.cardNo);
    if (c && !/^\d{16}$/.test(c)) throw new AccError("شماره کارت ۱۶ رقم است");
    data.cardNo = c;
  }
  if (input.sheba !== undefined) {
    let s = digits(input.sheba)?.toUpperCase() ?? null;
    if (s && /^\d{24}$/.test(s)) s = "IR" + s;
    if (s && !/^IR\d{24}$/.test(s)) throw new AccError("شبا ۲۴ رقم است (با یا بدون IR)");
    data.sheba = s;
  }
  if (input.settleToId !== undefined) {
    if (input.settleToId) {
      const bank = await tx.accTreasury.findUnique({ where: { id: input.settleToId } });
      if (!bank || bank.kind !== "BANK") throw new AccError("حساب تسویه باید یک حساب بانکی باشد");
      if (current && bank.id === current.id) throw new AccError("حساب تسویه خودش نمی‌شود");
    }
    data.settleToId = input.settleToId || null;
  }
  if (input.providers !== undefined) {
    data.providers = [...new Set(input.providers.map((p) => p.trim()).filter(Boolean))];
  }
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  return data;
}

export async function createTreasury(tx: Tx, input: TreasuryInput): Promise<AccTreasury> {
  const data = (await normalize(tx, input)) as Prisma.AccTreasuryUncheckedCreateInput;
  const code = await nextNumber(tx, GLOBAL_SEQ, "treasury", 101);
  return tx.accTreasury.create({ data: { ...data, code } });
}

export async function updateTreasury(tx: Tx, id: string, input: TreasuryInput): Promise<AccTreasury> {
  const current = await tx.accTreasury.findUnique({ where: { id } });
  if (!current) throw new AccError("پیدا نشد", 404);
  if (input.kind && input.kind !== current.kind && (await tx.accVoucherLine.count({ where: { treasuryId: id } }))) {
    throw new AccError("این مورد گردش دارد؛ نوعش عوض نمی‌شود");
  }
  return tx.accTreasury.update({ where: { id }, data: await normalize(tx, input, current) });
}
