import { AccError, toAmount } from "@/lib/accounting/errors";
import { parseDay } from "@/lib/accounting/dates";
import { toLatinDigits } from "@/lib/accounting/money";
import { can, type StaffAccess } from "@/lib/permissions";
import type { PoInput } from "@/lib/accounting/purchases/orders";
import { ORDER_KINDS, type OrderKind } from "@/lib/accounting/purchases/order-kind";

/**
 * فی و جمع سفارش — در خرید کارمند فقط-انبار تعداد را می‌بیند، نه قیمت خرید؛
 * قیمت سفارش فروش همان قیمت فروش است و پنهان نیست.
 */
export const seesPrice = (a: StaffAccess, kind: OrderKind = "PURCHASE") =>
  kind === "SALES" || can(a, "ACC_VIEW") || can(a, "ACC_PURCHASE") || can(a, "ACC_COST_VIEW");

interface Body {
  date?: string;
  dueDate?: string | null;
  partyId?: string;
  warehouseId?: string | null;
  supplierRef?: string | null;
  note?: string | null;
  lines?: { id?: string | null; productId?: string; qty?: unknown; unitPrice?: unknown; packSize?: unknown; note?: string | null }[];
}

export function poFromBody(b: Body, kind: OrderKind = "PURCHASE"): PoInput {
  const date = parseDay(b.date);
  if (!date) throw new AccError("تاریخ سفارش را انتخاب کنید");
  if (!b.partyId) throw new AccError(`${ORDER_KINDS[kind].party} را انتخاب کنید`);
  return {
    kind,
    date,
    dueDate: parseDay(b.dueDate) ?? null,
    partyId: b.partyId,
    warehouseId: b.warehouseId || null,
    supplierRef: b.supplierRef ?? null,
    note: b.note ?? null,
    lines: (b.lines ?? []).map((l) => ({
      id: l.id || null,
      productId: String(l.productId ?? ""),
      qty: Number(toLatinDigits(String(l.qty ?? ""))),
      unitPrice: toAmount(l.unitPrice, "فی"),
      packSize: l.packSize === undefined || l.packSize === null || l.packSize === "" ? null : Number(l.packSize) || null,
      note: l.note ?? null,
    })),
  };
}
