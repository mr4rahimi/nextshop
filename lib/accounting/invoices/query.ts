/**
 * خواندن فاکتور برای رابط کاربری و تبدیل بدنه‌ی درخواست به ورودی سرویس.
 *
 * ⚠️ بهای تمام‌شده و سود فقط با `ACC_COST_VIEW` برمی‌گردد (بخش ۱۴) — سمت
 *    سرور حذف می‌شود، نه با پنهان‌کردن در مرورگر.
 */

import type { AccInvoiceStatus, AccInvoiceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, type StaffAccess } from "@/lib/permissions";
import { AccError, toAmount } from "../errors";
import { parseDay } from "../dates";
import { toLatinDigits } from "../money";
import { returnedQty, INVOICE_SOURCE, type InvoiceInput } from "./service";
import { invoiceOpenAmounts } from "../cash/allocation";

export const SALES_TYPES: AccInvoiceType[] = ["SALES", "SALES_RETURN", "PROFORMA"];
export const PURCHASE_TYPES: AccInvoiceType[] = ["PURCHASE", "PURCHASE_RETURN"];
const ALL_TYPES: AccInvoiceType[] = [...SALES_TYPES, ...PURCHASE_TYPES];

/** مجوز نوشتن هر نوع فاکتور */
export const permOf = (t: AccInvoiceType) => (SALES_TYPES.includes(t) ? "ACC_SALES" : "ACC_PURCHASE");

export function parseType(v: unknown): AccInvoiceType {
  if (typeof v === "string" && (ALL_TYPES as string[]).includes(v)) return v as AccInvoiceType;
  throw new AccError("نوع فاکتور نامعتبر است");
}

/** آیا این کاربر این نوع فاکتور را می‌بیند؟ */
export function canSee(access: StaffAccess, t: AccInvoiceType): boolean {
  return can(access, "ACC_VIEW") || can(access, permOf(t));
}

interface LineBody {
  productId?: string | null;
  title?: string | null;
  unit?: string | null;
  qty?: unknown;
  unitPrice?: unknown;
  discount?: unknown;
  vatRateBp?: unknown;
  accountId?: string | null;
  refLineId?: string | null;
  taxCode?: string | null;
}

export interface InvoiceBody {
  type?: string;
  date?: string;
  dueDate?: string | null;
  validUntil?: string | null;
  partyId?: string;
  warehouseId?: string | null;
  pricesIncludeVat?: boolean;
  invoiceDiscount?: unknown;
  additions?: unknown;
  additionsTitle?: string | null;
  note?: string | null;
  refInvoiceId?: string | null;
  issue?: boolean;
  partySnapshot?: InvoiceInput["partySnapshot"];
  lines?: LineBody[];
}

export function inputFromBody(b: InvoiceBody): InvoiceInput {
  const type = parseType(b.type);
  const date = parseDay(b.date);
  if (!date) throw new AccError("تاریخ فاکتور را انتخاب کنید");
  if (!b.partyId && !b.refInvoiceId) throw new AccError(type.startsWith("PURCHASE") ? "فروشنده را انتخاب کنید" : "خریدار را انتخاب کنید");
  const lines = (b.lines ?? []).map((l) => {
    const qty = Number(toLatinDigits(String(l.qty ?? "")));
    const vat = l.vatRateBp === undefined || l.vatRateBp === null || l.vatRateBp === "" ? 0 : Number(l.vatRateBp);
    if (!Number.isFinite(vat)) throw new AccError("نرخ مالیات نامعتبر است");
    return {
      productId: l.productId || null,
      title: l.title ?? null,
      unit: l.unit ?? null,
      qty,
      unitPrice: toAmount(l.unitPrice, "فی"),
      discount: toAmount(l.discount, "تخفیف"),
      vatRateBp: Math.round(vat),
      accountId: l.accountId || null,
      refLineId: l.refLineId || null,
      taxCode: l.taxCode?.trim() || null,
    };
  });
  return {
    type,
    date,
    dueDate: parseDay(b.dueDate) ?? null,
    validUntil: parseDay(b.validUntil) ?? null,
    partyId: b.partyId ?? "",
    warehouseId: b.warehouseId || null,
    pricesIncludeVat: !!b.pricesIncludeVat,
    invoiceDiscount: toAmount(b.invoiceDiscount, "تخفیف فاکتور"),
    additions: toAmount(b.additions, "اضافات"),
    additionsTitle: b.additionsTitle ?? null,
    note: b.note ?? null,
    refInvoiceId: b.refInvoiceId || null,
    partySnapshot: b.partySnapshot,
    lines,
  };
}

export interface ListFilter {
  types: AccInvoiceType[];
  status?: AccInvoiceStatus | "OPEN_PROFORMA" | null;
  q?: string | null;
  partyId?: string | null;
  from?: Date | null;
  to?: Date | null;
  take?: number;
}

