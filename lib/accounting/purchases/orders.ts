/**
 * سفارش خرید — docs/plans/webhesab-parity.md بخش ۱۳.
 *
 * سفارش سند مالی و کاردکس ندارد. دریافت کالا همان «فاکتور خرید از روی سفارش» است
 * (تصمیم کاربر ۱۴۰۵/۰۸/۱۰): ردیف‌های فاکتور `poLineId` دارند و «دریافت‌شده» از
 * فاکتورهای خرید **صادرشده** حساب می‌شود — باطل شدن فاکتور خودبه‌خود سفارش را باز می‌کند.
 * وضعیت ذخیره‌شده فقط OPEN / CLOSED / CANCELED است؛ «ناقص» و «کامل» هر بار حساب می‌شود.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { faNum } from "../money";
import { todayKey } from "../dates";
import type { Actor } from "../ledger/post";
import { GLOBAL_SEQ, nextNumber } from "../ledger/sequence";
import { ensureItems, itemCards } from "../inventory/items";
import { saveInvoice } from "../invoices/service";
import { poLineProgress } from "./progress";

export { poLineProgress };

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const PO_MAX_LINES = 500;

export type PoStatus = "OPEN" | "CLOSED" | "CANCELED";
/** وضعیت نمایشی */
export type PoState = "OPEN" | "PARTIAL" | "RECEIVED" | "CLOSED" | "CANCELED";

export const PO_STATE_LABEL: Record<PoState, string> = {
  OPEN: "باز",
  PARTIAL: "دریافت ناقص",
  RECEIVED: "کامل دریافت شد",
  CLOSED: "بسته",
  CANCELED: "باطل",
};

export interface PoLineInput {
  /** ردیف موجود (ویرایش) */
  id?: string | null;
  productId: string;
  qty: number;
  unitPrice?: bigint;
  note?: string | null;
}

export interface PoInput {
  date: Date;
  dueDate?: Date | null;
  partyId: string;
  warehouseId?: string | null;
  supplierRef?: string | null;
  note?: string | null;
  lines: PoLineInput[];
}

// ── دریافت‌شده ─────────────────────────────────────────────────────────

export function stateOf(status: string, lines: { qty: number; received: number }[]): PoState {
  if (status === "CANCELED") return "CANCELED";
  if (status === "CLOSED") return "CLOSED";
  if (lines.length && lines.every((l) => l.received >= l.qty)) return "RECEIVED";
  return lines.some((l) => l.received > 0) ? "PARTIAL" : "OPEN";
}

/** مانده‌ی در راه هر کالا در سفارش‌های باز (کاردکس، پیشنهاد خرید) */
export async function onOrderQty(db: Db, productIds?: string[]): Promise<Map<string, number>> {
  const lines = await db.accPurchaseOrderLine.findMany({
    where: { order: { status: "OPEN" }, ...(productIds ? { productId: { in: productIds } } : {}) },
    select: { id: true, productId: true, qty: true },
  });
  const prog = await poLineProgress(db, lines.map((l) => l.id));
  const out = new Map<string, number>();
  for (const l of lines) {
    const left = l.qty - (prog.get(l.id)?.received ?? 0);
    if (left > 0) out.set(l.productId, (out.get(l.productId) ?? 0) + left);
  }
  return out;
}

// ── ثبت و ویرایش ───────────────────────────────────────────────────────

