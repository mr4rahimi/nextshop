/**
 * موجودی کالای اول دوره — docs/plans/accounting.md بخش ۸. انبارگردانی سال اول هم
 * اختلافش را از همین مسیر می‌نشاند (inventory-items.md بخش ۱۵).
 */

import type { Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { postVoucher, rebuildVoucher, voidVoucher, type Actor } from "../ledger/post";
import { hasCarriedOpening } from "../ledger/closing";
import { applyMoves, removeMoves } from "./stock";

type Tx = Prisma.TransactionClient;

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
  // کاردکس پیوسته است؛ موجودی سال بعد از بستن همان مانده‌ی کاردکس است
  if (await hasCarriedOpening(tx, yearId)) throw new AccError("موجودی کالای این سال از سال قبل ادامه دارد؛ موجودی اول دوره فقط برای سال اول است", 409);
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
