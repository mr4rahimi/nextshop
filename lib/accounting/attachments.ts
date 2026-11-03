/**
 * پیوست مدارک به اسناد حسابداری — docs/plans/webhesab-parity.md بخش ۱۶.
 *
 * ⚠️ فایل‌ها خصوصی‌اند: زیر `ACC_FILES_DIR` (پیش‌فرض `storage/accounting` در ریشه‌ی پروژه)، نه `public/`.
 *    این پوشه در `EXCLUDES` استقرار است؛ بدون آن `rsync --delete` هر استقرار پیوست‌ها را پاک می‌کرد.
 * ⚠️ نوع فایل از **پسوند** تعیین می‌شود، نه از `file.type` مرورگر؛ فقط عکس و PDF درون مرورگر باز می‌شوند،
 *    بقیه دانلود — SVG و HTML اصلاً پذیرفته نمی‌شوند (اسکریپت درون صفحه‌ی پنل).
 */

import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import type { StaffAccess } from "@/lib/permissions";
import { canAny } from "@/lib/permissions";
import { isDemo, demoUploadProblem } from "@/lib/demo";
import { AccError } from "./errors";
import { faNum } from "./money";
import { INVOICE_TYPE_LABELS } from "./invoices/calc";
import type { Actor } from "./ledger/post";
import type { Db } from "./reports/common";

export type AttachDocType =
  | "AccInvoice"
  | "AccMoneyDoc"
  | "AccVoucher"
  | "AccStockAdjust"
  | "AccTransfer"
  | "AccStockCount"
  | "AccPurchaseOrder"
  | "AccCheque"
  | "AccParty";

/** مجوز دیدن و افزودن پیوست هر نوع سند — همان مجوزهای صفحه‌ی خود سند */
export const ATTACH_PERMS: Record<AttachDocType, { label: string; view: string[]; edit: string[] }> = {
  AccInvoice: { label: "فاکتور", view: ["ACC_VIEW", "ACC_SALES", "ACC_PURCHASE"], edit: ["ACC_SALES", "ACC_PURCHASE"] },
  AccMoneyDoc: { label: "دریافت و پرداخت", view: ["ACC_VIEW", "ACC_TREASURY", "ACC_EXPENSE"], edit: ["ACC_TREASURY", "ACC_EXPENSE"] },
  AccVoucher: { label: "سند حسابداری", view: ["ACC_VIEW", "ACC_VOUCHER"], edit: ["ACC_VOUCHER"] },
  AccStockAdjust: { label: "ورود و خروج کالا", view: ["ACC_VIEW", "ACC_INVENTORY"], edit: ["ACC_INVENTORY"] },
  AccTransfer: { label: "حواله", view: ["ACC_VIEW", "ACC_INVENTORY", "ACC_STOCK_RECEIVE"], edit: ["ACC_INVENTORY", "ACC_STOCK_RECEIVE"] },
  AccStockCount: { label: "انبارگردانی", view: ["ACC_VIEW", "ACC_INVENTORY", "ACC_STOCK_COUNT"], edit: ["ACC_INVENTORY", "ACC_STOCK_COUNT"] },
  AccPurchaseOrder: { label: "سفارش خرید", view: ["ACC_VIEW", "ACC_PURCHASE"], edit: ["ACC_PURCHASE"] },
  AccCheque: { label: "چک", view: ["ACC_VIEW", "ACC_CHEQUE", "ACC_TREASURY"], edit: ["ACC_CHEQUE", "ACC_TREASURY"] },
  AccParty: { label: "شخص", view: ["ACC_VIEW", "ACC_PARTY_MANAGE"], edit: ["ACC_PARTY_MANAGE"] },
};

export const ATTACH_TYPES = Object.keys(ATTACH_PERMS) as AttachDocType[];

export function isAttachType(t: unknown): t is AttachDocType {
  return typeof t === "string" && t in ATTACH_PERMS;
}

export function canView(access: StaffAccess | null, t: AttachDocType) {
  return canAny(access, ATTACH_PERMS[t].view);
}
export function canEdit(access: StaffAccess | null, t: AttachDocType) {
  return canAny(access, ATTACH_PERMS[t].edit);
}

// ── فایل ────────────────────────────────────────────────────────────────

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_PER_DOC = 30;