export async function savePurchaseOrder(tx: Tx, id: string | null, input: PoInput, actor: Actor) {
  const current = id ? await tx.accPurchaseOrder.findUnique({ where: { id }, include: { lines: true } }) : null;
  if (id && !current) throw new AccError("سفارش پیدا نشد", 404);
  if (current && current.status !== "OPEN") throw new AccError("سفارش بسته یا باطل‌شده ویرایش نمی‌شود — اول «بازگشایی» کنید", 409);

  const party = await tx.accParty.findUnique({ where: { id: input.partyId } });
  if (!party) throw new AccError("عرضه‌کننده را انتخاب کنید");
  if (!party.isActive) throw new AccError(`«${party.name}» غیرفعال است`);
  if (current && current.partyId !== input.partyId && (await tx.accInvoice.count({ where: { purchaseOrderId: current.id, status: { not: "VOID" } } }))) {
    throw new AccError("برای این سفارش فاکتور ثبت شده؛ عرضه‌کننده عوض نمی‌شود", 409);
  }
  if (input.warehouseId) {
    const wh = await tx.accWarehouse.findUnique({ where: { id: input.warehouseId } });
    if (!wh?.isActive) throw new AccError("انبار پیدا نشد یا غیرفعال است");
  }
  if (input.dueDate && input.dueDate < input.date) throw new AccError("موعد تحویل پیش از تاریخ سفارش است");

  if (!input.lines.length) throw new AccError("دست‌کم یک کالا لازم است");
  if (input.lines.length > PO_MAX_LINES) throw new AccError(`حداکثر ${faNum(PO_MAX_LINES)} ردیف`);
  const productIds = [...new Set(input.lines.map((l) => l.productId).filter(Boolean))];
  await ensureItems(tx, productIds);
  const items = new Map((await tx.accItem.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true, unit: true } })).map((i) => [i.id, i]));
  const old = new Map((current?.lines ?? []).map((l) => [l.id, l]));
  const prog = await poLineProgress(tx, [...old.keys()]);
  const used = (lineId: string) => (prog.get(lineId)?.received ?? 0) + (prog.get(lineId)?.draft ?? 0);

  const seen = new Set<string>();
  for (const [i, l] of input.lines.entries()) {
    const at = `ردیف ${faNum(i + 1)}`;
    if (!items.has(l.productId)) throw new AccError(`${at}: کالا پیدا نشد`);
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new AccError(`${at}: تعداد باید عدد صحیح مثبت باشد`);
    if ((l.unitPrice ?? 0n) < 0n) throw new AccError(`${at}: فی منفی نمی‌شود`);
    if (l.id) {
      const o = old.get(l.id);
      if (!o) throw new AccError(`${at}: ردیف مال این سفارش نیست`);
      if (used(o.id) && o.productId !== l.productId) throw new AccError(`${at}: «${o.title}» فاکتور شده؛ کالایش عوض نمی‌شود`, 409);
      if (l.qty < used(o.id)) throw new AccError(`${at}: از «${o.title}» ${faNum(used(o.id))} عدد فاکتور شده؛ سفارش کمتر از این نمی‌شود`, 409);
      seen.add(l.id);
    }
  }
  for (const o of old.values()) {
    if (!seen.has(o.id) && used(o.id)) throw new AccError(`«${o.title}» فاکتور شده و از سفارش حذف نمی‌شود`, 409);
  }

  const data = {
    date: input.date,
    dueDate: input.dueDate ?? null,
    partyId: input.partyId,
    warehouseId: input.warehouseId || null,
    supplierRef: input.supplierRef?.trim() || null,
    note: input.note?.trim() || null,
  };
  const po = current
    ? await tx.accPurchaseOrder.update({ where: { id: current.id }, data })
    : await tx.accPurchaseOrder.create({
        data: { ...data, number: await nextNumber(tx, GLOBAL_SEQ, "purchase-order"), createdById: actor.id ?? null, createdByName: actor.name },
      });

  // ردیف‌های قبلی با همان شناسه می‌مانند (poLineId فاکتورها به آن‌ها اشاره می‌کند)
  const gone = [...old.keys()].filter((k) => !seen.has(k));
  if (gone.length) await tx.accPurchaseOrderLine.deleteMany({ where: { id: { in: gone } } });
  for (const [i, l] of input.lines.entries()) {
    const it = items.get(l.productId)!;
    const row = { seq: i + 1, productId: l.productId, title: it.title, unit: it.unit, qty: l.qty, unitPrice: l.unitPrice ?? 0n, note: l.note?.trim() || null };
    if (l.id) await tx.accPurchaseOrderLine.update({ where: { id: l.id }, data: row });
    else await tx.accPurchaseOrderLine.create({ data: { ...row, orderId: po.id } });
  }
  return po;
}

/**
 * `close`: مانده لغو (دست‌کم یک دریافت دارد یا کاربر نمی‌خواهد)؛ `cancel`: باطل — فقط بی‌فاکتور؛
 * `reopen`: برگرداندن بسته/باطل به باز.
 */
export async function setPoStatus(tx: Tx, id: string, action: "close" | "cancel" | "reopen", reason?: string | null) {
  const po = await tx.accPurchaseOrder.findUnique({ where: { id } });
  if (!po) throw new AccError("سفارش پیدا نشد", 404);
  if (action === "reopen") {
    if (po.status === "OPEN") return po;
    return tx.accPurchaseOrder.update({ where: { id }, data: { status: "OPEN", closedReason: null, closedAt: null } });
  }
  if (po.status !== "OPEN") throw new AccError("سفارش باز نیست", 409);
  const drafts = await tx.accInvoice.count({ where: { purchaseOrderId: id, status: "DRAFT" } });
  if (drafts) throw new AccError("پیش‌نویس فاکتور از این سفارش هست؛ اول آن را صادر یا پاک کنید", 409);
  if (action === "cancel" && (await tx.accInvoice.count({ where: { purchaseOrderId: id, status: "ISSUED" } }))) {
    throw new AccError("بخشی از این سفارش دریافت شده؛ به‌جای باطل «بستن» را بزنید", 409);
  }
  return tx.accPurchaseOrder.update({
    where: { id },
    data: { status: action === "close" ? "CLOSED" : "CANCELED", closedReason: reason?.trim() || null, closedAt: new Date() },
  });
}

