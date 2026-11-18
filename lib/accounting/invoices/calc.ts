/**
 * محاسبه‌ی مبالغ فاکتور — بدون وابستگی سمت سرور؛ فرم مرورگر همین را صدا می‌زند
 * تا عددی که کاربر می‌بیند همان باشد که ذخیره می‌شود.
 *
 * ترتیب هر ردیف:
 *   ناخالص = تعداد × فی   (ردیف بسته‌ای: تعداد ÷ اندازه‌ی بسته × فی بسته — `lineGross`)
 *   − تخفیف ردیف
 *   − سهم تخفیف فاکتور  (به نسبت مبلغ پس از تخفیف ردیف؛ باقی گرد به ردیف آخر — تله‌ی ۱۲)
 *   = پس از تخفیف
 *   قیمت بی‌مالیات: مالیات = گرد(پس از تخفیف × نرخ)، جمع ردیف = پس از تخفیف + مالیات
 *   قیمت با مالیات: خالص = گرد(پس از تخفیف ÷ (۱+نرخ))، مالیات = پس از تخفیف − خالص
 *
 * جمع فاکتور = Σ جمع ردیف‌ها + اضافات (کرایه). مالیات هر ردیف جدا گرد می‌شود و
 * جمع فاکتور همیشه جمع ردیف‌هاست.
 */

export interface CalcLineInput {
  /** همیشه به واحد پایه — ردیف بسته‌ای مضرب `packSize` */
  qty: number;
  /** ردیف بسته‌ای: فی هر بسته */
  unitPrice: bigint;
  /** ردیف بسته‌ای (کارتن = ۱۲) — webhesab-parity.md بخش ۲۹ */
  packSize?: number | null;
  discount?: bigint;
  vatRateBp?: number;
}

export interface CalcInput {
  lines: CalcLineInput[];
  invoiceDiscount?: bigint;
  additions?: bigint;
  pricesIncludeVat?: boolean;
}

export interface CalcLine {
  gross: bigint;
  discount: bigint;
  share: bigint;
  /** پس از تخفیف‌ها، بی‌مالیات */
  net: bigint;
  vatAmount: bigint;
  lineTotal: bigint;
}

export interface CalcResult {
  lines: CalcLine[];
  subtotal: bigint;
  lineDiscount: bigint;
  invoiceDiscount: bigint;
  additions: bigint;
  vatTotal: bigint;
  /** Σ خالص ردیف‌ها — پایه‌ی درآمد/بهای کالا */
  netTotal: bigint;
  total: bigint;
}

export class CalcError extends Error {}

const faIdx = (i: number) => String(i + 1).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

/** ناخالص ردیف — تنها جای ضرب تعداد در فی؛ ردیف بسته‌ای فی را برای هر بسته دارد */
export function lineGross(l: { qty: number; unitPrice: bigint; packSize?: number | null }): bigint {
  return l.packSize && l.packSize > 1 ? l.unitPrice * BigInt(Math.floor(l.qty / l.packSize)) : l.unitPrice * BigInt(l.qty);
}

/** تعداد ردیف به واحد خودش — ردیف بسته‌ای تعداد بسته */
export const packQty = (l: { qty: number; packSize?: number | null }) => (l.packSize && l.packSize > 1 ? l.qty / l.packSize : l.qty);

/** موجودی به بسته: «۲ کارتن و ۳ عدد» — null اگر کالا بسته ندارد یا کمتر از یک بسته است */
export function packBreakdown(qty: number, unit: string, packUnit: string | null | undefined, packSize: number | null | undefined, faNum: (n: number) => string): string | null {
  if (!packSize || packSize < 2 || !packUnit || Math.abs(qty) < packSize) return null;
  const sign = qty < 0 ? "−" : "";
  const a = Math.abs(qty);
  const packs = Math.floor(a / packSize);
  const rest = a % packSize;
  return `${sign}${faNum(packs)} ${packUnit}${rest ? ` و ${faNum(rest)} ${unit}` : ""}`;
}

/** تعداد ردیف به زبان خودش: «۵ کارتن» یا «۷ عدد» */
export function lineQtyText(l: { qty: number; unit?: string | null; packSize?: number | null }, faNum: (n: number) => string): string {
  if (l.packSize && l.packSize > 1) return `${faNum(l.qty / l.packSize)} ${l.unit || "بسته"}`;
  return `${faNum(l.qty)}${l.unit ? ` ${l.unit}` : ""}`;
}

/** تقسیم با گرد کردن نیمه به بالا — فقط برای اعداد نامنفی */
export function divRound(a: bigint, b: bigint): bigint {
  return (a * 2n + b) / (b * 2n);
}

