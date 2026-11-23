/**
 * تفکیک ردیف خرید به رنگ و سایز — docs/plans/inventory-items.md بخش ۱۶.
 *
 * فاکتور خرید با یک ردیف تجمیعی ثبت می‌شود («بافت یقه‌دار کرال» × ۵۱). بعد، با
 * باز شدن بسته‌ها، تعداد هر رنگ و سایز نوشته می‌شود؛ همان ردیف فاکتور به چند
 * ردیف تنوع با **همان فی** شکسته می‌شود و تخفیف، مالیات و جمع ردیف به نسبت
 * تعداد پخش می‌شوند (`allocate`) — پس جمع فاکتور، پرداخت‌ها و مانده‌ی تأمین‌کننده
 * یک ریال هم عوض نمی‌شود. کاردکس فاکتور برداشته و از ردیف‌های تازه دوباره ساخته
 * می‌شود: موجودی و بهای ورود مستقیم روی تنوع‌ها می‌نشیند، نه روی کالای تجمیعی.
 *
 * مدل تنوع‌ها: مدل خودِ کالای تجمیعی (اگر مدل دارد) وگرنه مدلی تازه با همان نام
 * که `specs.sourceItemId` آن را به کالای تجمیعی وصل می‌کند — خرید بعدی همان جنس
 * همان مدل و همان کدهای رنگ/سایز را می‌گیرد.
 *
 * تعداد کمتر از ردیف ← مانده روی ردیف تجمیعی می‌ماند و بعداً تفکیک‌شدنی است.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { assertPostable } from "../ledger/fiscal-year";
import type { Actor } from "../ledger/post";
import { logDoc } from "../doc-log";
import { faNum } from "../money";
import { allocate } from "../invoices/calc";
import { buildInvoiceVoucher, INVOICE_SOURCE, invoiceMoves } from "../invoices/service";
import { applyMoves, assertAvailable, removeMoves } from "./stock";
import { ALWAYS_ASK_AXES, RELABEL_MAX_ROWS, specsOf, variantItemsFor } from "./relabel";

type Db = Prisma.TransactionClient | typeof prisma;
type Tx = Prisma.TransactionClient;

/** مقدارهای پرکاربرد هر محور که بی‌تایپ پیشنهاد می‌شوند */
const POPULAR_PER_AXIS = 16;

export interface SplitLine {
  lineId: string;
  invoiceId: string;
  invoiceNumber: number | null;
  date: Date;
  partyName: string;
  seq: number;
  itemId: string;
  itemCode: string;
  title: string;
  qty: number;
  unitPrice: bigint;
}

/** ردیف‌های خرید صادرشده که کالایشان رنگ/سایز ندارد — تازه‌ترین اول */
export async function splitCandidates(db: Db, opts: { q?: string | null; invoiceId?: string | null; take?: number } = {}): Promise<SplitLine[]> {
  const term = opts.q?.trim();
  const lines = await db.accInvoiceLine.findMany({
    where: {
      productId: { not: null },
      packSize: null,
      invoice: { type: "PURCHASE", status: "ISSUED", ...(opts.invoiceId ? { id: opts.invoiceId } : {}) },
      ...(term ? { OR: [{ title: { contains: term, mode: "insensitive" } }, { invoice: { partyName: { contains: term, mode: "insensitive" } } }] } : {}),
    },
    include: { invoice: { select: { id: true, number: true, date: true, partyName: true } } },
    orderBy: [{ invoice: { date: "desc" } }, { invoice: { number: "desc" } }, { seq: "asc" }],
    take: opts.invoiceId ? 500 : 400,
  });
  const ids = [...new Set(lines.map((l) => l.productId!))];
  const items = new Map(
    (await db.accItem.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, _count: { select: { attrs: true } } } })).map((i) => [i.id, i]),
  );
  return lines
    .filter((l) => l.serials.length === 0 && (items.get(l.productId!)?._count.attrs ?? 1) === 0)
    .slice(0, opts.take ?? 150)
    .map((l) => ({
      lineId: l.id,
      invoiceId: l.invoice.id,
      invoiceNumber: l.invoice.number,
      date: l.invoice.date,
      partyName: l.invoice.partyName,
      seq: l.seq,
      itemId: l.productId!,
      itemCode: items.get(l.productId!)!.code,
      title: l.title,
      qty: l.qty,
      unitPrice: l.unitPrice,
    }));
}

