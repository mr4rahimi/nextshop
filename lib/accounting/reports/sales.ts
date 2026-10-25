/**
 * تحلیل فروش کالا — docs/plans/webhesab-parity.md بخش ۵.
 *
 * یک گزارش به‌جای گزارش‌های جدای وب حساب (دسته، عرضه‌کننده، مشخصه، انبار، صندوق، ماه):
 * سطر «بر اساس» یکی از بُعدها، ستون اختیاری (انبار، ماه، کانال).
 *
 * فروش = `lineTotal − vatAmount` ردیف فاکتور فروش صادرشده (تخفیف ردیف و سهم تخفیف کل در آن
 * هست، کرایه نه)؛ برگشت از فروش منفی. بها از کاردکس همان ردیف — مثل `profit.ts`.
 */

import type { AccChannel } from "@prisma/client";
import { toJalali, jalaliMonthName } from "@/lib/club/jalali";
import { INVOICE_SOURCE } from "../invoices/service";
import { groupTree } from "../inventory/counts";
import { CHANNEL_LABELS } from "./profit";
import type { Db, DateRange } from "./common";

/** بُعدهای ثابت؛ به‌علاوه‌ی `axis:<id>` و `spec:<نام>` */
export const FIXED_DIMS = ["item", "model", "group", "group1", "supplier", "warehouse", "channel", "terminal", "seller", "month"] as const;
export type FixedDim = (typeof FIXED_DIMS)[number];
export type SalesDim = FixedDim | `axis:${string}` | `spec:${string}`;
export const COL_DIMS = ["warehouse", "month", "channel"] as const;
export type ColDim = (typeof COL_DIMS)[number];

/** سطرهایی که «موجودی فعلی» دارند — کانال، صندوق، فروشنده و ماه موجودی ندارند */
const STOCK_DIMS = (d: SalesDim) => !["channel", "terminal", "seller", "month"].includes(d);

export function parseDim(raw: string | null): SalesDim {
  if (raw && ((FIXED_DIMS as readonly string[]).includes(raw) || /^axis:[\w-]+$/.test(raw) || /^spec:.{1,60}$/.test(raw))) return raw as SalesDim;
  return "group";
}

export interface SalesFilters {
  groupId?: string | null;
  warehouseId?: string | null;
  supplierId?: string | null;
}

interface Fact {
  productId: string | null;
  title: string;
  sign: 1 | -1;
  qty: number;
  revenue: bigint;
  cost: bigint;
  date: Date;
  channel: AccChannel;
  platformCode: string | null;
  warehouseId: string | null;
  invoiceId: string;
  invoiceType: "SALES" | "SALES_RETURN";
  number: number | null;
  partyId: string;
  partyName: string;
}

/** ردیف‌های فاکتورِ پشت یک سطر/خانه — پنجره‌ی جزئیات */
export interface DetailLine {
  invoiceId: string;
  type: "SALES" | "SALES_RETURN";
  number: number | null;
  date: Date;
  partyId: string;
  partyName: string;
  productId: string | null;
  title: string;
  qty: number;
  revenue: bigint;
}

interface Cell {
  qty: number;
  revenue: bigint;
}

export interface SalesRow {
  key: string;
  label: string;
  soldQty: number;
  returnQty: number;
  netQty: number;
  revenue: bigint;
  cost: bigint | null;
  profit: bigint | null;
  marginBp: number | null;
  /** سهم از فروش خالص کل × ۱۰۰ */
  shareBp: number;
  stock: number | null;
  cells: Record<string, Cell> | null;
}

const NONE = "_none";
const MAX_COLS = 24;

