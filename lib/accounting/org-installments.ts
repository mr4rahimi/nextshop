/**
 * اقساط سازمانی — docs/plans/org-installments.md.
 *
 * سازمان (آموزش و پرورش، …) کارمندانش را معرفی می‌کند؛ کارمند می‌خرد و سازمان ماه‌به‌ماه قسط همه را
 * یک‌جا (با فهرست اکسل) می‌پردازد.
 *
 * فروش (صندوق یا صفحه‌ی فاکتور): دریافت از مشتری با روش `ORG_INSTALLMENT` ← فاکتور مشتری تسویه، طلب
 * به سازمان منتقل: بدهکار AR سازمان (مبلغ − پورسانت)، بدهکار «کارمزد فروش اقساطی سازمانی» (پورسانت)،
 * بستانکار AR مشتری. قرارداد + جدول اقساط (مبلغ قسطی ÷ ماه، گرد، اختلاف در قسط آخر).
 *
 * دریافت ماهانه (تسویه): یک «دریافت» عادی از شخص سازمان به بانک/صندوق؛ مبلغ هر مشتری به قسط‌های باز
 * همان مشتری در همین سازمان (قدیمی‌ترین اول) می‌نشیند. `paid` هر قسط کش است = Σ ردیف‌های تسویه‌ی زنده
 * (`recalcOrgInstallments`). ابطال دریافت ← قلاب `onMoneyDocVoid`.
 *
 * ⚠️ مانده‌ی AR سازمان در دفتر = Σ (مبلغ − دریافتی) قسط‌های قراردادهای زنده؛ آزمون این را می‌سنجد.
 */

import type { AccInstallmentOrg, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromJalali, jalaliMonthLength, jalaliMonthName, toJalali } from "@/lib/club/jalali";
import { AccError } from "./errors";
import { createParty } from "./parties";
import { createMoneyDoc, voidMoneyDoc } from "./cash/docs";
import { invoiceOpenAmounts } from "./cash/allocation";
import { GLOBAL_SEQ, nextNumber } from "./ledger/sequence";
import { addJalaliMonths } from "./installments-calc";
import { recalcOrgInstallments } from "./org-installments-hooks";
import { faNum, formatAmount } from "./money";
import { todayKey } from "./dates";
import type { Actor } from "./ledger/post";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

// ───────────────────────── ماه شمسی ─────────────────────────

/** «1405-09» */
export const periodOf = (d: Date) => {
  const j = toJalali(d);
  return `${j.year}-${String(j.month).padStart(2, "0")}`;
};
export function periodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new AccError("ماه نامعتبر است");
  const start = fromJalali(y, m, 1)!;
  const last = fromJalali(y, m, jalaliMonthLength(y, m))!;
  return { start, end: new Date(last.getTime() + 86_400_000) };
}
export const periodLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return `${jalaliMonthName(m)} ${faNum(y)}`;
};

// ───────────────────────── سازمان ─────────────────────────

export interface OrgInput {
  name?: unknown;
  months?: unknown;
  commissionPct?: unknown;
  capPerCustomer?: unknown;
  capTotal?: unknown;
  minPurchase?: unknown;
  firstDueMonths?: unknown;
  dueDay?: unknown;
  roundTo?: unknown;
  requireRef?: unknown;
  contractNo?: unknown;
  contactName?: unknown;
  contactPhone?: unknown;
  note?: unknown;
  color?: unknown;
  isActive?: unknown;
}

const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const fa2en = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const money = (v: unknown, label: string): bigint | null => {
  if (v === null || v === undefined || v === "") return null;
  const t = fa2en(String(v)).replace(/[,،\s]/g, "");
  if (!/^\d+$/.test(t)) throw new AccError(`${label}: عدد بنویسید`);
  const n = BigInt(t);
  return n > 0n ? n : null;
};
const int = (v: unknown, label: string, min: number, max: number) => {
  const n = Number(fa2en(String(v ?? "")));
  if (!Number.isInteger(n) || n < min || n > max) throw new AccError(`${label} عددی از ${faNum(min)} تا ${faNum(max)} است`);
  return n;
};