/** پسوند ← نوع؛ `inline` = در مرورگر باز شود */
const EXT: Record<string, { mime: string; inline: boolean }> = {
  ".jpg": { mime: "image/jpeg", inline: true },
  ".jpeg": { mime: "image/jpeg", inline: true },
  ".png": { mime: "image/png", inline: true },
  ".webp": { mime: "image/webp", inline: true },
  ".gif": { mime: "image/gif", inline: true },
  ".heic": { mime: "image/heic", inline: false },
  ".pdf": { mime: "application/pdf", inline: true },
  ".doc": { mime: "application/msword", inline: false },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false },
  ".xls": { mime: "application/vnd.ms-excel", inline: false },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false },
  ".csv": { mime: "text/csv", inline: false },
  ".txt": { mime: "text/plain", inline: false },
  ".zip": { mime: "application/zip", inline: false },
  ".rar": { mime: "application/vnd.rar", inline: false },
};

export const ACCEPT = Object.keys(EXT).join(",");

export function filesRoot(): string {
  return process.env.ACC_FILES_DIR || path.join(process.cwd(), "storage", "accounting");
}

function fullPath(rel: string): string {
  const root = path.resolve(filesRoot());
  const p = path.resolve(root, rel);
  // مسیر ذخیره‌شده همیشه از خود ماست؛ این فقط سد آخر است
  if (!p.startsWith(root + path.sep)) throw new AccError("مسیر فایل نامعتبر است", 400);
  return p;
}

export function fileKind(fileName: string) {
  return EXT[path.extname(fileName).toLowerCase()] ?? null;
}

// ── سند ─────────────────────────────────────────────────────────────────

export interface DocRef {
  label: string;
  href: string;
  partyName: string | null;
  date: Date | null;
}

const A = "/admin/accounting";
const MONEY: Record<string, string> = { RECEIPT: "دریافت", PAYMENT: "پرداخت", TRANSFER: "انتقال وجه", EXPENSE: "هزینه", INCOME: "درآمد" };

/** نام، لینک و طرف حساب چند سند با یک پرس‌وجو برای هر نوع — سند حذف‌شده در نتیجه نیست */
export async function resolveDocs(db: Db, refs: { docType: string; docId: string }[]): Promise<Map<string, DocRef>> {
  const out = new Map<string, DocRef>();
  const ids = (t: string) => [...new Set(refs.filter((r) => r.docType === t).map((r) => r.docId))];
  const set = (t: string, id: string, v: DocRef) => out.set(`${t}|${id}`, v);
  const n = (x: number | null | undefined) => (x != null ? ` ${faNum(x)}` : "");

  const [inv, money, vouchers, adjusts, transfers, counts, pos, cheques, parties] = await Promise.all([
    ids("AccInvoice").length ? db.accInvoice.findMany({ where: { id: { in: ids("AccInvoice") } }, select: { id: true, type: true, number: true, date: true, partyName: true } }) : [],
    ids("AccMoneyDoc").length ? db.accMoneyDoc.findMany({ where: { id: { in: ids("AccMoneyDoc") } }, select: { id: true, kind: true, number: true, date: true, party: { select: { name: true } } } }) : [],
    ids("AccVoucher").length ? db.accVoucher.findMany({ where: { id: { in: ids("AccVoucher") } }, select: { id: true, number: true, date: true, description: true } }) : [],
    ids("AccStockAdjust").length ? db.accStockAdjust.findMany({ where: { id: { in: ids("AccStockAdjust") } }, select: { id: true, direction: true, number: true, date: true } }) : [],
    ids("AccTransfer").length ? db.accTransfer.findMany({ where: { id: { in: ids("AccTransfer") } }, select: { id: true, number: true, date: true } }) : [],
    ids("AccStockCount").length ? db.accStockCount.findMany({ where: { id: { in: ids("AccStockCount") } }, select: { id: true, number: true, date: true } }) : [],
    ids("AccPurchaseOrder").length ? db.accPurchaseOrder.findMany({ where: { id: { in: ids("AccPurchaseOrder") } }, select: { id: true, number: true, date: true, party: { select: { name: true } } } }) : [],
    ids("AccCheque").length ? db.accCheque.findMany({ where: { id: { in: ids("AccCheque") } }, select: { id: true, serialNo: true, dueDate: true, party: { select: { name: true } } } }) : [],
    ids("AccParty").length ? db.accParty.findMany({ where: { id: { in: ids("AccParty") } }, select: { id: true, code: true, name: true } }) : [],
  ]);
  for (const r of inv) set("AccInvoice", r.id, { label: `${INVOICE_TYPE_LABELS[r.type]}${r.number != null ? n(r.number) : " (پیش‌نویس)"}`, href: `${A}/invoices/${r.id}`, partyName: r.partyName, date: r.date });
  for (const r of money) set("AccMoneyDoc", r.id, { label: `${MONEY[r.kind] ?? r.kind}${n(r.number)}`, href: `${A}/money/${r.id}`, partyName: r.party?.name ?? null, date: r.date });
  for (const r of vouchers) set("AccVoucher", r.id, { label: `سند${n(r.number)}`, href: `${A}/vouchers/${r.id}`, partyName: null, date: r.date });
  for (const r of adjusts) set("AccStockAdjust", r.id, { label: `${r.direction === "IN" ? "ورود" : "خروج"} کالا${n(r.number)}`, href: `${A}/inventory/adjustments/${r.id}`, partyName: null, date: r.date });
  for (const r of transfers) set("AccTransfer", r.id, { label: `حواله${n(r.number)}`, href: `${A}/inventory/transfers?id=${r.id}`, partyName: null, date: r.date });
  for (const r of counts) set("AccStockCount", r.id, { label: `انبارگردانی${n(r.number)}`, href: `${A}/inventory/counts/${r.id}`, partyName: null, date: r.date });
  for (const r of pos) set("AccPurchaseOrder", r.id, { label: `سفارش خرید${n(r.number)}`, href: `${A}/purchases/orders/${r.id}`, partyName: r.party?.name ?? null, date: r.date });
  for (const r of cheques) set("AccCheque", r.id, { label: `چک ${r.serialNo}`, href: `${A}/cheques/${r.id}`, partyName: r.party?.name ?? null, date: r.dueDate });
  for (const r of parties) set("AccParty", r.id, { label: `${r.name} (کد ${faNum(r.code)})`, href: `${A}/parties/${r.id}`, partyName: r.name, date: null });
  return out;
}

