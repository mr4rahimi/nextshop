/**
 * فاکتور خودکار از بخش‌های فروشگاه — مصرف‌کننده‌ی رویدادهای `SALE_*` و
 * `PURCHASE_RECORDED` (docs/plans/accounting.md بخش ۴.۳، ۵ و ۱۰).
 *
 * هر تابع idempotent است: فاکتور منبع با `sourceKey` یکتا پیدا می‌شود و دوباره
 * ساخته نمی‌شود. خروجی `null` یعنی «چیزی برای ثبت نبود» (رویداد رد می‌شود).
 *
 * ⚠️ موجودی سایت (تله‌ی ۱۵): فروشگاه موجودی سفارش را خودش کسر می‌کند
 *    (`deductStockForOrderItems`) و بازارگاه با نگاشت. پس صدور این فاکتورها و
 *    لغو بازارگاه `shopStock: false` می‌گیرند. لغو و مرجوعی سفارش سایت کالا را
 *    واقعاً برمی‌گرداند و فروشگاه خودش برنمی‌گرداند — آن‌ها موجودی سایت را زیاد می‌کنند.
 */

import type { AccInvoice, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { dayKey } from "../dates";
import type { Actor } from "../ledger/post";
import { partyForPlatform, partyForSupplier, partyForUser } from "../parties";
import { saveInvoice, voidInvoice, returnedQty, type InvoiceLineInput } from "./service";

type Tx = Prisma.TransactionClient;

export const AUTO_ACTOR: Actor = { id: null, name: "ثبت خودکار" };

export const orderSaleKey = (orderId: string) => `order:${orderId}:sale`;
export const orderReturnKey = (orderId: string) => `order:${orderId}:return`;
export const integSaleKey = (rowId: string) => `integ:${rowId}:sale`;
export const taskPurchaseKey = (taskId: string) => `task:${taskId}:purchase`;

async function vatDefaults(tx: Tx, productIds: string[]) {
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { vatEnabled: true, vatRateBp: true } });
  const costs = new Map((await tx.accProductCost.findMany({ where: { productId: { in: productIds } } })).map((c) => [c.productId, c]));
  return (productId: string) => ({
    vatRateBp: s?.vatEnabled ? costs.get(productId)?.vatRateBp ?? s.vatRateBp : 0,
    taxCode: costs.get(productId)?.taxCode ?? null,
  });
}

/** فاکتور فروش سفارش سایت یا تلفنی — لحظه‌ی کسر موجودی */
export async function saleFromOrder(tx: Tx, orderId: string, at: Date): Promise<AccInvoice | null> {
  const existing = await tx.accInvoice.findUnique({ where: { sourceKey: orderSaleKey(orderId) } });
  if (existing) return existing;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" } }, address: true, payments: true },
  });
  if (!order) throw new AccError("سفارش پیدا نشد", 404);
  if (!order.items.length) return null;

  const party = await partyForUser(tx, order.userId);
  const vat = await vatDefaults(tx, order.items.map((i) => i.productId));
  const lines: InvoiceLineInput[] = order.items.map((i) => ({
    productId: i.productId,
    title: i.titleSnapshot,
    qty: i.qty,
    // قیمت مؤثر همان است که مشتری پرداخته؛ فروش ویژه تخفیف حساب نمی‌شود
    unitPrice: i.unitSalePrice && i.unitSalePrice > 0n ? i.unitSalePrice : i.unitPrice,
    orderItemId: i.id,
    ...vat(i.productId),
  }));

  // `discountTotal` سفارش کیف پول را هم دارد — کیف پول روش پرداخت است، نه تخفیف (فاز ۶)
  const wallet = order.payments
    .filter((p) => p.provider?.toUpperCase() === "WALLET" && p.status === "SUCCEEDED")
    .reduce((s, p) => s + p.amount, 0n);
  const discount = order.discountTotal > wallet ? order.discountTotal - wallet : 0n;
  const a = order.address;

  return saveInvoice(
    tx,
    null,
    {
      type: "SALES",
      date: dayKey(at),
      partyId: party.id,
      // مشتری همان مبلغ سفارش را پرداخته؛ اگر مالیات روشن است، از داخلش جدا می‌شود
      pricesIncludeVat: true,
      invoiceDiscount: discount,
      additions: order.shippingFee,
      additionsTitle: "هزینه‌ی ارسال",
      note: `سفارش ${order.orderNumber}`,
      channel: order.createdByStaffId ? "PHONE" : "SHOP",
      orderId: order.id,
      sourceKey: orderSaleKey(order.id),
      partySnapshot: a
        ? {
            address: [a.province, a.city, a.addressLine].filter(Boolean).join("، "),
            postalCode: a.postalCode,
            phone: party.mobile ?? a.phone,
          }
        : undefined,
      lines,
    },
    { issue: true, shopStock: false },
    AUTO_ACTOR,
  );
}