export async function saveOrg(tx: Tx, id: string | null, input: OrgInput, actor: Actor): Promise<AccInstallmentOrg> {
  const cur = id ? await tx.accInstallmentOrg.findUnique({ where: { id } }) : null;
  if (id && !cur) throw new AccError("سازمان پیدا نشد", 404);
  const name = input.name !== undefined ? str(input.name, 120) : cur?.name ?? null;
  if (!name) throw new AccError("نام سازمان را بنویسید؛ مثلاً «آموزش و پرورش ساری»");
  const dup = await tx.accInstallmentOrg.findFirst({ where: { name, ...(cur ? { id: { not: cur.id } } : {}) }, select: { id: true } });
  if (dup) throw new AccError(`سازمانی با نام «${name}» هست`);
  const pct = input.commissionPct !== undefined ? Number(fa2en(String(input.commissionPct || 0))) : (cur?.commissionBp ?? 0) / 100;
  if (!Number.isFinite(pct) || pct < 0 || pct >= 50) throw new AccError("پورسانت سازمان بین ۰ تا ۵۰ درصد");
  const data = {
    name,
    months: input.months !== undefined ? int(input.months, "تعداد قسط", 1, 60) : cur?.months ?? 6,
    commissionBp: Math.round(pct * 100),
    capPerCustomer: input.capPerCustomer !== undefined ? money(input.capPerCustomer, "سقف خرید هر نفر") : cur?.capPerCustomer ?? null,
    capTotal: input.capTotal !== undefined ? money(input.capTotal, "سقف کل") : cur?.capTotal ?? null,
    minPurchase: input.minPurchase !== undefined ? money(input.minPurchase, "حداقل خرید") : cur?.minPurchase ?? null,
    firstDueMonths: input.firstDueMonths !== undefined ? int(input.firstDueMonths, "قسط اول (ماه بعد)", 0, 12) : cur?.firstDueMonths ?? 1,
    dueDay: input.dueDay !== undefined ? int(input.dueDay, "روز سررسید", 1, 29) : cur?.dueDay ?? 1,
    roundTo: input.roundTo !== undefined ? int(input.roundTo || 0, "گرد کردن", 0, 1_000_000) : cur?.roundTo ?? 1000,
    requireRef: typeof input.requireRef === "boolean" ? input.requireRef : cur?.requireRef ?? true,
    contractNo: input.contractNo !== undefined ? str(input.contractNo, 80) : cur?.contractNo ?? null,
    contactName: input.contactName !== undefined ? str(input.contactName, 120) : cur?.contactName ?? null,
    contactPhone: input.contactPhone !== undefined ? str(input.contactPhone && fa2en(String(input.contactPhone)), 40) : cur?.contactPhone ?? null,
    note: input.note !== undefined ? str(input.note, 1000) : cur?.note ?? null,
    color: input.color !== undefined ? (typeof input.color === "string" && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : null) : cur?.color ?? null,
    isActive: typeof input.isActive === "boolean" ? input.isActive : cur?.isActive ?? true,
  };
  if (cur) {
    if (name !== cur.name) await tx.accParty.update({ where: { id: cur.partyId }, data: { name } });
    return tx.accInstallmentOrg.update({ where: { id: cur.id }, data });
  }
  // شخص حسابداری سازمان: اگر هم‌نام هست همان، وگرنه تازه (حقوقی)
  const existing = await tx.accParty.findFirst({ where: { name, mergedIntoId: null } });
  const taken = existing ? await tx.accInstallmentOrg.findUnique({ where: { partyId: existing.id } }) : null;
  const party =
    existing && !taken
      ? await tx.accParty.update({ where: { id: existing.id }, data: { isCustomer: true } })
      : await createParty(tx, { personType: "LEGAL", companyName: name, name, isCustomer: true, note: `سازمان اقساط — ${actor.name}` });
  return tx.accInstallmentOrg.create({ data: { ...data, partyId: party.id } });
}

// ───────────────────────── برآورد فروش ─────────────────────────

export interface OrgQuote {
  org: { id: string; name: string; months: number; commissionBp: number; requireRef: boolean; color: string | null };
  amount: bigint;
  commission: bigint;
  net: bigint;
  monthly: bigint;
  schedule: { seq: number; dueDate: Date; amount: bigint }[];
  /** سقف هر نفر: استفاده‌شده (خریدهای باز) و باقی */
  cap: { limit: bigint | null; used: bigint; available: bigint | null };
  /** سقف کل سازمان */
  orgCap: { limit: bigint | null; used: bigint; available: bigint | null };
  /** خطاها به زبان صندوقدار — خالی یعنی مجاز */
  problems: string[];
}

/** جدول اقساط: قسط اول = ماه خرید + firstDueMonths، روز dueDay؛ گرد کردن و اختلاف در قسط آخر */
export function orgSchedule(org: Pick<AccInstallmentOrg, "months" | "firstDueMonths" | "dueDay" | "roundTo">, net: bigint, saleDay: Date) {
  const j = toJalali(saleDay);
  const total = j.year * 12 + (j.month - 1) + org.firstDueMonths;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const first = fromJalali(y, m, Math.min(org.dueDay, jalaliMonthLength(y, m)))!;
  const n = BigInt(org.months);
  const round = BigInt(Math.max(1, org.roundTo));
  let each = net / n;
  each = (each / round) * round;
  if (each <= 0n) each = net / n;
  const rows = Array.from({ length: org.months }, (_, i) => ({ seq: i + 1, dueDate: i === 0 ? first : addJalaliMonths(first, i), amount: each }));
  rows[rows.length - 1].amount = net - each * (n - 1n);
  return rows;
}

const commissionOf = (amount: bigint, bp: number) => (amount * BigInt(bp) + 5_000n) / 10_000n;

