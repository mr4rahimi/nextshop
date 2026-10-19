/**
 * رسید صندوق: فروش، مرجوعی یا تعویض — docs/plans/inventory-items.md بخش ۱۳.
 *
 * هر رسید در یک تراکنش:
 *   مرجوعی ← فاکتور «برگشت از فروش» (با رسید: همان ردیف‌ها و همان مبلغ فاکتور مرجع)
 *   فروش   ← فاکتور فروش صادرشده
 *   پول    ← «دریافت» تخصیص‌یافته به فاکتور فروش، و سند «پس دادن» (منبع `POS`):
 *            بدهکار طلب از شخص، بستانکار صندوق نقد/کارتخوان همین پیشخوان
 *
 * تعویض (مرجوعی + خرید): بخش مشترک (`internal = min(فروش، مرجوعی)`) از صندوق نقد
 * می‌گذرد — در دریافت به‌عنوان نقد می‌آید و در سند پس دادن بیرون می‌رود؛ خالصش صفر
 * است و هر دو فاکتور تسویه می‌مانند. مشتری فقط مابه‌التفاوت را می‌دهد یا می‌گیرد.
 *
 * ⚠️ مبالغ رسید (`cash`، `card`، `credit`) نگاه مشتری است: + یعنی داد، − یعنی گرفت.
 * ⚠️ ابطال رسید نداریم؛ اشتباه با مرجوعی جبران می‌شود. فاکتوری که از صفحه‌ی فاکتور
 *    باطل شود، رسیدش در گزارش صندوق می‌ماند (تله‌ی بخش ۱۳).
 */