/**
 * لغو یا مرجوعی سفارش سایت. لغو پیش از ارسال = ابطال فاکتور؛ بعد از ارسال
 * (یا «مسترد شد») = فاکتور برگشت از فروش برای همه‌ی اقلام مانده و کرایه.
 */
export async function reverseOrderSale(tx: Tx, orderId: string, kind: "void" | "return", at: Date, reason: string): Promise<AccInvoice | null> {
  const sale = await tx.accInvoice.findUnique({ where: { sourceKey: orderSaleKey(orderId) }, include: { lines: true } });
  if (!sale || sale.status !== "ISSUED") return null;

  if (kind === "void") {
    // اگر برگشتی دارد دیگر ابطال معنا ندارد — بقیه برگشت می‌خورد
    const hasReturn = await tx.accInvoice.count({ where: { refInvoiceId: sale.id, status: { not: "VOID" } } });
    if (!hasReturn) return voidInvoice(tx, sale.id, reason, AUTO_ACTOR, { shopStock: true });
  }

  const existing = await tx.accInvoice.findUnique({ where: { sourceKey: orderReturnKey(orderId) } });
  if (existing) return existing;
  const done = await returnedQty(tx, sale.lines.map((l) => l.id));
  const lines = sale.lines
    .map((l) => ({ refLineId: l.id, qty: l.qty - (done.get(l.id) ?? 0), unitPrice: 0n }))
    .filter((l) => l.qty > 0);
  const priorReturns = await tx.accInvoice.aggregate({
    where: { refInvoiceId: sale.id, status: { not: "VOID" } },
    _sum: { additions: true },
  });
  const shipping = sale.additions - (priorReturns._sum.additions ?? 0n);
  if (!lines.length && shipping <= 0n) return null;
  if (!lines.length) throw new AccError("همه‌ی اقلام این سفارش قبلاً برگشت خورده‌اند؛ برگشت کرایه را دستی ثبت کنید");

  return saveInvoice(
    tx,
    null,
    {
      type: "SALES_RETURN",
      date: dayKey(at),
      partyId: sale.partyId,
      refInvoiceId: sale.id,
      additions: shipping > 0n ? shipping : 0n,
      additionsTitle: "برگشت هزینه‌ی ارسال",
      note: reason,
      channel: sale.channel,
      orderId,
      sourceKey: orderReturnKey(orderId),
      lines,
    },
    { issue: true, shopStock: true },
    AUTO_ACTOR,
  );
}

/** فاکتور فروش یک قلم سفارش بازارگاه — طرف حساب خود بازارگاه است (تصمیم ۹) */
export async function saleFromIntegOrder(tx: Tx, rowId: string): Promise<AccInvoice | null> {
  const existing = await tx.accInvoice.findUnique({ where: { sourceKey: integSaleKey(rowId) } });
  if (existing) return existing;
  const row = await tx.integOrder.findUnique({ where: { id: rowId } });
  if (!row) throw new AccError("سفارش بازارگاه پیدا نشد", 404);
  // ردیف‌های «shop» فقط برای فاکتور حسابان‌اند؛ فروش سایت از خود سفارش می‌آید
  if (row.platformCode === "shop" || row.status === "CANCELLED") return null;

  const link = row.mappingId
    ? await tx.integMappingLink.findUnique({ where: { mappingId_platformCode: { mappingId: row.mappingId, platformCode: "shop" } } })
    : null;
  if (!link) throw new AccError(`کالای «${row.productTitle}» به محصول سایت نگاشت نشده؛ فاکتورش را دستی ثبت کنید یا نگاشت را کامل کنید`);

  const platform = await tx.integPlatform.findUnique({ where: { code: row.platformCode }, select: { name: true } });
  const party = await partyForPlatform(tx, row.platformCode, platform?.name ?? row.platformCode);
  const vat = await vatDefaults(tx, [link.externalId]);
  const price = row.unitPrice && row.unitPrice > 0 ? BigInt(Math.round(row.unitPrice)) : 0n;
  const buyer = [row.customerName, row.customerPhone].filter(Boolean).join(" — ");

  return saveInvoice(
    tx,
    null,
    {
      type: "SALES",
      date: dayKey(row.createdAt),
      partyId: party.id,
      pricesIncludeVat: true,
      note: [
        `سفارش ${platform?.name ?? row.platformCode} ${row.platformOrderNo ?? row.platformOrderId}`,
        buyer && `خریدار: ${buyer}`,
        !price && "قیمت فروش از بازارگاه نیامد — فاکتور را ویرایش و قیمت را وارد کنید",
      ]
        .filter(Boolean)
        .join("\n"),
      channel: "MARKETPLACE",
      platformCode: row.platformCode,
      sourceKey: integSaleKey(row.id),
      lines: [{ productId: link.externalId, title: row.productTitle, qty: row.qty, unitPrice: price, ...vat(link.externalId) }],
    },
    { issue: true, shopStock: false },
    AUTO_ACTOR,
  );
}