export async function salesAnalysis(
  db: Db,
  opts: { range: DateRange; by: SalesDim; col: ColDim | null; filters: SalesFilters; costs: boolean; detail?: { row: string; col?: string | null } | null },
) {
  const { range, by, col, filters } = opts;
  const invs = await db.accInvoice.findMany({
    where: {
      status: "ISSUED",
      type: { in: ["SALES", "SALES_RETURN"] },
      ...(range.from || range.to ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {}),
    },
    select: {
      id: true,
      type: true,
      date: true,
      channel: true,
      platformCode: true,
      warehouseId: true,
      number: true,
      partyId: true,
      partyName: true,
      lines: { select: { id: true, productId: true, title: true, qty: true, lineTotal: true, vatAmount: true } },
    },
  });
  const moves = await db.accStockMove.findMany({
    where: { sourceType: INVOICE_SOURCE, sourceId: { in: invs.map((i) => i.id) } },
    select: { sourceLineId: true, totalCost: true, warehouseId: true },
  });
  const moveOf = new Map<string, { cost: bigint; warehouseId: string }>();
  for (const m of moves) {
    if (!m.sourceLineId) continue;
    const cur = moveOf.get(m.sourceLineId);
    moveOf.set(m.sourceLineId, { cost: (cur?.cost ?? 0n) + m.totalCost, warehouseId: m.warehouseId });
  }

  let facts: Fact[] = invs.flatMap((inv) =>
    inv.lines.map((l) => ({
      productId: l.productId,
      title: l.title,
      sign: inv.type === "SALES" ? (1 as const) : (-1 as const),
      qty: l.qty,
      revenue: l.lineTotal - l.vatAmount,
      cost: moveOf.get(l.id)?.cost ?? 0n,
      date: inv.date,
      channel: inv.channel,
      platformCode: inv.platformCode,
      warehouseId: moveOf.get(l.id)?.warehouseId ?? inv.warehouseId,
      invoiceId: inv.id,
      invoiceType: inv.type as "SALES" | "SALES_RETURN",
      number: inv.number,
      partyId: inv.partyId,
      partyName: inv.partyName,
    })),
  );

  // ── اطلاعات کالاها (فروخته‌ها + دارای موجودی برای ستون موجودی) ──
  const withStock = STOCK_DIMS(by);
  const stocks = withStock
    ? await db.accStock.findMany({ where: { qty: { not: 0 }, ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}) }, select: { productId: true, warehouseId: true, qty: true } })
    : [];
  const ids = [...new Set([...facts.map((f) => f.productId).filter((x): x is string => !!x), ...stocks.map((s) => s.productId)])];
  const needAttrs = by.startsWith("axis:");
  const [items, groups, warehouses] = await Promise.all([
    db.accItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, code: true, groupId: true, modelId: true, supplierId: true, ...(needAttrs ? { attrs: { select: { axisId: true, valueId: true } } } : {}) },
    }),
    db.accItemGroup.findMany({ select: { id: true, name: true, parentId: true } }),
    db.accWarehouse.findMany({ select: { id: true, name: true } }),
  ]);
  const itemOf = new Map(items.map((i) => [i.id, i as typeof i & { attrs?: { axisId: string; valueId: string }[] }]));
  const groupOf = new Map(groups.map((g) => [g.id, g]));
  const whName = new Map(warehouses.map((w) => [w.id, w.name]));

  // عرضه‌کننده: فیلد کالا، وگرنه طرف آخرین فاکتور خرید صادرشده
  const needSupplier = by === "supplier" || !!filters.supplierId;
  const supplierOf = new Map<string, string>();
  const partyName = new Map<string, string>();
  if (needSupplier) {
    for (const [k, v] of await suppliersOf(db, items)) supplierOf.set(k, v);
    const parties = await db.accParty.findMany({ where: { id: { in: [...new Set(supplierOf.values())] } }, select: { id: true, name: true } });
    for (const p of parties) partyName.set(p.id, p.name);
  }

  // ── فیلترها ──
  const inGroup = filters.groupId ? await groupTree(db, filters.groupId) : null;
  const keep = (productId: string | null, warehouseId: string | null) => {
    if (inGroup && !(productId && inGroup.has(itemOf.get(productId)?.groupId ?? ""))) return false;
    if (filters.warehouseId && warehouseId !== filters.warehouseId) return false;
    if (filters.supplierId && !(productId && supplierOf.get(productId) === filters.supplierId)) return false;
    return true;
  };
  facts = facts.filter((f) => keep(f.productId, f.warehouseId));

  // ── صندوق و فروشنده ──
  const ticketOf = new Map<string, { terminal: string; seller: string | null }>();
  const posNames = new Map<string, string>();
  if (by === "terminal" || by === "seller") {
    const invIds = [...new Set(facts.map((f) => f.invoiceId))];
    const tickets = await db.accPosTicket.findMany({
      where: { OR: [{ saleInvoiceId: { in: invIds } }, { returnInvoiceId: { in: invIds } }] },
      select: { saleInvoiceId: true, returnInvoiceId: true, terminalId: true, sellerId: true },
    });
    for (const t of tickets) {
      const v = { terminal: t.terminalId, seller: t.sellerId };
      if (t.saleInvoiceId) ticketOf.set(t.saleInvoiceId, v);
      if (t.returnInvoiceId) ticketOf.set(t.returnInvoiceId, v);
    }
    const [terms, sellers] = await Promise.all([
      db.accPosTerminal.findMany({ select: { id: true, name: true } }),
      db.accPosSeller.findMany({ select: { id: true, name: true } }),
    ]);
    for (const x of [...terms, ...sellers]) posNames.set(x.id, x.name);
  }

  // ── نام مدل‌ها، محور و مشخصه ──
  const needModels = by === "model" || by.startsWith("spec:");
  const models = needModels
    ? await db.accItemModel.findMany({ where: { id: { in: [...new Set(items.map((i) => i.modelId).filter((x): x is string => !!x))] } }, select: { id: true, title: true, specs: true } })
    : [];
  const modelOf = new Map(models.map((m) => [m.id, m]));
  const axisId = by.startsWith("axis:") ? by.slice(5) : null;
  const axis = axisId ? await db.accAxis.findUnique({ where: { id: axisId }, include: { values: { select: { id: true, value: true } } } }) : null;
  const valueName = new Map(axis?.values.map((v) => [v.id, v.value]) ?? []);
  const specKey = by.startsWith("spec:") ? by.slice(5) : null;

  const groupPath = (id: string) => {
    const parts: string[] = [];
    for (let g = groupOf.get(id); g && parts.length < 8; g = g.parentId ? groupOf.get(g.parentId) : undefined) parts.unshift(g.name);
    return parts.join(" › ");
  };
  const rootOf = (id: string) => {
    let g = groupOf.get(id);
    while (g?.parentId && groupOf.get(g.parentId)) g = groupOf.get(g.parentId);
    return g;
  };

  /** کلید و برچسب یک بُعد برای یک کالا/ردیف */
  function dimOf(d: SalesDim | ColDim, f: { productId: string | null; title?: string; warehouseId: string | null; channel?: AccChannel; platformCode?: string | null; date?: Date; invoiceId?: string }): [string, string] {
    const it = f.productId ? itemOf.get(f.productId) : undefined;
    switch (d) {
      case "item":
        return f.productId ? [f.productId, it ? `${it.title} · ${it.code}` : (f.title ?? "")] : [NONE, "خدمات (بی‌کالا)"];
      case "model": {
        const m = it?.modelId ? modelOf.get(it.modelId) : undefined;
        return m ? [m.id, m.title] : [NONE, "بی‌مدل"];
      }
      case "group":
        return it?.groupId ? [it.groupId, groupPath(it.groupId)] : [NONE, "بی‌گروه"];
      case "group1": {
        const r = it?.groupId ? rootOf(it.groupId) : undefined;
        return r ? [r.id, r.name] : [NONE, "بی‌گروه"];
      }
      case "supplier": {
        const s = f.productId ? supplierOf.get(f.productId) : undefined;
        return s ? [s, partyName.get(s) ?? "—"] : [NONE, "نامعلوم"];
      }
      case "warehouse":
        return f.warehouseId ? [f.warehouseId, whName.get(f.warehouseId) ?? "—"] : [NONE, "بی‌انبار (خدمات)"];
      case "channel":
        return f.platformCode ? [`MARKETPLACE:${f.platformCode}`, `بازارگاه — ${f.platformCode}`] : [f.channel!, CHANNEL_LABELS[f.channel!]];
      case "terminal": {
        const t = f.invoiceId ? ticketOf.get(f.invoiceId) : undefined;
        return t ? [t.terminal, posNames.get(t.terminal) ?? "صندوق"] : [NONE, "بیرون از صندوق"];
      }
      case "seller": {
        const t = f.invoiceId ? ticketOf.get(f.invoiceId) : undefined;
        if (!t) return [NONE, "بیرون از صندوق"];
        return t.seller ? [t.seller, posNames.get(t.seller) ?? "فروشنده"] : ["_noseller", "بی‌فروشنده"];
      }
      case "month": {
        const j = toJalali(f.date!);
        return [`${j.year}-${String(j.month).padStart(2, "0")}`, `${jalaliMonthName(j.month)} ${j.year.toLocaleString("fa-IR", { useGrouping: false })}`];
      }
      default: {
        if (axisId) {
          const v = it?.attrs?.find((a) => a.axisId === axisId)?.valueId;
          return v ? [v, valueName.get(v) ?? "—"] : [NONE, `بی ${axis?.name ?? "مقدار"}`];
        }
        const m = it?.modelId ? modelOf.get(it.modelId) : undefined;
        const v = specKey ? specsOf(m?.specs)[specKey]?.trim() : undefined;
        return v ? [`s:${v}`, v] : [NONE, `بی ${specKey ?? ""}`];
      }
    }
  }

  // ── جزئیات یک سطر (و خانه): کالاهای پشتش + ردیف‌های فاکتور ──
  if (opts.detail) {
    const d = opts.detail;
    const picked = facts.filter((f) => dimOf(by, f)[0] === d.row && (!col || !d.col || dimOf(col, f)[0] === d.col));
    const byItem = new Map<string, { productId: string | null; label: string; netQty: number; revenue: bigint; stock: number | null }>();
    for (const f of picked) {
      const [k, label] = dimOf("item", f);
      const r = byItem.get(k) ?? { productId: f.productId, label, netQty: 0, revenue: 0n, stock: null };
      r.netQty += f.sign * f.qty;
      r.revenue += BigInt(f.sign) * f.revenue;
      byItem.set(k, r);
    }
    for (const s of stocks) {
      const r = byItem.get(s.productId);
      if (r && keep(s.productId, s.warehouseId)) r.stock = (r.stock ?? 0) + s.qty;
    }
    const lines: DetailLine[] = [...picked]
      .sort((a, b) => b.date.getTime() - a.date.getTime() || (b.number ?? 0) - (a.number ?? 0))
      .slice(0, 500)
      .map((f) => ({
        invoiceId: f.invoiceId,
        type: f.invoiceType,
        number: f.number,
        date: f.date,
        partyId: f.partyId,
        partyName: f.partyName,
        productId: f.productId,
        title: f.productId ? (itemOf.get(f.productId)?.title ?? f.title) : f.title,
        qty: f.sign * f.qty,
        revenue: BigInt(f.sign) * f.revenue,
      }));
    const label = picked[0] ? dimOf(by, picked[0])[1] : "";
    const colLabel = col && d.col && picked[0] ? dimOf(col, picked[0])[1] : null;
    return {
      detail: {
        label,
        colLabel,
        items: [...byItem.values()].sort((a, b) => (b.revenue > a.revenue ? 1 : b.revenue < a.revenue ? -1 : b.netQty - a.netQty)),
        lines,
        lineCount: picked.length,
      },
    };
  }

  // ── جمع ──
  const rows = new Map<string, SalesRow & { _cost: bigint }>();
  const colLabels = new Map<string, { label: string; revenue: bigint }>();
  for (const f of facts) {
    const [key, label] = dimOf(by, f);
    const r =
      rows.get(key) ??
      ({ key, label, soldQty: 0, returnQty: 0, netQty: 0, revenue: 0n, cost: null, profit: null, marginBp: null, shareBp: 0, stock: null, cells: col ? {} : null, _cost: 0n } as SalesRow & { _cost: bigint });
    if (f.sign > 0) r.soldQty += f.qty;
    else r.returnQty += f.qty;
    r.netQty += f.sign * f.qty;
    r.revenue += BigInt(f.sign) * f.revenue;
    r._cost += BigInt(f.sign) * f.cost;
    if (col && r.cells) {
      const [ck, cl] = dimOf(col, f);
      const c = r.cells[ck] ?? { qty: 0, revenue: 0n };
      c.qty += f.sign * f.qty;
      c.revenue += BigInt(f.sign) * f.revenue;
      r.cells[ck] = c;
      const cc = colLabels.get(ck) ?? { label: cl, revenue: 0n };
      cc.revenue += BigInt(f.sign) * f.revenue;
      colLabels.set(ck, cc);
    }
    rows.set(key, r);
  }

  if (withStock) {
    for (const s of stocks) {
      if (!keep(s.productId, s.warehouseId)) continue;
      const [key] = dimOf(by, { productId: s.productId, warehouseId: s.warehouseId });
      const r = rows.get(key);
      if (r) r.stock = (r.stock ?? 0) + s.qty;
    }
    for (const r of rows.values()) r.stock ??= 0;
  }

  const total = [...rows.values()].reduce((s, r) => s + r.revenue, 0n);
  const list: SalesRow[] = [...rows.values()].map(({ _cost, ...r }) => {
    const out: SalesRow = { ...r, shareBp: total > 0n ? Number((r.revenue * 10_000n) / total) : 0 };
    if (opts.costs) {
      out.cost = _cost;
      out.profit = r.revenue - _cost;
      out.marginBp = r.revenue > 0n ? Number(((r.revenue - _cost) * 10_000n) / r.revenue) : null;
    }
    return out;
  });
  list.sort((a, b) => (by === "month" ? a.key.localeCompare(b.key) : b.revenue > a.revenue ? 1 : b.revenue < a.revenue ? -1 : b.netQty - a.netQty));

  // ستون‌ها: ماه به ترتیب زمان، بقیه به ترتیب فروش؛ بیشتر از سقف ← «سایر»
  let columns = [...colLabels].map(([key, v]) => ({ key, label: v.label, revenue: v.revenue }));
  columns.sort((a, b) => (col === "month" ? a.key.localeCompare(b.key) : b.revenue > a.revenue ? 1 : -1));
  if (columns.length > MAX_COLS) {
    const kept = new Set(columns.slice(0, MAX_COLS - 1).map((c) => c.key));
    for (const r of list) {
      if (!r.cells) continue;
      const other: Cell = { qty: 0, revenue: 0n };
      for (const [k, c] of Object.entries(r.cells)) {
        if (kept.has(k)) continue;
        other.qty += c.qty;
        other.revenue += c.revenue;
        delete r.cells[k];
      }
      if (other.qty || other.revenue) r.cells._other = other;
    }
    columns = [...columns.slice(0, MAX_COLS - 1), { key: "_other", label: "سایر", revenue: 0n }];
  }

  const totals = list.reduce(
    (t, r) => ({
      soldQty: t.soldQty + r.soldQty,
      returnQty: t.returnQty + r.returnQty,
      netQty: t.netQty + r.netQty,
      revenue: t.revenue + r.revenue,
      cost: opts.costs ? (t.cost ?? 0n) + (r.cost ?? 0n) : null,
      stock: withStock ? (t.stock ?? 0) + (r.stock ?? 0) : null,
    }),
    { soldQty: 0, returnQty: 0, netQty: 0, revenue: 0n, cost: null as bigint | null, stock: null as number | null },
  );
  return { rows: list, columns: columns.map(({ key, label }) => ({ key, label })), totals, costs: opts.costs, stock: withStock };
}