export async function orgQuote(db: Db, orgId: string, partyId: string | null, amount: bigint, saleDay: Date = todayKey()): Promise<OrgQuote> {
  const org = await db.accInstallmentOrg.findUnique({ where: { id: orgId } });
  if (!org) throw new AccError("سازمان اقساط پیدا نشد", 404);
  const problems: string[] = [];
  if (!org.isActive) problems.push(`قرارداد «${org.name}» غیرفعال است`);
  if (!partyId) problems.push("برای خرید اقساطی مشتری (کارمند معرفی‌شده) را انتخاب کنید");
  if (amount <= 0n) problems.push("مبلغ اقساطی باید بیشتر از صفر باشد");
  if (org.minPurchase && amount < org.minPurchase) problems.push(`حداقل خرید اقساطی «${org.name}» ${formatAmount(org.minPurchase)} تومان است`);
  // سقف هر نفر: جمع خرید قراردادهای باز همین سازمان
  let used = 0n;
  if (partyId) {
    const open = await db.accOrgContract.aggregate({ where: { orgId, partyId, status: "ACTIVE" }, _sum: { total: true } });
    used = open._sum.total ?? 0n;
  }
  const available = org.capPerCustomer ? (org.capPerCustomer > used ? org.capPerCustomer - used : 0n) : null;
  if (available !== null && amount > available) {
    problems.push(`سقف خرید هر نفر ${formatAmount(org.capPerCustomer!)} تومان است؛ این مشتری ${formatAmount(used)} خرید باز دارد و حداکثر ${formatAmount(available)} تومان دیگر می‌تواند قسطی بخرد`);
  }
  const commission = commissionOf(amount > 0n ? amount : 0n, org.commissionBp);
  const net = amount - commission;
  // سقف کل سازمان: مانده‌ی اقساط باز همه
  const rem = await db.$queryRaw<{ s: bigint | null }[]>`
    SELECT SUM(i."amount" - i."paid") s FROM "AccOrgInstallment" i JOIN "AccOrgContract" c ON c.id = i."contractId"
    WHERE c."orgId" = ${orgId} AND c."status" = 'ACTIVE'`;
  const orgUsed = BigInt(rem[0]?.s ?? 0);
  const orgAvail = org.capTotal ? (org.capTotal > orgUsed ? org.capTotal - orgUsed : 0n) : null;
  if (orgAvail !== null && net > orgAvail) problems.push(`سقف اعتبار کل «${org.name}» پر است (باقی ${formatAmount(orgAvail)} تومان)`);
  const schedule = amount > 0n && net > 0n ? orgSchedule(org, net, saleDay) : [];
  return {
    org: { id: org.id, name: org.name, months: org.months, commissionBp: org.commissionBp, requireRef: org.requireRef, color: org.color },
    amount,
    commission,
    net,
    monthly: schedule[0]?.amount ?? 0n,
    schedule,
    cap: { limit: org.capPerCustomer, used, available },
    orgCap: { limit: org.capTotal, used: orgUsed, available: orgAvail },
    problems,
  };
}

export interface OrgSaleInput {
  orgId: string;
  amount: bigint;
  employeeCode?: string | null;
  letterNo?: string | null;
  note?: string | null;
}

const cleanRef = (v: string | null | undefined) => (v ? fa2en(v).trim().slice(0, 60) || null : null);

/** پیش از ساخت دریافت: همه‌ی شرط‌ها + ردیف روش پرداخت */
export async function prepareOrgSale(tx: Tx, partyId: string | null, input: OrgSaleInput, day: Date) {
  await tx.$queryRaw`SELECT id FROM "AccInstallmentOrg" WHERE id = ${input.orgId} FOR UPDATE`;
  const q = await orgQuote(tx, input.orgId, partyId, input.amount, day);
  if (q.problems.length) throw new AccError(q.problems[0]);
  const employeeCode = cleanRef(input.employeeCode);
  const letterNo = cleanRef(input.letterNo);
  if (q.org.requireRef && !employeeCode && !letterNo) throw new AccError(`برای «${q.org.name}» کد پرسنلی یا شماره‌ی معرفی‌نامه را بنویسید`);
  const org = await tx.accInstallmentOrg.findUniqueOrThrow({ where: { id: input.orgId } });
  const item = {
    method: "ORG_INSTALLMENT" as const,
    amount: input.amount,
    fee: q.commission,
    counterPartyId: org.partyId,
    trackingCode: [org.name, employeeCode && `پرسنلی ${employeeCode}`, letterNo && `معرفی‌نامه ${letterNo}`].filter(Boolean).join(" — ").slice(0, 190),
  };
  return { q, org, item, employeeCode, letterNo };
}