export async function deletePurchaseOrder(tx: Tx, id: string) {
  const po = await tx.accPurchaseOrder.findUnique({ where: { id } });
  if (!po) throw new AccError("سفارش پیدا نشد", 404);
  if (await tx.accInvoice.count({ where: { purchaseOrderId: id } })) throw new AccError("این سفارش فاکتور دارد و پاک نمی‌شود؛ «باطل» یا «بستن» را بزنید", 409);
  await tx.accPurchaseOrder.delete({ where: { id } });
}

/**
 * فاکتور خرید از روی سفارش: پیش‌نویسی با مانده‌ی هر ردیف (تعداد را کاربر به آنچه رسیده اصلاح می‌کند).
 * اگر پیش‌نویس این سفارش از قبل هست، همان برمی‌گردد — دو پیش‌نویس هم‌زمان مانده را دو بار نمی‌گیرند.
 */
export async function invoiceFromOrder(tx: Tx, id: string, actor: Actor, date: Date = todayKey()) {
  const po = await tx.accPurchaseOrder.findUnique({ where: { id }, include: { lines: { orderBy: { seq: "asc" } } } });
  if (!po) throw new AccError("سفارش پیدا نشد", 404);
  if (po.status !== "OPEN") throw new AccError("سفارش باز نیست", 409);
  const draft = await tx.accInvoice.findFirst({ where: { purchaseOrderId: id, status: "DRAFT" }, select: { id: true } });
  if (draft) return { id: draft.id, existing: true };
  const prog = await poLineProgress(tx, po.lines.map((l) => l.id));
  const left = po.lines.map((l) => ({ l, qty: l.qty - (prog.get(l.id)?.received ?? 0) })).filter((x) => x.qty > 0);
  if (!left.length) throw new AccError("همه‌ی کالاهای این سفارش دریافت شده است", 409);
  const inv = await saveInvoice(
    tx,
    null,
    {
      type: "PURCHASE",
      date,
      partyId: po.partyId,
      warehouseId: po.warehouseId,
      note: `سفارش خرید ${faNum(po.number)}${po.supplierRef ? ` — پیگیری عرضه‌کننده ${po.supplierRef}` : ""}`,
      lines: left.map(({ l, qty }) => ({ productId: l.productId, title: l.title, unit: l.unit, qty, unitPrice: l.unitPrice, poLineId: l.id })),
    },
    {},
    actor,
  );
  return { id: inv.id, existing: false };
}

// ── خواندن ─────────────────────────────────────────────────────────────

export interface PoFilter {
  state?: "open" | "overdue" | "done" | "all";
  partyId?: string | null;
  productId?: string | null;
  q?: string | null;
}

export async function listPurchaseOrders(db: Db, f: PoFilter) {
  const where: Prisma.AccPurchaseOrderWhereInput = {};
  const state = f.state ?? "open";
  if (state === "open" || state === "overdue") where.status = "OPEN";
  if (f.partyId) where.partyId = f.partyId;
  if (f.productId) where.lines = { some: { productId: f.productId } };
  const q = f.q?.trim();
  if (q) {
    const n = Number(q.replace(/[^\d]/g, ""));
    where.OR = [{ party: { name: { contains: q, mode: "insensitive" } } }, { supplierRef: { contains: q } }, ...(n ? [{ number: n }] : [])];
  }
  const orders = await db.accPurchaseOrder.findMany({
    where,
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: 500,
    include: { lines: { select: { id: true, qty: true, unitPrice: true, productId: true } }, party: { select: { id: true, name: true } } },
  });
  const prog = await poLineProgress(db, orders.flatMap((o) => o.lines.map((l) => l.id)));
  const today = todayKey();
  const rows = orders.map((o) => {
    const lines = o.lines.map((l) => ({ ...l, received: prog.get(l.id)?.received ?? 0, draft: prog.get(l.id)?.draft ?? 0 }));
    const st = stateOf(o.status, lines);
    const ordered = lines.reduce((s, l) => s + l.qty, 0);
    const received = lines.reduce((s, l) => s + Math.min(l.received, l.qty), 0);
    const product = f.productId ? lines.filter((l) => l.productId === f.productId) : null;
    return {
      id: o.id,
      number: o.number,
      date: o.date,
      dueDate: o.dueDate,
      party: o.party,
      supplierRef: o.supplierRef,
      warehouseId: o.warehouseId,
      status: o.status,
      state: st,
      overdue: !!o.dueDate && o.dueDate < today && (st === "OPEN" || st === "PARTIAL"),
      lineCount: lines.length,
      ordered,
      received,
      hasDraft: lines.some((l) => l.draft > 0),
      total: lines.reduce((s, l) => s + l.unitPrice * BigInt(l.qty), 0n),
      /** با فیلتر کالا: سفارش و دریافت همان کالا */
      product: product ? { qty: product.reduce((s, l) => s + l.qty, 0), received: product.reduce((s, l) => s + l.received, 0) } : null,
    };
  });
  const filtered =
    state === "open" ? rows.filter((r) => r.state === "OPEN" || r.state === "PARTIAL") :
    state === "overdue" ? rows.filter((r) => r.overdue) :
    state === "done" ? rows.filter((r) => r.state !== "OPEN" && r.state !== "PARTIAL") :
    rows;
  return filtered;
}

