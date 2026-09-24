/**
 * فاکتورها — docs/plans/accounting.md بخش ۵، ۶.۶ و ۱۰.
 *
 * تنها راه نوشتن `AccInvoice`. هر فاکتور صادرشده سه چیز هم‌زمان دارد:
 * ردیف‌ها و مبالغ (`calc.ts`)، حرکت کاردکس (`inventory/stock.ts`) و سند
 * دوطرفه (`buildInvoiceVoucher`). ویرایش فاکتور صادرشده هر سه را بازسازی
 * می‌کند و شماره می‌ماند (تصمیم ۱۱)؛ ابطال هر سه را خنثی می‌کند.
 *
 * پیش‌نویس شماره، سند و کاردکس ندارد. پیش‌فاکتور شماره دارد ولی نه سند و نه
 * کاردکس؛ «تبدیل» یک فاکتور فروش تازه می‌سازد.
 *
 * ⚠️ سند بهای تمام‌شده از روی حرکت‌های کاردکس ساخته می‌شود، نه از فاکتور. ثبت
 *    با تاریخ گذشته بهای خروج را عوض می‌کند و `registerCostRebuilder` پایین
 *    همین فایل سند فاکتورهای متأثر را بازسازی می‌کند (تله‌ی ۲ و ۱۶).
 */

import type { AccInvoice, AccInvoiceType, AccMoveType, AccSource, AccChannel, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { assertPostable, yearForDate } from "../ledger/fiscal-year";
import { postVoucher, rebuildVoucher, voidVoucher, type Actor, type LineInput } from "../ledger/post";
import { nextNumber } from "../ledger/sequence";
import { applyMoves, registerCostRebuilder, removeMoves, type MoveInput } from "../inventory/stock";
import { ensureDefaultWarehouse } from "../inventory/docs";
import { faNum } from "../money";
import { calcInvoice, CalcError, divRound, INVOICE_TYPE_LABELS, allocate } from "./calc";

type Tx = Prisma.TransactionClient;

export const INVOICE_SOURCE = "AccInvoice";

const VOUCHER_SOURCE: Record<AccInvoiceType, AccSource | null> = {
  SALES: "SALES_INVOICE",
  PURCHASE: "PURCHASE_INVOICE",
  SALES_RETURN: "SALES_RETURN",
  PURCHASE_RETURN: "PURCHASE_RETURN",
  PROFORMA: null,
};

const MOVE_TYPE: Record<AccInvoiceType, AccMoveType | null> = {
  SALES: "SALE",
  PURCHASE: "PURCHASE",
  SALES_RETURN: "SALE_RETURN",
  PURCHASE_RETURN: "PURCHASE_RETURN",
  PROFORMA: null,
};

/** برگشتی ← نوع فاکتور مرجعش */
const RETURN_OF: Partial<Record<AccInvoiceType, AccInvoiceType>> = {
  SALES_RETURN: "SALES",
  PURCHASE_RETURN: "PURCHASE",
};

const seqKey = (t: AccInvoiceType) => `invoice:${t}`;
const SALES_SIDE: AccInvoiceType[] = ["SALES", "SALES_RETURN", "PROFORMA"];

export interface InvoiceLineInput {
  productId?: string | null;
  title?: string | null;
  unit?: string | null;
  qty: number;
  unitPrice: bigint;
  discount?: bigint;
  vatRateBp?: number;
  accountId?: string | null;
  refLineId?: string | null;
  orderItemId?: string | null;
  taxCode?: string | null;
}

export interface PartySnapshot {
  name?: string | null;
  nationalId?: string | null;
  economicCode?: string | null;
  postalCode?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface InvoiceInput {
  type: AccInvoiceType;
  date: Date;
  dueDate?: Date | null;
  validUntil?: Date | null;
  partyId: string;
  warehouseId?: string | null;
  pricesIncludeVat?: boolean;
  invoiceDiscount?: bigint;
  additions?: bigint;
  additionsTitle?: string | null;
  note?: string | null;
  refInvoiceId?: string | null;
  lines: InvoiceLineInput[];
  /** فقط مسیرهای خودکار */
  channel?: AccChannel;
  platformCode?: string | null;
  orderId?: string | null;
  sourceKey?: string | null;
  convertedFromId?: string | null;
  partySnapshot?: PartySnapshot;
}

export interface SaveOpts {
  /** پیش‌نویس را صادر کن (فاکتور صادرشده همیشه صادرشده می‌ماند) */
  issue?: boolean;
  /** `false` = موجودی سایت دست نمی‌خورد — فقط کانال‌هایی که خودشان کسر کرده‌اند (تله‌ی ۱۵) */
  shopStock?: boolean;
}

/** تعداد برگشت‌شده‌ی هر ردیف مرجع در برگشتی‌های معتبر */
export async function returnedQty(tx: Tx, refLineIds: string[], excludeInvoiceId?: string | null): Promise<Map<string, number>> {
  if (!refLineIds.length) return new Map();
  const rows = await tx.accInvoiceLine.groupBy({
    by: ["refLineId"],
    where: {
      refLineId: { in: refLineIds },
      invoice: { status: { not: "VOID" }, ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}) },
    },
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.refLineId!, r._sum.qty ?? 0]));
}