/** بعد از ساخت دریافت: قرارداد و جدول اقساط */
export async function createContract(
  tx: Tx,
  prep: Awaited<ReturnType<typeof prepareOrgSale>>,
  ctx: { partyId: string; moneyDocId: string; invoiceId?: string | null; posTicketId?: string | null; note?: string | null },
  actor: Actor,
) {
  const party = await tx.accParty.findUniqueOrThrow({ where: { id: ctx.partyId } });
  const number = await nextNumber(tx, GLOBAL_SEQ, "org:contract", 1);
  return tx.accOrgContract.create({
    data: {
      number,
      orgId: prep.org.id,
      partyId: party.id,
      customerName: party.name,
      mobile: party.mobile,
      nationalId: party.nationalId,
      employeeCode: prep.employeeCode,
      letterNo: prep.letterNo,
      invoiceId: ctx.invoiceId ?? null,
      posTicketId: ctx.posTicketId ?? null,
      moneyDocId: ctx.moneyDocId,
      total: prep.q.amount,
      commissionBp: prep.q.org.commissionBp,
      commission: prep.q.commission,
      net: prep.q.net,
      months: prep.q.org.months,
      firstDue: prep.q.schedule[0].dueDate,
      note: ctx.note ?? null,
      createdByName: actor.name,
      items: { create: prep.q.schedule.map((r) => ({ seq: r.seq, dueDate: r.dueDate, amount: r.amount })) },
    },
  });
}

/** فروش اقساطی روی فاکتور فروش صادرشده (صفحه‌ی فاکتور) — مبلغ ≤ مانده‌ی باز فاکتور */
export async function sellOnInvoice(tx: Tx, invoiceId: string, input: OrgSaleInput & { date?: Date | null }, actor: Actor) {
  const inv = await tx.accInvoice.findUnique({ where: { id: invoiceId } });
  if (!inv || inv.type !== "SALES") throw new AccError("فاکتور فروش پیدا نشد", 404);
  if (inv.status !== "ISSUED") throw new AccError("فقط فاکتور صادرشده قسطی می‌شود");
  if (!inv.partyId) throw new AccError("فاکتور مشتری ندارد");
  if (await tx.accInstallmentPlan.count({ where: { invoiceId } })) throw new AccError("این فاکتور برنامه‌ی اقساط مشتری دارد؛ اقساط سازمانی با آن جمع نمی‌شود");
  const open = (await invoiceOpenAmounts(tx, [invoiceId])).get(invoiceId)?.open ?? 0n;
  if (input.amount > open) throw new AccError(`مبلغ اقساطی از مانده‌ی فاکتور (${formatAmount(open)} تومان) بیشتر است`);
  const day = input.date ?? todayKey();
  const prep = await prepareOrgSale(tx, inv.partyId, input, day);
  const doc = await createMoneyDoc(
    tx,
    {
      kind: "RECEIPT",
      date: day,
      partyId: inv.partyId,
      description: `اقساط سازمانی ${prep.org.name} — فاکتور فروش ${faNum(inv.number ?? 0)}`,
      items: [prep.item],
      allocations: [{ invoiceId, amount: input.amount }],
    },
    actor,
  );
  return createContract(tx, prep, { partyId: inv.partyId, moneyDocId: doc.id, invoiceId, note: input.note }, actor);
}

/** ابطال قرارداد از صفحه‌ی اقساط: فقط بی قسط دریافت‌شده و فقط فروش فاکتوری (صندوق ← ابطال رسید) */
export async function voidContract(tx: Tx, id: string, reason: string, actor: Actor) {
  const c = await tx.accOrgContract.findUnique({ where: { id } });
  if (!c) throw new AccError("قرارداد پیدا نشد", 404);
  if (c.status === "VOID") return c;
  if (c.posTicketId) throw new AccError("این خرید از صندوق است؛ رسید صندوقش را باطل کنید (همه‌چیز با هم برمی‌گردد)", 409);
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  await voidMoneyDoc(tx, c.moneyDocId, `ابطال قرارداد اقساط سازمانی ${faNum(c.number)}: ${reason.trim()}`, actor);
  return tx.accOrgContract.findUniqueOrThrow({ where: { id } });
}

// ───────────────────────── دریافت ماهانه از سازمان ─────────────────────────

export interface SettlementInput {
  orgId: string;
  period: string;
  treasuryId: string;
  date?: Date | null;
  trackingCode?: string | null;
  note?: string | null;
  fileName?: string | null;
  /** مبلغ هر مشتری — روی قسط‌های باز همان مشتری (قدیمی‌ترین اول) می‌نشیند */
  rows: { partyId: string; amount: bigint }[];
}

