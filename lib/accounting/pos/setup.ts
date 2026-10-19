/**
 * صندوق فروشگاهی — تعریف صندوق‌ها و فروشنده‌ها، و قیمت/کارت کالا برای پیشخوان.
 * docs/plans/inventory-items.md بخش ۱۳.
 *
 * هر صندوق انبار، صندوق نقد و کارتخوان خودش را دارد؛ صندوق نقد هر پیشخوان باید
 * جدا باشد چون «بستن صندوق» مانده‌ی دفتری همان صندوق را با پول شمرده مقایسه می‌کند.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { GLOBAL_SEQ, nextNumber } from "../ledger/sequence";
import { createTreasury } from "../treasury";
import { faNum } from "../money";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export interface TerminalInput {
  name?: unknown;
  warehouseId?: unknown;
  /** `"new"` = صندوق نقد تازه با نام «صندوق <نام پیشخوان>» */
  cashTreasuryId?: unknown;
  cardTreasuryId?: unknown;
  roundTo?: unknown;
  receiptHeader?: unknown;
  receiptFooter?: unknown;
  paperMm?: unknown;
  isActive?: unknown;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function saveTerminal(tx: Tx, id: string | null, input: TerminalInput) {
  const current = id ? await tx.accPosTerminal.findUnique({ where: { id } }) : null;
  if (id && !current) throw new AccError("صندوق پیدا نشد", 404);
  const name = input.name !== undefined ? str(input.name) : current?.name ?? null;
  if (!name) throw new AccError("نام صندوق را بنویسید؛ مثلاً «صندوق ۱»");
  const dup = await tx.accPosTerminal.findFirst({ where: { name, ...(current ? { id: { not: current.id } } : {}) }, select: { id: true } });
  if (dup) throw new AccError(`صندوقی با نام «${name}» هست`);

  const warehouseId = input.warehouseId !== undefined ? str(input.warehouseId) : current?.warehouseId ?? null;
  if (!warehouseId) throw new AccError("انبار این صندوق را انتخاب کنید");
  const wh = await tx.accWarehouse.findUnique({ where: { id: warehouseId } });
  if (!wh || !wh.isActive) throw new AccError("انبار پیدا نشد یا غیرفعال است");

  let cashTreasuryId = input.cashTreasuryId !== undefined ? str(input.cashTreasuryId) : current?.cashTreasuryId ?? null;
  if (cashTreasuryId === "new") cashTreasuryId = (await createTreasury(tx, { kind: "CASH", name: `صندوق ${name}` })).id;
  if (!cashTreasuryId) throw new AccError("صندوق نقد این پیشخوان را انتخاب کنید");
  const cash = await tx.accTreasury.findUnique({ where: { id: cashTreasuryId } });
  if (!cash || cash.kind !== "CASH" || !cash.isActive) throw new AccError("صندوق نقد باید یک «صندوق» فعال باشد");
  const sharing = await tx.accPosTerminal.findFirst({ where: { cashTreasuryId, ...(current ? { id: { not: current.id } } : {}) }, select: { name: true } });
  if (sharing) throw new AccError(`«${cash.name}» صندوق نقد «${sharing.name}» است؛ هر پیشخوان صندوق نقد جدا می‌خواهد تا بستن صندوق درست بشمارد`);

  const cardTreasuryId = input.cardTreasuryId !== undefined ? str(input.cardTreasuryId) : current?.cardTreasuryId ?? null;
  if (cardTreasuryId) {
    const card = await tx.accTreasury.findUnique({ where: { id: cardTreasuryId } });
    if (!card || !["POS", "BANK"].includes(card.kind) || !card.isActive) throw new AccError("کارتخوان باید یک «کارتخوان» یا حساب بانکی فعال باشد");
  }

  const roundTo = input.roundTo !== undefined ? Math.max(0, Math.floor(Number(input.roundTo) || 0)) : current?.roundTo ?? 0;
  if (roundTo > 100_000) throw new AccError("گرد کردن حداکثر ۱۰۰٬۰۰۰ تومان");
  const paperMm = input.paperMm !== undefined ? (Number(input.paperMm) === 58 ? 58 : 80) : current?.paperMm ?? 80;

  const data = {
    name,
    warehouseId,
    cashTreasuryId,
    cardTreasuryId,
    roundTo,
    paperMm,
    receiptHeader: input.receiptHeader !== undefined ? str(input.receiptHeader) : current?.receiptHeader ?? null,
    receiptFooter: input.receiptFooter !== undefined ? str(input.receiptFooter) : current?.receiptFooter ?? null,
    isActive: typeof input.isActive === "boolean" ? input.isActive : current?.isActive ?? true,
  };
  if (current) {
    if (!data.isActive && (await tx.accPosShift.count({ where: { terminalId: current.id, status: "OPEN" } }))) {
      throw new AccError("این صندوق شیفت باز دارد؛ اول صندوق را ببندید");
    }
    return tx.accPosTerminal.update({ where: { id: current.id }, data });
  }
  const code = await nextNumber(tx, GLOBAL_SEQ, "pos:terminal", 1);
  return tx.accPosTerminal.create({ data: { ...data, code } });
}

