/**
 * کالای حسابداری (`AccItem`) — docs/plans/inventory-items.md.
 *
 * کالای هر محصول همان `id` محصول را دارد و تریگر دیتابیس می‌سازدش؛ اینجا
 * فقط کد، جستجو و کارت نمایشی کالاست. `productId` جدول‌های `Acc*` یعنی
 * شناسه‌ی کالا.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { toLatinDigits } from "../money";

type Db = Prisma.TransactionClient | typeof prisma;

/** آینه‌ی `acc_norm_code` دیتابیس: trim، ارقام لاتین، حروف بزرگ */
export function normalizeItemCode(c: string | null | undefined): string | null {
  const v = toLatinDigits(c ?? "").trim().toUpperCase();
  return v || null;
}

/** کد خودکار بعدی، بی‌مصرف کردن شمارنده — برای جای خالی فرم */
export async function peekItemCode(db: Db): Promise<string> {
  const [r] = await db.$queryRaw<{ c: string }[]>`SELECT acc_peek_item_code() AS c`;
  return r.c;
}

export async function nextItemCode(db: Db): Promise<string> {
  const [r] = await db.$queryRaw<{ c: string }[]>`SELECT acc_next_item_code() AS c`;
  return r.c;
}

/**
 * پشتیبان تریگر: کالای محصول‌هایی که (به هر دلیل) کالا ندارند. شناسه‌ای که
 * نه کالاست نه محصول، بی‌صدا رد می‌شود و فراخوان خودش «پیدا نشد» می‌دهد.
 */
export async function ensureItems(db: Db, ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return;
  const have = new Set((await db.accItem.findMany({ where: { id: { in: uniq } }, select: { id: true } })).map((i) => i.id));
  for (const id of uniq) if (!have.has(id)) await db.$executeRaw`SELECT acc_ensure_item(${id})`;
}

/** جستجوی کالا: عنوان، کد، کد قبلی، بارکد — و sku/بارکد محصول هم‌شناسه مثل قبل */
export async function itemSearchWhere(q: string | null | undefined, db: Db = prisma): Promise<Prisma.AccItemWhereInput> {
  const term = q?.trim();
  if (!term) return {};
  const lat = toLatinDigits(term);
  const code = normalizeItemCode(term)!;
  const viaProduct = (
    await db.product.findMany({
      where: { OR: [{ sku: { contains: lat, mode: "insensitive" } }, { gtin13: lat }] },
      select: { id: true },
      take: 200,
    })
  ).map((p) => p.id);
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { code: { contains: code } },
      { aliases: { some: { code } } },
      { barcodes: { some: { barcode: code } } },
      ...(viaProduct.length ? [{ id: { in: viaProduct } }] : []),
    ],
  };
}

/** کالای دقیق بارکد/کد/کد قبلی (بارکدخوان) — اول کد خود کالا */
export async function exactItem(q: string, db: Db = prisma): Promise<string | null> {
  const code = normalizeItemCode(q);
  if (!code) return null;
  const hit =
    (await db.accItem.findUnique({ where: { code }, select: { id: true } })) ??
    (await db.accItemBarcode.findUnique({ where: { barcode: code }, select: { itemId: true } }).then((b) => (b ? { id: b.itemId } : null))) ??
    (await db.accItemAlias.findFirst({ where: { code }, select: { itemId: true } }).then((a) => (a ? { id: a.itemId } : null))) ??
    (await db.product.findFirst({ where: { OR: [{ gtin13: q.trim() }, { sku: q.trim() }] }, select: { id: true } }));
  return hit?.id ?? null;
}

export interface ItemCard {
  id: string;
  title: string;
  code: string;
  /// `sku` در پاسخ‌های قبلی — رابط‌ها کد کالا را با همین نام نشان می‌دادند
  sku: string;
  unit: string;
  image: string | null;
  isActive: boolean;
  /** محصول فروشگاهِ هم‌شناسه دارد؟ */
  hasProduct: boolean;
  siteStock: number | null;
  price: bigint | null;
  lowStockThreshold: number;
}

/** کارت نمایشی چند کالا — عکس و موجودی و قیمت سایت از محصول هم‌شناسه */
export async function itemCards(ids: string[], db: Db = prisma): Promise<Map<string, ItemCard>> {
  const uniq = [...new Set(ids)];
  const [items, products] = await Promise.all([
    db.accItem.findMany({ where: { id: { in: uniq } } }),
    db.product.findMany({
      where: { id: { in: uniq } },
      select: { id: true, mainImage: true, stock: true, price: true, salePrice: true, lowStockThreshold: true },
    }),
  ]);
  const byProduct = new Map(products.map((p) => [p.id, p]));
  const out = new Map<string, ItemCard>();
  for (const i of items) {
    const p = byProduct.get(i.id);
    out.set(i.id, {
      id: i.id,
      title: i.title,
      code: i.code,
      sku: i.code,
      unit: i.unit,
      image: p?.mainImage ?? null,
      isActive: i.isActive,
      hasProduct: !!p,
      siteStock: p ? p.stock : null,
      price: p ? (p.salePrice && p.salePrice > 0n ? p.salePrice : p.price) : i.salePrice,
      lowStockThreshold: i.reorderPoint ?? p?.lowStockThreshold ?? 3,
    });
  }
  return out;
}

export interface ItemInput {
  code?: string | null;
  title?: string;
  unit?: string | null;
  salePrice?: bigint | null;
  reorderPoint?: number | null;
  sellOnline?: boolean;
  isActive?: boolean;
  barcodes?: string[];
  groupId?: string | null;
}

