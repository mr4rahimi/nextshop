import { AccError, toAmount } from "@/lib/accounting/errors";
import type { ItemInput } from "@/lib/accounting/inventory/items";

/** بدنه‌ی فرم کالا → ورودی `createItem` / `updateItem`؛ فیلد نیامده دست نمی‌خورد */
export function parseItemInput(b: Record<string, unknown>): ItemInput {
  const out: ItemInput = {};
  if (b.code !== undefined) out.code = b.code === null ? null : String(b.code);
  if (b.title !== undefined) out.title = String(b.title ?? "");
  if (b.unit !== undefined) out.unit = b.unit === null ? null : String(b.unit);
  if (b.salePrice !== undefined) out.salePrice = b.salePrice === null || b.salePrice === "" ? null : toAmount(b.salePrice, "قیمت فروش");
  if (b.reorderPoint !== undefined) {
    if (b.reorderPoint === null || b.reorderPoint === "") out.reorderPoint = null;
    else {
      const n = Number(b.reorderPoint);
      if (!Number.isInteger(n) || n < 0) throw new AccError("نقطه‌ی سفارش باید عدد صحیح نامنفی باشد");
      out.reorderPoint = n;
    }
  }
  if (b.sellOnline !== undefined) out.sellOnline = !!b.sellOnline;
  if (b.isActive !== undefined) out.isActive = !!b.isActive;
  if (b.barcodes !== undefined) {
    if (!Array.isArray(b.barcodes)) throw new AccError("بارکدها نامعتبر است");
    out.barcodes = b.barcodes.map(String);
  }
  return out;
}