export async function createSettlement(tx: Tx, input: SettlementInput, actor: Actor) {
  const org = await tx.accInstallmentOrg.findUnique({ where: { id: input.orgId } });
  if (!org) throw new AccError("سازمان پیدا نشد", 404);
  periodRange(input.period);
  const rows = input.rows.filter((r) => r.amount !== 0n);
  if (!rows.length) throw new AccError("مبلغی برای هیچ مشتری نیامده");
  if (rows.some((r) => r.amount < 0n)) throw new AccError("مبلغ منفی نمی‌شود");
  const parties = [...new Set(rows.map((r) => r.partyId))];
  if (parties.length !== rows.length) throw new AccError("یک مشتری دو بار آمده");
  // قسط‌های باز هر مشتری در همین سازمان (قفل)
  await tx.$queryRaw`SELECT id FROM "AccInstallmentOrg" WHERE id = ${org.id} FOR UPDATE`;
  const items = await tx.accOrgInstallment.findMany({
    where: { contract: { orgId: org.id, status: "ACTIVE", partyId: { in: parties } } },
    include: { contract: { select: { partyId: true, customerName: true } } },
    orderBy: [{ dueDate: "asc" }, { seq: "asc" }],
  });
  const lines: { installmentId: string; amount: bigint }[] = [];
  for (const r of rows) {
    let left = r.amount;
    const mine = items.filter((i) => i.contract.partyId === r.partyId && i.paid < i.amount);
    const name = items.find((i) => i.contract.partyId === r.partyId)?.contract.customerName ?? "مشتری";
    const open = mine.reduce((s, i) => s + i.amount - i.paid, 0n);
    if (r.amount > open) throw new AccError(`مبلغ «${name}» (${formatAmount(r.amount)}) از مانده‌ی اقساطش (${formatAmount(open)}) بیشتر است`);
    for (const i of mine) {
      if (left <= 0n) break;
      const put = i.amount - i.paid < left ? i.amount - i.paid : left;
      lines.push({ installmentId: i.id, amount: put });
      left -= put;
    }
  }
  const total = rows.reduce((s, r) => s + r.amount, 0n);
  const tr = await tx.accTreasury.findUnique({ where: { id: input.treasuryId } });
  if (!tr || !tr.isActive) throw new AccError("بانک یا صندوق دریافت را انتخاب کنید");
  const method = tr.kind === "CASH" ? "CASH" : "BANK_TRANSFER";
  if (tr.kind !== "CASH" && tr.kind !== "BANK") throw new AccError("دریافت سازمان به بانک یا صندوق می‌نشیند");
  const day = input.date ?? todayKey();
  const doc = await createMoneyDoc(
    tx,
    {
      kind: "RECEIPT",
      date: day,
      partyId: org.partyId,
      description: `اقساط ${periodLabel(input.period)} ${org.name} — ${faNum(rows.length)} نفر`,
      items: [{ method, treasuryId: tr.id, amount: total, trackingCode: input.trackingCode ?? null }],
    },
    actor,
  );
  const number = await nextNumber(tx, GLOBAL_SEQ, "org:settlement", 1);
  const st = await tx.accOrgSettlement.create({
    data: {
      number,
      orgId: org.id,
      period: input.period,
      amount: total,
      moneyDocId: doc.id,
      note: input.note?.trim() || null,
      fileName: input.fileName ?? null,
      createdByName: actor.name,
      lines: { create: lines },
    },
  });
  await recalcOrgInstallments(tx, lines.map((l) => l.installmentId));
  return st;
}

export async function voidSettlement(tx: Tx, id: string, reason: string, actor: Actor) {
  const st = await tx.accOrgSettlement.findUnique({ where: { id } });
  if (!st) throw new AccError("دریافت پیدا نشد", 404);
  if (st.voidedAt) return st;
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  await voidMoneyDoc(tx, st.moneyDocId, `ابطال دریافت اقساط ${periodLabel(st.period)}: ${reason.trim()}`, actor);
  return tx.accOrgSettlement.findUniqueOrThrow({ where: { id } });
}

// ───────────────────────── گزارش‌ها ─────────────────────────

interface InstRow {
  id: string;
  contractId: string;
  dueDate: Date;
  amount: bigint;
  paid: bigint;
  partyId: string;
}

async function openItems(db: Db, orgIds: string[]) {
  return db.accOrgInstallment.findMany({
    where: { contract: { orgId: { in: orgIds }, status: { in: ["ACTIVE", "DONE"] } } },
    select: { id: true, contractId: true, dueDate: true, amount: true, paid: true, contract: { select: { orgId: true, partyId: true, status: true } } },
  });
}

/** کاشی هر سازمان: بدهی کل، قسط این ماه، معوق، مشتری فعال */
export async function orgSummaries(db: Db) {
  const orgs = await db.accInstallmentOrg.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  const items = await openItems(db, orgs.map((o) => o.id));
  const thisPeriod = periodOf(todayKey());
  const { start, end } = periodRange(thisPeriod);
  return orgs.map((o) => {
    const mine = items.filter((i) => i.contract.orgId === o.id);
    let debt = 0n;
    let thisMonth = 0n;
    let thisMonthPaid = 0n;
    let overdue = 0n;
    const active = new Set<string>();
    for (const i of mine) {
      const rest = i.amount - i.paid;
      debt += rest;
      if (rest > 0n) active.add(i.contract.partyId);
      if (i.dueDate >= start && i.dueDate < end) {
        thisMonth += i.amount;
        thisMonthPaid += i.paid;
      }
      if (i.dueDate < start) overdue += rest;
    }
    return { ...o, stats: { debt, thisMonth, thisMonthPaid, overdue, customers: active.size, period: thisPeriod } };
  });
}