export async function listInvoices(f: ListFilter) {
  const where: Prisma.AccInvoiceWhereInput = { type: { in: f.types } };
  if (f.status === "OPEN_PROFORMA") Object.assign(where, { status: "ISSUED", proformaState: "OPEN" });
  else if (f.status) where.status = f.status;
  if (f.partyId) where.partyId = f.partyId;
  if (f.from || f.to) where.date = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  const term = f.q?.trim();
  if (term) {
    const lat = toLatinDigits(term);
    const or: Prisma.AccInvoiceWhereInput[] = [{ partyName: { contains: term, mode: "insensitive" } }, { note: { contains: term, mode: "insensitive" } }];
    if (/^\d{1,9}$/.test(lat)) or.push({ number: Number(lat) });
    where.OR = or;
  }
  const [items, agg] = await Promise.all([
    prisma.accInvoice.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }, { createdAt: "desc" }],
      take: f.take ?? 100,
      select: {
        id: true,
        type: true,
        number: true,
        date: true,
        status: true,
        proformaState: true,
        validUntil: true,
        partyId: true,
        partyName: true,
        channel: true,
        platformCode: true,
        total: true,
        paidTotal: true,
        refInvoiceId: true,
        _count: { select: { lines: true } },
      },
    }),
    prisma.accInvoice.aggregate({ where: { ...where, status: { not: "VOID" } }, _sum: { total: true }, _count: true }),
  ]);
  return { items, summary: { count: agg._count, total: agg._sum.total ?? 0n } };
}

export async function invoiceDetail(id: string, access: StaffAccess) {
  const inv = await prisma.accInvoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { seq: "asc" } }, party: { select: { id: true, code: true, name: true, mobile: true } } },
  });
  if (!inv) return null;
  const withCost = can(access, "ACC_COST_VIEW");

  const productIds = inv.lines.map((l) => l.productId).filter((x): x is string => !!x);
  const accountIds = inv.lines.map((l) => l.accountId).filter((x): x is string => !!x);
  const [products, accounts, warehouse, ref, returns, convertedTo, convertedFrom, voucher, order, moves] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, sku: true, mainImage: true, slug: true } }),
    prisma.accAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, code: true, name: true } }),
    inv.warehouseId ? prisma.accWarehouse.findUnique({ where: { id: inv.warehouseId }, select: { id: true, name: true } }) : null,
    inv.refInvoiceId ? prisma.accInvoice.findUnique({ where: { id: inv.refInvoiceId }, select: { id: true, type: true, number: true, date: true } }) : null,
    prisma.accInvoice.findMany({ where: { refInvoiceId: inv.id }, select: { id: true, type: true, number: true, date: true, status: true, total: true }, orderBy: { date: "asc" } }),
    prisma.accInvoice.findUnique({ where: { convertedFromId: inv.id }, select: { id: true, type: true, number: true, status: true } }),
    inv.convertedFromId ? prisma.accInvoice.findUnique({ where: { id: inv.convertedFromId }, select: { id: true, type: true, number: true } }) : null,
    inv.voucherId && can(access, "ACC_VOUCHER") ? prisma.accVoucher.findUnique({ where: { id: inv.voucherId }, select: { id: true, number: true, status: true } }) : null,
    inv.orderId ? prisma.order.findUnique({ where: { id: inv.orderId }, select: { id: true, orderNumber: true, status: true } }) : null,
    withCost ? prisma.accStockMove.findMany({ where: { sourceType: INVOICE_SOURCE, sourceId: inv.id }, select: { sourceLineId: true, totalCost: true } }) : Promise.resolve([]),
  ]);
  const byProduct = new Map(products.map((p) => [p.id, p]));
  const byAccount = new Map(accounts.map((a) => [a.id, a]));
  const returned = inv.type === "SALES" || inv.type === "PURCHASE" ? await returnedQty(prisma, inv.lines.map((l) => l.id)) : new Map<string, number>();
  const costByLine = new Map(moves.map((m) => [m.sourceLineId, m.totalCost]));

  const lines = inv.lines.map((l) => ({
    ...l,
    net: l.lineTotal - l.vatAmount,
    sku: l.productId ? byProduct.get(l.productId)?.sku ?? null : null,
    image: l.productId ? byProduct.get(l.productId)?.mainImage ?? null : null,
    account: l.accountId ? byAccount.get(l.accountId) ?? null : null,
    returnedQty: returned.get(l.id) ?? 0,
    ...(withCost && l.productId ? { cost: costByLine.get(l.id) ?? 0n } : {}),
  }));
  // تسویه — دریافت/پرداخت‌های تخصیص‌یافته و مانده‌ی باز (فاز ۵)
  const [allocations, openMap] = await Promise.all([
    prisma.accAllocation.findMany({
      where: { invoiceId: inv.id, moneyDoc: { status: "POSTED" } },
      include: { moneyDoc: { select: { id: true, kind: true, number: true, date: true } } },
    }),
    invoiceOpenAmounts(prisma, [inv.id]),
  ]);
  const cost = withCost && (inv.type === "SALES" || inv.type === "SALES_RETURN") ? moves.reduce((s, m) => s + m.totalCost, 0n) : null;
  const productNet = lines.filter((l) => l.productId).reduce((s, l) => s + l.net, 0n);

  return {
    invoice: { ...inv, lines },
    warehouse,
    ref,
    returns,
    convertedTo,
    convertedFrom,
    voucher,
    order,
    profit: cost !== null && inv.status === "ISSUED" ? { cost, gross: productNet - cost } : null,
    settlement: {
      allocations: allocations.map((a) => ({ amount: a.amount, ...a.moneyDoc })),
      returned: openMap.get(inv.id)?.returned ?? 0n,
      open: openMap.get(inv.id)?.open ?? 0n,
    },
  };
}