import type { AccInvoice, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { assertPostable } from "../ledger/fiscal-year";
import { postVoucher, type Actor, type LineInput } from "../ledger/post";
import { nextNumber } from "../ledger/sequence";
import { saveInvoice, returnedQty, type InvoiceLineInput } from "../invoices/service";
import { calcInvoice, CalcError, divRound } from "../invoices/calc";
import { createMoneyDoc, type MoneyItemInput } from "../cash/docs";
import { walkInParty } from "../parties";
import { TREASURY_ACCOUNT_KEY } from "../treasury";
import { todayKey } from "../dates";
import { faNum, formatAmount } from "../money";
import { posItems } from "./setup";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const TICKET_BARCODE_PREFIX = "POS";

export interface TicketInput {
  terminalId: string;
  sellerId?: string | null;
  partyId?: string | null;
  sale: { productId: string; qty: number; unitPrice: bigint; discount: bigint }[];
  invoiceDiscount: bigint;
  /** مرجوعی — با رسید: `invoiceId` + `refLineId`ها؛ بی‌رسید (مدیر): `productId`ها */
  ret: { invoiceId: string | null; lines: { refLineId?: string | null; productId?: string | null; qty: number }[] } | null;
  /**
   * مبلغ‌های مثبت در جهت مابه‌التفاوت: مشتری می‌دهد، یا (مرجوعی بیشتر) پس می‌گیرد.
   * `cash: "rest"` = باقیِ بعد از کارت — صندوق مبلغ دقیق مرجوعی را پیش از ثبت نمی‌داند
   * (سهم تخفیف هر ردیف گرد می‌شود)، پس رابط همیشه همین را می‌فرستد مگر نسیه باشد.
   */
  pay: { cash: bigint | "rest"; card: bigint };
  tendered?: bigint | null;
  overrideCredit?: boolean;
}

export interface TicketPerms {
  /** تغییر قیمت، مرجوعی بی‌رسید */
  manage: boolean;
}

export async function createTicket(tx: Tx, input: TicketInput, perms: TicketPerms, actor: Actor) {
  const terminal = await tx.accPosTerminal.findUnique({ where: { id: input.terminalId } });
  if (!terminal || !terminal.isActive) throw new AccError("صندوق پیدا نشد یا غیرفعال است", 404);
  const shift = await tx.accPosShift.findFirst({ where: { terminalId: terminal.id, status: "OPEN" } });
  if (!shift) throw new AccError("این صندوق باز نیست؛ اول «باز کردن صندوق» را بزنید", 409);

  // ── فروشنده — وقتی فروشنده تعریف شده، انتخابش لازم است ──
  let seller: { id: string; name: string } | null = null;
  if (input.sellerId) {
    seller = await tx.accPosSeller.findFirst({ where: { id: input.sellerId, isActive: true }, select: { id: true, name: true } });
    if (!seller) throw new AccError("فروشنده پیدا نشد یا غیرفعال است");
  } else if (await tx.accPosSeller.count({ where: { isActive: true } })) {
    throw new AccError("فروشنده را انتخاب کنید");
  }

  const date = todayKey();
  const year = await assertPostable(tx, date);
  const settings = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { vatEnabled: true, vatRateBp: true } });
  if (!input.sale.length && !input.ret?.lines.length) throw new AccError("سبد خالی است");

  // ── قیمت‌ها از سرور ──
  const ids = [...input.sale.map((l) => l.productId), ...(input.ret?.lines.map((l) => l.productId).filter((x): x is string => !!x) ?? [])];
  const items = await posItems(ids, terminal.warehouseId, tx);
  const vatOf = new Map(
    (await tx.accProductCost.findMany({ where: { productId: { in: ids } }, select: { productId: true, vatRateBp: true } })).map((c) => [c.productId, c.vatRateBp]),
  );
  const vat = (id: string) => (settings?.vatEnabled ? vatOf.get(id) ?? settings.vatRateBp : 0);

  const saleLines: InvoiceLineInput[] = input.sale.map((l, i) => {
    const at = `ردیف ${faNum(i + 1)}`;
    const it = items.get(l.productId);
    if (!it) throw new AccError(`${at}: کالا پیدا نشد`);
    if (!Number.isInteger(l.qty) || l.qty <= 0 || l.qty > 10_000) throw new AccError(`${at}: تعداد نامعتبر است`);
    if (l.unitPrice <= 0n) throw new AccError(`${at}: «${it.title}» قیمت ندارد؛ قیمت را بنویسید`);
    if (!perms.manage && it.price > 0n && l.unitPrice !== it.price) throw new AccError(`${at}: تغییر قیمت «${it.title}» مجوز مدیر صندوق می‌خواهد؛ به‌جایش تخفیف بدهید`);
    if (l.discount < 0n) throw new AccError(`${at}: تخفیف منفی نمی‌شود`);
    return { productId: l.productId, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, vatRateBp: vat(l.productId) };
  });

  // ── مرجوعی ──
  let ref: (AccInvoice & { lines: { id: string; qty: number }[] }) | null = null;
  let retLines: InvoiceLineInput[] = [];
  if (input.ret?.lines.length) {
    if (input.ret.invoiceId) {
      ref = await tx.accInvoice.findUnique({ where: { id: input.ret.invoiceId }, include: { lines: { select: { id: true, qty: true } } } });
      if (!ref || ref.type !== "SALES" || ref.status !== "ISSUED") throw new AccError("رسید یا فاکتور فروش مرجوعی پیدا نشد");
      retLines = input.ret.lines.map((l, i) => {
        if (!l.refLineId) throw new AccError(`مرجوعی ردیف ${faNum(i + 1)}: ردیف رسید را انتخاب کنید`);
        return { refLineId: l.refLineId, qty: l.qty, unitPrice: 0n }; // مبلغ از ردیف مرجع می‌آید
      });
    } else {
      if (!perms.manage) throw new AccError("مرجوعی بی‌رسید مجوز مدیر صندوق می‌خواهد");
      retLines = input.ret.lines.map((l, i) => {
        const it = l.productId ? items.get(l.productId) : null;
        if (!it) throw new AccError(`مرجوعی ردیف ${faNum(i + 1)}: کالا پیدا نشد`);
        if (it.price <= 0n) throw new AccError(`مرجوعی «${it.title}»: کالا قیمت ندارد`);
        return { productId: it.id, qty: l.qty, unitPrice: it.price, vatRateBp: vat(it.id) };
      });
    }
  }

  // ── طرف حساب: مرجوعی با رسید همیشه به نام خریدار همان رسید ──
  const party = ref
    ? await tx.accParty.findUniqueOrThrow({ where: { id: ref.partyId } })
    : input.partyId
      ? await tx.accParty.findUnique({ where: { id: input.partyId } })
      : await walkInParty(tx);
  if (!party) throw new AccError("مشتری پیدا نشد");
  const walkIn = party.platformCode === "walk-in";

  // ── گرد کردن جمع فروش به پایین — اختلاف تخفیف فاکتور می‌شود ──
  let invoiceDiscount = input.invoiceDiscount;
  if (invoiceDiscount < 0n) throw new AccError("تخفیف منفی نمی‌شود");
  if (saleLines.length && terminal.roundTo > 0) {
    try {
      const pre = calcInvoice({ lines: saleLines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, vatRateBp: l.vatRateBp })), invoiceDiscount, additions: 0n, pricesIncludeVat: true });
      invoiceDiscount += pre.total % BigInt(terminal.roundTo);
    } catch (e) {
      if (e instanceof CalcError) throw new AccError(e.message);
      throw e;
    }
  }

  const number = await nextNumber(tx, year.id, "pos:ticket");
  const note = `${terminal.name} — رسید ${faNum(number)}${seller ? ` — فروشنده: ${seller.name}` : ""}`;

  const retInv = retLines.length
    ? await saveInvoice(
        tx,
        null,
        { type: "SALES_RETURN", date, partyId: party.id, warehouseId: terminal.warehouseId, refInvoiceId: ref?.id ?? null, pricesIncludeVat: true, note, lines: retLines },
        { issue: true },
        actor,
      )
    : null;
  const saleInv = saleLines.length
    ? await saveInvoice(
        tx,
        null,
        { type: "SALES", date, partyId: party.id, warehouseId: terminal.warehouseId, invoiceDiscount, pricesIncludeVat: true, note, lines: saleLines },
        { issue: true, allowOverCredit: !!input.overrideCredit },
        actor,
      )
    : null;

  const S = saleInv?.total ?? 0n;
  const R = retInv?.total ?? 0n;
  const net = S - R;
  const due = net >= 0n ? net : -net;
  const k = input.pay.card;
  const c = input.pay.cash === "rest" ? (due > k ? due - k : 0n) : input.pay.cash;
  if (c < 0n || k < 0n) throw new AccError("مبلغ منفی نمی‌شود");
  if (k > 0n && !terminal.cardTreasuryId) throw new AccError("این صندوق کارتخوان ندارد");
  const moved = c + k;
  if (moved > due) {
    throw new AccError(
      net >= 0n
        ? `دریافتی (${formatAmount(moved)}) از مبلغ قابل پرداخت (${formatAmount(due)}) بیشتر است؛ باقی پول را پس بدهید و مبلغ نقد را درست کنید`
        : `برگشت به کارت/نقد (${formatAmount(moved)}) از طلب مشتری (${formatAmount(due)}) بیشتر است`,
    );
  }
  const unsettled = due - moved;
  if (unsettled > 0n && walkIn) {
    throw new AccError(net >= 0n ? `${formatAmount(unsettled)} تومان دریافت نشده؛ برای نسیه مشتری را انتخاب کنید` : `${formatAmount(unsettled)} تومان پس داده نشده؛ همه را پس بدهید یا مشتری را انتخاب کنید`);
  }

  const kind = S > 0n && R > 0n ? "EXCHANGE" : R > 0n ? "RETURN" : "SALE";
  const ticket = await tx.accPosTicket.create({
    data: {
      number,
      yearId: year.id,
      kind,
      terminalId: terminal.id,
      shiftId: shift.id,
      sellerId: seller?.id ?? null,
      sellerName: seller?.name ?? null,
      cashierId: actor.id ?? null,
      cashierName: actor.name,
      partyId: party.id,
      partyName: party.name,
      saleInvoiceId: saleInv?.id ?? null,
      returnInvoiceId: retInv?.id ?? null,
      saleTotal: S,
      returnTotal: R,
      saleQty: saleLines.reduce((s, l) => s + l.qty, 0),
      returnQty: retLines.reduce((s, l) => s + l.qty, 0),
      discount: (saleInv ? saleInv.lineDiscount + saleInv.invoiceDiscount : 0n),
      cash: net >= 0n ? c : -c,
      card: net >= 0n ? k : -k,
      credit: net >= 0n ? unsettled : -unsettled,
      tendered: net > 0n && c > 0n && input.tendered && input.tendered > c ? input.tendered : null,
      change: net > 0n && c > 0n && input.tendered && input.tendered > c ? input.tendered - c : 0n,
    },
  });

  // ── پول ──
  const internal = S < R ? S : R;
  let receiptDocId: string | null = null;
  let refundVoucherId: string | null = null;
  const cashIn = saleInv ? internal + (net >= 0n ? c : 0n) : 0n;
  const cardIn = saleInv && net >= 0n ? k : 0n;
  if (saleInv && cashIn + cardIn > 0n) {
    const items: MoneyItemInput[] = [];
    if (cashIn > 0n) items.push({ method: "CASH", treasuryId: terminal.cashTreasuryId, amount: cashIn });
    if (cardIn > 0n) items.push({ method: "POS", treasuryId: terminal.cardTreasuryId, amount: cardIn });
    const doc = await createMoneyDoc(
      tx,
      {
        kind: "RECEIPT",
        date,
        partyId: party.id,
        description: `${note} — فاکتور فروش ${faNum(saleInv.number ?? 0)}`,
        items,
        allocations: [{ invoiceId: saleInv.id, amount: cashIn + cardIn }],
      },
      actor,
    );
    receiptDocId = doc.id;
  }
  const cashOut = retInv ? internal + (net < 0n ? c : 0n) : 0n;
  const cardOut = retInv && net < 0n ? k : 0n;
  if (retInv && cashOut + cardOut > 0n) {
    const trs = await tx.accTreasury.findMany({ where: { id: { in: [terminal.cashTreasuryId, terminal.cardTreasuryId].filter((x): x is string => !!x) } } });
    const keyOf = (id: string) => TREASURY_ACCOUNT_KEY[trs.find((t) => t.id === id)!.kind];
    const lines: LineInput[] = [{ accountKey: "AR", partyId: party.id, debit: cashOut + cardOut, description: "پس دادن مرجوعی" }];
    if (cashOut > 0n) lines.push({ accountKey: keyOf(terminal.cashTreasuryId), treasuryId: terminal.cashTreasuryId, credit: cashOut, description: internal > 0n && saleInv ? "تعویض و پس دادن نقد" : "پس دادن نقد" });
    if (cardOut > 0n) lines.push({ accountKey: keyOf(terminal.cardTreasuryId!), treasuryId: terminal.cardTreasuryId, credit: cardOut, description: "برگشت به کارت" });
    const v = await postVoucher(tx, {
      date,
      description: `${note} — برگشت از فروش ${faNum(retInv.number ?? 0)}`,
      source: "POS",
      sourceId: ticket.id,
      lines,
      actor,
    });
    refundVoucherId = v.id;
  }
  if (receiptDocId || refundVoucherId) {
    await tx.accPosTicket.update({ where: { id: ticket.id }, data: { receiptDocId, refundVoucherId } });
  }
  return { ...ticket, receiptDocId, refundVoucherId, saleNumber: saleInv?.number ?? null, returnNumber: retInv?.number ?? null };
}