/** جزئیات سازمان: ماه‌به‌ماه، مشتری‌ها، دریافت‌ها */
export async function orgDetail(db: Db, orgId: string) {
  const org = await db.accInstallmentOrg.findUnique({ where: { id: orgId } });
  if (!org) throw new AccError("سازمان پیدا نشد", 404);
  const contracts = await db.accOrgContract.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { seq: "asc" } } },
  });
  const settlements = await db.accOrgSettlement.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 200 });
  const today = todayKey();
  const thisPeriod = periodOf(today);
  const { start } = periodRange(thisPeriod);

  // ماه‌به‌ماه
  const months = new Map<string, { period: string; expected: bigint; paid: bigint; customers: Set<string> }>();
  // مشتری‌ها
  const customers = new Map<
    string,
    {
      partyId: string;
      name: string;
      mobile: string | null;
      nationalId: string | null;
      employeeCode: string | null;
      contracts: number;
      total: bigint;
      net: bigint;
      paid: bigint;
      remaining: bigint;
      monthly: bigint;
      overdue: bigint;
      nextDue: Date | null;
      lastBuy: Date;
    }
  >();
  let debt = 0n;
  let overdue = 0n;
  let commission = 0n;
  let sales = 0n;
  for (const c of contracts) {
    if (c.status === "VOID") continue;
    sales += c.total;
    commission += c.commission;
    const cu =
      customers.get(c.partyId) ??
      { partyId: c.partyId, name: c.customerName, mobile: c.mobile, nationalId: c.nationalId, employeeCode: c.employeeCode, contracts: 0, total: 0n, net: 0n, paid: 0n, remaining: 0n, monthly: 0n, overdue: 0n, nextDue: null, lastBuy: c.createdAt };
    cu.contracts++;
    cu.total += c.total;
    cu.net += c.net;
    if (c.employeeCode && !cu.employeeCode) cu.employeeCode = c.employeeCode;
    if (c.createdAt > cu.lastBuy) cu.lastBuy = c.createdAt;
    for (const i of c.items) {
      const p = periodOf(i.dueDate);
      const m = months.get(p) ?? { period: p, expected: 0n, paid: 0n, customers: new Set<string>() };
      m.expected += i.amount;
      m.paid += i.paid;
      m.customers.add(c.partyId);
      months.set(p, m);
      const rest = i.amount - i.paid;
      cu.paid += i.paid;
      cu.remaining += rest;
      debt += rest;
      if (i.dueDate < start && rest > 0n) {
        cu.overdue += rest;
        overdue += rest;
      }
      if (rest > 0n && (!cu.nextDue || i.dueDate < cu.nextDue)) cu.nextDue = i.dueDate;
      if (periodOf(i.dueDate) === thisPeriod) cu.monthly += i.amount;
    }
    customers.set(c.partyId, cu);
  }
  const monthRows = [...months.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((m) => ({
      period: m.period,
      label: periodLabel(m.period),
      expected: m.expected,
      paid: m.paid,
      remaining: m.expected - m.paid,
      customers: m.customers.size,
      state: m.paid >= m.expected ? "PAID" : m.period < thisPeriod ? (m.paid > 0n ? "PARTIAL_LATE" : "LATE") : m.period === thisPeriod ? "CURRENT" : "UPCOMING",
    }));
  const ledger = await db.accVoucherLine.aggregate({ where: { partyId: org.partyId, isVoid: false, account: { systemKey: "AR" } }, _sum: { debit: true, credit: true } });
  const thisMonth = monthRows.find((m) => m.period === thisPeriod);
  return {
    org,
    kpi: {
      debt,
      overdue,
      sales,
      commission,
      thisMonth: thisMonth?.expected ?? 0n,
      thisMonthPaid: thisMonth?.paid ?? 0n,
      customers: [...customers.values()].filter((c) => c.remaining > 0n).length,
      allCustomers: customers.size,
      ledgerBalance: (ledger._sum.debit ?? 0n) - (ledger._sum.credit ?? 0n),
      period: thisPeriod,
    },
    months: monthRows,
    customers: [...customers.values()].sort((a, b) => (b.remaining > a.remaining ? 1 : b.remaining < a.remaining ? -1 : a.name.localeCompare(b.name))),
    contracts: contracts.map((c) => ({
      id: c.id,
      number: c.number,
      partyId: c.partyId,
      customerName: c.customerName,
      employeeCode: c.employeeCode,
      letterNo: c.letterNo,
      total: c.total,
      commission: c.commission,
      net: c.net,
      months: c.months,
      status: c.status,
      createdAt: c.createdAt,
      invoiceId: c.invoiceId,
      posTicketId: c.posTicketId,
      paid: c.items.reduce((s, i) => s + i.paid, 0n),
      voidReason: c.voidReason,
    })),
    settlements,
  };
}

