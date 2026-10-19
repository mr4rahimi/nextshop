/**
 * گزارش فروش صندوق‌ها — docs/plans/inventory-items.md بخش ۱۳.
 * از رسیدهای صندوق (`AccPosTicket`) — به تفکیک صندوق، فروشنده، روز و ساعت (تهران).
 * پورسانت فروشنده فقط برآورد است (درصد روی فروش خالص) و سندی نمی‌خورد.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dayKey, dayValue } from "../dates";

const DAY_MS = 86_400_000;
const TEHRAN_OFFSET_MS = 3.5 * 3_600_000;

interface Agg {
  tickets: number;
  saleTotal: bigint;
  returnTotal: bigint;
  net: bigint;
  saleQty: number;
  returnQty: number;
  discount: bigint;
  cash: bigint;
  card: bigint;
  credit: bigint;
}

const zero = (): Agg => ({ tickets: 0, saleTotal: 0n, returnTotal: 0n, net: 0n, saleQty: 0, returnQty: 0, discount: 0n, cash: 0n, card: 0n, credit: 0n });

export async function posReport(opts: { from: Date; to: Date; terminalId?: string | null; sellerId?: string | null }, db: Prisma.TransactionClient | typeof prisma = prisma) {
  // روز تهران ← بازه‌ی لحظه‌ها
  const start = new Date(opts.from.getTime() - TEHRAN_OFFSET_MS);
  const end = new Date(opts.to.getTime() + DAY_MS - TEHRAN_OFFSET_MS);
  const [tickets, terminals, sellers] = await Promise.all([
    db.accPosTicket.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        ...(opts.terminalId ? { terminalId: opts.terminalId } : {}),
        ...(opts.sellerId ? { sellerId: opts.sellerId } : {}),
      },
      select: {
        terminalId: true, sellerId: true, sellerName: true, createdAt: true, kind: true,
        saleTotal: true, returnTotal: true, saleQty: true, returnQty: true, discount: true, cash: true, card: true, credit: true,
      },
    }),
    db.accPosTerminal.findMany({ select: { id: true, name: true }, orderBy: { code: "asc" } }),
    db.accPosSeller.findMany({ select: { id: true, name: true, code: true, commissionBp: true }, orderBy: { code: "asc" } }),
  ]);

  const total = zero();
  const byTerminal = new Map<string, Agg>();
  const bySeller = new Map<string, Agg>();
  const byDay = new Map<string, Agg>();
  const byHour = Array.from({ length: 24 }, zero);
  const add = (a: Agg, t: (typeof tickets)[number]) => {
    a.tickets++;
    a.saleTotal += t.saleTotal;
    a.returnTotal += t.returnTotal;
    a.net += t.saleTotal - t.returnTotal;
    a.saleQty += t.saleQty;
    a.returnQty += t.returnQty;
    a.discount += t.discount;
    a.cash += t.cash;
    a.card += t.card;
    a.credit += t.credit;
  };
  const bump = (m: Map<string, Agg>, k: string, t: (typeof tickets)[number]) => {
    const a = m.get(k) ?? zero();
    add(a, t);
    m.set(k, a);
  };
  for (const t of tickets) {
    add(total, t);
    bump(byTerminal, t.terminalId, t);
    bump(bySeller, t.sellerId ?? "", t);
    bump(byDay, dayValue(dayKey(t.createdAt)), t);
    const hour = Math.floor(((t.createdAt.getTime() + TEHRAN_OFFSET_MS) % DAY_MS) / 3_600_000);
    add(byHour[hour], t);
  }
  const sellerInfo = new Map(sellers.map((s) => [s.id, s]));
  const saleTickets = tickets.filter((t) => t.saleTotal > 0n).length;
  return {
    total: { ...total, avgBasket: saleTickets ? total.saleTotal / BigInt(saleTickets) : 0n },
    terminals: terminals.filter((t) => byTerminal.has(t.id)).map((t) => ({ id: t.id, name: t.name, ...byTerminal.get(t.id)! })),
    sellers: [...bySeller.entries()]
      .map(([id, a]) => {
        const s = sellerInfo.get(id);
        const name = s?.name ?? tickets.find((t) => (t.sellerId ?? "") === id)?.sellerName ?? "بی‌فروشنده";
        const commission = s && a.net > 0n ? (a.net * BigInt(s.commissionBp)) / 10_000n : 0n;
        return { id: id || null, name, code: s?.code ?? null, commissionBp: s?.commissionBp ?? 0, commission, ...a };
      })
      .sort((a, b) => (b.net > a.net ? 1 : b.net < a.net ? -1 : 0)),
    days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, a]) => ({ day, ...a })),
    hours: byHour.map((a, hour) => ({ hour, ...a })).filter((h) => h.tickets > 0),
  };
}
