/**
 * ورود و خروج دستی کالا با دلیل — docs/plans/webhesab-parity.md بخش ۷.
 *
 * هر سند یک جهت (IN/OUT)، یک دلیل (سرفصل طرف مقابل) و یک انبار دارد. کاردکس با
 * `ADJUST_IN`/`ADJUST_OUT` به بهای میانگین لحظه؛ سند حسابداری از همان حرکت‌ها ساخته و با
 * خرید تاریخ‌گذشته بازسازی می‌شود. اشتباه ← ابطال (پیش‌نویس ندارد).
 */

import type { AccMoveReason, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { assertPostable } from "../ledger/fiscal-year";
import { nextNumber } from "../ledger/sequence";
import { postVoucher, rebuildVoucher, voidVoucher, type Actor, type LineInput } from "../ledger/post";
import { applyMoves, assertAvailable, registerCostRebuilder, removeMoves } from "./stock";
import { exactItem, itemTitles, normalizeItemCode } from "./items";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export type Direction = "IN" | "OUT";
export const ADJUST_SOURCE = "AccStockAdjust";
/** `sourceId` سند حسابداری — انبارگردانی شناسه‌ی خالی دارد، این پیشوند */
export const adjustVoucherKey = (id: string) => `adjust:${id}`;

const DEFAULTS: { direction: Direction; name: string }[] = [
  { direction: "OUT", name: "مصرف داخلی" },
  { direction: "OUT", name: "ضایعات و خرابی" },
  { direction: "OUT", name: "هدیه و نمونه" },
  { direction: "OUT", name: "کسری" },
  { direction: "IN", name: "اضافی و پیداشده" },
  { direction: "IN", name: "هدیه‌ی دریافتی" },
];

// ── دلیل‌ها ───────────────────────────────────────────────────────────────

/** دلیل‌های پیش‌فرض — فقط وقتی هیچ دلیلی نیست؛ همه روی «کسری و اضافات انبار» */
export async function ensureReasons(tx: Tx): Promise<void> {
  if (await tx.accMoveReason.count()) return;
  const acc = await tx.accAccount.findUnique({ where: { systemKey: "INVENTORY_ADJUSTMENT" } });
  if (!acc) throw new AccError("حسابداری داخلی راه‌اندازی نشده؛ سرفصل «کسری و اضافات انبار» نیست", 409);
  await tx.accMoveReason.createMany({ data: DEFAULTS.map((d, i) => ({ ...d, accountId: acc.id, sortOrder: i })), skipDuplicates: true });
}

export async function listReasons(db: Db, includeInactive = false) {
  const reasons = await db.accMoveReason.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ direction: "desc" }, { sortOrder: "asc" }, { name: "asc" }] });
  const accounts = await db.accAccount.findMany({ where: { id: { in: [...new Set(reasons.map((r) => r.accountId))] } }, select: { id: true, code: true, name: true, detailKind: true } });
  const am = new Map(accounts.map((a) => [a.id, a]));
  return reasons.map((r) => ({ ...r, account: am.get(r.accountId) ?? null }));
}

async function assertReasonAccount(db: Db, accountId: string) {
  const a = await db.accAccount.findUnique({ where: { id: accountId } });
  if (!a || !a.isActive) throw new AccError("سرفصل پیدا نشد یا غیرفعال است");
  if (a.level !== "SUBLEDGER") throw new AccError("سرفصل باید معین باشد (نه گروه یا کل)");
  if (a.detailKind === "TREASURY") throw new AccError("سرفصل صندوق و بانک برای ورود و خروج کالا نمی‌شود — برای پول «دریافت» یا «پرداخت» ثبت کنید");
  if (a.systemKey === "INVENTORY") throw new AccError("طرف مقابل نمی‌تواند خود «موجودی کالا» باشد");
}

export async function saveReason(
  tx: Tx,
  id: string | null,
  input: { name?: string; direction?: Direction; accountId?: string; isActive?: boolean; sortOrder?: number },
  canAccount: boolean,
): Promise<AccMoveReason> {
  const cur = id ? await tx.accMoveReason.findUnique({ where: { id } }) : null;
  if (id && !cur) throw new AccError("دلیل پیدا نشد", 404);
  const name = input.name !== undefined ? input.name.trim() : cur?.name;
  if (!name) throw new AccError("نام دلیل را بنویسید");
  const direction = cur?.direction ?? (input.direction === "IN" ? "IN" : input.direction === "OUT" ? "OUT" : null);
  if (!direction) throw new AccError("ورود یا خروج بودن دلیل را انتخاب کنید");
  if (cur && input.direction && input.direction !== cur.direction) throw new AccError("جهت دلیل ثبت‌شده عوض نمی‌شود؛ دلیل تازه بسازید");

  let accountId = cur?.accountId;
  if (input.accountId && input.accountId !== cur?.accountId) {
    if (!canAccount) throw new AccError("عوض کردن سرفصل دلیل مجوز «تنظیمات حسابداری» می‌خواهد", 403);
    await assertReasonAccount(tx, input.accountId);
    accountId = input.accountId;
  }
  if (!accountId) {
    const def = await tx.accAccount.findUnique({ where: { systemKey: "INVENTORY_ADJUSTMENT" } });
    if (!def) throw new AccError("سرفصل «کسری و اضافات انبار» نیست؛ حسابداری را راه‌اندازی کنید", 409);
    accountId = def.id;
  }
  const dup = await tx.accMoveReason.findFirst({ where: { direction, name, ...(cur ? { id: { not: cur.id } } : {}) } });
  if (dup) throw new AccError(`دلیل «${name}» از قبل هست`, 409);
  const data = { name, accountId, ...(input.isActive !== undefined ? { isActive: input.isActive } : {}), ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}) };
  return cur ? tx.accMoveReason.update({ where: { id: cur.id }, data }) : tx.accMoveReason.create({ data: { ...data, direction } });
}