/** فهرست یک ماه برای خروجی/دریافت: هر مشتری با قسط این ماه، معوق قبلی و مانده‌ی کل */
export async function periodList(db: Db, orgId: string, period: string) {
  const { start, end } = periodRange(period);
  const contracts = await db.accOrgContract.findMany({
    where: { orgId, status: { in: ["ACTIVE", "DONE"] } },
    include: { items: true },
  });
  const by = new Map<string, { partyId: string; name: string; mobile: string | null; nationalId: string | null; employeeCode: string | null; due: bigint; dueGross: bigint; duePaid: bigint; overdue: bigint; remaining: bigint; contracts: number[] }>();
  for (const c of contracts) {
    const r = by.get(c.partyId) ?? { partyId: c.partyId, name: c.customerName, mobile: c.mobile, nationalId: c.nationalId, employeeCode: c.employeeCode, due: 0n, dueGross: 0n, duePaid: 0n, overdue: 0n, remaining: 0n, contracts: [] };
    let touched = false;
    for (const i of c.items) {
      const rest = i.amount - i.paid;
      r.remaining += rest;
      if (i.dueDate >= start && i.dueDate < end) {
        r.due += i.amount;
        // کسر از حقوق کارمند (پیش از پورسانت سازمان) — هم‌نسبت مبلغ خرید به مبلغ قسطی
        r.dueGross += c.net > 0n ? (i.amount * c.total + c.net / 2n) / c.net : i.amount;
        r.duePaid += i.paid;
        touched = true;
      } else if (i.dueDate < start && rest > 0n) {
        r.overdue += rest;
        touched = true;
      }
    }
    if (touched) r.contracts.push(c.number);
    if (!r.employeeCode && c.employeeCode) r.employeeCode = c.employeeCode;
    by.set(c.partyId, r);
  }
  const rows = [...by.values()].filter((r) => r.due > 0n || r.overdue > 0n).sort((a, b) => a.name.localeCompare(b.name));
  return {
    period,
    label: periodLabel(period),
    rows: rows.map((r) => ({ ...r, toPay: r.due - r.duePaid + r.overdue })),
    total: rows.reduce((s, r) => s + r.due, 0n),
    totalGross: rows.reduce((s, r) => s + r.dueGross, 0n),
    toPay: rows.reduce((s, r) => s + r.due - r.duePaid + r.overdue, 0n),
  };
}

/** خرید اقساطی‌های یک مشتری (پرونده‌ی صندوق، صفحه‌ی مشتری) */
export async function partyContracts(db: Db, partyId: string) {
  const cs = await db.accOrgContract.findMany({
    where: { partyId, status: { not: "VOID" } },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { seq: "asc" } }, org: { select: { id: true, name: true, color: true } } },
  });
  return cs.map((c) => ({
    id: c.id,
    number: c.number,
    org: c.org,
    total: c.total,
    net: c.net,
    status: c.status,
    createdAt: c.createdAt,
    paid: c.items.reduce((s, i) => s + i.paid, 0n),
    remaining: c.items.reduce((s, i) => s + i.amount - i.paid, 0n),
    monthly: c.items[0]?.amount ?? 0n,
    nextDue: c.items.find((i) => i.paid < i.amount)?.dueDate ?? null,
  }));
}

export async function contractDetail(db: Db, id: string) {
  const c = await db.accOrgContract.findUnique({
    where: { id },
    include: { items: { orderBy: { seq: "asc" }, include: { lines: { include: { settlement: { select: { number: true, period: true, createdAt: true, voidedAt: true } } } } } }, org: true },
  });
  if (!c) throw new AccError("قرارداد پیدا نشد", 404);
  const [inv, ticket] = await Promise.all([
    c.invoiceId ? db.accInvoice.findUnique({ where: { id: c.invoiceId }, select: { id: true, number: true, date: true } }) : null,
    c.posTicketId ? db.accPosTicket.findUnique({ where: { id: c.posTicketId }, select: { id: true, number: true, saleInvoiceId: true } }) : null,
  ]);
  return { ...c, invoice: inv, ticket };
}

// ───────────────────────── تطبیق فایل اکسل سازمان ─────────────────────────

const norm = (s: string) => fa2en(String(s ?? "")).replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").replace(/‌/g, " ").replace(/\s+/g, " ").trim();
const digits = (s: string) => norm(s).replace(/\D/g, "");

/**
 * فایل سازمان (هر ستون‌بندی): ستون مبلغ و دست‌کم یکی از کد پرسنلی، کد ملی، موبایل یا نام را خودش پیدا می‌کند.
 * خروجی برای پیش‌نمایش: هر سطر فایل ← مشتری (یا پیدا نشد) و مبلغ؛ مشتری‌های ماه که در فایل نیستند.
 */
