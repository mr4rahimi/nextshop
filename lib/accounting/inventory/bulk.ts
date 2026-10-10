/**
 * ورود گروهی کالا — جدول ویرایشی یا چسباندن از اکسل — docs/plans/inventory-items.md بخش ۴.
 * همه یا هیچ: یک ردیف ایراد داشته باشد، هیچ کالایی ساخته نمی‌شود.
 */

import type { Prisma } from "@prisma/client";
import { AccError, toAmount } from "../errors";
import { faNum, toLatinDigits } from "../money";
import { groupByPath } from "./catalog";
import { createItem, normalizeItemCode } from "./items";

type Tx = Prisma.TransactionClient;

export const BULK_MAX = 2000;

const priceOf = (v: string) => toAmount(toLatinDigits(v).replace(/[,٬،\s]/g, ""), "قیمت");

export interface BulkRow {
  title?: string;
  code?: string;
  barcode?: string;
  unit?: string;
  salePrice?: string;
  group?: string;
}

export interface BulkCheck {
  index: number;
  error: string | null;
}

/** ایرادهای هر ردیف — بی‌نوشتن چیزی */
export async function checkBulk(tx: Tx, rows: BulkRow[]): Promise<BulkCheck[]> {
  if (rows.length > BULK_MAX) throw new AccError(`حداکثر ${faNum(BULK_MAX)} ردیف در یک بار`);
  const codes = rows.map((r) => normalizeItemCode(r.code));
  const barcodes = rows.map((r) => (r.barcode ?? "").split(/[\s,،]+/).map(normalizeItemCode).filter((x): x is string => !!x));
  const flatCodes = codes.filter((x): x is string => !!x);
  const flatBarcodes = barcodes.flat();
  const [takenCodes, takenAliases, takenBarcodes] = await Promise.all([
    tx.accItem.findMany({ where: { code: { in: flatCodes } }, select: { code: true, title: true } }),
    tx.accItemAlias.findMany({ where: { code: { in: flatCodes } }, select: { code: true } }),
    tx.accItemBarcode.findMany({ where: { barcode: { in: flatBarcodes } }, select: { barcode: true, item: { select: { title: true } } } }),
  ]);
  const codeOwner = new Map(takenCodes.map((c) => [c.code, c.title]));
  const aliasSet = new Set(takenAliases.map((a) => a.code));
  const bcOwner = new Map(takenBarcodes.map((b) => [b.barcode, b.item.title]));
  const seenCode = new Map<string, number>();
  const seenBc = new Map<string, number>();

  return rows.map((r, i) => {
    const err = (m: string) => ({ index: i, error: m });
    if (!r.title?.trim()) return err("نام کالا خالی است");
    const c = codes[i];
    if (c) {
      if (codeOwner.has(c)) return err(`کد «${c}» مال «${codeOwner.get(c)}» است`);
      if (aliasSet.has(c)) return err(`کد «${c}» کد قبلی کالای دیگری است`);
      if (seenCode.has(c)) return err(`کد «${c}» در ردیف ${faNum(seenCode.get(c)! + 1)} هم آمده`);
      seenCode.set(c, i);
    }
    for (const b of barcodes[i]) {
      if (bcOwner.has(b)) return err(`بارکد «${b}» مال «${bcOwner.get(b)}» است`);
      if (seenBc.has(b) && seenBc.get(b) !== i) return err(`بارکد «${b}» در ردیف ${faNum(seenBc.get(b)! + 1)} هم آمده`);
      seenBc.set(b, i);
    }
    if (r.salePrice?.trim()) {
      try {
        priceOf(r.salePrice);
      } catch {
        return err("قیمت فروش عدد نیست");
      }
    }
    return { index: i, error: null };
  });
}

export async function commitBulk(tx: Tx, rows: BulkRow[]) {
  const checks = await checkBulk(tx, rows);
  const bad = checks.find((c) => c.error);
  if (bad) throw new AccError(`ردیف ${faNum(bad.index + 1)}: ${bad.error}`);
  const groups = new Map<string, string>();
  const created: { id: string; code: string; title: string }[] = [];
  for (const r of rows) {
    const groupId = r.group?.trim() ? await groupByPath(tx, r.group, groups) : null;
    const item = await createItem(tx, {
      title: r.title,
      code: r.code || null,
      unit: r.unit,
      salePrice: r.salePrice?.trim() ? priceOf(r.salePrice) : null,
      groupId,
      barcodes: r.barcode ? r.barcode.split(/[\s,،]+/) : undefined,
    });
    created.push({ id: item.id, code: item.code, title: item.title });
  }
  return created;
}