async function assertNoLiveReturns(tx: Tx, inv: AccInvoice, what: string) {
  const ret = await tx.accInvoice.findFirst({
    where: { refInvoiceId: inv.id, status: { not: "VOID" } },
    select: { type: true, number: true, status: true },
  });
  if (ret) {
    const label = INVOICE_TYPE_LABELS[ret.type];
    throw new AccError(`این فاکتور ${label}${ret.number ? ` شماره‌ی ${faNum(ret.number)}` : ""} دارد؛ تا آن برگشتی باطل نشود، این فاکتور ${what} نمی‌شود`, 409);
  }
}

async function validateServiceAccount(tx: Tx, accountId: string, salesSide: boolean, at: string) {
  const acc = await tx.accAccount.findUnique({ where: { id: accountId } });
  if (!acc) throw new AccError(`${at}: حساب پیدا نشد`);
  if (acc.level !== "SUBLEDGER" || !acc.isActive) throw new AccError(`${at}: «${acc.name}» حساب معین فعال نیست`);
  if (acc.detailKind !== "NONE") throw new AccError(`${at}: حساب «${acc.name}» تفصیلی می‌خواهد و برای ردیف خدمت مناسب نیست`);
  if (salesSide && acc.class !== "REVENUE") throw new AccError(`${at}: ردیف خدمت فروش فقط روی حساب درآمد می‌نشیند`);
  if (!salesSide && acc.class !== "EXPENSE" && acc.class !== "ASSET") throw new AccError(`${at}: ردیف خدمت خرید روی حساب هزینه یا دارایی می‌نشیند`);
}

/**
 * ساخت یا ویرایش فاکتور. `id = null` یعنی تازه. فاکتور صادرشده با ویرایش
 * دوباره صادر می‌شود (کاردکس و سند بازسازی، شماره ثابت).
 */
