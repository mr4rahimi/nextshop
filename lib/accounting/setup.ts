/**
 * راه‌اندازی حسابداری داخلی و مانده‌های اول دوره — docs/plans/accounting.md بخش ۱۷.
 *
 * راه‌اندازی: سرفصل پیش‌فرض، سال مالی، یک «صندوق فروشگاه»، و حالت INTERNAL —
 * همه در یک تراکنش. از این لحظه فاکتور خودکار حسابان خاموش است (تصمیم ۱).
 *
 * مانده‌های اول دوره یک سند OPENING است که با هر ذخیره بازسازی می‌شود
 * (`sourceId = opening:<yearId>:balances`). فرم از روی ردیف‌های همین سند دوباره
 * پر می‌شود — جدول جداگانه‌ای ندارد.
 */

import type { AccFiscalYear, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "./errors";
import { seedDefaultChart, missingSystemKeys } from "./ledger/accounts";
import { ensureFiscalYear } from "./ledger/fiscal-year";
import { postVoucher, rebuildVoucher, voidVoucher, type Actor, type LineInput } from "./ledger/post";
import { createTreasury, TREASURY_ACCOUNT_KEY } from "./treasury";
import { ensureDefaultWarehouse } from "./inventory/docs";

type Tx = Prisma.TransactionClient;

export async function activateInternal(input: { jalaliYear: number; actor: Actor }): Promise<AccFiscalYear> {
  if (!Number.isInteger(input.jalaliYear) || input.jalaliYear < 1390 || input.jalaliYear > 1500) {
    throw new AccError("سال مالی نامعتبر است");
  }
  return prisma.$transaction(async (tx) => {
    await seedDefaultChart(tx);
    const missing = await missingSystemKeys(tx);
    if (missing.length) throw new AccError(`سرفصل ناقص است؛ این حساب‌های سیستمی نیستند: ${missing.join("، ")}`);

    const year = await ensureFiscalYear(tx, input.jalaliYear);
    if (!(await tx.accTreasury.count({ where: { kind: "CASH" } }))) {
      await createTreasury(tx, { kind: "CASH", name: "صندوق فروشگاه" });
    }
    await ensureDefaultWarehouse(tx);
    await tx.accSettings.upsert({
      where: { id: "singleton" },
      update: { mode: "INTERNAL", modeChangedAt: new Date(), modeChangedBy: input.actor.name, currentYearId: year.id },
      create: { id: "singleton", mode: "INTERNAL", modeChangedAt: new Date(), modeChangedBy: input.actor.name, currentYearId: year.id },
    });
    return year;
  });
}

/** خروج از حالت داخلی فقط وقتی هنوز هیچ سند معتبری ثبت نشده (چیزی گم نمی‌شود) */
export async function canLeaveInternal(): Promise<boolean> {
  return (await prisma.accVoucher.count({ where: { status: "POSTED" } })) === 0;
}

export interface OpeningBalances {
  treasuries: { treasuryId: string; amount: bigint }[];
  /** مثبت = طلب ما از شخص (بدهکار)، منفی = بدهی ما به شخص (بستانکار) */
  parties: { partyId: string; amount: bigint }[];
}

export const openingKey = (yearId: string) => `opening:${yearId}:balances`;

export async function readOpening(db: Tx | typeof prisma, yearId: string) {
  const v = await db.accVoucher.findFirst({
    where: { source: "OPENING", sourceId: openingKey(yearId), status: "POSTED" },
    include: { lines: { include: { account: { select: { systemKey: true } } } } },
  });
  const treasuries: { treasuryId: string; amount: bigint }[] = [];
  const parties: { partyId: string; amount: bigint }[] = [];
  for (const l of v?.lines ?? []) {
    if (l.treasuryId) treasuries.push({ treasuryId: l.treasuryId, amount: l.debit - l.credit });
    else if (l.partyId) parties.push({ partyId: l.partyId, amount: l.debit - l.credit });
  }
  return { voucher: v ? { id: v.id, number: v.number, date: v.date } : null, treasuries, parties };
}

export async function saveOpening(yearId: string, input: OpeningBalances, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const year = await tx.accFiscalYear.findUnique({ where: { id: yearId } });
    if (!year) throw new AccError("سال مالی پیدا نشد", 404);

    const lines: LineInput[] = [];
    const seenT = new Set<string>();
    for (const t of input.treasuries) {
      if (t.amount === 0n) continue;
      if (seenT.has(t.treasuryId)) throw new AccError("یک صندوق یا بانک دو بار آمده است");
      seenT.add(t.treasuryId);
      const tr = await tx.accTreasury.findUnique({ where: { id: t.treasuryId } });
      if (!tr) throw new AccError("صندوق یا بانک پیدا نشد");
      if (t.amount < 0n && tr.kind === "CASH") throw new AccError(`موجودی «${tr.name}» منفی نمی‌شود`);
      lines.push({
        accountKey: TREASURY_ACCOUNT_KEY[tr.kind],
        treasuryId: tr.id,
        debit: t.amount > 0n ? t.amount : 0n,
        credit: t.amount < 0n ? -t.amount : 0n,
        description: "موجودی اول دوره",
      });
    }
    const seenP = new Set<string>();
    for (const p of input.parties) {
      if (p.amount === 0n) continue;
      if (seenP.has(p.partyId)) throw new AccError("یک شخص دو بار آمده است");
      seenP.add(p.partyId);
      lines.push(
        p.amount > 0n
          ? { accountKey: "AR", partyId: p.partyId, debit: p.amount, description: "طلب اول دوره" }
          : { accountKey: "AP", partyId: p.partyId, credit: -p.amount, description: "بدهی اول دوره" },
      );
    }

    const existing = await tx.accVoucher.findFirst({
      where: { source: "OPENING", sourceId: openingKey(yearId), status: "POSTED" },
    });
    if (!lines.length) {
      if (existing) await voidVoucher(tx, existing.id, "مانده‌های اول دوره پاک شد", actor, { fromSource: true });
      return null;
    }
    // اختلاف دارایی و بدهی = سرمایه‌ی اول دوره — روی «تراز افتتاحیه» می‌نشیند
    const net = lines.reduce((s, l) => s + (l.debit ?? 0n) - (l.credit ?? 0n), 0n);
    if (net !== 0n) {
      lines.push(
        net > 0n
          ? { accountKey: "OPENING_BALANCE", credit: net, description: "تراز افتتاحیه" }
          : { accountKey: "OPENING_BALANCE", debit: -net, description: "تراز افتتاحیه" },
      );
    }
    if (lines.length < 2) throw new AccError("مانده‌ها سند تراز نمی‌سازند");

    const input2 = { date: year.startDate, description: `مانده‌های اول دوره‌ی سال ${year.title}`, lines, actor };
    return existing
      ? rebuildVoucher(tx, existing.id, input2)
      : postVoucher(tx, { ...input2, source: "OPENING", sourceId: openingKey(yearId) });
  });
}
