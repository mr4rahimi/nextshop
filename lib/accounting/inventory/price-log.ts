/**
 * ثبت تاریخچه‌ی قیمت فروشگاه — جدا از `store-price.ts` تا `items.ts` (فرم کالا) بی‌چرخه
 * صدایش بزند. docs/plans/webhesab-parity.md بخش ۱۰.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "../ledger/post";
import { posItems } from "../pos/setup";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export type PriceSource = "FORM" | "BULK" | "EXCEL" | "UNDO";

/** قیمت فعلی فروشگاه: `raw` = `salePrice` خود کالا، `price` = آنچه صندوق می‌گیرد (۰ = بی‌قیمت) */
export async function storePrices(db: Db, ids: string[]): Promise<Map<string, { raw: bigint | null; price: bigint }>> {
  const out = new Map<string, { raw: bigint | null; price: bigint }>();
  for (let k = 0; k < ids.length; k += 2000) {
    const part = ids.slice(k, k + 2000);
    const [raws, pos] = await Promise.all([
      db.accItem.findMany({ where: { id: { in: part } }, select: { id: true, salePrice: true } }),
      posItems(part, null, db),
    ]);
    for (const r of raws) out.set(r.id, { raw: r.salePrice, price: pos.get(r.id)?.price ?? 0n });
  }
  return out;
}

/** ثبت تاریخچه — فقط ردیف‌هایی که واقعاً عوض شده‌اند */
export async function recordPriceChanges(
  tx: Tx,
  rows: { itemId: string; fromPrice: bigint; prevRaw: bigint | null; toPrice: bigint | null }[],
  ctx: { source: PriceSource; batchId?: string | null; actor: Actor },
) {
  const data = rows
    .filter((r) => r.prevRaw !== r.toPrice)
    .map((r) => ({ ...r, source: ctx.source, batchId: ctx.batchId ?? null, createdByName: ctx.actor.name }));
  for (let k = 0; k < data.length; k += 5000) await tx.accPriceChange.createMany({ data: data.slice(k, k + 5000) });
}
