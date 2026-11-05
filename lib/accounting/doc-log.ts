/**
 * دفتر ابطال و ویرایش اسناد — docs/plans/webhesab-parity.md بخش ۱۵.
 *
 * هر تابع ابطال/ویرایش سند ثبت‌شده، داخل همان تراکنش `logDoc` را صدا می‌زند؛ ابطالی که برگردد
 * ردیفش هم برمی‌گردد. پیش‌نویس ثبت نمی‌شود (ویرایش پیش‌نویس ویرایش سند نیست).
 */

import type { Prisma } from "@prisma/client";
import { faNum, formatAmount } from "./money";
import { INVOICE_TYPE_LABELS } from "./invoices/calc";
import type { Actor } from "./ledger/post";

import type { Db } from "./reports/common";

type Tx = Prisma.TransactionClient;

export type DocType = "AccInvoice" | "AccMoneyDoc" | "AccVoucher" | "AccStockAdjust" | "AccTransfer" | "AccStockCount" | "AccInstallmentPlan" | "AccParty";

export interface DocChange {
  label: string;
  before: string;
  after: string;
}

export interface DocLogInput {
  docType: DocType;
  docId: string;
  kind?: string | null;
  number?: number | null;
  docDate: Date;
  partyName?: string | null;
  action: "EDIT" | "VOID";
  reason?: string | null;
  totalBefore?: bigint | null;
  totalAfter?: bigint | null;
  changes?: DocChange[];
}

export async function logDoc(tx: Tx, input: DocLogInput, actor: Actor): Promise<void> {
  await tx.accDocLog.create({
    data: {
      docType: input.docType,
      docId: input.docId,
      kind: input.kind ?? null,
      number: input.number ?? null,
      docDate: input.docDate,
      partyName: input.partyName ?? null,
      action: input.action,
      reason: input.reason?.trim() || null,
      totalBefore: input.totalBefore ?? null,
      totalAfter: input.totalAfter ?? null,
      changes: input.changes?.length ? (input.changes as unknown as Prisma.InputJsonValue) : undefined,
      actorId: actor.id ?? null,
      actorName: actor.name,
    },
  });
}

// ── نام و لینک ───────────────────────────────────────────────────────────

const MONEY_LABELS: Record<string, string> = {
  RECEIPT: "دریافت",
  PAYMENT: "پرداخت",
  TRANSFER: "انتقال وجه",
  EXPENSE: "هزینه",
  INCOME: "درآمد متفرقه",
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  AccInvoice: "فاکتور",
  AccMoneyDoc: "دریافت و پرداخت",
  AccVoucher: "سند دستی",
  AccStockAdjust: "ورود و خروج کالا",
  AccTransfer: "حواله",
  AccStockCount: "انبارگردانی",
  AccInstallmentPlan: "برنامه‌ی اقساط",
  AccParty: "ادغام اشخاص",
};

export function docLabel(r: { docType: string; kind: string | null; number: number | null }): string {
  const n = r.number != null ? ` ${faNum(r.number)}` : "";
  switch (r.docType) {
    case "AccInvoice":
      return `${INVOICE_TYPE_LABELS[r.kind as keyof typeof INVOICE_TYPE_LABELS] ?? "فاکتور"}${n}`;
    case "AccMoneyDoc":
      return `${MONEY_LABELS[r.kind ?? ""] ?? "دریافت/پرداخت"}${n}`;
    case "AccVoucher":
      return `سند${n}`;
    case "AccStockAdjust":
      return `${r.kind === "IN" ? "ورود" : "خروج"} کالا${n}`;
    case "AccTransfer":
      return `حواله${n}`;
    case "AccStockCount":
      return `انبارگردانی${n}`;
    case "AccInstallmentPlan":
      return `اقساط فاکتور${n}`;
    case "AccParty":
      return `ادغام در شخص${n}`;
  }
  return r.docType;
}

