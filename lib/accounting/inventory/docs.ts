/**
 * اسناد انبار — انبار، حواله، انبارگردانی، موجودی اول دوره.
 * docs/plans/accounting.md بخش ۸.
 *
 * هر کدام کاردکس را فقط از `applyMoves` / `removeMoves` تغییر می‌دهد و سند
 * حسابداری‌اش (اگر دارد) را بعد از بازسازی کاردکس از روی همان حرکت‌ها می‌سازد.
 */

import type { AccWarehouse, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { assertPostable } from "../ledger/fiscal-year";
import { GLOBAL_SEQ, nextNumber } from "../ledger/sequence";
import { postVoucher, rebuildVoucher, voidVoucher, type Actor, type LineInput } from "../ledger/post";
import { applyMoves, assertAvailable, qtyAt, registerCostRebuilder, removeMoves } from "./stock";

type Tx = Prisma.TransactionClient;

// ── انبار ─────────────────────────────────────────────────────────────

export async function ensureDefaultWarehouse(tx: Tx): Promise<AccWarehouse> {
  const existing = await tx.accWarehouse.findFirst({ where: { isDefault: true } });
  if (existing) return existing;
  const any = await tx.accWarehouse.findFirst({ orderBy: { code: "asc" } });
  if (any) return tx.accWarehouse.update({ where: { id: any.id }, data: { isDefault: true } });
  const code = await nextNumber(tx, GLOBAL_SEQ, "warehouse", 1);
  return tx.accWarehouse.create({ data: { code, name: "انبار اصلی", sellable: true, isDefault: true } });
}

export interface WarehouseInput {
  name?: string;
  address?: string | null;
  sellable?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
}

export async function saveWarehouse(tx: Tx, id: string | null, input: WarehouseInput): Promise<AccWarehouse> {
  const current = id ? await tx.accWarehouse.findUnique({ where: { id } }) : null;
  if (id && !current) throw new AccError("انبار پیدا نشد", 404);
  const name = input.name !== undefined ? input.name.trim() : current?.name;
  if (!name) throw new AccError("نام انبار را بنویسید");

  if (current && input.isActive === false) {
    if (current.isDefault) throw new AccError("انبار پیش‌فرض غیرفعال نمی‌شود؛ اول انبار دیگری را پیش‌فرض کنید");
    const left = await tx.accStock.findFirst({ where: { warehouseId: current.id, qty: { not: 0 } } });
    if (left) throw new AccError("این انبار هنوز کالا دارد؛ اول با حواله خالی‌اش کنید");
  }
  // قابل فروش بودن، موجودی سایت را جابه‌جا می‌کند — با کالای داخلش عوض نمی‌شود
  if (current && input.sellable !== undefined && input.sellable !== current.sellable) {
    const left = await tx.accStock.findFirst({ where: { warehouseId: current.id, qty: { not: 0 } } });
    if (left) throw new AccError("این انبار کالا دارد؛ «قابل فروش در سایت» فقط برای انبار خالی عوض می‌شود");
  }

  const data = {
    name,
    ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
    ...(input.sellable !== undefined ? { sellable: input.sellable } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  };
  const saved = current
    ? await tx.accWarehouse.update({ where: { id: current.id }, data })
    : await tx.accWarehouse.create({ data: { ...data, code: await nextNumber(tx, GLOBAL_SEQ, "warehouse", 1) } });

  if (input.isDefault) {
    await tx.accWarehouse.updateMany({ where: { id: { not: saved.id } }, data: { isDefault: false } });
    return tx.accWarehouse.update({ where: { id: saved.id }, data: { isDefault: true, isActive: true } });
  }
  return saved;
}

// ── حواله‌ی انتقال ──────────────────────────────────────────────────────

export async function createTransfer(
  tx: Tx,
  input: { date: Date; fromWarehouseId: string; toWarehouseId: string; note?: string | null; lines: { productId: string; qty: number }[] },
  actor: Actor,
) {
  if (input.fromWarehouseId === input.toWarehouseId) throw new AccError("انبار مبدأ و مقصد یکی‌اند");
  const lines = input.lines.filter((l) => l.qty > 0);
  if (!lines.length) throw new AccError("دست‌کم یک کالا با تعداد وارد کنید");
  const year = await assertPostable(tx, input.date);
  const titles = new Map((await tx.product.findMany({ where: { id: { in: lines.map((l) => l.productId) } }, select: { id: true, title: true } })).map((p) => [p.id, p.title]));
  if (titles.size !== new Set(lines.map((l) => l.productId)).size) throw new AccError("کالا پیدا نشد");
  await assertAvailable(tx, lines.map((l) => ({ ...l, title: titles.get(l.productId) })), input.fromWarehouseId, input.date);

  const t = await tx.accTransfer.create({
    data: {
      yearId: year.id,
      number: await nextNumber(tx, year.id, "transfer"),
      date: input.date,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      note: input.note?.trim() || null,
      createdByName: actor.name,
      lines: { create: lines.map((l) => ({ productId: l.productId, qty: l.qty })) },
    },
    include: { lines: true },
  });
  await applyMoves(
    tx,
    t.lines.flatMap((l) => [
      { productId: l.productId, warehouseId: t.fromWarehouseId, date: t.date, type: "TRANSFER_OUT" as const, qty: l.qty, sourceType: "AccTransfer", sourceId: t.id, sourceLineId: l.id },
      { productId: l.productId, warehouseId: t.toWarehouseId, date: t.date, type: "TRANSFER_IN" as const, qty: l.qty, sourceType: "AccTransfer", sourceId: t.id, sourceLineId: l.id },
    ]),
    actor,
  );
  return t;
}

export async function voidTransfer(tx: Tx, id: string, reason: string, actor: Actor) {
  const t = await tx.accTransfer.findUnique({ where: { id }, include: { lines: true } });
  if (!t) throw new AccError("حواله پیدا نشد", 404);
  if (t.status === "VOID") return t;
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  // برگرداندن کالا به مبدأ یعنی خروج از مقصد — باید آنجا مانده باشد
  const titles = new Map((await tx.product.findMany({ where: { id: { in: t.lines.map((l) => l.productId) } }, select: { id: true, title: true } })).map((p) => [p.id, p.title]));
  await assertAvailable(tx, t.lines.map((l) => ({ productId: l.productId, qty: l.qty, title: titles.get(l.productId) })), t.toWarehouseId, null);
  await removeMoves(tx, "AccTransfer", t.id, actor);
  return tx.accTransfer.update({ where: { id }, data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` } });
}

// ── انبارگردانی ─────────────────────────────────────────────────────────

export async function createCount(tx: Tx, input: { date: Date; warehouseId: string; note?: string | null }, actor: Actor) {
  const year = await assertPostable(tx, input.date);
  const wh = await tx.accWarehouse.findUnique({ where: { id: input.warehouseId } });
  if (!wh?.isActive) throw new AccError("انبار پیدا نشد یا غیرفعال است");
  return tx.accStockCount.create({
    data: {
      yearId: year.id,
      number: await nextNumber(tx, year.id, "count"),
      date: input.date,
      warehouseId: input.warehouseId,
      note: input.note?.trim() || null,
      createdByName: actor.name,
    },
  });
}

/** شمارش ردیف‌ها — فقط در پیش‌نویس. `countedQty: null` ردیف را حذف می‌کند. */
export async function setCountLines(tx: Tx, countId: string, lines: { productId: string; countedQty: number | null }[]) {
  const c = await tx.accStockCount.findUnique({ where: { id: countId } });
  if (!c) throw new AccError("انبارگردانی پیدا نشد", 404);
  if (c.status !== "DRAFT") throw new AccError("انبارگردانی ثبت‌شده عوض نمی‌شود");
  for (const l of lines) {
    if (l.countedQty === null) {
      await tx.accStockCountLine.deleteMany({ where: { countId, productId: l.productId } });
      continue;
    }
    if (!Number.isInteger(l.countedQty) || l.countedQty < 0) throw new AccError("شمارش باید عدد صحیح نامنفی باشد");
    await tx.accStockCountLine.upsert({
      where: { countId_productId: { countId, productId: l.productId } },
      update: { countedQty: l.countedQty },
      create: { countId, productId: l.productId, countedQty: l.countedQty },
    });
  }
}

export async function postCount(tx: Tx, countId: string, actor: Actor) {
  const c = await tx.accStockCount.findUnique({ where: { id: countId }, include: { lines: true } });
  if (!c) throw new AccError("انبارگردانی پیدا نشد", 404);
  if (c.status !== "DRAFT") throw new AccError("این انبارگردانی قبلاً ثبت شده است");
  if (!c.lines.length) throw new AccError("هیچ کالایی شمرده نشده است");
  await assertPostable(tx, c.date);

  const moves = [];
  for (const l of c.lines) {
    const systemQty = await qtyAt(tx, l.productId, c.warehouseId, c.date);
    const diff = l.countedQty - systemQty;
    await tx.accStockCountLine.update({ where: { id: l.id }, data: { systemQty, diff } });
    if (diff !== 0) {
      moves.push({
        productId: l.productId,
        warehouseId: c.warehouseId,
        date: c.date,
        type: diff > 0 ? ("ADJUST_IN" as const) : ("ADJUST_OUT" as const),
        qty: Math.abs(diff),
        sourceType: "AccStockCount",
        sourceId: c.id,
        sourceLineId: l.id,
      });
    }
  }
  await applyMoves(tx, moves, actor);
  await tx.accStockCount.update({ where: { id: c.id }, data: { status: "POSTED", postedAt: new Date(), postedByName: actor.name } });
  await buildCountVoucher(tx, c.id, actor);
}

export async function voidCount(tx: Tx, countId: string, reason: string, actor: Actor) {
  const c = await tx.accStockCount.findUnique({ where: { id: countId } });
  if (!c) throw new AccError("انبارگردانی پیدا نشد", 404);
  if (c.status === "VOID") return;
  if (c.status === "DRAFT") {
    await tx.accStockCount.delete({ where: { id: countId } });
    return;
  }
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  await removeMoves(tx, "AccStockCount", c.id, actor);
  if (c.voucherId) await voidVoucher(tx, c.voucherId, `ابطال انبارگردانی: ${reason.trim()}`, actor, { fromSource: true });
  await tx.accStockCount.update({ where: { id: countId }, data: { status: "VOID", voucherId: null, voidReason: `${reason.trim()} — ${actor.name}` } });
}

/** سند انبارگردانی از روی بهای محاسبه‌شده‌ی حرکت‌ها — کسری و اضافی جدا */
async function buildCountVoucher(tx: Tx, countId: string, actor: Actor) {
  const c = await tx.accStockCount.findUnique({ where: { id: countId } });
  if (!c || c.status !== "POSTED") return;
  const moves = await tx.accStockMove.findMany({ where: { sourceType: "AccStockCount", sourceId: countId } });
  const shortage = moves.filter((m) => m.type === "ADJUST_OUT").reduce((s, m) => s + m.totalCost, 0n);
  const surplus = moves.filter((m) => m.type === "ADJUST_IN").reduce((s, m) => s + m.totalCost, 0n);

  const lines: LineInput[] = [];
  if (shortage > 0n) {
    lines.push({ accountKey: "INVENTORY_ADJUSTMENT", debit: shortage, description: "کسری انبار" });
    lines.push({ accountKey: "INVENTORY", credit: shortage, description: "کسری انبار" });
  }
  if (surplus > 0n) {
    lines.push({ accountKey: "INVENTORY", debit: surplus, description: "اضافی انبار" });
    lines.push({ accountKey: "INVENTORY_ADJUSTMENT", credit: surplus, description: "اضافی انبار" });
  }
  const input = { date: c.date, description: `انبارگردانی شماره‌ی ${c.number}`, lines, actor };

  if (!lines.length) {
    if (c.voucherId) {
      await voidVoucher(tx, c.voucherId, "اختلاف ارزشی نماند", actor, { fromSource: true });
      await tx.accStockCount.update({ where: { id: countId }, data: { voucherId: null } });
    }
    return;
  }
  if (c.voucherId) {
    const v = await rebuildVoucher(tx, c.voucherId, input);
    if (v.id !== c.voucherId) await tx.accStockCount.update({ where: { id: countId }, data: { voucherId: v.id } });
  } else {
    const v = await postVoucher(tx, { ...input, source: "INVENTORY", sourceId: countId });
    await tx.accStockCount.update({ where: { id: countId }, data: { voucherId: v.id } });
  }
}

registerCostRebuilder("AccStockCount", (tx, id, actor) => buildCountVoucher(tx, id, actor));

// ── موجودی اول دوره ─────────────────────────────────────────────────────

export const OPENING_INV_SOURCE = "OpeningInventory";
export const openingInvKey = (yearId: string) => `opening:${yearId}:inventory`;

export interface OpeningInvLine {
  productId: string;
  warehouseId: string;
  qty: number;
  unitCost: bigint;
}

/**
 * ذخیره‌ی موجودی اول دوره — حرکت‌های قبلی همین سال پاک و دوباره ساخته می‌شوند.
 * `Product.stock` برای کالاهای همین فهرست **مطلق** با جمع کاردکس یکی می‌شود
 * (تله‌ی ۱۵): اول دوره نقطه‌ی حقیقت است.
 */
export async function saveOpeningInventory(tx: Tx, yearId: string, lines: OpeningInvLine[], actor: Actor) {
  const year = await tx.accFiscalYear.findUnique({ where: { id: yearId } });
  if (!year) throw new AccError("سال مالی پیدا نشد", 404);
  const seen = new Set<string>();
  for (const l of lines) {
    const k = `${l.productId}|${l.warehouseId}`;
    if (seen.has(k)) throw new AccError("یک کالا در یک انبار دو بار آمده است");
    seen.add(k);
    if (!Number.isInteger(l.qty) || l.qty < 0) throw new AccError("تعداد باید عدد صحیح نامنفی باشد");
    if (l.unitCost < 0n) throw new AccError("بها منفی نمی‌شود");
  }
  const kept = lines.filter((l) => l.qty > 0);
  const sourceId = yearId;

  await removeMoves(tx, OPENING_INV_SOURCE, sourceId, actor, { absoluteShopStock: true });
  await applyMoves(
    tx,
    kept.map((l) => ({
      productId: l.productId,
      warehouseId: l.warehouseId,
      date: year.startDate,
      type: "OPENING" as const,
      qty: l.qty,
      unitCost: l.unitCost,
      sourceType: OPENING_INV_SOURCE,
      sourceId,
    })),
    actor,
    { absoluteShopStock: true },
  );

  const total = kept.reduce((s, l) => s + l.unitCost * BigInt(l.qty), 0n);
  const existing = await tx.accVoucher.findFirst({ where: { source: "OPENING", sourceId: openingInvKey(yearId), status: "POSTED" } });
  const input = {
    date: year.startDate,
    description: `موجودی کالای اول دوره‌ی سال ${year.title}`,
    lines: [
      { accountKey: "INVENTORY", debit: total, description: "موجودی کالای اول دوره" },
      { accountKey: "OPENING_BALANCE", credit: total, description: "تراز افتتاحیه" },
    ],
    actor,
  };
  if (total === 0n) {
    if (existing) await voidVoucher(tx, existing.id, "موجودی اول دوره پاک شد", actor, { fromSource: true });
    return null;
  }
  return existing
    ? rebuildVoucher(tx, existing.id, input)
    : postVoucher(tx, { ...input, source: "OPENING", sourceId: openingInvKey(yearId) });
}
