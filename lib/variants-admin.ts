/**
 * ویرایش تنوع‌های یک محصول در ادمین — docs/plans/inventory-items.md فاز ۴.
 * ذخیره کل فهرست را می‌گیرد: ترکیب تازه ساخته، موجود به‌روز، حذف‌شده — اگر در
 * سفارش یا سبد آمده — غیرفعال و وگرنه پاک می‌شود.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { optionKeyOf, recomputeProductStock } from "@/lib/variants";
import { slugify } from "@/lib/slugify";

type Tx = Prisma.TransactionClient;

export class VariantError extends Error {}

export interface VariantInput {
  id?: string | null;
  /** attributeId ← attributeValueId */
  options: Record<string, string>;
  price?: bigint | null;
  salePrice?: bigint | null;
  stock?: number;
  sku?: string | null;
  accItemId?: string | null;
  isActive?: boolean;
}

export interface VariantsInput {
  axes: { attributeId: string; display?: string }[];
  variants: VariantInput[];
  /** عکس محصول ← رنگ (مقدار) یا null = عمومی */
  images?: { imageId: string; attributeValueId: string | null }[];
}

export async function loadVariantAdmin(productId: string) {
  const [product, axes, variants, images, attributes, settings] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true, price: true, salePrice: true, stock: true } }),
    prisma.productVariantAxis.findMany({ where: { productId }, orderBy: { sortOrder: "asc" } }),
    prisma.productVariant.findMany({ where: { productId }, include: { options: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.productImage.findMany({ where: { productId }, orderBy: { sortOrder: "asc" }, select: { id: true, url: true, attributeValueId: true } }),
    prisma.attribute.findMany({ orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }], include: { group: { select: { title: true } }, values: { orderBy: { sortOrder: "asc" } } } }),
    prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } }),
  ]);
  const itemIds = variants.map((v) => v.accItemId).filter((x): x is string => !!x);
  const items = itemIds.length ? await prisma.accItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, title: true } }) : [];
  return {
    product,
    axes,
    variants: variants.map((v) => ({ ...v, options: Object.fromEntries(v.options.map((o) => [o.attributeId, o.attributeValueId])), accItem: items.find((i) => i.id === v.accItemId) ?? null })),
    images,
    attributes: attributes.map((a) => ({ id: a.id, title: a.title, group: a.group.title, values: a.values.map((v) => ({ id: v.id, value: v.value, colorHex: v.colorHex })) })),
    accountingInternal: settings?.mode === "INTERNAL",
  };
}

/** موجودی قابل فروش کالا در حسابداری داخلی (جمع انبارهای sellable) */
async function itemSellableStock(tx: Tx, itemIds: string[]) {
  if (!itemIds.length) return new Map<string, number>();
  const sellable = (await tx.accWarehouse.findMany({ where: { sellable: true }, select: { id: true } })).map((w) => w.id);
  const rows = await tx.accStock.groupBy({ by: ["productId"], where: { productId: { in: itemIds }, warehouseId: { in: sellable } }, _sum: { qty: true } });
  return new Map(rows.map((r) => [r.productId, Math.max(0, r._sum.qty ?? 0)]));
}

