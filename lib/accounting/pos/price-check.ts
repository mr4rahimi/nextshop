/**
 * چک کردن قیمت (کیوسک) — docs/plans/webhesab-parity.md بخش ۹.
 *
 * همان اسکن صندوق (`scanCode`) بی‌سبد: کالا ← قیمت فروشگاه و موجودی انبار همین کیوسک، به‌علاوه‌ی
 * رنگ/سایزهای دیگر همان مدل در همین انبار. کد قبلی چندتنوعی ← جدول همان مدل. نمای کارمند
 * (`staff`) موجودی عددی، قیمت آنلاین و موجودی انبارهای دیگر را هم دارد؛ نمای مشتری فقط «هست/نیست».
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { onlinePricesOf, onlineRule } from "../inventory/online-price";
import { modelPick, scanCode, type ModelPick } from "./scan";
import type { PosItem } from "./setup";

type Db = Prisma.TransactionClient | typeof prisma;

export interface PriceCheckResult {
  kind: "item" | "model" | "list" | "none";
  /** کالای اسکن‌شده (فقط `item`) */
  item: PosItem | null;
  /** رنگ/سایزهای همان مدل در همین انبار (`item` با مدل چندکالایی، یا `model`) */
  pick: ModelPick | null;
  /** نتیجه‌ی جستجوی متنی */
  items: PosItem[];
  /** فقط کارمند: قیمت آنلاین هر کالا (وقتی قیمت آنلاین از فروشگاه روشن است) */
  online: Record<string, bigint>;
  /** فقط کارمند: موجودی انبارهای دیگر هر کالا (غیرصفر) */
  elsewhere: Record<string, { warehouseId: string; name: string; qty: number }[]>;
}

/** انبار کیوسک: انبار فعال داده‌شده، وگرنه پیش‌فرض */
export async function kioskWarehouse(id: string | null | undefined, db: Db = prisma) {
  const w = id
    ? await db.accWarehouse.findFirst({ where: { id, isActive: true }, select: { id: true, name: true } })
    : await db.accWarehouse.findFirst({ where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { code: "asc" }], select: { id: true, name: true } });
  if (!w) throw new AccError(id ? "انبار کیوسک پیدا نشد یا غیرفعال است" : "هنوز انباری تعریف نشده", 404);
  return w;
}

export async function priceCheck(raw: string, warehouseId: string, opts: { staff: boolean }, db: Db = prisma): Promise<PriceCheckResult> {
  const out: PriceCheckResult = { kind: "none", item: null, pick: null, items: [], online: {}, elsewhere: {} };
  const scan = await scanCode(raw, warehouseId, db);
  if (scan.kind === "item") {
    out.kind = "item";
    out.item = scan.item;
    if (scan.item.modelId) {
      const pick = await modelPick(db, scan.item.modelId, null, warehouseId);
      if (pick.items.length > 1) out.pick = pick;
    }
  } else if (scan.kind === "model") {
    out.kind = "model";
    out.pick = scan.pick;
  } else if (scan.kind === "list" && scan.items.length === 1) {
    return priceCheck(scan.items[0].code, warehouseId, opts, db);
  } else if (scan.kind === "list" && scan.items.length) {
    out.kind = "list";
    out.items = scan.items;
  }

  const all = [...(out.item ? [out.item] : []), ...(out.pick?.items ?? []), ...out.items];
  if (!opts.staff) {
    // مشتری عدد موجودی را نمی‌بیند — فقط هست (۱) یا نیست (۰)
    for (const i of all) i.stock = i.stock > 0 ? 1 : 0;
    return out;
  }
  const ids = [...new Set(all.map((i) => i.id))];
  if (!ids.length) return out;
  const rule = await onlineRule(db);
  const [online, stocks, warehouses] = await Promise.all([
    rule.enabled ? onlinePricesOf(db, ids, rule) : Promise.resolve(new Map<string, { price: bigint }>()),
    db.accStock.findMany({ where: { productId: { in: ids }, warehouseId: { not: warehouseId }, qty: { not: 0 } } }),
    db.accWarehouse.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  for (const [id, p] of online) out.online[id] = p.price;
  for (const w of warehouses)
    for (const s of stocks) if (s.warehouseId === w.id) (out.elsewhere[s.productId] ??= []).push({ warehouseId: w.id, name: w.name, qty: s.qty });
  return out;
}
