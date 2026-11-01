/**
 * حذف و فعال/غیرفعال دسته‌ای کالا — docs/plans/webhesab-parity.md بخش ۱۲.
 *
 * حذف واقعی فقط برای کالای **بی‌گردش**: نه کاردکس، نه فاکتور (حتی پیش‌نویس)، نه
 * حواله/انبارگردانی/ورود و خروج دستی، نه موجودی، نه محصول سایت، نه کد قبلی. کالای
 * گردش‌دار پاک نمی‌شود — غیرفعال می‌شود تا تاریخچه‌ی سندها سالم بماند.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { faNum } from "../money";
import { exactItem, normalizeItemCode } from "./items";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const RETIRE_MAX = 3000;

/** دلیل‌های «گردش دارد» — به ترتیب نمایش */
export const USE_LABEL = {
  moves: "کاردکس",
  invoices: "فاکتور",
  transfers: "حواله",
  adjusts: "ورود/خروج دستی",
  counts: "انبارگردانی",
  stock: "موجودی",
  product: "محصول سایت",
  legacy: "کد قبلی",
  relabel: "برچسب‌زنی",
} as const;
export type UseKey = keyof typeof USE_LABEL;

const ids = (rows: { productId?: string | null; itemId?: string | null; accItemId?: string | null; id?: string }[]) =>
  rows.map((r) => r.productId ?? r.itemId ?? r.accItemId ?? r.id ?? "");

/** کالاهای گردش‌دار ← دلیل‌ها؛ کالایی که در نقشه نیست بی‌گردش است */
export async function itemUses(db: Db, itemIds: string[]): Promise<Map<string, UseKey[]>> {
  const out = new Map<string, UseKey[]>();
  if (!itemIds.length) return out;
  const p = { productId: { in: itemIds } };
  const i = { itemId: { in: itemIds } };
  const found: Record<UseKey, string[]> = {
    moves: ids(await db.accStockMove.findMany({ where: p, select: { productId: true }, distinct: ["productId"] })),
    invoices: ids(await db.accInvoiceLine.findMany({ where: p, select: { productId: true }, distinct: ["productId"] })),
    transfers: ids(await db.accTransferLine.findMany({ where: p, select: { productId: true }, distinct: ["productId"] })),
    adjusts: ids(await db.accStockAdjustLine.findMany({ where: p, select: { productId: true }, distinct: ["productId"] })),
    counts: [
      ...ids(await db.accStockCountLine.findMany({ where: p, select: { productId: true }, distinct: ["productId"] })),
      ...ids(await db.accStockCountEntry.findMany({ where: p, select: { productId: true }, distinct: ["productId"] })),
    ],
    stock: [
      ...ids(await db.accStock.findMany({ where: { ...p, qty: { not: 0 } }, select: { productId: true }, distinct: ["productId"] })),
      ...ids(await db.accProductCost.findMany({ where: { ...p, qtyOnHand: { not: 0 } }, select: { productId: true } })),
    ],
    product: [
      ...ids(await db.product.findMany({ where: { id: { in: itemIds } }, select: { id: true } })),
      ...ids(await db.productVariant.findMany({ where: { accItemId: { in: itemIds } }, select: { accItemId: true } })),
    ],
    legacy: ids(await db.accLegacyItem.findMany({ where: i, select: { itemId: true } })),
    relabel: ids(await db.accRelabelLog.findMany({ where: i, select: { itemId: true }, distinct: ["itemId"] })),
  };
  for (const k of Object.keys(USE_LABEL) as UseKey[]) {
    for (const id of new Set(found[k])) {
      const r = out.get(id) ?? [];
      r.push(k);
      out.set(id, r);
    }
  }
  return out;
}

function checkIds(itemIds: string[]) {
  const uniq = [...new Set(itemIds.filter((x) => typeof x === "string" && x))];
  if (!uniq.length) throw new AccError("کالایی انتخاب نشده");
  if (uniq.length > RETIRE_MAX) throw new AccError(`حداکثر ${faNum(RETIRE_MAX)} کالا در یک بار`);
  return uniq;
}

export interface RetirePlan {
  /** پاک‌شدنی */
  free: { id: string; code: string; title: string }[];
  /** گردش‌دار — با «حذف» غیرفعال می‌شوند */
  used: { id: string; code: string; title: string; isActive: boolean; uses: UseKey[] }[];
  /** از انتخاب‌شده‌ها چند تا هنوز موجودی دارند (غیرفعال کردن موجودی را صفر نمی‌کند) */
  withStock: number;
  active: number;
  inactive: number;
}

