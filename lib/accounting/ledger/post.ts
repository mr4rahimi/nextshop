/**
 * تنها راه نوشتن سند — docs/plans/accounting.md بخش ۶.۴.
 *
 * ناورداها (نقض = AccError، هیچ‌چیز نوشته نمی‌شود):
 *   ۱. Σبدهکار = Σبستانکار و بزرگ‌تر از صفر
 *   ۲. هر ردیف دقیقاً یک طرف مثبت دارد
 *   ۳. حساب ردیف معین و فعال است؛ تفصیلی دقیقاً همان است که حساب می‌خواهد
 *   ۴. تاریخ داخل سال مالی باز و بعد از تاریخ قفل
 *
 * سند خودکار (منبعش فاکتور، دریافت، کاردکس …) با `rebuildVoucher` بازسازی
 * می‌شود و شماره‌اش می‌ماند؛ سند دستی با ابطال یا سند معکوس اصلاح می‌شود.
 */

import type { AccSource, AccVoucher, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { assertPostable } from "./fiscal-year";
import { nextNumber } from "./sequence";
import { faNum, formatAmount } from "../money";

export interface LineInput {
  accountId?: string;
  /** به‌جای `accountId` — کلید سیستمی (`AR`، `CASH`، …) */
  accountKey?: string;
  partyId?: string | null;
  treasuryId?: string | null;
  debit?: bigint;
  credit?: bigint;
  description?: string | null;
}

export interface Actor {
  id?: string | null;
  name: string;
}

export interface VoucherInput {
  date: Date;
  description: string;
  source: AccSource;
  sourceId?: string | null;
  lines: LineInput[];
  actor: Actor;
}

type Tx = Prisma.TransactionClient;

interface ResolvedLine {
  accountId: string;
  partyId: string | null;
  treasuryId: string | null;
  debit: bigint;
  credit: bigint;
  description: string | null;
}

async function resolveLines(tx: Tx, lines: LineInput[]): Promise<{ lines: ResolvedLine[]; total: bigint }> {
  if (lines.length < 2) throw new AccError("سند دست‌کم دو ردیف لازم دارد");

  const keys = [...new Set(lines.map((l) => l.accountKey).filter((k): k is string => !!k))];
  const byKey = new Map(
    (await tx.accAccount.findMany({ where: { systemKey: { in: keys } } })).map((a) => [a.systemKey!, a.id]),
  );
  for (const k of keys) if (!byKey.has(k)) throw new AccError(`حساب سیستمی «${k}» در سرفصل نیست`);

  const resolved = lines.map((l, i) => {
    const accountId = l.accountId ?? (l.accountKey ? byKey.get(l.accountKey) : undefined);
    if (!accountId) throw new AccError(`ردیف ${faNum(i + 1)}: حساب انتخاب نشده`);
    const debit = l.debit ?? 0n;
    const credit = l.credit ?? 0n;
    if (debit < 0n || credit < 0n) throw new AccError(`ردیف ${faNum(i + 1)}: مبلغ منفی مجاز نیست`);
    if ((debit > 0n) === (credit > 0n)) {
      throw new AccError(`ردیف ${faNum(i + 1)}: هر ردیف یا بدهکار است یا بستانکار — نه هر دو، نه هیچ‌کدام`);
    }
    return {
      accountId,
      partyId: l.partyId || null,
      treasuryId: l.treasuryId || null,
      debit,
      credit,
      description: l.description?.trim() || null,
    };
  });

  const accounts = new Map(
    (await tx.accAccount.findMany({ where: { id: { in: [...new Set(resolved.map((l) => l.accountId))] } } })).map((a) => [a.id, a]),
  );
  const partyIds = [...new Set(resolved.map((l) => l.partyId).filter((x): x is string => !!x))];
  const treasuryIds = [...new Set(resolved.map((l) => l.treasuryId).filter((x): x is string => !!x))];
  const parties = new Map((await tx.accParty.findMany({ where: { id: { in: partyIds } } })).map((p) => [p.id, p]));
  const treasuries = new Map((await tx.accTreasury.findMany({ where: { id: { in: treasuryIds } } })).map((t) => [t.id, t]));

  resolved.forEach((l, i) => {
    const acc = accounts.get(l.accountId);
    const at = `ردیف ${faNum(i + 1)}`;
    if (!acc) throw new AccError(`${at}: حساب پیدا نشد`);
    if (acc.level !== "SUBLEDGER") throw new AccError(`${at}: «${acc.name}» حساب معین نیست؛ سند فقط روی معین می‌نشیند`);
    if (!acc.isActive) throw new AccError(`${at}: حساب «${acc.name}» غیرفعال است`);
    if (acc.detailKind === "PARTY") {
      if (!l.partyId) throw new AccError(`${at}: حساب «${acc.name}» شخص لازم دارد`);
      const p = parties.get(l.partyId);
      if (!p) throw new AccError(`${at}: شخص پیدا نشد`);
      if (!p.isActive) throw new AccError(`${at}: شخص «${p.name}» غیرفعال است`);
    } else if (l.partyId) {
      throw new AccError(`${at}: حساب «${acc.name}» شخص نمی‌پذیرد`);
    }
    if (acc.detailKind === "TREASURY") {
      if (!l.treasuryId) throw new AccError(`${at}: حساب «${acc.name}» صندوق یا بانک لازم دارد`);
      const t = treasuries.get(l.treasuryId);
      if (!t) throw new AccError(`${at}: صندوق یا بانک پیدا نشد`);
      if (!t.isActive) throw new AccError(`${at}: «${t.name}» غیرفعال است`);
    } else if (l.treasuryId) {
      throw new AccError(`${at}: حساب «${acc.name}» صندوق یا بانک نمی‌پذیرد`);
    }
  });

  const debit = resolved.reduce((s, l) => s + l.debit, 0n);
  const credit = resolved.reduce((s, l) => s + l.credit, 0n);
  if (debit !== credit) {
    throw new AccError(
      `سند تراز نیست: جمع بدهکار ${formatAmount(debit)} و جمع بستانکار ${formatAmount(credit)} — اختلاف ${formatAmount(debit > credit ? debit - credit : credit - debit)}`,
    );
  }
  if (debit === 0n) throw new AccError("سند با مبلغ صفر ثبت نمی‌شود");
  return { lines: resolved, total: debit };
}

function lineRows(voucherId: string, yearId: string, date: Date, lines: ResolvedLine[]) {
  return lines.map((l, i) => ({ ...l, voucherId, yearId, date, seq: i + 1 }));
}

export async function postVoucher(tx: Tx, input: VoucherInput): Promise<AccVoucher> {
  const description = input.description.trim();
  if (!description) throw new AccError("شرح سند را بنویسید");
  const year = await assertPostable(tx, input.date);
  const { lines, total } = await resolveLines(tx, input.lines);
  const number = await nextNumber(tx, year.id, "voucher");

  const voucher = await tx.accVoucher.create({
    data: {
      yearId: year.id,
      number,
      date: input.date,
      description,
      source: input.source,
      sourceId: input.sourceId ?? null,
      totalDebit: total,
      createdById: input.actor.id ?? null,
      createdByName: input.actor.name,
    },
  });
  await tx.accVoucherLine.createMany({ data: lineRows(voucher.id, year.id, input.date, lines) });
  return voucher;
}

/**
 * بازسازی سند خودکار با همان شماره. تاریخ قبلی و تاریخ تازه هر دو باید باز
 * باشند؛ اگر سال عوض شود، سند باطل و سند تازه در سال جدید ساخته می‌شود.
 */
export async function rebuildVoucher(
  tx: Tx,
  voucherId: string,
  input: Omit<VoucherInput, "source" | "sourceId">,
): Promise<AccVoucher> {
  const old = await tx.accVoucher.findUnique({ where: { id: voucherId } });
  if (!old) throw new AccError("سند پیدا نشد", 404);
  if (old.status === "VOID") throw new AccError("سند باطل‌شده بازسازی نمی‌شود");
  await assertPostable(tx, old.date);
  const year = await assertPostable(tx, input.date);

  if (year.id !== old.yearId) {
    await voidVoucher(tx, old.id, "تاریخ منبع به سال مالی دیگری رفت", input.actor, { fromSource: true });
    return postVoucher(tx, { ...input, source: old.source, sourceId: old.sourceId });
  }

  const description = input.description.trim() || old.description;
  const { lines, total } = await resolveLines(tx, input.lines);
  await tx.accVoucherLine.deleteMany({ where: { voucherId } });
  await tx.accVoucherLine.createMany({ data: lineRows(voucherId, year.id, input.date, lines) });
  return tx.accVoucher.update({
    where: { id: voucherId },
    data: { date: input.date, description, totalDebit: total },
  });
}

/**
 * ابطال — سند و ردیف‌هایش می‌مانند (شماره حفره نمی‌شود) ولی در هیچ مانده و
 * گزارشی شمرده نمی‌شوند. سند خودکار فقط از مسیر منبعش باطل می‌شود.
 */
export async function voidVoucher(
  tx: Tx,
  id: string,
  reason: string,
  actor: Actor,
  opts: { fromSource?: boolean } = {},
): Promise<AccVoucher> {
  const v = await tx.accVoucher.findUnique({ where: { id } });
  if (!v) throw new AccError("سند پیدا نشد", 404);
  if (v.status === "VOID") return v;
  if (v.source !== "MANUAL" && !opts.fromSource) {
    throw new AccError("این سند خودکار است؛ از همان فاکتور، دریافت یا عملیاتی که ساختش اصلاح یا باطلش کنید", 409);
  }
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  await assertPostable(tx, v.date);
  await tx.accVoucherLine.updateMany({ where: { voucherId: id }, data: { isVoid: true } });
  return tx.accVoucher.update({
    where: { id },
    data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` },
  });
}

/** سند معکوس — برای اصلاح سندی که تاریخش قفل شده؛ در تاریخ باز ثبت می‌شود */
export async function reverseVoucher(tx: Tx, id: string, date: Date, actor: Actor): Promise<AccVoucher> {
  const v = await tx.accVoucher.findUnique({ where: { id }, include: { lines: { orderBy: { seq: "asc" } } } });
  if (!v) throw new AccError("سند پیدا نشد", 404);
  if (v.status === "VOID") throw new AccError("سند باطل‌شده معکوس نمی‌شود");
  if (v.source !== "MANUAL") throw new AccError("سند خودکار از مسیر منبعش اصلاح می‌شود", 409);
  if (await tx.accVoucher.findFirst({ where: { reversalOfId: id } })) throw new AccError("این سند قبلاً معکوس شده است", 409);
  if (v.reversalOfId) throw new AccError("سند معکوس، دوباره معکوس نمی‌شود");

  const rev = await postVoucher(tx, {
    date,
    description: `معکوس سند ${faNum(v.number)} — ${v.description}`,
    source: "MANUAL",
    lines: v.lines.map((l) => ({
      accountId: l.accountId,
      partyId: l.partyId,
      treasuryId: l.treasuryId,
      debit: l.credit,
      credit: l.debit,
      description: l.description,
    })),
    actor,
  });
  return tx.accVoucher.update({ where: { id: rev.id }, data: { reversalOfId: v.id } });
}