export async function saveInvoice(tx: Tx, id: string | null, input: InvoiceInput, opts: SaveOpts, actor: Actor): Promise<AccInvoice> {
  const current = id ? await tx.accInvoice.findUnique({ where: { id } }) : null;
  if (id && !current) throw new AccError("فاکتور پیدا نشد", 404);
  if (current) {
    if (current.status === "VOID") throw new AccError("فاکتور باطل‌شده ویرایش نمی‌شود");
    if (current.type !== input.type) throw new AccError("نوع فاکتور عوض نمی‌شود");
    if (current.type === "PROFORMA" && current.proformaState === "CONVERTED") {
      throw new AccError("این پیش‌فاکتور به فاکتور تبدیل شده و دیگر ویرایش نمی‌شود");
    }
    if (current.status === "ISSUED") {
      await assertNoLiveReturns(tx, current, "ویرایش");
      if (current.paidTotal > 0n) throw new AccError("برای این فاکتور دریافت یا پرداخت ثبت شده؛ اول آن را جدا کنید", 409);
      await assertPostable(tx, current.date);
    }
  }
  const type = input.type;
  const salesSide = SALES_SIDE.includes(type);
  const issue = !!opts.issue || current?.status === "ISSUED";

  // ── مرجع برگشتی ──
  const refType = RETURN_OF[type];
  const ref = refType && input.refInvoiceId
    ? await tx.accInvoice.findUnique({ where: { id: input.refInvoiceId }, include: { lines: true } })
    : null;
  if (input.refInvoiceId && !refType) throw new AccError("فقط برگشتی فاکتور مرجع دارد");
  if (refType && input.refInvoiceId) {
    if (!ref) throw new AccError("فاکتور مرجع پیدا نشد", 404);
    if (ref.type !== refType || ref.status !== "ISSUED") throw new AccError(`مرجع باید ${INVOICE_TYPE_LABELS[refType]} صادرشده باشد`);
  }
  const partyId = ref ? ref.partyId : input.partyId;

  const party = await tx.accParty.findUnique({ where: { id: partyId } });
  if (!party) throw new AccError("طرف حساب پیدا نشد", 404);
  if (!party.isActive) throw new AccError(`«${party.name}» غیرفعال است`);

  const year = issue ? await assertPostable(tx, input.date) : await yearForDate(tx, input.date);
  if (!year) throw new AccError("برای این تاریخ سال مالی تعریف نشده است");

  const settings = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { vatEnabled: true } });
  const manual = (input.channel ?? current?.channel ?? "MANUAL") === "MANUAL";

  // ── ردیف‌ها ──
  if (!input.lines.length) throw new AccError("دست‌کم یک ردیف لازم است");
  const refLines = new Map((ref?.lines ?? []).map((l) => [l.id, l]));
  const already = ref ? await returnedQty(tx, [...refLines.keys()], id) : new Map<string, number>();
  const productIds = [...new Set(input.lines.map((l) => (l.refLineId ? refLines.get(l.refLineId)?.productId : l.productId)).filter((x): x is string => !!x))];
  const products = new Map(
    (await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true } })).map((p) => [p.id, p]),
  );

  const lines: (Required<Omit<InvoiceLineInput, "discount" | "vatRateBp" | "title">> & { title: string; discount: bigint; vatRateBp: number })[] = [];
  for (const [i, l] of input.lines.entries()) {
    const at = `ردیف ${faNum(i + 1)}`;
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new AccError(`${at}: تعداد باید عدد صحیح مثبت باشد`);
    if (ref) {
      const rl = l.refLineId ? refLines.get(l.refLineId) : null;
      if (!rl) throw new AccError(`${at}: ردیف در فاکتور مرجع نیست`);
      const left = rl.qty - (already.get(rl.id) ?? 0) - lines.filter((x) => x.refLineId === rl.id).reduce((s, x) => s + x.qty, 0);
      if (l.qty > left) throw new AccError(`${at}: از «${rl.title}» فقط ${faNum(Math.max(0, left))} عدد قابل برگشت است`);
      // مبلغ برگشت همان مبلغ فروش/خرید اولیه است، به نسبت تعداد
      const disc = rl.discount + rl.invoiceDiscountShare;
      lines.push({
        productId: rl.productId,
        title: rl.title,
        unit: rl.unit,
        qty: l.qty,
        unitPrice: rl.unitPrice,
        discount: l.qty === rl.qty ? disc : divRound(disc * BigInt(l.qty), BigInt(rl.qty)),
        vatRateBp: rl.vatRateBp,
        accountId: rl.accountId,
        refLineId: rl.id,
        orderItemId: rl.orderItemId,
        taxCode: rl.taxCode,
      });
      continue;
    }
    const productId = l.productId || null;
    if (productId && !products.has(productId)) throw new AccError(`${at}: کالا پیدا نشد`);
    const title = l.title?.trim() || (productId ? products.get(productId)!.title : "");
    if (!title) throw new AccError(`${at}: شرح ردیف خدمت را بنویسید`);
    let accountId = productId ? null : l.accountId || null;
    if (!productId) {
      if (!accountId && salesSide) {
        accountId = (await tx.accAccount.findUnique({ where: { systemKey: "SERVICE_REVENUE" }, select: { id: true } }))?.id ?? null;
      }
      if (!accountId) throw new AccError(`${at}: حساب ردیف «${title}» را انتخاب کنید`);
      await validateServiceAccount(tx, accountId, salesSide, at);
    }
    lines.push({
      productId,
      title,
      unit: l.unit?.trim() || null,
      qty: l.qty,
      unitPrice: l.unitPrice,
      discount: l.discount ?? 0n,
      vatRateBp: manual && !settings?.vatEnabled ? 0 : l.vatRateBp ?? 0,
      accountId,
      refLineId: null,
      orderItemId: l.orderItemId ?? null,
      taxCode: l.taxCode ?? null,
    });
  }

  const pricesIncludeVat = ref ? ref.pricesIncludeVat : !!input.pricesIncludeVat;
  const invoiceDiscount = ref ? 0n : input.invoiceDiscount ?? 0n;
  const additions = input.additions ?? 0n;
  const hasProducts = lines.some((l) => l.productId);
  if (type === "PURCHASE" && additions > 0n && !hasProducts) throw new AccError("کرایه‌ی خرید روی بهای کالا پخش می‌شود؛ فاکتور بی‌کالا کرایه نمی‌گیرد");
  if (type === "PURCHASE_RETURN" && additions > 0n) throw new AccError("برگشت از خرید اضافات ندارد");
  if (ref && input.invoiceDiscount) throw new AccError("برگشتی تخفیف جدا نمی‌گیرد؛ تخفیف فاکتور مرجع به نسبت برمی‌گردد");

  let calc;
  try {
    calc = calcInvoice({ lines, invoiceDiscount, additions, pricesIncludeVat });
  } catch (e) {
    if (e instanceof CalcError) throw new AccError(e.message);
    throw e;
  }

  // ── انبار ──
  let warehouseId: string | null = null;
  if (hasProducts && type !== "PROFORMA") {
    warehouseId = input.warehouseId || current?.warehouseId || (await ensureDefaultWarehouse(tx)).id;
    const wh = await tx.accWarehouse.findUnique({ where: { id: warehouseId } });
    if (!wh) throw new AccError("انبار پیدا نشد");
    if (!wh.isActive) throw new AccError(`انبار «${wh.name}» غیرفعال است`);
  }

  // ── شماره ──
  let number = current?.number ?? null;
  if (issue && (!number || current?.yearId !== year.id)) number = await nextNumber(tx, year.id, seqKey(type));

  const snap = input.partySnapshot ?? {};
  const pick = <K extends keyof PartySnapshot>(k: K, fallback: string | null) => (snap[k] !== undefined ? snap[k]?.trim() || null : fallback);
  const data = {
    type,
    yearId: year.id,
    number,
    date: input.date,
    dueDate: input.dueDate ?? null,
    validUntil: type === "PROFORMA" ? input.validUntil ?? null : null,
    status: issue ? ("ISSUED" as const) : ("DRAFT" as const),
    proformaState: type === "PROFORMA" ? current?.proformaState ?? "OPEN" : null,
    partyId,
    warehouseId,
    pricesIncludeVat,
    partyName: pick("name", party.name) ?? party.name,
    partyNationalId: pick("nationalId", party.nationalId),
    partyEconomicCode: pick("economicCode", party.economicCode),
    partyPostalCode: pick("postalCode", party.postalCode),
    partyAddress: pick("address", [party.city, party.address].filter(Boolean).join("، ") || null),
    partyPhone: pick("phone", party.mobile ?? party.phone),
    subtotal: calc.subtotal,
    lineDiscount: calc.lineDiscount,
    invoiceDiscount: calc.invoiceDiscount,
    additions: calc.additions,
    additionsTitle: calc.additions > 0n ? input.additionsTitle?.trim() || (salesSide ? "هزینه‌ی ارسال" : "کرایه‌ی حمل") : null,
    vatTotal: calc.vatTotal,
    total: calc.total,
    note: input.note?.trim() || null,
    refInvoiceId: ref?.id ?? null,
    ...(issue && !current?.issuedAt ? { issuedAt: new Date() } : {}),
  };

  let inv: AccInvoice;
  if (current) {
    if (current.status === "ISSUED" && MOVE_TYPE[type]) {
      // حرکت‌های قبلی پیش از پاک شدن ردیف‌ها برداشته می‌شوند
      await removeMoves(tx, INVOICE_SOURCE, current.id, actor, { shopStock: opts.shopStock });
    }
    inv = await tx.accInvoice.update({ where: { id: current.id }, data });
    await tx.accInvoiceLine.deleteMany({ where: { invoiceId: current.id } });
  } else {
    inv = await tx.accInvoice.create({
      data: {
        ...data,
        channel: input.channel ?? "MANUAL",
        platformCode: input.platformCode ?? null,
        orderId: input.orderId ?? null,
        sourceKey: input.sourceKey ?? null,
        convertedFromId: input.convertedFromId ?? null,
        createdById: actor.id ?? null,
        createdByName: actor.name,
      },
    });
  }
  await tx.accInvoiceLine.createMany({
    data: lines.map((l, i) => ({
      invoiceId: inv.id,
      seq: i + 1,
      productId: l.productId,
      title: l.title,
      unit: l.unit,
      qty: l.qty,
      unitPrice: l.unitPrice,
      discount: l.discount,
      invoiceDiscountShare: calc.lines[i].share,
      vatRateBp: l.vatRateBp,
      vatAmount: calc.lines[i].vatAmount,
      lineTotal: calc.lines[i].lineTotal,
      accountId: l.accountId,
      refLineId: l.refLineId,
      orderItemId: l.orderItemId,
      taxCode: l.taxCode,
    })),
  });

  if (issue && MOVE_TYPE[type]) {
    await applyMoves(tx, await invoiceMoves(tx, inv.id), actor, { shopStock: opts.shopStock });
    await buildInvoiceVoucher(tx, inv.id, actor);
  }
  return tx.accInvoice.findUniqueOrThrow({ where: { id: inv.id } });
}