/** لغو قلم بازارگاه — موجودی سایت را نگاشت برگردانده، کاردکس فقط خنثی می‌شود */
export async function voidIntegSale(tx: Tx, rowId: string): Promise<AccInvoice | null> {
  const inv = await tx.accInvoice.findUnique({ where: { sourceKey: integSaleKey(rowId) } });
  if (!inv || inv.status !== "ISSUED") return null;
  return voidInvoice(tx, inv.id, "لغو سفارش در بازارگاه", AUTO_ACTOR, { shopStock: false });
}

/**
 * «خرید شد» کار تأمین کالای کارتابل ← فاکتور خرید از تأمین‌کننده‌ی همان کار.
 * کالا برای همان سفارش خریده شده و موجودی سایت را زیاد نمی‌کند؛ در کاردکس کسری
 * فروش را جبران می‌کند و بهای تمام‌شده‌ی آن فروش اصلاح می‌شود.
 */
export async function purchaseFromTask(tx: Tx, taskId: string): Promise<AccInvoice | null> {
  const existing = await tx.accInvoice.findUnique({ where: { sourceKey: taskPurchaseKey(taskId) } });
  if (existing) return existing;
  const task = await tx.staffTask.findUnique({
    where: { id: taskId },
    select: { title: true, entity: true, entityId: true, supplierId: true, supplierName: true, occurredAt: true, doneAt: true, createdAt: true },
  });
  if (!task) throw new AccError("کار پیدا نشد", 404);
  if (task.entity !== "ORDER" || !task.entityId) return null;
  if (!task.supplierId) {
    throw new AccError(
      `تأمین‌کننده‌ی کار «${task.title}» از فهرست انتخاب نشده${task.supplierName ? ` («${task.supplierName}» فقط نوشته شده)` : ""}؛ در کارتابل تأمین‌کننده را انتخاب کنید`,
    );
  }
  const items = await tx.orderItem.findMany({
    where: { orderId: task.entityId },
    orderBy: { id: "asc" },
    select: { id: true, productId: true, titleSnapshot: true, qty: true, cost: { select: { cost: true } } },
  });
  const priced = items.filter((i) => i.cost && i.cost.cost > 0n);
  if (!priced.length) return null;

  const party = await partyForSupplier(tx, task.supplierId);
  const order = await tx.order.findUnique({ where: { id: task.entityId }, select: { orderNumber: true } });
  const lines: InvoiceLineInput[] = priced.map((i) => {
    // قیمت خرید کل ردیف ذخیره شده؛ فی گرد به بالا و خرده به‌صورت تخفیف تا جمع دقیق بماند
    const cost = i.cost!.cost;
    const unit = (cost + BigInt(i.qty) - 1n) / BigInt(i.qty);
    return { productId: i.productId, title: i.titleSnapshot, qty: i.qty, unitPrice: unit, discount: unit * BigInt(i.qty) - cost, orderItemId: i.id };
  });

  return saveInvoice(
    tx,
    null,
    {
      type: "PURCHASE",
      date: dayKey(task.occurredAt ?? task.doneAt ?? task.createdAt),
      partyId: party.id,
      note: `کار «${task.title}»${order ? ` — سفارش ${order.orderNumber}` : ""}`,
      channel: "WORKLIST",
      orderId: task.entityId,
      sourceKey: taskPurchaseKey(taskId),
      lines,
    },
    { issue: true, shopStock: false },
    AUTO_ACTOR,
  );
}