export async function saveVariants(tx: Tx, productId: string, input: VariantsInput) {
  const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new VariantError("محصول پیدا نشد");
  const axisIds = input.axes.map((a) => a.attributeId);
  if (new Set(axisIds).size !== axisIds.length) throw new VariantError("یک ویژگی دو بار آمده");
  if (input.variants.length && !axisIds.length) throw new VariantError("دست‌کم یک ویژگی (مثل رنگ) انتخاب کنید");
  if (input.variants.length > 300) throw new VariantError("حداکثر ۳۰۰ تنوع برای یک محصول");

  const attrs = await tx.attribute.findMany({ where: { id: { in: axisIds } }, include: { values: true } });
  if (attrs.length !== axisIds.length) throw new VariantError("ویژگی پیدا نشد");
  const byAttr = new Map(attrs.map((a) => [a.id, a]));

  const mode = (await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } }))?.mode;
  const internal = mode === "INTERNAL";
  const itemIds = input.variants.map((v) => v.accItemId).filter((x): x is string => !!x);
  if (new Set(itemIds).size !== itemIds.length) throw new VariantError("یک کالای حسابداری به دو تنوع وصل شده");
  if (itemIds.length) {
    const found = await tx.accItem.findMany({ where: { id: { in: itemIds } }, select: { id: true } });
    if (found.length !== itemIds.length) throw new VariantError("کالای حسابداری پیدا نشد");
    const taken = await tx.productVariant.findFirst({ where: { accItemId: { in: itemIds }, productId: { not: productId } }, select: { title: true, product: { select: { title: true } } } });
    if (taken) throw new VariantError(`کالای حسابداری به تنوع «${taken.title}» محصول «${taken.product.title}» وصل است`);
  }
  const fromAcc = internal ? await itemSellableStock(tx, itemIds) : new Map<string, number>();

  const existing = await tx.productVariant.findMany({ where: { productId } });
  const byKey = new Map(existing.map((v) => [v.optionKey, v]));
  const seen = new Set<string>();
  // اول accItemId همه‌ی تنوع‌های این محصول آزاد می‌شود تا جابه‌جایی کالا بین دو تنوع با یکتایی نخورد
  await tx.productVariant.updateMany({ where: { productId, accItemId: { not: null } }, data: { accItemId: null } });

  for (const [i, v] of input.variants.entries()) {
    const opts = axisIds.map((attributeId) => {
      const valueId = v.options[attributeId];
      const at = byAttr.get(attributeId)!;
      if (!valueId) throw new VariantError(`ردیف ${i + 1}: «${at.title}» انتخاب نشده`);
      if (!at.values.some((x) => x.id === valueId)) throw new VariantError(`ردیف ${i + 1}: مقدار «${at.title}» نامعتبر است`);
      return { attributeId, attributeValueId: valueId };
    });
    const key = optionKeyOf(opts);
    if (seen.has(key)) throw new VariantError(`ردیف ${i + 1}: این ترکیب دو بار آمده`);
    seen.add(key);
    const title = opts.map((o) => byAttr.get(o.attributeId)!.values.find((x) => x.id === o.attributeValueId)!.value).join(" / ");
    if (v.price !== null && v.price !== undefined && v.price < 0n) throw new VariantError(`ردیف ${i + 1}: قیمت منفی`);
    if (v.salePrice && v.price === null) throw new VariantError(`ردیف ${i + 1}: قیمت ویژه بدون قیمت — هر دو را بنویسید یا هر دو خالی`);
    const stock = v.accItemId && internal ? (fromAcc.get(v.accItemId) ?? 0) : Math.max(0, Math.floor(Number(v.stock ?? 0)) || 0);
    const data = {
      title,
      sku: v.sku?.trim() || null,
      price: v.price ?? null,
      salePrice: v.price === null || v.price === undefined ? null : (v.salePrice ?? null),
      stock,
      accItemId: v.accItemId || null,
      isActive: v.isActive !== false,
      sortOrder: i,
    };
    const cur = byKey.get(key);
    if (cur) await tx.productVariant.update({ where: { id: cur.id }, data });
    else await tx.productVariant.create({ data: { ...data, productId, optionKey: key, options: { create: opts } } });
  }

  // حذف‌شده‌ها: در سفارش/سبد آمده ← غیرفعال، وگرنه پاک
  const gone = existing.filter((v) => !seen.has(v.optionKey));
  if (gone.length) {
    const ids = gone.map((v) => v.id);
    const [inOrders, inCarts] = await Promise.all([
      tx.orderItem.findMany({ where: { variantId: { in: ids } }, select: { variantId: true }, distinct: ["variantId"] }),
      tx.cartItem.findMany({ where: { variantKey: { in: ids } }, select: { variantKey: true }, distinct: ["variantKey"] }),
    ]);
    const keep = new Set([...inOrders.map((o) => o.variantId!), ...inCarts.map((c) => c.variantKey)]);
    await tx.productVariant.updateMany({ where: { id: { in: ids.filter((id) => keep.has(id)) } }, data: { isActive: false } });
    await tx.productVariant.deleteMany({ where: { id: { in: ids.filter((id) => !keep.has(id)) } } });
  }

  await tx.productVariantAxis.deleteMany({ where: { productId } });
  if (input.variants.length)
    await tx.productVariantAxis.createMany({ data: input.axes.map((a, i) => ({ productId, attributeId: a.attributeId, sortOrder: i, display: a.display === "SWATCH" ? "SWATCH" : "CHIP" })) });

  if (input.images) {
    const allowed = new Set(attrs.flatMap((a) => a.values.map((v) => v.id)));
    for (const im of input.images) {
      if (im.attributeValueId && !allowed.has(im.attributeValueId)) continue;
      await tx.productImage.updateMany({ where: { id: im.imageId, productId }, data: { attributeValueId: im.attributeValueId } });
    }
  }

  await recomputeProductStock(tx, [productId]);
}

/** مقدار تازه برای ویژگی فروشگاه — از ویرایش تنوع (عمداً: روی محصول واقعی می‌نشیند) */
export async function addAttributeValue(tx: Tx, attributeId: string, value: string, colorHex?: string | null) {
  const v = value.replace(/\s+/g, " ").trim();
  if (!v) throw new VariantError("مقدار خالی است");
  const at = await tx.attribute.findUnique({ where: { id: attributeId }, include: { values: true } });
  if (!at) throw new VariantError("ویژگی پیدا نشد");
  const hit = at.values.find((x) => x.value === v);
  if (hit) return hit;
  const order = at.values.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 1;
  const hex = colorHex && /^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : null;
  // نامک برای فیلتر دسته‌ی سایت (`lib/catalog.ts` فقط مقدار نامک‌دار را فیلتر می‌کند)
  const base = slugify(v) || `v${order}`;
  let slug = base;
  for (let n = 2; at.values.some((x) => x.slug === slug); n++) slug = `${base}-${n}`;
  return tx.attributeValue.create({ data: { attributeId, value: v, slug, sortOrder: order, colorHex: hex } });
}