/** حرکت‌های کاردکس یک فاکتور صادرشده از روی ردیف‌های ذخیره‌شده */
async function invoiceMoves(tx: Tx, invoiceId: string): Promise<MoveInput[]> {
  const inv = await tx.accInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { lines: { orderBy: { seq: "asc" } } } });
  const moveType = MOVE_TYPE[inv.type];
  if (!moveType) return [];
  const products = inv.lines.filter((l) => l.productId);
  if (!products.length) return [];

  const base = { warehouseId: inv.warehouseId!, date: inv.date, type: moveType, sourceType: INVOICE_SOURCE, sourceId: inv.id };

  if (inv.type === "PURCHASE") {
    // بهای ورود = خالص ردیف + سهم کرایه به نسبت خالص؛ باقی تقسیم در سند روی «گرد کردن»
    const nets = products.map((l) => l.lineTotal - l.vatAmount);
    const freight = allocate(inv.additions, nets);
    return products.map((l, i) => ({
      ...base,
      productId: l.productId!,
      qty: l.qty,
      unitCost: (nets[i] + freight[i]) / BigInt(l.qty),
      sourceLineId: l.id,
    }));
  }

  if (inv.type === "SALES_RETURN") {
    // برگشت با همان بهای خروج اولیه (بخش ۵)؛ بی‌مرجع با میانگین فعلی
    const refIds = products.map((l) => l.refLineId).filter((x): x is string => !!x);
    const outMoves = refIds.length
      ? await tx.accStockMove.findMany({ where: { sourceType: INVOICE_SOURCE, sourceLineId: { in: refIds }, type: "SALE" } })
      : [];
    const byRef = new Map(outMoves.map((m) => [m.sourceLineId!, m.unitCost]));
    const costs = new Map(
      (await tx.accProductCost.findMany({ where: { productId: { in: products.map((l) => l.productId!) } } })).map((c) => [
        c.productId,
        c.avgCost > 0n ? c.avgCost : c.lastCost,
      ]),
    );
    return products.map((l) => ({
      ...base,
      productId: l.productId!,
      qty: l.qty,
      unitCost: (l.refLineId ? byRef.get(l.refLineId) : undefined) ?? costs.get(l.productId!) ?? 0n,
      sourceLineId: l.id,
    }));
  }

  return products.map((l) => ({ ...base, productId: l.productId!, qty: l.qty, sourceLineId: l.id }));
}