/** مدل تنوع‌های یک کالای تجمیعی — خود مدل کالا، یا مدلی که از همین کالا ساخته شده */
async function findModelOf(db: Db, item: { id: string; modelId: string | null }) {
  if (item.modelId) return item.modelId;
  const m = await db.accItemModel.findFirst({ where: { specs: { path: ["sourceItemId"], equals: item.id } }, select: { id: true } });
  return m?.id ?? null;
}

export interface SplitView {
  line: SplitLine & { warehouseId: string | null; stock: number; salePrice: bigint | null };
  model: { id: string | null; base: string; code: string | null };
  axes: { id: string; name: string; values: { id: string; value: string }[]; popular: string[] }[];
  items: { id: string; code: string; title: string; attrs: Record<string, string> }[];
}

export async function splitView(db: Db, lineId: string): Promise<SplitView> {
  const line = await db.accInvoiceLine.findUnique({
    where: { id: lineId },
    include: { invoice: { select: { id: true, number: true, date: true, partyName: true, type: true, status: true, warehouseId: true } } },
  });
  if (!line) throw new AccError("ردیف فاکتور پیدا نشد", 404);
  const inv = line.invoice;
  if (inv.type !== "PURCHASE" || inv.status !== "ISSUED") throw new AccError("فقط ردیف فاکتور خرید صادرشده تفکیک می‌شود");
  if (!line.productId) throw new AccError("ردیف خدمت تفکیک نمی‌شود");
  const item = await db.accItem.findUnique({ where: { id: line.productId }, include: { attrs: { select: { axisId: true } } } });
  if (!item) throw new AccError("کالای ردیف پیدا نشد", 404);

  const modelId = await findModelOf(db, item);
  const model = modelId
    ? await db.accItemModel.findUnique({ where: { id: modelId }, include: { items: { where: { isActive: true, attrKey: { not: null } }, include: { attrs: true }, orderBy: { code: "asc" } } } })
    : null;
  const used = new Set(model?.items.flatMap((i) => i.attrs.map((a) => a.axisId)) ?? []);
  const axes = await db.accAxis.findMany({
    where: { OR: [{ id: { in: [...used] } }, { name: { in: ALWAYS_ASK_AXES } }] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { values: { orderBy: [{ sortOrder: "asc" }, { value: "asc" }] } },
  });
  // پرکاربردترین مقدارهای هر محور در کل کالاها — سایزها و رنگ‌های همیشگی فروشگاه
  const counts = await db.accItemAttr.groupBy({ by: ["valueId"], where: { axisId: { in: axes.map((a) => a.id) } }, _count: { valueId: true } });
  const countOf = new Map(counts.map((c) => [c.valueId, c._count.valueId]));
  const stock = inv.warehouseId
    ? ((await db.accStock.findUnique({ where: { productId_warehouseId: { productId: item.id, warehouseId: inv.warehouseId } } }))?.qty ?? 0)
    : 0;

  return {
    line: {
      lineId: line.id,
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      date: inv.date,
      partyName: inv.partyName,
      seq: line.seq,
      itemId: item.id,
      itemCode: item.code,
      title: line.title,
      qty: line.qty,
      unitPrice: line.unitPrice,
      warehouseId: inv.warehouseId,
      stock,
      salePrice: item.salePrice,
    },
    model: { id: model?.id ?? null, base: model ? specsOf(model.specs).base?.trim() || model.title : item.title, code: model?.code ?? null },
    axes: axes.map((a) => ({
      id: a.id,
      name: a.name,
      values: a.values.map((v) => ({ id: v.id, value: v.value })),
      popular: a.values
        .filter((v) => (countOf.get(v.id) ?? 0) > 0)
        .sort((x, y) => (countOf.get(y.id) ?? 0) - (countOf.get(x.id) ?? 0))
        .slice(0, POPULAR_PER_AXIS)
        .sort((x, y) => a.values.indexOf(x) - a.values.indexOf(y))
        .map((v) => v.value),
    })),
    items: (model?.items ?? []).map((i) => ({ id: i.id, code: i.code, title: i.title, attrs: Object.fromEntries(i.attrs.map((a) => [a.axisId, a.valueId])) })),
  };
}

export interface SplitInput {
  lineId: string;
  /** هر ردیف: نام مقدار هر محور (`axisId` ← «آبی») و تعداد */
  rows: { values: Record<string, string>; qty: number }[];
}

/**
 * شکستن ردیف خرید. خروجی: کالا و تعداد هر تنوع (برای صفحه‌ی چاپ برچسب).
 * ⚠️ ترتیب: کاردکس فاکتور برداشته ← ردیف‌ها بازنویسی ← کاردکس و سند دوباره (مثل ویرایش فاکتور).
 */
export async function commitSplit(tx: Tx, input: SplitInput, actor: Actor) {
  const line = await tx.accInvoiceLine.findUnique({ where: { id: input.lineId }, include: { invoice: true } });
  if (!line) throw new AccError("ردیف فاکتور پیدا نشد", 404);
  const inv = line.invoice;
  if (inv.type !== "PURCHASE" || inv.status !== "ISSUED") throw new AccError("فقط ردیف فاکتور خرید صادرشده تفکیک می‌شود");
  if (!line.productId || !inv.warehouseId) throw new AccError("ردیف خدمت تفکیک نمی‌شود");
  if (line.packSize) throw new AccError("ردیف بسته‌ای تفکیک نمی‌شود؛ فاکتور را با تعداد عددی ویرایش کنید");
  if (line.serials.length) throw new AccError("ردیف سریال‌دار تفکیک نمی‌شود");
  const returns = await tx.accInvoiceLine.count({ where: { refLineId: line.id, invoice: { status: { not: "VOID" } } } });
  if (returns) throw new AccError("از این ردیف برگشت از خرید ثبت شده؛ اول برگشتی را باطل کنید", 409);
  await assertPostable(tx, inv.date);

  const item = await tx.accItem.findUnique({ where: { id: line.productId }, include: { attrs: { select: { axisId: true } } } });
  const cost = await tx.accProductCost.findUnique({ where: { productId: line.productId }, select: { taxCode: true } });
  if (!item) throw new AccError("کالای ردیف پیدا نشد", 404);
  if (item.attrs.length) throw new AccError(`«${item.title}» خودش رنگ/سایز دارد و تفکیک نمی‌شود`);

  const rows = (input.rows ?? []).filter((r) => (Number(r.qty) || 0) > 0);
  if (!rows.length) throw new AccError("تعداد دست‌کم یک رنگ/سایز را بنویسید");
  if (rows.length > RELABEL_MAX_ROWS) throw new AccError(`حداکثر ${faNum(RELABEL_MAX_ROWS)} رنگ/سایز در یک بار`);
  const total = rows.reduce((s, r) => s + Math.floor(Number(r.qty) || 0), 0);
  if (total > line.qty) throw new AccError(`جمع تعدادها ${faNum(total)} است ولی این ردیف ${faNum(line.qty)} عدد دارد`);

  // ── مدل: موجود یا تازه با نام کالای تجمیعی ──
  let modelId = await findModelOf(tx, item);
  if (!modelId) {
    const taken = await tx.accItemModel.findUnique({ where: { title: item.title }, select: { id: true } });
    const created = await tx.accItemModel.create({
      data: {
        title: taken ? `${item.title} · ${item.code}` : item.title,
        groupId: item.groupId,
        specs: { base: item.title, unit: item.unit, sourceItemId: item.id } as Prisma.InputJsonValue,
      },
    });
    modelId = created.id;
  }
  const model = await tx.accItemModel.findUniqueOrThrow({ where: { id: modelId }, include: { items: { select: { id: true, attrKey: true, isActive: true } } } });
  // کالای تجمیعی اگر عضو همین مدل است (attrKey خالی) هدف ترکیب «بی‌ویژگی» نشود
  model.items = model.items.filter((i) => i.attrKey !== null);

  const parts = await variantItemsFor(tx, model, rows, {
    salePrice: item.salePrice,
    supplierId: item.supplierId ?? inv.partyId,
    taxCode: cost?.taxCode ?? undefined,
    unit: item.unit,
    requireValue: true,
  });
  const split = parts.filter((p) => p.qty > 0);
  if (split.some((p) => p.itemId === item.id)) throw new AccError("رنگ/سایز ردیف با خود کالای تجمیعی یکی شد");

  // موجودی کالای تجمیعی در انبار فاکتور باید هنوز باشد (فروخته یا جابه‌جا نشده باشد)
  await assertAvailable(tx, [{ productId: item.id, qty: total, title: item.title }], inv.warehouseId, null, {
    where: "انبار این فاکتور",
    verb: "تفکیک کرد (بخشی از آن فروخته یا جابه‌جا شده)",
  });

  // ── بازنویسی ردیف‌ها ── مانده (اگر هست) + هر تنوع، با همان فی؛ مبالغ به نسبت تعداد
  const remainder = line.qty - total;
  const titles = new Map((await tx.accItem.findMany({ where: { id: { in: split.map((p) => p.itemId) } }, select: { id: true, title: true } })).map((i) => [i.id, i.title]));
  const parts2 = [...(remainder > 0 ? [{ itemId: item.id, qty: remainder, keep: true }] : []), ...split.map((p) => ({ ...p, keep: false }))];
  const w = parts2.map((p) => BigInt(p.qty));
  const disc = allocate(line.discount, w);
  const share = allocate(line.invoiceDiscountShare, w);
  const vat = allocate(line.vatAmount, w);
  // جمع هر ردیف از اجزای خودش (همان فرمول calc.ts) — هر ردیف سازگار و جمعشان برابر ردیف اصلی
  const lt = parts2.map((p, i) => line.unitPrice * BigInt(p.qty) - disc[i] - share[i] + (inv.pricesIncludeVat ? 0n : vat[i]));
  if (lt.reduce((a, b) => a + b, 0n) !== line.lineTotal) {
    const fix = allocate(line.lineTotal, w);
    lt.splice(0, lt.length, ...fix);
  }

  await removeMoves(tx, INVOICE_SOURCE, inv.id, actor);

  const all = await tx.accInvoiceLine.findMany({ where: { invoiceId: inv.id }, orderBy: { seq: "asc" }, select: { id: true, seq: true } });
  const after = all.filter((l) => l.seq > line.seq);
  const shift = parts2.length - 1;
  // جا باز کردن برای ردیف‌های تازه (از آخر، تا seq تکراری لحظه‌ای هم نشود)
  if (shift > 0) for (const l of [...after].reverse()) await tx.accInvoiceLine.update({ where: { id: l.id }, data: { seq: l.seq + shift } });
  if (shift < 0) for (const l of after) await tx.accInvoiceLine.update({ where: { id: l.id }, data: { seq: l.seq + shift } });

  const common = {
    invoiceId: inv.id,
    unit: line.unit,
    unitPrice: line.unitPrice,
    vatRateBp: line.vatRateBp,
    taxCode: line.taxCode,
    poLineId: line.poLineId,
    orderItemId: line.orderItemId,
  };
  await tx.accInvoiceLine.delete({ where: { id: line.id } });
  for (const [i, p] of parts2.entries()) {
    await tx.accInvoiceLine.create({
      data: {
        ...common,
        ...(p.keep ? { id: line.id } : {}),
        seq: line.seq + i,
        productId: p.itemId,
        title: p.keep ? line.title : titles.get(p.itemId) ?? line.title,
        qty: p.qty,
        discount: disc[i],
        invoiceDiscountShare: share[i],
        vatAmount: vat[i],
        lineTotal: lt[i],
      },
    });
  }

  await applyMoves(tx, await invoiceMoves(tx, inv.id), actor);
  await buildInvoiceVoucher(tx, inv.id, actor);
  await logDoc(
    tx,
    {
      docType: "AccInvoice",
      docId: inv.id,
      kind: inv.type,
      number: inv.number,
      docDate: inv.date,
      partyName: inv.partyName,
      action: "EDIT",
      totalBefore: inv.total,
      totalAfter: inv.total,
      changes: [
        {
          label: `تفکیک «${line.title}»`,
          before: `${faNum(line.qty)} عدد`,
          after: `${faNum(split.length)} رنگ/سایز، ${faNum(total)} عدد${remainder > 0 ? ` — ${faNum(remainder)} عدد مانده` : ""}`,
        },
      ],
    },
    actor,
  );
  return { items: split, remainder, invoiceId: inv.id };
}