/**
 * رسید یا فاکتور فروش برای مرجوعی: `POS12` یا «۱۲» = رسید صندوق (اول سال جاری)،
 * وگرنه شماره‌ی فاکتور فروش. خروجی: ردیف‌ها با تعداد قابل برگشت و مبلغ هر عدد.
 */
export async function findReturnable(raw: string, db: Db = prisma) {
  const t = raw.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).trim().toUpperCase();
  const isTicket = t.startsWith(TICKET_BARCODE_PREFIX);
  const n = Number(isTicket ? t.slice(TICKET_BARCODE_PREFIX.length) : t);
  if (!Number.isInteger(n) || n <= 0) throw new AccError("شماره‌ی رسید یا فاکتور را بنویسید یا بارکد رسید را اسکن کنید");
  const settings = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { currentYearId: true } });
  // شماره‌ی رسید هر سال از ۱ شروع می‌شود — اول سال جاری، بعد تازه‌ترین
  const ticket =
    (settings?.currentYearId ? await db.accPosTicket.findFirst({ where: { number: n, yearId: settings.currentYearId, saleInvoiceId: { not: null } } }) : null) ??
    (await db.accPosTicket.findFirst({ where: { number: n, saleInvoiceId: { not: null } }, orderBy: { createdAt: "desc" } }));
  const inv = ticket?.saleInvoiceId
    ? await db.accInvoice.findUnique({ where: { id: ticket.saleInvoiceId }, include: { lines: { orderBy: { seq: "asc" } } } })
    : isTicket
      ? null
      : await db.accInvoice.findFirst({ where: { type: "SALES", number: n, status: "ISSUED" }, orderBy: { date: "desc" }, include: { lines: { orderBy: { seq: "asc" } } } });
  if (!inv) throw new AccError(isTicket ? `رسید ${faNum(n)} پیدا نشد` : `رسید یا فاکتور فروش ${faNum(n)} پیدا نشد`, 404);
  if (inv.status !== "ISSUED") throw new AccError("این فاکتور باطل شده است", 409);
  const back = await returnedQty(db as Tx, inv.lines.map((l) => l.id));
  return {
    invoiceId: inv.id,
    invoiceNumber: inv.number,
    ticketNumber: ticket?.number ?? null,
    date: inv.date,
    partyId: inv.partyId,
    partyName: inv.partyName,
    walkIn: (await db.accParty.findUnique({ where: { id: inv.partyId }, select: { platformCode: true } }))?.platformCode === "walk-in",
    lines: inv.lines
      .filter((l) => l.productId)
      .map((l) => ({
        refLineId: l.id,
        productId: l.productId!,
        title: l.title,
        qty: l.qty,
        left: l.qty - (back.get(l.id) ?? 0),
        /** مبلغ برگشت هر عدد — همان سهم فروش (تخفیف ردیف و فاکتور کم شده) */
        each: divRound(l.lineTotal, BigInt(l.qty)),
      })),
  };
}