/** سند یک فاکتور صادرشده — از مبالغ ردیف‌ها و بهای واقعی حرکت‌های کاردکس */
export async function buildInvoiceVoucher(tx: Tx, invoiceId: string, actor: Actor): Promise<void> {
  const inv = await tx.accInvoice.findUnique({ where: { id: invoiceId }, include: { lines: { orderBy: { seq: "asc" } } } });
  const source = inv ? VOUCHER_SOURCE[inv.type] : null;
  if (!inv || inv.status !== "ISSUED" || !source) return;

  const moves = await tx.accStockMove.findMany({ where: { sourceType: INVOICE_SOURCE, sourceId: inv.id } });
  const kardex = moves.reduce((s, m) => s + m.totalCost, 0n);
  const party = inv.partyId;

  // جمع هر حساب — ردیف‌های هم‌حساب یکی می‌شوند تا سند خوانا بماند
  const rows = new Map<string, LineInput>();
  const put = (key: { accountKey?: string; accountId?: string }, side: "debit" | "credit", amount: bigint, description: string, partyId?: string) => {
    if (amount === 0n) return;
    if (amount < 0n) {
      side = side === "debit" ? "credit" : "debit";
      amount = -amount;
    }
    const k = `${key.accountKey ?? key.accountId}|${side}|${partyId ?? ""}`;
    const r = rows.get(k);
    if (r) r[side] = (r[side] ?? 0n) + amount;
    else rows.set(k, { ...key, partyId: partyId ?? null, [side]: amount, description });
  };

  const net = (l: (typeof inv.lines)[number]) => l.lineTotal - l.vatAmount;
  const productNet = inv.lines.filter((l) => l.productId).reduce((s, l) => s + net(l), 0n);

  switch (inv.type) {
    case "SALES": {
      put({ accountKey: "AR" }, "debit", inv.total, "فروش", party);
      put({ accountKey: "SALES_DISCOUNT" }, "debit", inv.lineDiscount + inv.invoiceDiscount, "تخفیف فروش");
      for (const l of inv.lines) {
        const gross = l.unitPrice * BigInt(l.qty) - (inv.pricesIncludeVat ? l.vatAmount : 0n);
        put(l.productId ? { accountKey: "SALES" } : { accountId: l.accountId! }, "credit", gross, l.productId ? "فروش کالا" : l.title);
      }
      put({ accountKey: "SHIPPING_REVENUE" }, "credit", inv.additions, inv.additionsTitle ?? "درآمد ارسال");
      put({ accountKey: "VAT_SALES" }, "credit", inv.vatTotal, "مالیات بر ارزش افزوده");
      put({ accountKey: "COGS" }, "debit", kardex, "بهای تمام‌شده‌ی کالای فروش‌رفته");
      put({ accountKey: "INVENTORY" }, "credit", kardex, "خروج کالا");
      break;
    }
    case "SALES_RETURN": {
      put({ accountKey: "SALES_RETURN" }, "debit", productNet, "برگشت از فروش");
      for (const l of inv.lines) if (!l.productId) put({ accountId: l.accountId! }, "debit", net(l), l.title);
      put({ accountKey: "VAT_SALES" }, "debit", inv.vatTotal, "مالیات برگشت از فروش");
      put({ accountKey: "SHIPPING_REVENUE" }, "debit", inv.additions, inv.additionsTitle ?? "برگشت هزینه‌ی ارسال");
      put({ accountKey: "AR" }, "credit", inv.total, "برگشت از فروش", party);
      put({ accountKey: "INVENTORY" }, "debit", kardex, "ورود کالای برگشتی");
      put({ accountKey: "COGS" }, "credit", kardex, "برگشت بهای تمام‌شده");
      break;
    }
    case "PURCHASE": {
      put({ accountKey: "INVENTORY" }, "debit", kardex, "خرید کالا");
      // خرده‌ی تقسیم بهای کل ردیف بر تعداد — کاردکس بهای واحد صحیح نگه می‌دارد
      put({ accountKey: "ROUNDING" }, "debit", productNet + inv.additions - kardex, "گرد کردن بهای واحد");
      for (const l of inv.lines) if (!l.productId) put({ accountId: l.accountId! }, "debit", net(l), l.title);
      put({ accountKey: "VAT_PURCHASE" }, "debit", inv.vatTotal, "مالیات بر ارزش افزوده‌ی خرید");
      put({ accountKey: "AP" }, "credit", inv.total, "خرید", party);
      break;
    }
    case "PURCHASE_RETURN": {
      put({ accountKey: "AP" }, "debit", inv.total, "برگشت از خرید", party);
      put({ accountKey: "VAT_PURCHASE" }, "credit", inv.vatTotal, "مالیات برگشت از خرید");
      for (const l of inv.lines) if (!l.productId) put({ accountId: l.accountId! }, "credit", net(l), l.title);
      put({ accountKey: "INVENTORY" }, "credit", kardex, "خروج کالای برگشتی");
      // کالا با میانگین روز خارج می‌شود، تأمین‌کننده با قیمت خرید حساب می‌کند — اختلاف به بهای تمام‌شده
      put({ accountKey: "COGS" }, "credit", productNet - kardex, "اختلاف بهای برگشت از خرید");
      break;
    }
  }

  const lines = [...rows.values()];
  const label = INVOICE_TYPE_LABELS[inv.type];
  const input = { date: inv.date, description: `${label} ${faNum(inv.number ?? 0)} — ${inv.partyName}`, lines, actor };

  if (lines.length < 2) {
    if (inv.voucherId) {
      await voidVoucher(tx, inv.voucherId, "فاکتور مبلغی ندارد", actor, { fromSource: true });
      await tx.accInvoice.update({ where: { id: inv.id }, data: { voucherId: null } });
    }
    return;
  }
  const existing = inv.voucherId ? await tx.accVoucher.findUnique({ where: { id: inv.voucherId } }) : null;
  if (existing && existing.status === "POSTED") {
    const v = await rebuildVoucher(tx, existing.id, input);
    if (v.id !== existing.id) await tx.accInvoice.update({ where: { id: inv.id }, data: { voucherId: v.id } });
  } else {
    const v = await postVoucher(tx, { ...input, source, sourceId: inv.id });
    await tx.accInvoice.update({ where: { id: inv.id }, data: { voucherId: v.id } });
  }
}

