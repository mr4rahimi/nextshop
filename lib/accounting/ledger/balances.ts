/**
 * مانده و گردش — همه از `AccVoucherLine` (بدون ردیف باطل)، هیچ‌جا ذخیره نمی‌شود (تله‌ی ۶).
 *
 * علامت: مانده = بدهکار − بستانکار. برای شخص مثبت یعنی «طلب ما از او»، منفی
 * یعنی «بدهی ما به او». برای خزانه مثبت یعنی پول موجود.
 *
 * ⚠️ مانده‌ی شخص و خزانه روی **همه‌ی سال‌ها** جمع زده می‌شود. درست است چون
 *    اختتامیه‌ی سال قبل حساب‌های دائم را صفر و افتتاحیه‌ی سال بعد همان را
 *    دوباره می‌سازد (بخش ۱۷) — جمع دو سند صفر است.
 *    گردش (`statement`) همان دو سند «انتقال مانده» را نشان نمی‌دهد (`NOT_CARRY`).
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export interface Balance {
  debit: bigint;
  credit: bigint;
  balance: bigint;
}

/**
 * شرط «سند انتقال مانده‌ی بستن سال نیست» (`closing.ts`) — اختتامیه و افتتاحیه‌ی
 * خودکار هم را خنثی می‌کنند؛ گردش و گزارش‌ها کنارشان می‌گذارند. با شرط‌های
 * دیگرِ `voucher` در `AND` بیاید، نه spread (کلید `voucher` جایگزین می‌شود).
 * ⚠️ `sourceId` تهی است برای سند دستی؛ `NOT startsWith` روی NULL در SQL تهی است — پس OR.
 */
export const NOT_CARRY: Prisma.AccVoucherLineWhereInput = {
  voucher: { OR: [{ sourceId: null }, { NOT: { sourceId: { startsWith: "carry:" } } }] },
};

/**
 * «مانده‌ی شخص» (طلب/بدهی) فقط از حساب‌های دارایی و بدهی — AR، AP، چک‌ها،
 * پیش‌دریافت، کیف پول. ردیف هزینه با تفصیلی شخص (حقوق، پورسانت) و سرمایه‌ی
 * شریک طلب یا بدهی نیست: پورسانتِ پرداخت‌شده کارمند را «بدهکار» نشان می‌داد و
 * حقوقِ نسیه را «تسویه»؛ بستن سال هم آن ردیف‌ها را صفر می‌کند.
 */
export const PARTY_BALANCE: Prisma.AccVoucherLineWhereInput = { account: { class: { in: ["ASSET", "LIABILITY"] } } };

const ZERO: Balance = { debit: 0n, credit: 0n, balance: 0n };

function toBalance(sum: { debit: bigint | null; credit: bigint | null }): Balance {
  const debit = sum.debit ?? 0n;
  const credit = sum.credit ?? 0n;
  return { debit, credit, balance: debit - credit };
}

export async function balancesBy(
  db: Db,
  dim: "partyId" | "treasuryId" | "accountId",
  where: Prisma.AccVoucherLineWhereInput = {},
): Promise<Map<string, Balance>> {
  const rows = await db.accVoucherLine.groupBy({
    by: [dim],
    // accountId اجباری است و `not: null` نمی‌پذیرد؛ برای بقیه ردیف‌های بی‌تفصیلی کنار می‌روند
    where: { isVoid: false, ...(dim === "accountId" ? {} : { [dim]: { not: null } }), ...where },
    _sum: { debit: true, credit: true },
  });
  const map = new Map<string, Balance>();
  for (const r of rows) {
    const key = (r as Record<string, unknown>)[dim] as string | null;
    if (key) map.set(key, toBalance(r._sum));
  }
  return map;
}

export async function balanceOf(db: Db, where: Prisma.AccVoucherLineWhereInput): Promise<Balance> {
  const s = await db.accVoucherLine.aggregate({ where: { isVoid: false, ...where }, _sum: { debit: true, credit: true } });
  return s._sum ? toBalance(s._sum) : ZERO;
}

export interface StatementRow {
  id: string;
  date: Date;
  voucherId: string;
  voucherNumber: number;
  source: string;
  sourceId: string | null;
  description: string;
  accountName: string;
  debit: bigint;
  credit: bigint;
  running: bigint;
}

/**
 * گردش با مانده‌ی جاری — صورت‌حساب شخص، گردش خزانه، دفتر معین.
 * `opening` مانده‌ی قبل از `from` است.
 */
export async function statement(
  db: Db,
  filter: Prisma.AccVoucherLineWhereInput,
  range: { from?: Date | null; to?: Date | null },
  take = 500,
): Promise<{ opening: bigint; rows: StatementRow[]; closing: bigint; truncated: boolean }> {
  const f: Prisma.AccVoucherLineWhereInput = { AND: [filter, NOT_CARRY] };
  const base: Prisma.AccVoucherLineWhereInput = { isVoid: false, ...f };
  const opening = range.from ? (await balanceOf(db, { ...f, date: { lt: range.from } })).balance : 0n;
  const dateWhere: Prisma.DateTimeFilter = {};
  if (range.from) dateWhere.gte = range.from;
  if (range.to) dateWhere.lte = range.to;

  const lines = await db.accVoucherLine.findMany({
    where: { ...base, ...(range.from || range.to ? { date: dateWhere } : {}) },
    orderBy: [{ date: "asc" }, { voucher: { number: "asc" } }, { seq: "asc" }],
    take: take + 1,
    include: {
      voucher: { select: { number: true, source: true, sourceId: true, description: true } },
      account: { select: { name: true } },
    },
  });
  const truncated = lines.length > take;
  let running = opening;
  const rows = lines.slice(0, take).map((l) => {
    running += l.debit - l.credit;
    return {
      id: l.id,
      date: l.date,
      voucherId: l.voucherId,
      voucherNumber: l.voucher.number,
      source: l.voucher.source,
      sourceId: l.voucher.sourceId,
      description: l.description || l.voucher.description,
      accountName: l.account.name,
      debit: l.debit,
      credit: l.credit,
      running,
    };
  });
  // با بریده شدن فهرست، مانده‌ی جاری آخرین ردیف مانده‌ی پایان نیست
  const closing = truncated
    ? (await balanceOf(db, { ...f, ...(range.to ? { date: { lte: range.to } } : {}) })).balance
    : running;
  return { opening, rows, closing, truncated };
}