/** پیش‌نمایش — بی‌نوشتن */
export async function planRetire(db: Db, itemIds: string[]): Promise<RetirePlan> {
  const uniq = checkIds(itemIds);
  const [items, uses] = await Promise.all([
    db.accItem.findMany({ where: { id: { in: uniq } }, select: { id: true, code: true, title: true, isActive: true }, orderBy: { code: "asc" } }),
    itemUses(db, uniq),
  ]);
  const plan: RetirePlan = { free: [], used: [], withStock: 0, active: 0, inactive: 0 };
  for (const it of items) {
    if (it.isActive) plan.active++;
    else plan.inactive++;
    const u = uses.get(it.id);
    if (u?.includes("stock")) plan.withStock++;
    if (u) plan.used.push({ ...it, uses: u });
    else plan.free.push({ id: it.id, code: it.code, title: it.title });
  }
  return plan;
}

export type RetireAction = "activate" | "deactivate" | "delete";

/**
 * `delete`: بی‌گردش‌ها پاک، گردش‌دارها غیرفعال (`strict` = اگر یکی گردش داشت هیچ کاری نکن —
 * دکمه‌ی حذف تک‌کالا). گردش دوباره داخل همین تراکنش سنجیده می‌شود، نه از پیش‌نمایش.
 */
export async function retireItems(tx: Tx, itemIds: string[], action: RetireAction, opts: { strict?: boolean } = {}) {
  const uniq = checkIds(itemIds);
  if (action !== "delete") {
    const r = await tx.accItem.updateMany({ where: { id: { in: uniq }, isActive: action !== "activate" }, data: { isActive: action === "activate" } });
    return { changed: r.count, deleted: 0, deactivated: action === "deactivate" ? r.count : 0, codes: [] as string[] };
  }
  const plan = await planRetire(tx, uniq);
  if (opts.strict && plan.used.length) {
    const u = plan.used[0];
    throw new AccError(`«${u.title}» گردش دارد (${u.uses.map((k) => USE_LABEL[k]).join("، ")}) و پاک نمی‌شود — غیرفعالش کنید`, 409);
  }
  const free = plan.free.map((f) => f.id);
  if (free.length) {
    // ردیف‌های صفرِ مانده از موجودی و بها — بی‌کلید خارجی‌اند
    await tx.accStock.deleteMany({ where: { productId: { in: free } } });
    await tx.accProductCost.deleteMany({ where: { productId: { in: free } } });
    await tx.accItem.deleteMany({ where: { id: { in: free } } });
  }
  const toDeactivate = plan.used.filter((u) => u.isActive).map((u) => u.id);
  if (toDeactivate.length) await tx.accItem.updateMany({ where: { id: { in: toDeactivate } }, data: { isActive: false } });
  return { changed: free.length + toDeactivate.length, deleted: free.length, deactivated: toDeactivate.length, codes: plan.free.map((f) => f.code) };
}

/**
 * فهرست کد (اکسل یا چسباندن) ← کالا. کد کالا، بارکد، کد قبلی؛ کد مدل یا کد قبلی
 * چندتنوعی ← **همه‌ی** تنوع‌ها، فعال و غیرفعال (برای فعال کردن دوباره هم به کار می‌رود).
 */
export async function resolveCodes(db: Db, codes: string[]) {
  const found = new Set<string>();
  const unknown: string[] = [];
  const expanded: { code: string; items: number }[] = [];
  const seen = new Set<string>();
  for (const raw of codes.slice(0, 20_000)) {
    const code = normalizeItemCode(raw);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const one = await exactItem(code, db);
    if (one) {
      found.add(one);
      continue;
    }
    const legacy = await db.accLegacyItem.findUnique({ where: { code }, select: { itemId: true, modelId: true } });
    if (legacy?.itemId) {
      found.add(legacy.itemId);
      continue;
    }
    const modelId = legacy ? legacy.modelId : (await db.accItemModel.findUnique({ where: { code }, select: { id: true } }))?.id;
    const many = modelId ? await db.accItem.findMany({ where: { modelId }, select: { id: true } }) : [];
    if (!many.length) unknown.push(raw.trim());
    else {
      expanded.push({ code: raw.trim(), items: many.length });
      for (const m of many) found.add(m.id);
    }
  }
  // exactItem محصول سایتِ بی‌کالا را هم پیدا می‌کند؛ فقط کالاهای واقعی
  const real = await db.accItem.findMany({ where: { id: { in: [...found] } }, select: { id: true } });
  if (real.length > RETIRE_MAX) throw new AccError(`حداکثر ${faNum(RETIRE_MAX)} کالا در یک بار — فایل را چند تکه کنید`);
  return { ids: real.map((r) => r.id), unknown, expanded };
}