// ── نوشتن و خواندن ───────────────────────────────────────────────────────

export interface UploadFile {
  name: string;
  size: number;
  /** نوع اعلام‌شده‌ی مرورگر — فقط برای قاعده‌ی دمو */
  type: string;
  bytes: Buffer;
}

export async function addAttachment(db: Db, docType: AttachDocType, docId: string, file: UploadFile, title: string | null, actor: Actor) {
  if (!(await resolveDocs(db, [{ docType, docId }])).has(`${docType}|${docId}`)) throw new AccError("سند پیدا نشد", 404);
  const name = path.basename(file.name || "").trim().slice(0, 200);
  if (!name) throw new AccError("فایلی انتخاب نشده است");
  if (isDemo()) {
    const problem = demoUploadProblem(file);
    if (problem) throw new AccError(problem, 403);
  }
  const kind = fileKind(name);
  if (!kind) throw new AccError(`پسوند «${path.extname(name) || "بی‌پسوند"}» پذیرفته نمی‌شود؛ عکس (JPG، PNG، WebP)، PDF، Word، Excel، متن یا ZIP بفرستید`);
  if (!file.size || !file.bytes.length) throw new AccError("فایل خالی است");
  if (file.size > MAX_SIZE) throw new AccError(`حجم «${name}» ${(file.size / 1024 / 1024).toFixed(1)} مگابایت است؛ حداکثر ۱۰ مگابایت`);
  const count = await db.accAttachment.count({ where: { docType, docId, deletedAt: null } });
  if (count >= MAX_PER_DOC) throw new AccError(`هر سند حداکثر ${faNum(MAX_PER_DOC)} پیوست دارد`, 409);

  const now = new Date();
  const rel = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(12).toString("hex")}${path.extname(name).toLowerCase()}`;
  const full = fullPath(rel);
  await mkdir(path.dirname(full), { recursive: true });
  try {
    await writeFile(full, file.bytes, { flag: "wx" });
  } catch (e) {
    // خطای خام ← ۵۰۰ از accErrorResponse
    throw new Error(`[acc-attach] نوشتن فایل شکست خورد: ${(e as Error).message}`);
  }
  return db.accAttachment.create({
    data: {
      docType,
      docId,
      title: title?.trim().slice(0, 200) || null,
      fileName: name,
      mimeType: kind.mime,
      size: file.size,
      path: rel,
      uploadedById: actor.id ?? null,
      uploadedByName: actor.name,
    },
  });
}

export async function readAttachment(db: Db, id: string) {
  const a = await db.accAttachment.findUnique({ where: { id } });
  if (!a || a.deletedAt) throw new AccError("پیوست پیدا نشد", 404);
  let bytes: Buffer;
  try {
    bytes = await readFile(fullPath(a.path));
  } catch {
    throw new AccError("فایل این پیوست روی سرور نیست", 404);
  }
  return { a, bytes, inline: fileKind(a.fileName)?.inline ?? false };
}

export async function removeAttachment(db: Db, id: string, actor: Actor) {
  const a = await db.accAttachment.findUnique({ where: { id } });
  if (!a || a.deletedAt) throw new AccError("پیوست پیدا نشد", 404);
  return db.accAttachment.update({ where: { id }, data: { deletedAt: new Date(), deletedByName: actor.name } });
}

export async function renameAttachment(db: Db, id: string, title: string | null) {
  const a = await db.accAttachment.findUnique({ where: { id } });
  if (!a || a.deletedAt) throw new AccError("پیوست پیدا نشد", 404);
  return db.accAttachment.update({ where: { id }, data: { title: title?.trim().slice(0, 200) || null } });
}

function view(a: { id: string; docType: string; docId: string; title: string | null; fileName: string; mimeType: string; size: number; uploadedByName: string; createdAt: Date }) {
  return {
    id: a.id,
    docType: a.docType,
    docId: a.docId,
    title: a.title,
    fileName: a.fileName,
    mimeType: a.mimeType,
    size: a.size,
    image: a.mimeType.startsWith("image/") && a.mimeType !== "image/heic",
    url: `/api/admin/accounting/attachments/${a.id}`,
    uploadedByName: a.uploadedByName,
    createdAt: a.createdAt,
  };
}
export type AttachmentView = ReturnType<typeof view>;

export async function listAttachments(db: Db, docType: AttachDocType, docId: string) {
  const rows = await db.accAttachment.findMany({ where: { docType, docId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  return rows.map(view);
}

export async function countAttachments(db: Db, docType: AttachDocType, docIds: string[]): Promise<Map<string, number>> {
  if (!docIds.length) return new Map();
  const g = await db.accAttachment.groupBy({ by: ["docId"], where: { docType, docId: { in: docIds }, deletedAt: null }, _count: { _all: true } });
  return new Map(g.map((x) => [x.docId, x._count._all]));
}

export interface AttachFilter {
  types: AttachDocType[];
  docType?: string | null;
  from?: Date | null;
  to?: Date | null;
  q?: string | null;
  uploader?: string | null;
}

/** فهرست همه‌ی پیوست‌ها (صفحه‌ی «پیوست مدارک»، مثل «اسناد را پیوست کن» وب حساب) — فقط نوع‌هایی که کاربر می‌بیند */
export async function searchAttachments(db: Db, f: AttachFilter) {
  const types = f.docType && f.types.includes(f.docType as AttachDocType) ? [f.docType] : f.types;
  const end = f.to ? new Date(f.to.getTime() + 86_400_000) : null;
  const term = f.q?.trim();
  const where: Prisma.AccAttachmentWhereInput = {
    deletedAt: null,
    docType: { in: types },
    ...(f.from || end ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(end ? { lt: end } : {}) } } : {}),
    ...(f.uploader ? { uploadedByName: f.uploader } : {}),
    ...(term ? { OR: [{ title: { contains: term, mode: "insensitive" } }, { fileName: { contains: term, mode: "insensitive" } }] } : {}),
  };
  const [rows, byType, uploaders, totalSize] = await Promise.all([
    db.accAttachment.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    db.accAttachment.groupBy({ by: ["docType"], where: { ...where, docType: { in: f.types } }, _count: { _all: true } }),
    db.accAttachment.groupBy({ by: ["uploadedByName"], where: { ...where, uploadedByName: undefined }, _count: { _all: true }, orderBy: { uploadedByName: "asc" } }),
    db.accAttachment.aggregate({ where, _sum: { size: true }, _count: { _all: true } }),
  ]);
  const docs = await resolveDocs(db, rows);
  return {
    rows: rows.map((r) => {
      const d = docs.get(`${r.docType}|${r.docId}`);
      return { ...view(r), doc: d ?? { label: `${ATTACH_PERMS[r.docType as AttachDocType]?.label ?? r.docType} (حذف‌شده)`, href: null, partyName: null, date: null } };
    }),
    total: totalSize._count._all,
    totalSize: totalSize._sum.size ?? 0,
    counts: {
      byType: Object.fromEntries(byType.map((b) => [b.docType, b._count._all])),
      uploaders: uploaders.map((u) => ({ name: u.uploadedByName, count: u._count._all })),
    },
  };
}