// ── سند ───────────────────────────────────────────────────────────────────

export interface AdjustInput {
  date: Date;
  direction: Direction;
  reasonId: string;
  warehouseId: string;
  partyId?: string | null;
  note?: string | null;
  lines: { productId: string; qty: number; note?: string | null }[];
}

export async function createAdjust(tx: Tx, input: AdjustInput, actor: Actor) {
  const year = await assertPostable(tx, input.date);
  const reason = await tx.accMoveReason.findUnique({ where: { id: input.reasonId } });
  if (!reason || !reason.isActive) throw new AccError("دلیل را انتخاب کنید");
  if (reason.direction !== input.direction) throw new AccError(`دلیل «${reason.name}» برای ${reason.direction === "IN" ? "ورود" : "خروج"} است`);
  const wh = await tx.accWarehouse.findUnique({ where: { id: input.warehouseId } });
  if (!wh?.isActive) throw new AccError("انبار پیدا نشد یا غیرفعال است");
  const account = await tx.accAccount.findUnique({ where: { id: reason.accountId } });
  if (!account) throw new AccError("سرفصل دلیل پیدا نشد", 409);
  if (account.detailKind === "PARTY" && !input.partyId) throw new AccError(`سرفصل «${account.name}» تفصیلی شخص دارد؛ شخص را انتخاب کنید`);
  if (input.partyId && !(await tx.accParty.findUnique({ where: { id: input.partyId }, select: { id: true } }))) throw new AccError("شخص پیدا نشد");

  // یک کالا چند بار ← جمع
  const sum = new Map<string, { qty: number; note: string | null }>();
  for (const l of input.lines) {
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new AccError("تعداد هر ردیف باید عدد صحیح مثبت باشد");
    const cur = sum.get(l.productId);
    sum.set(l.productId, { qty: (cur?.qty ?? 0) + l.qty, note: cur?.note ?? (l.note?.trim() || null) });
  }
  if (!sum.size) throw new AccError("دست‌کم یک کالا با تعداد وارد کنید");
  if (sum.size > 2000) throw new AccError("بیش از ۲۰۰۰ کالا در یک سند نمی‌شود");
  const titles = await itemTitles([...sum.keys()], tx);
  if (titles.size !== sum.size) throw new AccError("کالا پیدا نشد");
  if (input.direction === "OUT") await assertAvailable(tx, [...sum].map(([productId, l]) => ({ productId, qty: l.qty, title: titles.get(productId) })), wh.id, input.date, { where: "این انبار", verb: "خارج کرد" });

  const doc = await tx.accStockAdjust.create({
    data: {
      yearId: year.id,
      number: await nextNumber(tx, year.id, "adjust"),
      date: input.date,
      direction: input.direction,
      reasonId: reason.id,
      warehouseId: wh.id,
      partyId: input.partyId || null,
      note: input.note?.trim() || null,
      createdByName: actor.name,
      lines: { create: [...sum].map(([productId, l]) => ({ productId, qty: l.qty, note: l.note })) },
    },
    include: { lines: true },
  });
  await applyMoves(
    tx,
    doc.lines.map((l) => ({
      productId: l.productId,
      warehouseId: wh.id,
      date: doc.date,
      type: input.direction === "IN" ? ("ADJUST_IN" as const) : ("ADJUST_OUT" as const),
      qty: l.qty,
      sourceType: ADJUST_SOURCE,
      sourceId: doc.id,
      sourceLineId: l.id,
      note: reason.name,
    })),
    actor,
  );
  await buildAdjustVoucher(tx, doc.id, actor);
  return tx.accStockAdjust.findUniqueOrThrow({ where: { id: doc.id } });
}