export async function purchaseOrderDetail(db: Db, id: string) {
  const po = await db.accPurchaseOrder.findUnique({
    where: { id },
    include: { lines: { orderBy: { seq: "asc" } }, party: { select: { id: true, code: true, name: true, mobile: true, phone: true, address: true, city: true } } },
  });
  if (!po) return null;
  const [prog, cards, invoices, warehouse] = await Promise.all([
    poLineProgress(db, po.lines.map((l) => l.id)),
    itemCards(po.lines.map((l) => l.productId), db),
    db.accInvoice.findMany({
      where: { purchaseOrderId: id },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { id: true, number: true, date: true, status: true, total: true },
    }),
    po.warehouseId ? db.accWarehouse.findUnique({ where: { id: po.warehouseId }, select: { id: true, name: true } }) : null,
  ]);
  const lines = po.lines.map((l) => ({
    ...l,
    code: cards.get(l.productId)?.code ?? "",
    image: cards.get(l.productId)?.image ?? null,
    received: prog.get(l.id)?.received ?? 0,
    draft: prog.get(l.id)?.draft ?? 0,
  }));
  const st = stateOf(po.status, lines);
  return {
    order: { ...po, lines },
    state: st,
    overdue: !!po.dueDate && po.dueDate < todayKey() && (st === "OPEN" || st === "PARTIAL"),
    total: lines.reduce((s, l) => s + l.unitPrice * BigInt(l.qty), 0n),
    invoices,
    warehouse,
  };
}

// ── پیشنهاد خرید ──────────────────────────────────────────────────────

/**
 * کالاهایی که موجودی + در راهشان به نقطه‌ی سفارش رسیده — پیشنهاد تعداد تا دو برابر نقطه‌ی سفارش.
 * فقط کالای فعالی که نقطه‌ی سفارش دارد یا قبلاً خریده شده (وگرنه همه‌ی کالاهای صفر می‌آیند).
 * با `partyId`: فقط کالاهای همان عرضه‌کننده (روی کالا، وگرنه آخرین خرید).
 */
export async function suggestLines(db: Db, opts: { partyId?: string | null; warehouseId?: string | null; limit?: number }) {
  const bought = await db.accInvoiceLine.findMany({
    where: { productId: { not: null }, invoice: { type: "PURCHASE", status: "ISSUED" } },
    orderBy: { invoice: { date: "desc" } },
    select: { productId: true, unitPrice: true, invoice: { select: { partyId: true } } },
    take: 20_000,
  });
  const last = new Map<string, { price: bigint; partyId: string }>();
  for (const b of bought) if (!last.has(b.productId!)) last.set(b.productId!, { price: b.unitPrice, partyId: b.invoice.partyId });

  const items = await db.accItem.findMany({
    where: { isActive: true, OR: [{ reorderPoint: { not: null } }, { id: { in: [...last.keys()] } }] },
    select: { id: true, supplierId: true, reorderPoint: true },
    take: 20_000,
  });
  const mine = opts.partyId ? items.filter((i) => (i.supplierId ?? last.get(i.id)?.partyId) === opts.partyId) : items;
  const ids = mine.map((i) => i.id);
  const [cards, stocks, onOrder] = await Promise.all([
    itemCards(ids, db),
    db.accStock.groupBy({ by: ["productId"], where: { productId: { in: ids }, ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}) }, _sum: { qty: true } }),
    onOrderQty(db, ids),
  ]);
  const stock = new Map(stocks.map((s) => [s.productId, s._sum.qty ?? 0]));
  const out = [];
  for (const id of ids) {
    const c = cards.get(id);
    if (!c) continue;
    const point = c.lowStockThreshold;
    const have = stock.get(id) ?? 0;
    const coming = onOrder.get(id) ?? 0;
    if (have + coming > point) continue;
    out.push({
      productId: id,
      title: c.title,
      code: c.code,
      image: c.image,
      stock: have,
      onOrder: coming,
      reorderPoint: point,
      qty: Math.max(point * 2 - have - coming, 1),
      unitPrice: last.get(id)?.price ?? 0n,
    });
  }
  out.sort((a, b) => a.stock - a.reorderPoint - (b.stock - b.reorderPoint) || a.title.localeCompare(b.title, "fa"));
  return out.slice(0, opts.limit ?? 300);
}