/** پخش یک مبلغ به نسبت وزن‌ها — جمع دقیقاً همان مبلغ است؛ باقی گرد به آخرین وزن مثبت */
export function allocate(amount: bigint, weights: bigint[]): bigint[] {
  const total = weights.reduce((s, w) => s + (w > 0n ? w : 0n), 0n);
  const out = weights.map(() => 0n);
  if (amount === 0n || total === 0n) return out;
  let given = 0n;
  let last = -1;
  weights.forEach((w, i) => {
    if (w <= 0n) return;
    out[i] = (amount * w) / total;
    given += out[i];
    last = i;
  });
  out[last] += amount - given;
  return out;
}

export function calcInvoice(input: CalcInput): CalcResult {
  const invoiceDiscount = input.invoiceDiscount ?? 0n;
  const additions = input.additions ?? 0n;
  if (invoiceDiscount < 0n) throw new CalcError("تخفیف فاکتور منفی نمی‌شود");
  if (additions < 0n) throw new CalcError("اضافات منفی نمی‌شود");

  const base = input.lines.map((l, i) => {
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new CalcError(`ردیف ${faIdx(i)}: تعداد باید عدد صحیح مثبت باشد`);
    if (l.unitPrice < 0n) throw new CalcError(`ردیف ${faIdx(i)}: فی منفی نمی‌شود`);
    if (l.packSize !== undefined && l.packSize !== null) {
      if (!Number.isInteger(l.packSize) || l.packSize < 2) throw new CalcError(`ردیف ${faIdx(i)}: اندازه‌ی بسته نامعتبر است`);
      if (l.qty % l.packSize) throw new CalcError(`ردیف ${faIdx(i)}: تعداد باید بسته‌ی کامل باشد (مضرب ${faIdx(l.packSize - 1)})`);
    }
    const gross = lineGross(l);
    const discount = l.discount ?? 0n;
    if (discount < 0n) throw new CalcError(`ردیف ${faIdx(i)}: تخفیف منفی نمی‌شود`);
    if (discount > gross) throw new CalcError(`ردیف ${faIdx(i)}: تخفیف از مبلغ ردیف بیشتر است`);
    const rate = l.vatRateBp ?? 0;
    if (!Number.isInteger(rate) || rate < 0 || rate > 10000) throw new CalcError(`ردیف ${faIdx(i)}: نرخ مالیات نامعتبر است`);
    return { gross, discount, rate };
  });

  const afterLine = base.map((b) => b.gross - b.discount);
  const room = afterLine.reduce((s, x) => s + x, 0n);
  if (invoiceDiscount > room) throw new CalcError("تخفیف فاکتور از جمع ردیف‌ها بیشتر است");
  const shares = allocate(invoiceDiscount, afterLine);

  const lines = base.map((b, i) => {
    const after = afterLine[i] - shares[i];
    let net: bigint;
    let vatAmount: bigint;
    if (input.pricesIncludeVat) {
      net = b.rate ? divRound(after * 10000n, BigInt(10000 + b.rate)) : after;
      vatAmount = after - net;
    } else {
      net = after;
      vatAmount = b.rate ? divRound(after * BigInt(b.rate), 10000n) : 0n;
    }
    return { gross: b.gross, discount: b.discount, share: shares[i], net, vatAmount, lineTotal: net + vatAmount };
  });

  const sum = (f: (l: CalcLine) => bigint) => lines.reduce((s, l) => s + f(l), 0n);
  return {
    lines,
    subtotal: sum((l) => l.gross),
    lineDiscount: sum((l) => l.discount),
    invoiceDiscount,
    additions,
    vatTotal: sum((l) => l.vatAmount),
    netTotal: sum((l) => l.net),
    total: sum((l) => l.lineTotal) + additions,
  };
}

export const INVOICE_TYPE_LABELS = {
  SALES: "فاکتور فروش",
  PURCHASE: "فاکتور خرید",
  SALES_RETURN: "برگشت از فروش",
  PURCHASE_RETURN: "برگشت از خرید",
  PROFORMA: "پیش‌فاکتور",
} as const;

export type InvoiceTypeKey = keyof typeof INVOICE_TYPE_LABELS;

export const CHANNEL_LABELS = {
  SHOP: "سایت",
  PHONE: "تلفنی",
  MARKETPLACE: "بازارگاه",
  WORKLIST: "کارتابل",
  MANUAL: "دستی",
} as const;

/** نوع فاکتوری که «فروش» حساب می‌شود — طرف حساب مشتری، کالا خارج می‌شود */
export const isSalesSide = (t: InvoiceTypeKey) => t === "SALES" || t === "SALES_RETURN" || t === "PROFORMA";
