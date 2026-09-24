/**
 * اشخاص (طرف حساب) — docs/plans/accounting.md بخش ۶.۳.
 *
 * هر مشتری سایت، تأمین‌کننده‌ی کارتابل یا بازارگاه حداکثر یک شخص دارد
 * (`userId` / `supplierId` / `platformCode` یکتا). پیدا-یا-ساختن آن‌ها از
 * `partyForUser` و هم‌خانواده‌ها است تا فاز ۴ و ۵ شخص تکراری نسازند.
 */

import type { AccParty, AccPersonType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError, toAmount } from "./errors";
import { GLOBAL_SEQ, nextNumber } from "./ledger/sequence";
import { faNum, toLatinDigits } from "./money";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const PARTY_CODE_START = 1001;

export interface PartyInput {
  personType?: AccPersonType;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  name?: string | null;
  nationalId?: string | null;
  economicCode?: string | null;
  regNo?: string | null;
  mobile?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  address?: string | null;
  city?: string | null;
  isCustomer?: boolean;
  isSupplier?: boolean;
  isEmployee?: boolean;
  isMarketplace?: boolean;
  creditLimit?: unknown;
  note?: string | null;
  isActive?: boolean;
}

const clean = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};
const digits = (v: string | null | undefined) => {
  const t = clean(v);
  return t ? toLatinDigits(t).replace(/[\s-]/g, "") : null;
};

function normalize(input: PartyInput, current?: AccParty): Prisma.AccPartyUncheckedUpdateInput {
  const personType = input.personType ?? current?.personType ?? "REAL";
  const firstName = input.firstName !== undefined ? clean(input.firstName) : current?.firstName ?? null;
  const lastName = input.lastName !== undefined ? clean(input.lastName) : current?.lastName ?? null;
  const companyName = input.companyName !== undefined ? clean(input.companyName) : current?.companyName ?? null;

  const auto = personType === "LEGAL" ? companyName : [firstName, lastName].filter(Boolean).join(" ");
  const name = clean(input.name) ?? (auto || current?.name || null);
  if (!name) throw new AccError(personType === "LEGAL" ? "نام شرکت را بنویسید" : "نام شخص را بنویسید");

  const mobile = input.mobile !== undefined ? digits(input.mobile) : current?.mobile ?? null;
  if (mobile && !/^09\d{9}$/.test(mobile)) throw new AccError("شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود");
  const nationalId = input.nationalId !== undefined ? digits(input.nationalId) : current?.nationalId ?? null;
  if (nationalId && !/^\d{10,11}$/.test(nationalId)) throw new AccError("کد ملی ۱۰ رقم و شناسه‌ی ملی ۱۱ رقم است");
  const postalCode = input.postalCode !== undefined ? digits(input.postalCode) : current?.postalCode ?? null;
  if (postalCode && !/^\d{10}$/.test(postalCode)) throw new AccError("کد پستی ۱۰ رقم است");

  const data: Prisma.AccPartyUncheckedUpdateInput = {
    personType,
    name,
    firstName,
    lastName,
    companyName,
    mobile,
    nationalId,
    postalCode,
  };
  for (const k of ["economicCode", "regNo", "phone"] as const) {
    if (input[k] !== undefined) data[k] = digits(input[k]);
  }
  for (const k of ["address", "city", "note"] as const) {
    if (input[k] !== undefined) data[k] = clean(input[k]);
  }
  for (const k of ["isCustomer", "isSupplier", "isEmployee", "isMarketplace", "isActive"] as const) {
    if (typeof input[k] === "boolean") data[k] = input[k];
  }
  if (input.creditLimit !== undefined) {
    const v = input.creditLimit === null || input.creditLimit === "" ? null : toAmount(input.creditLimit, "سقف اعتبار");
    if (v !== null && v < 0n) throw new AccError("سقف اعتبار منفی نمی‌شود");
    data.creditLimit = v;
  }
  return data;
}

export async function createParty(tx: Tx, input: PartyInput & { userId?: string; supplierId?: string; platformCode?: string }): Promise<AccParty> {
  const data = normalize(input) as Prisma.AccPartyUncheckedCreateInput;
  if (data.mobile && !input.userId) {
    const dup = await tx.accParty.findFirst({ where: { mobile: data.mobile as string }, select: { name: true, code: true } });
    if (dup) throw new AccError(`این موبایل برای «${dup.name}» (کد ${faNum(dup.code)}) ثبت شده است`, 409);
  }
  const code = await nextNumber(tx, GLOBAL_SEQ, "party", PARTY_CODE_START);
  return tx.accParty.create({
    data: {
      ...data,
      code,
      userId: input.userId ?? null,
      supplierId: input.supplierId ?? null,
      platformCode: input.platformCode ?? null,
    },
  });
}