export async function matchOrgFile(db: Db, orgId: string, period: string, sheet: string[][]) {
  const list = await periodList(db, orgId, period);
  // همه‌ی مشتری‌های سازمان (نه فقط این ماه) — شاید سازمان پیش‌پرداخت یا معوق را با هم فرستاده باشد
  const contracts = await db.accOrgContract.findMany({ where: { orgId, status: { in: ["ACTIVE", "DONE"] } }, select: { partyId: true, customerName: true, mobile: true, nationalId: true, employeeCode: true } });
  const people = new Map<string, { partyId: string; name: string; mobile: string | null; nationalId: string | null; codes: Set<string> }>();
  for (const c of contracts) {
    const p = people.get(c.partyId) ?? { partyId: c.partyId, name: c.customerName, mobile: c.mobile, nationalId: c.nationalId, codes: new Set<string>() };
    if (c.employeeCode) p.codes.add(digits(c.employeeCode) || norm(c.employeeCode));
    people.set(c.partyId, p);
  }
  // سرستون
  // سرستون = سطری از ۱۵ سطر اول که بیشترین سرستون شناخته‌شده را دارد (عنوان «گزارش کسر حقوق» بالای جدول گولش نزند)
  const HEAD = [/مبلغ|کسر|قسط|amount/i, /پرسنل|کارمند|استخدام/, /ملی/, /موبایل|همراه|تلفن|mobile/i, /نام/];
  let headerIdx = -1;
  let best = 0;
  sheet.slice(0, 15).forEach((r, i) => {
    const score = HEAD.filter((re) => r.some((c) => re.test(norm(c)) && norm(c).length < 40)).length;
    if (score > best) {
      best = score;
      headerIdx = i;
    }
  });
  if (best < 2) headerIdx = -1;
  const header = headerIdx >= 0 ? sheet[headerIdx].map(norm) : [];
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const cAmount = col(/مبلغ|کسر|قسط|amount/i);
  const cCode = col(/پرسنل|کارمند|استخدام/);
  const cNid = col(/ملی/);
  const cMobile = col(/موبایل|همراه|تلفن|mobile/i);
  const cName = col(/نام/);
  const cFamily = header.findIndex((h, i) => i !== cName && /خانوادگی|فامیل/.test(h));
  if (cAmount < 0) throw new AccError("ستون «مبلغ» در فایل پیدا نشد؛ سرستون مبلغ را «مبلغ» یا «مبلغ کسر» بنویسید");
  if (cCode < 0 && cNid < 0 && cMobile < 0 && cName < 0) throw new AccError("ستون کد پرسنلی، کد ملی، موبایل یا نام پیدا نشد");
  const rows: { line: number; text: string; amount: bigint; partyId: string | null; name: string | null; by: string | null }[] = [];
  for (let r = headerIdx + 1; r < sheet.length; r++) {
    const row = sheet[r];
    const amt = digits(row[cAmount] ?? "");
    if (!amt) continue;
    const code = cCode >= 0 ? digits(row[cCode] ?? "") || norm(row[cCode] ?? "") : "";
    const nid = cNid >= 0 ? digits(row[cNid] ?? "") : "";
    let mob = cMobile >= 0 ? digits(row[cMobile] ?? "") : "";
    if (mob.length === 10 && mob.startsWith("9")) mob = `0${mob}`;
    const name = norm([cName >= 0 ? row[cName] : "", cFamily >= 0 ? row[cFamily] : ""].filter(Boolean).join(" "));
    let hit: { partyId: string; name: string } | null = null;
    let by: string | null = null;
    for (const p of people.values()) {
      if (code && p.codes.has(code)) { hit = p; by = "کد پرسنلی"; break; }
    }
    if (!hit && nid) for (const p of people.values()) if (p.nationalId && digits(p.nationalId) === nid) { hit = p; by = "کد ملی"; break; }
    if (!hit && mob) for (const p of people.values()) if (p.mobile && digits(p.mobile) === mob) { hit = p; by = "موبایل"; break; }
    if (!hit && name) {
      const same = [...people.values()].filter((p) => norm(p.name) === name);
      if (same.length === 1) { hit = same[0]; by = "نام"; }
    }
    rows.push({ line: r + 1, text: [name, code && `پرسنلی ${code}`, nid && `ملی ${nid}`, mob].filter(Boolean).join(" · "), amount: BigInt(amt), partyId: hit?.partyId ?? null, name: hit?.name ?? null, by });
  }
  // جمع هر مشتری (اگر سازمان دو سطر برای یک نفر فرستاده)
  const perParty = new Map<string, bigint>();
  for (const r of rows) if (r.partyId) perParty.set(r.partyId, (perParty.get(r.partyId) ?? 0n) + r.amount);
  const expected = new Map(list.rows.map((r) => [r.partyId, r]));
  return {
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0n),
    unmatched: rows.filter((r) => !r.partyId).length,
    perParty: [...perParty.entries()].map(([partyId, amount]) => ({ partyId, amount, expected: expected.get(partyId)?.toPay ?? 0n })),
    missing: list.rows.filter((r) => !perParty.has(r.partyId) && r.toPay > 0n).map((r) => ({ partyId: r.partyId, name: r.name, toPay: r.toPay })),
  };
}
