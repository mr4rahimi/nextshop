import { AccError, toAmount } from "@/lib/accounting/errors";
import { parseDay } from "@/lib/accounting/dates";
import { toLatinDigits } from "@/lib/accounting/money";
import { can, type StaffAccess } from "@/lib/permissions";
import type { PoInput } from "@/lib/accounting/purchases/orders";

export const VIEW = ["ACC_VIEW", "ACC_PURCHASE", "ACC_INVENTORY"] as const;

/** فی و جمع سفارش — کارمند فقط-انبار تعداد را می‌بیند، نه قیمت خرید */
export const seesPrice = (a: StaffAccess) => can(a, "ACC_VIEW") || can(a, "ACC_PURCHASE") || can(a, "ACC_COST_VIEW");

interface Body {
  date?: string;
  dueDate?: string | null;
  partyId?: string;
  warehouseId?: string | null;
  supplierRef?: string | null;
  note?: string | null;
  lines?: { id?: string | null; productId?: string; qty?: unknown; unitPrice?: unknown; note?: string | null }[];
}

export function poFromBody(b: Body): PoInput {
  const date = parseDay(b.date);
  if (!date) throw new AccError("تاریخ سفارش را انتخاب کنید");
  if (!b.partyId) throw new AccError("عرضه‌کننده را انتخاب کنید");
  return {
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
      note: l.note ?? null,
    })),
  };
}