export interface SellerInput {
  name?: unknown;
  code?: unknown;
  commissionPct?: unknown;
  isActive?: unknown;
}

export async function saveSeller(tx: Tx, id: string | null, input: SellerInput) {
  const current = id ? await tx.accPosSeller.findUnique({ where: { id } }) : null;
  if (id && !current) throw new AccError("فروشنده پیدا نشد", 404);
  const name = input.name !== undefined ? str(input.name) : current?.name ?? null;
  if (!name) throw new AccError("نام فروشنده را بنویسید");
  let code = input.code !== undefined && input.code !== null && input.code !== "" ? Number(input.code) : current?.code ?? null;
  if (code === null) {
    const max = await tx.accPosSeller.aggregate({ _max: { code: true } });
    code = (max._max.code ?? 0) + 1;
  }
  if (!Number.isInteger(code) || code < 1 || code > 99) throw new AccError("کد فروشنده عددی از ۱ تا ۹۹ است");
  const dup = await tx.accPosSeller.findFirst({ where: { code, ...(current ? { id: { not: current.id } } : {}) }, select: { name: true } });
  if (dup) throw new AccError(`کد ${faNum(code)} مال «${dup.name}» است`);
  const pct = input.commissionPct !== undefined ? Number(input.commissionPct) || 0 : (current?.commissionBp ?? 0) / 100;
  if (pct < 0 || pct > 100) throw new AccError("درصد پورسانت بین ۰ تا ۱۰۰");
  const data = {
    name,
    code,
    commissionBp: Math.round(pct * 100),
    isActive: typeof input.isActive === "boolean" ? input.isActive : current?.isActive ?? true,
  };
  return current ? tx.accPosSeller.update({ where: { id: current.id }, data }) : tx.accPosSeller.create({ data });
}

export interface PosItem {
  id: string;
  code: string;
  title: string;
  unit: string;
  image: string | null;
  /** قیمت فروشگاه (تومان) — صفر یعنی قیمت ندارد و صندوقدار می‌نویسد */
  price: bigint;
  /** موجودی انبار همین صندوق */
  stock: number;
  modelId: string | null;
}

/**
 * قیمت فروش در فروشگاه: قیمت خود کالا (`AccItem.salePrice`، همان خرده‌فروشی نرم‌افزار
 * قبلی)، وگرنه قیمت تنوعِ وصل، وگرنه قیمت محصول هم‌شناسه (با تخفیف ویژه).
 */
export async function posItems(ids: string[], warehouseId: string | null, db: Db = prisma): Promise<Map<string, PosItem>> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return new Map();
  const [items, products, variants, stocks] = await Promise.all([
    db.accItem.findMany({ where: { id: { in: uniq } }, select: { id: true, code: true, title: true, unit: true, salePrice: true, modelId: true } }),
    db.product.findMany({ where: { id: { in: uniq } }, select: { id: true, mainImage: true, price: true, salePrice: true } }),
    db.productVariant.findMany({
      where: { accItemId: { in: uniq } },
      select: { accItemId: true, price: true, salePrice: true, product: { select: { mainImage: true, price: true, salePrice: true } } },
    }),
    warehouseId ? db.accStock.findMany({ where: { productId: { in: uniq }, warehouseId } }) : Promise.resolve([]),
  ]);
  const eff = (p: { price: bigint; salePrice: bigint | null }) => (p.salePrice && p.salePrice > 0n ? p.salePrice : p.price);
  const prod = new Map(products.map((p) => [p.id, p]));
  const vars = new Map(variants.map((v) => [v.accItemId!, v]));
  const stock = new Map(stocks.map((s) => [s.productId, s.qty]));
  const out = new Map<string, PosItem>();
  for (const i of items) {
    const p = prod.get(i.id);
    const v = vars.get(i.id);
    const variantPrice = v ? (v.price !== null ? (v.salePrice && v.salePrice > 0n ? v.salePrice : v.price) : eff(v.product)) : null;
    const price = i.salePrice && i.salePrice > 0n ? i.salePrice : variantPrice ?? (p ? eff(p) : 0n);
    out.set(i.id, {
      id: i.id,
      code: i.code,
      title: i.title,
      unit: i.unit,
      image: p?.mainImage ?? v?.product.mainImage ?? null,
      price,
      stock: stock.get(i.id) ?? 0,
      modelId: i.modelId,
    });
  }
  return out;
}

/** مانده‌ی دفتری یک صندوق/بانک (بدهکار − بستانکار، بی سند باطل) */
export async function treasuryBook(db: Db, treasuryId: string): Promise<bigint> {
  const s = await db.accVoucherLine.aggregate({ where: { treasuryId, isVoid: false }, _sum: { debit: true, credit: true } });
  return (s._sum.debit ?? 0n) - (s._sum.credit ?? 0n);
}
