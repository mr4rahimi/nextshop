/**
 * پایه‌ی گزارش‌های مالی — docs/plans/accounting.md بخش ۱۱.
 *
 * ⚠️ هر عدد مالی از `AccVoucherLine` (بدون ردیف باطل) جمع زده می‌شود، نه از
 *    فاکتور یا سفارش، تا گزارش‌ها هیچ‌وقت با هم تناقض نداشته باشند. استثنا:
 *    گزارش‌های مقداری و بهای کالا از کاردکس (`profit.ts`، `inventory.ts`).
 */

import type { AccAccount, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Db = Prisma.TransactionClient | typeof prisma;

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface Sums {
  debit: bigint;
  credit: bigint;
}

export const dateWhere = (r: DateRange): Prisma.AccVoucherLineWhereInput =>
  r.from || r.to ? { date: { ...(r.from ? { gte: r.from } : {}), ...(r.to ? { lte: r.to } : {}) } } : {};

/** جمع بدهکار/بستانکار هر حساب معین */
export async function sumsByAccount(db: Db, where: Prisma.AccVoucherLineWhereInput): Promise<Map<string, Sums>> {
  const rows = await db.accVoucherLine.groupBy({
    by: ["accountId"],
    where: { isVoid: false, ...where },
    _sum: { debit: true, credit: true },
  });
  return new Map(rows.map((r) => [r.accountId, { debit: r._sum.debit ?? 0n, credit: r._sum.credit ?? 0n }]));
}

export interface AccountIndex {
  byId: Map<string, AccAccount>;
  byKey: Map<string, AccAccount>;
  /** زنجیره‌ی پدران یک حساب، از خودش تا گروه */
  chain: (id: string) => AccAccount[];
}

export async function accountIndex(db: Db): Promise<AccountIndex> {
  const all = await db.accAccount.findMany({ orderBy: { code: "asc" } });
  const byId = new Map(all.map((a) => [a.id, a]));
  const byKey = new Map(all.filter((a) => a.systemKey).map((a) => [a.systemKey!, a]));
  const chain = (id: string) => {
    const out: AccAccount[] = [];
    for (let a = byId.get(id); a; a = a.parentId ? byId.get(a.parentId) : undefined) out.push(a);
    return out;
  };
  return { byId, byKey, chain };
}

/** مانده‌ی «طبیعی»: دارایی و هزینه بدهکار، بقیه بستانکار */
export function natural(cls: AccAccount["class"], s: Sums): bigint {
  return cls === "ASSET" || cls === "EXPENSE" ? s.debit - s.credit : s.credit - s.debit;
}

export const sumBig = <T>(xs: T[], f: (x: T) => bigint) => xs.reduce((s, x) => s + f(x), 0n);