export async function voidAdjust(tx: Tx, id: string, reason: string, actor: Actor) {
  const doc = await tx.accStockAdjust.findUnique({ where: { id }, include: { lines: true } });
  if (!doc) throw new AccError("سند پیدا نشد", 404);
  if (doc.status === "VOID") return doc;
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  // برگرداندن ورود یعنی خروج — کالا باید هنوز در انبار باشد
  if (doc.direction === "IN") {
    const titles = await itemTitles(doc.lines.map((l) => l.productId), tx);
    await assertAvailable(tx, doc.lines.map((l) => ({ productId: l.productId, qty: l.qty, title: titles.get(l.productId) })), doc.warehouseId, null, { where: "انبار", verb: "برگرداند (بخشی از آن خارج شده)" });
  }
  await removeMoves(tx, ADJUST_SOURCE, doc.id, actor);
  if (doc.voucherId) await voidVoucher(tx, doc.voucherId, `ابطال ${doc.direction === "IN" ? "ورود" : "خروج"} کالا: ${reason.trim()}`, actor, { fromSource: true });
  return tx.accStockAdjust.update({ where: { id }, data: { status: "VOID", voucherId: null, voidReason: `${reason.trim()} — ${actor.name}` } });
}

/** سند حسابداری از بهای کاردکس همان سند */
async function buildAdjustVoucher(tx: Tx, id: string, actor: Actor) {
  const doc = await tx.accStockAdjust.findUnique({ where: { id }, include: { reason: true } });
  if (!doc || doc.status !== "POSTED") return;
  const moves = await tx.accStockMove.findMany({ where: { sourceType: ADJUST_SOURCE, sourceId: id }, select: { totalCost: true } });
  const total = moves.reduce((s, m) => s + m.totalCost, 0n);
  const account = await tx.accAccount.findUnique({ where: { id: doc.reason.accountId }, select: { detailKind: true } });
  const desc = `${doc.direction === "IN" ? "ورود" : "خروج"} کالا — ${doc.reason.name}`;
  const other: LineInput = { accountId: doc.reason.accountId, partyId: account?.detailKind === "PARTY" ? doc.partyId : null, description: desc };
  const lines: LineInput[] =
    doc.direction === "OUT"
      ? [{ ...other, debit: total }, { accountKey: "INVENTORY", credit: total, description: desc }]
      : [{ accountKey: "INVENTORY", debit: total, description: desc }, { ...other, credit: total }];
  const input = { date: doc.date, description: `${desc} — شماره‌ی ${doc.number}${doc.note ? ` (${doc.note})` : ""}`, lines, actor };

  if (total <= 0n) {
    if (doc.voucherId) {
      await voidVoucher(tx, doc.voucherId, "ارزش کالاها صفر شد", actor, { fromSource: true });
      await tx.accStockAdjust.update({ where: { id }, data: { voucherId: null } });
    }
    return;
  }
  if (doc.voucherId) {
    const v = await rebuildVoucher(tx, doc.voucherId, input);
    if (v.id !== doc.voucherId) await tx.accStockAdjust.update({ where: { id }, data: { voucherId: v.id } });
  } else {
    const v = await postVoucher(tx, { ...input, source: "INVENTORY", sourceId: adjustVoucherKey(id) });
    await tx.accStockAdjust.update({ where: { id }, data: { voucherId: v.id } });
  }
}

registerCostRebuilder(ADJUST_SOURCE, (tx, id, actor) => buildAdjustVoucher(tx, id, actor));

// ── چسباندن از اکسل ─────────────────────────────────────────────────────────

/** ردیف‌های متن (کد، تعداد) ← کالا؛ کد ناشناخته و کد قبلی چندتنوعی جدا */
export async function resolveRows(db: Db, rows: { code: string; qty: number | null }[]) {
  const lines = new Map<string, number>();
  const unknown: string[] = [];
  const ambiguous: string[] = [];
  const invalid: string[] = [];
  const seen = new Map<string, string | "model" | null>();
  for (const r of rows.slice(0, 20_000)) {
    const qty = r.qty ?? 1;
    if (!Number.isInteger(qty) || qty <= 0) {
      invalid.push(r.code);
      continue;
    }
    const code = normalizeItemCode(r.code) ?? "";
    if (!seen.has(code)) {
      const legacy = await db.accLegacyItem.findUnique({ where: { code }, select: { itemId: true } });
      seen.set(code, legacy ? (legacy.itemId ?? "model") : await exactItem(code, db));
    }
    const hit = seen.get(code);
    if (hit === "model") ambiguous.push(r.code);
    else if (!hit) unknown.push(r.code);
    else lines.set(hit, (lines.get(hit) ?? 0) + qty);
  }
  const titles = await itemTitles([...lines.keys()], db);
  const codes = new Map((await db.accItem.findMany({ where: { id: { in: [...lines.keys()] } }, select: { id: true, code: true } })).map((i) => [i.id, i.code]));
  const uniq = (a: string[]) => [...new Set(a)];
  return {
    lines: [...lines].map(([productId, qty]) => ({ productId, qty, title: titles.get(productId) ?? "", code: codes.get(productId) ?? "" })),
    unknown: uniq(unknown),
    ambiguous: uniq(ambiguous),
    invalid: uniq(invalid),
  };
}