export function docHref(r: { docType: string; docId: string }): string {
  const base = "/admin/accounting";
  switch (r.docType) {
    case "AccInvoice":
      return `${base}/invoices/${r.docId}`;
    case "AccMoneyDoc":
      return `${base}/money/${r.docId}`;
    case "AccVoucher":
      return `${base}/vouchers/${r.docId}`;
    case "AccStockAdjust":
      return `${base}/inventory/adjustments/${r.docId}`;
    case "AccTransfer":
      return `${base}/inventory/transfers?id=${r.docId}`;
    case "AccStockCount":
      return `${base}/inventory/counts/${r.docId}`;
    case "AccInstallmentPlan":
      return `${base}/invoices/${r.docId}`;
    case "AccParty":
      return `${base}/parties/${r.docId}`;
  }
  return base;
}

// ── گزارش ────────────────────────────────────────────────────────────────

export interface DocLogFilter {
  action: "VOID" | "EDIT";
  from?: Date | null;
  to?: Date | null;
  docType?: string | null;
  actor?: string | null;
  q?: string | null;
}

/**
 * ابطال: هر ردیف یک ابطال. ویرایش: هر سند یک ردیف با تعداد ویرایش، آخرین ویرایش و کاربرها
 * (مثل «ویرایش‌شده‌ها»ی وب حساب)؛ `?docId` ← ریز ویرایش‌های همان سند.
 */
export async function docLogReport(db: Db, f: DocLogFilter) {
  const end = f.to ? new Date(f.to.getTime() + 86_400_000) : null;
  const where: Prisma.AccDocLogWhereInput = {
    action: f.action,
    ...(f.from || end ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(end ? { lt: end } : {}) } } : {}),
    ...(f.docType ? { docType: f.docType } : {}),
    ...(f.actor ? { actorName: f.actor } : {}),
    ...(f.q?.trim()
      ? {
          OR: [
            { partyName: { contains: f.q.trim(), mode: "insensitive" } },
            { reason: { contains: f.q.trim(), mode: "insensitive" } },
            ...(Number.isInteger(Number(f.q.trim())) ? [{ number: Number(f.q.trim()) }] : []),
          ],
        }
      : {}),
  };
  const [rows, byType, actors] = await Promise.all([
    db.accDocLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 2000 }),
    db.accDocLog.groupBy({ by: ["docType"], where: { ...where, docType: undefined }, _count: { _all: true } }),
    db.accDocLog.groupBy({ by: ["actorName"], where: { ...where, actorName: undefined }, _count: { _all: true }, orderBy: { actorName: "asc" } }),
  ]);
  const view = (r: (typeof rows)[number]) => ({
    id: r.id,
    docType: r.docType,
    docId: r.docId,
    label: docLabel(r),
    href: docHref(r),
    docDate: r.docDate,
    partyName: r.partyName,
    reason: r.reason,
    totalBefore: r.totalBefore,
    totalAfter: r.totalAfter,
    changes: (r.changes as DocChange[] | null) ?? [],
    actorName: r.actorName,
    approx: r.approx,
    at: r.createdAt,
  });

  const counts = {
    byType: Object.fromEntries(byType.map((b) => [b.docType, b._count._all])),
    actors: actors.map((a) => ({ name: a.actorName, count: a._count._all })),
  };
  if (f.action === "VOID") return { rows: rows.map(view), docs: null, counts };

  const docs = new Map<string, { key: string; first: ReturnType<typeof view>; edits: number; actors: string[]; items: ReturnType<typeof view>[] }>();
  for (const r of rows) {
    const key = `${r.docType}|${r.docId}`;
    const d = docs.get(key);
    const v = view(r);
    if (!d) docs.set(key, { key, first: v, edits: 1, actors: [r.actorName], items: [v] });
    else {
      d.edits++;
      d.items.push(v);
      if (!d.actors.includes(r.actorName)) d.actors.push(r.actorName);
    }
  }
  return { rows: null, docs: [...docs.values()].map((d) => ({ ...d.first, key: d.key, edits: d.edits, actors: d.actors, items: d.items })), counts };
}

/** یک خط مقایسه برای ویرایش — فقط وقتی عوض شده */
export function diff(label: string, before: unknown, after: unknown, fmt: (v: unknown) => string = (v) => String(v ?? "—")): DocChange | null {
  const a = fmt(before);
  const b = fmt(after);
  return a === b ? null : { label, before: a, after: b };
}

export const fmtAmount = (v: unknown) => (typeof v === "bigint" ? formatAmount(v) : String(v ?? "—"));