/** فقط ماتریس (`matrix.ts`) — مدل و ترکیب ویژگی کالا */
export interface ItemPlacement {
  modelId: string;
  attrs: { axisId: string; valueId: string }[];
}

export const attrKeyOf = (attrs: { axisId: string; valueId: string }[]) =>
  [...attrs].sort((a, b) => a.axisId.localeCompare(b.axisId)).map((a) => `${a.axisId}:${a.valueId}`).join("|");

async function assertCodeFree(db: Db, code: string, selfId: string | null) {
  const other = await db.accItem.findUnique({ where: { code }, select: { id: true, title: true } });
  if (other && other.id !== selfId) throw new AccError(`کد «${code}» مال «${other.title}» است`, 409);
  const alias = await db.accItemAlias.findFirst({ where: { code, ...(selfId ? { itemId: { not: selfId } } : {}) }, include: { item: { select: { title: true } } } });
  if (alias) throw new AccError(`کد «${code}» کد قبلی «${alias.item.title}» است`, 409);
}

async function assertGroup(db: Db, groupId: string | null | undefined) {
  if (groupId && !(await db.accItemGroup.findUnique({ where: { id: groupId }, select: { id: true } }))) throw new AccError("گروه کالا پیدا نشد");
}

async function setBarcodes(db: Db, itemId: string, raw: string[]) {
  const codes = [...new Set(raw.map(normalizeItemCode).filter((x): x is string => !!x))];
  const taken = await db.accItemBarcode.findMany({ where: { barcode: { in: codes }, itemId: { not: itemId } }, include: { item: { select: { title: true } } } });
  if (taken.length) throw new AccError(`بارکد «${taken[0].barcode}» مال «${taken[0].item.title}» است`, 409);
  await db.accItemBarcode.deleteMany({ where: { itemId, barcode: { notIn: codes } } });
  for (const barcode of codes) await db.accItemBarcode.upsert({ where: { barcode }, create: { barcode, itemId }, update: {} });
}

/** کالای تازه — بی‌محصول. کد خالی = خودکار */
export async function createItem(db: Prisma.TransactionClient, input: ItemInput, place?: ItemPlacement) {
  const title = input.title?.trim();
  if (!title) throw new AccError("نام کالا را بنویسید");
  const code = normalizeItemCode(input.code) ?? (await nextItemCode(db));
  await assertCodeFree(db, code, null);
  await assertGroup(db, input.groupId);
  const item = await db.accItem.create({
    data: {
      groupId: input.groupId || null,
      ...(place
        ? { modelId: place.modelId, attrKey: attrKeyOf(place.attrs), attrs: { create: place.attrs.map((a) => ({ axisId: a.axisId, valueId: a.valueId })) } }
        : {}),
      code,
      title,
      unit: input.unit?.trim() || "عدد",
      salePrice: input.salePrice ?? null,
      reorderPoint: input.reorderPoint ?? null,
      sellOnline: input.sellOnline ?? true,
    },
  });
  if (input.barcodes) await setBarcodes(db, item.id, input.barcodes);
  return item;
}

/** ویرایش — کد عوض‌شده به `AccItemAlias` می‌رود (تصمیم ۶) */
export async function updateItem(db: Prisma.TransactionClient, id: string, input: ItemInput) {
  const cur = await db.accItem.findUnique({ where: { id } });
  if (!cur) throw new AccError("کالا پیدا نشد", 404);
  const data: Prisma.AccItemUpdateInput = {};
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new AccError("نام کالا را بنویسید");
    data.title = t;
  }
  if (input.code !== undefined) {
    const code = normalizeItemCode(input.code);
    if (!code) throw new AccError("کد کالا خالی است");
    if (code !== cur.code) {
      await assertCodeFree(db, code, id);
      data.code = code;
      // کد تازه اگر قبلاً کد قبلی همین کالا بود از فهرست کدهای قبلی بیرون می‌رود
      await db.accItemAlias.deleteMany({ where: { itemId: id, code } });
      await db.accItemAlias.upsert({ where: { source_code: { source: "کد قبلی", code: cur.code } }, create: { itemId: id, code: cur.code }, update: { itemId: id } });
    }
  }
  if (input.unit !== undefined) data.unit = input.unit?.trim() || "عدد";
  if (input.salePrice !== undefined) data.salePrice = input.salePrice;
  if (input.reorderPoint !== undefined) data.reorderPoint = input.reorderPoint;
  if (input.sellOnline !== undefined) data.sellOnline = input.sellOnline;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.groupId !== undefined) {
    await assertGroup(db, input.groupId);
    data.group = input.groupId ? { connect: { id: input.groupId } } : { disconnect: true };
  }
  const item = await db.accItem.update({ where: { id }, data });
  if (input.barcodes) await setBarcodes(db, id, input.barcodes);
  return item;
}

/** شکل قدیمی `{id,title,sku,mainImage,stock}` که رابط‌های انبار از `Product` می‌گرفتند */
export async function itemBriefs(ids: string[], db: Db = prisma) {
  const cards = await itemCards(ids, db);
  return [...cards.values()].map((c) => ({ id: c.id, title: c.title, sku: c.code, mainImage: c.image, stock: c.siteStock ?? 0 }));
}

export async function itemTitles(ids: string[], db: Db = prisma): Promise<Map<string, string>> {
  const rows = await db.accItem.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, title: true } });
  return new Map(rows.map((r) => [r.id, r.title]));
}