/** رسید برای چاپ و نمایش */
export async function ticketView(id: string, db: Db = prisma) {
  const t = await db.accPosTicket.findUnique({ where: { id }, include: { terminal: true } });
  if (!t) throw new AccError("رسید پیدا نشد", 404);
  const invs = await db.accInvoice.findMany({
    where: { id: { in: [t.saleInvoiceId, t.returnInvoiceId].filter((x): x is string => !!x) } },
    include: { lines: { orderBy: { seq: "asc" } } },
  });
  const sale = invs.find((i) => i.id === t.saleInvoiceId) ?? null;
  const ret = invs.find((i) => i.id === t.returnInvoiceId) ?? null;
  const [store, acc] = await Promise.all([
    db.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true, sitePhone: true, siteAddress: true } }),
    db.accSettings.findUnique({ where: { id: "singleton" }, select: { sellerName: true, sellerPhone: true, sellerAddress: true, invoiceFooterNote: true } }),
  ]);
  const line = (l: (typeof invs)[number]["lines"][number]) => ({
    title: l.title,
    qty: l.qty,
    unitPrice: l.unitPrice,
    discount: l.discount,
    lineTotal: l.lineTotal,
  });
  return {
    ticket: t,
    terminal: { name: t.terminal.name, header: t.terminal.receiptHeader, footer: t.terminal.receiptFooter, paperMm: t.terminal.paperMm },
    store: {
      name: store?.storeName ?? acc?.sellerName ?? null,
      phone: acc?.sellerPhone ?? store?.sitePhone ?? null,
      address: acc?.sellerAddress ?? store?.siteAddress ?? null,
      footer: acc?.invoiceFooterNote ?? null,
    },
    sale: sale ? { number: sale.number, subtotal: sale.subtotal, discount: sale.lineDiscount + sale.invoiceDiscount, vat: sale.vatTotal, total: sale.total, lines: sale.lines.map(line) } : null,
    ret: ret ? { number: ret.number, total: ret.total, lines: ret.lines.map(line) } : null,
    barcode: `${TICKET_BARCODE_PREFIX}${t.number}`,
  };
}

class QuoteDone extends Error {
  constructor(public readonly totals: { saleTotal: bigint; returnTotal: bigint; net: bigint; discount: bigint }) {
    super("quote");
  }
}

/**
 * پیش‌نمایش دقیق جمع‌ها (مبلغ مرجوعی، گرد کردن) — همان `createTicket` در تراکنشی که
 * برگردانده می‌شود؛ پس هیچ شماره، سند یا حرکتی نمی‌ماند. پرداخت «همه‌اش باقی» فرض می‌شود.
 */
export async function quoteTicket(input: TicketInput, perms: TicketPerms, actor: Actor) {
  try {
    await prisma.$transaction(
      async (tx) => {
        const t = await createTicket(tx, { ...input, pay: { cash: "rest", card: 0n }, partyId: input.partyId, overrideCredit: true }, perms, actor);
        throw new QuoteDone({ saleTotal: t.saleTotal, returnTotal: t.returnTotal, net: t.saleTotal - t.returnTotal, discount: t.discount });
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    if (e instanceof QuoteDone) return e.totals;
    throw e;
  }
  throw new Error("unreachable");
}