export async function updateParty(tx: Tx, id: string, input: PartyInput): Promise<AccParty> {
  const current = await tx.accParty.findUnique({ where: { id } });
  if (!current) throw new AccError("شخص پیدا نشد", 404);
  const data = normalize(input, current);
  if (data.mobile && data.mobile !== current.mobile) {
    const dup = await tx.accParty.findFirst({ where: { mobile: data.mobile as string, id: { not: id } }, select: { name: true } });
    if (dup) throw new AccError(`این موبایل برای «${dup.name}» ثبت شده است`, 409);
  }
  return tx.accParty.update({ where: { id }, data });
}

/** شخص مشتری سایت — اگر نیست ساخته می‌شود (نقش مشتری روشن) */
export async function partyForUser(tx: Tx, userId: string): Promise<AccParty> {
  const existing = await tx.accParty.findUnique({ where: { userId } });
  if (existing) return existing.isCustomer ? existing : tx.accParty.update({ where: { id: existing.id }, data: { isCustomer: true } });
  const u = await tx.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, phone: true } });
  if (!u) throw new AccError("کاربر پیدا نشد", 404);
  // اگر همین موبایل قبلاً دستی ثبت شده، همان به کاربر وصل می‌شود نه شخص تکراری
  const byMobile = u.phone ? await tx.accParty.findFirst({ where: { mobile: u.phone, userId: null } }) : null;
  if (byMobile) return tx.accParty.update({ where: { id: byMobile.id }, data: { userId, isCustomer: true } });
  return createParty(tx, {
    firstName: u.firstName,
    lastName: u.lastName,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone,
    mobile: u.phone,
    isCustomer: true,
    userId,
  });
}

/** شخص تأمین‌کننده‌ی کارتابل */
export async function partyForSupplier(tx: Tx, supplierId: string): Promise<AccParty> {
  const existing = await tx.accParty.findUnique({ where: { supplierId } });
  if (existing) return existing;
  const s = await tx.staffSupplier.findUnique({ where: { id: supplierId } });
  if (!s) throw new AccError("تأمین‌کننده پیدا نشد", 404);
  const mobile = s.phone && /^09\d{9}$/.test(toLatinDigits(s.phone)) ? toLatinDigits(s.phone) : null;
  const byMobile = mobile ? await tx.accParty.findFirst({ where: { mobile, supplierId: null } }) : null;
  if (byMobile) return tx.accParty.update({ where: { id: byMobile.id }, data: { supplierId, isSupplier: true } });
  return createParty(tx, {
    personType: "LEGAL",
    companyName: s.name,
    name: s.name,
    mobile,
    phone: mobile ? null : s.phone,
    city: s.city,
    isSupplier: true,
    supplierId,
  });
}

/** شخص بازارگاه (باسلام، تپسی‌شاپ، …) */
export async function partyForPlatform(tx: Tx, platformCode: string, title: string): Promise<AccParty> {
  const existing = await tx.accParty.findUnique({ where: { platformCode } });
  if (existing) return existing;
  return createParty(tx, { personType: "LEGAL", companyName: title, name: title, isMarketplace: true, platformCode });
}

export type PartyRole = "customer" | "supplier" | "employee" | "marketplace";

export function partyWhere(q: string | null | undefined, role: PartyRole | null, includeInactive = false): Prisma.AccPartyWhereInput {
  const where: Prisma.AccPartyWhereInput = includeInactive ? {} : { isActive: true };
  if (role === "customer") where.isCustomer = true;
  if (role === "supplier") where.isSupplier = true;
  if (role === "employee") where.isEmployee = true;
  if (role === "marketplace") where.isMarketplace = true;
  const term = q?.trim();
  if (term) {
    const lat = toLatinDigits(term);
    const or: Prisma.AccPartyWhereInput[] = [
      { name: { contains: term, mode: "insensitive" } },
      { mobile: { contains: lat } },
      { nationalId: { contains: lat } },
    ];
    if (/^\d+$/.test(lat) && lat.length <= 9) or.push({ code: Number(lat) });
    where.OR = or;
  }
  return where;
}

export async function partyBrief(db: Db, id: string) {
  return db.accParty.findUnique({ where: { id }, select: { id: true, code: true, name: true, mobile: true, isActive: true } });
}
