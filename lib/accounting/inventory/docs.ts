/**
 * اسناد انبار — انبار و حواله. انبارگردانی در `counts.ts`، موجودی اول دوره در `opening.ts`
 * (هر دو از اینجا هم صادر می‌شوند تا ثبت بازساز سند انبارگردانی با هر بار بارگذاری همین فایل قطعی باشد).
 * docs/plans/accounting.md بخش ۸.
 *
 * هر کدام کاردکس را فقط از `applyMoves` / `removeMoves` تغییر می‌دهد و سند
 * حسابداری‌اش (اگر دارد) را بعد از بازسازی کاردکس از روی همان حرکت‌ها می‌سازد.
 */

import type { AccWarehouse, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { assertPostable } from "../ledger/fiscal-year";
import { GLOBAL_SEQ, nextNumber } from "../ledger/sequence";
import type { Actor } from "../ledger/post";
import { applyMoves, assertAvailable, removeMoves } from "./stock";
import { itemTitles } from "./items";

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
  const titles = await itemTitles(lines.map((l) => l.productId), tx);
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
  const titles = await itemTitles(t.lines.map((l) => l.productId), tx);
  await assertAvailable(tx, t.lines.map((l) => ({ productId: l.productId, qty: l.qty, title: titles.get(l.productId) })), t.toWarehouseId, null);
  await removeMoves(tx, "AccTransfer", t.id, actor);
  return tx.accTransfer.update({ where: { id }, data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` } });
}

// ── انبارگردانی و اول دوره — فایل‌های خودشان ─────────────────────────────

export { OPENING_INV_SOURCE, openingInvKey, saveOpeningInventory, type OpeningInvLine } from "./opening";
export { createCount, postCount, voidCount } from "./counts";
export { createAdjust, voidAdjust } from "./adjust";