registerCostRebuilder(INVOICE_SOURCE, (tx, id, actor) => buildInvoiceVoucher(tx, id, actor));

/** ابطال — کاردکس و سند خنثی می‌شوند؛ شماره می‌ماند (بی‌حفره) */
export async function voidInvoice(tx: Tx, id: string, reason: string, actor: Actor, opts: { shopStock?: boolean } = {}): Promise<AccInvoice> {
  const inv = await tx.accInvoice.findUnique({ where: { id } });
  if (!inv) throw new AccError("فاکتور پیدا نشد", 404);
  if (inv.status === "VOID") return inv;
  if (inv.status === "DRAFT") throw new AccError("پیش‌نویس ابطال نمی‌شود؛ حذفش کنید");
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  if (inv.type === "PROFORMA" && inv.proformaState === "CONVERTED") {
    throw new AccError("این پیش‌فاکتور به فاکتور تبدیل شده؛ فاکتورش را باطل کنید");
  }
  await assertNoLiveReturns(tx, inv, "باطل");
  if (inv.paidTotal > 0n) throw new AccError("برای این فاکتور دریافت یا پرداخت ثبت شده؛ اول آن را جدا کنید", 409);

  if (MOVE_TYPE[inv.type]) {
    await assertPostable(tx, inv.date);
    await removeMoves(tx, INVOICE_SOURCE, inv.id, actor, { shopStock: opts.shopStock });
    if (inv.voucherId) await voidVoucher(tx, inv.voucherId, `ابطال ${INVOICE_TYPE_LABELS[inv.type]}: ${reason.trim()}`, actor, { fromSource: true });
  }
  if (inv.convertedFromId) {
    await tx.accInvoice.update({ where: { id: inv.convertedFromId }, data: { proformaState: "OPEN" } });
  }
  return tx.accInvoice.update({
    where: { id },
    data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` },
  });
}

export async function deleteDraft(tx: Tx, id: string): Promise<void> {
  const inv = await tx.accInvoice.findUnique({ where: { id } });
  if (!inv) throw new AccError("فاکتور پیدا نشد", 404);
  if (inv.status !== "DRAFT") throw new AccError("فقط پیش‌نویس حذف می‌شود؛ فاکتور صادرشده باطل می‌شود");
  await tx.accInvoice.delete({ where: { id } });
}

/** پیش‌فاکتور ← فاکتور فروش صادرشده با همان اقلام و مبالغ */
export async function convertProforma(tx: Tx, id: string, date: Date, actor: Actor, warehouseId?: string | null): Promise<AccInvoice> {
  const pf = await tx.accInvoice.findUnique({ where: { id }, include: { lines: { orderBy: { seq: "asc" } } } });
  if (!pf || pf.type !== "PROFORMA") throw new AccError("پیش‌فاکتور پیدا نشد", 404);
  if (pf.status !== "ISSUED") throw new AccError(pf.status === "VOID" ? "پیش‌فاکتور باطل شده است" : "اول پیش‌فاکتور را صادر کنید");
  if (pf.proformaState === "CONVERTED") throw new AccError("این پیش‌فاکتور قبلاً تبدیل شده است", 409);

  const inv = await saveInvoice(
    tx,
    null,
    {
      type: "SALES",
      date,
      partyId: pf.partyId,
      warehouseId,
      pricesIncludeVat: pf.pricesIncludeVat,
      invoiceDiscount: pf.invoiceDiscount,
      additions: pf.additions,
      additionsTitle: pf.additionsTitle,
      note: pf.note,
      convertedFromId: pf.id,
      partySnapshot: {
        name: pf.partyName,
        nationalId: pf.partyNationalId,
        economicCode: pf.partyEconomicCode,
        postalCode: pf.partyPostalCode,
        address: pf.partyAddress,
        phone: pf.partyPhone,
      },
      lines: pf.lines.map((l) => ({
        productId: l.productId,
        title: l.title,
        unit: l.unit,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount,
        vatRateBp: l.vatRateBp,
        accountId: l.accountId,
        taxCode: l.taxCode,
      })),
    },
    { issue: true },
    actor,
  );
  await tx.accInvoice.update({ where: { id: pf.id }, data: { proformaState: "CONVERTED" } });
  return inv;
}