/** عرضه‌کننده‌ی هر کالا: فیلد کالا، وگرنه طرف آخرین فاکتور خرید صادرشده */
export async function suppliersOf(db: Db, items: { id: string; supplierId: string | null }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const i of items) if (i.supplierId) out.set(i.id, i.supplierId);
  const missing = items.filter((i) => !i.supplierId).map((i) => i.id);
  if (missing.length) {
    const last = await db.accInvoiceLine.findMany({
      where: { productId: { in: missing }, invoice: { type: "PURCHASE", status: "ISSUED" } },
      orderBy: [{ invoice: { date: "desc" } }, { invoice: { number: "desc" } }],
      distinct: ["productId"],
      select: { productId: true, invoice: { select: { partyId: true } } },
    });
    for (const l of last) if (l.productId) out.set(l.productId, l.invoice.partyId);
  }
  return out;
}

const specsOf = (raw: unknown): Record<string, string> => {
  const s = (raw as { specs?: unknown } | null)?.specs;
  return s && typeof s === "object" ? (s as Record<string, string>) : {};
};

/** گزینه‌های «بر اساس»: محورها و کلیدهای مشخصه‌ی مدل که واقعاً هستند */
export async function salesDims(db: Db) {
  const [axes, models] = await Promise.all([
    db.accAxis.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.accItemModel.findMany({ select: { specs: true }, take: 20_000 }),
  ]);
  const count = new Map<string, number>();
  for (const m of models) for (const [k, v] of Object.entries(specsOf(m.specs))) if (typeof v === "string" && v.trim()) count.set(k, (count.get(k) ?? 0) + 1);
  const specs = [...count].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k]) => k);
  return { axes, specs };
}
