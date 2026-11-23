/**
 * بن کارت فروشگاه — docs/plans/webhesab-parity.md بخش ۲۷.
 *
 * مانده‌ی هر بن بدهی فروشگاه به دارنده‌اش است (حساب سیستمی `GIFT_LIABILITY`، بی تفصیلی).
 *
 *   فروش    بدهکار خریدار (AR) = مبلغ − تخفیف · بدهکار تخفیفات فروش = تخفیف · بستانکار بن = مبلغ
 *           «اکنون پرداخت شد» ← دریافت عادی از همان خریدار (AR را صاف می‌کند)
 *   خرج     روش پرداخت `STORE_GIFT` در دریافت رسید صندوق ← بدهکار بن (cash/docs.ts)
 *   برگشت   مرجوعی رسیدی که با بن پرداخت شده: سهم بن به همان بن‌ها برمی‌گردد (tickets.ts)
 *   مرجوع   خریدار بن خرج‌نشده را پس می‌دهد ← معکوس فروش
 *   سوخت    مانده‌ی بن یک‌بارمصرف بعد از خرج، یا بن منقضی ← بدهکار بن · بستانکار سایر درآمدها
 *
 * ⚠️ `balance` همیشه = Σ `AccGiftTx.amount`؛ هر تغییر از همین فایل و با قفل ردیف بن.
 */

import type { AccGiftCard, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "./errors";
import { postVoucher, voidVoucher, type Actor, type LineInput } from "./ledger/post";
import { createAccount } from "./ledger/accounts";
import { createMoneyDoc } from "./cash/docs";
import { walkInParty } from "./parties";
import { todayKey } from "./dates";
import { faNum, formatAmount } from "./money";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const GIFT_KEY = "GIFT_LIABILITY";
const MAX_ISSUE = 2000;

/** حساب «بن کارت فروخته‌شده» — اگر سرفصل آن را ندارد، زیر «پیش‌دریافت‌ها» (۳۳) یا «بدهی‌های جاری» (۳) ساخته می‌شود */
export async function ensureGiftAccount(tx: Tx) {
  const hit = await tx.accAccount.findUnique({ where: { systemKey: GIFT_KEY } });
  if (hit) return hit;
  const parent =
    (await tx.accAccount.findFirst({ where: { code: "33", level: "LEDGER" } })) ??
    (await tx.accAccount.findFirst({ where: { class: "LIABILITY", level: "LEDGER" }, orderBy: { code: "asc" } }));
  if (!parent) throw new AccError("سرفصل بدهی‌ها پیدا نشد؛ حساب «بن کارت فروخته‌شده» را دستی زیر پیش‌دریافت‌ها بسازید");
  const acc = await createAccount(tx, { parentId: parent.id, name: "بن کارت فروخته‌شده" });
  return tx.accAccount.update({ where: { id: acc.id }, data: { systemKey: GIFT_KEY, nature: "CREDIT", detailKind: "NONE" } });
}

/** شماره‌ی یکدست: رقم فارسی ← لاتین، حروف بزرگ، بی فاصله و خط تیره */
export function normalizeGiftNumber(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

async function lockCard(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "AccGiftCard" WHERE id = ${id} FOR UPDATE`;
  return tx.accGiftCard.findUniqueOrThrow({ where: { id } });
}

async function addTx(tx: Tx, card: AccGiftCard, d: { kind: Prisma.AccGiftTxCreateInput["kind"]; amount: bigint; ticketId?: string | null; voucherId?: string | null; note?: string | null }, actor: Actor) {
  const balance = card.balance + d.amount;
  if (balance < 0n) throw new AccError(`مانده‌ی بن ${card.number} کافی نیست`);
  await tx.accGiftTx.create({ data: { cardId: card.id, kind: d.kind, amount: d.amount, ticketId: d.ticketId ?? null, voucherId: d.voucherId ?? null, note: d.note ?? null, actorName: actor.name } });
  const status = d.kind === "RETURN" ? "RETURNED" : balance === 0n ? "CLOSED" : "ACTIVE";
  return tx.accGiftCard.update({ where: { id: card.id }, data: { balance, status, closedAt: status === "ACTIVE" ? null : new Date() } });
}

// ───────────────────────── فروش (صدور) ─────────────────────────

export interface IssueInput {
  /** شماره‌دهی خودکار: تعداد و پیشوند */
  count?: number;
  prefix?: string;
  /** شماره‌دهی دستی (یا از اکسل): همین شماره‌ها */
  numbers?: string[];
  /** مبلغ اسمی هر بن */
  amount: bigint;
  /** تخفیف فروش هر بن (خریدار amount − این را می‌دهد) */
  saleDiscount: bigint;
  minInvoice: bigint;
  singleUse: boolean;
  expiresAt: Date | null;
  buyerPartyId: string | null;
  batch: string | null;
  note: string | null;
  /** «اکنون پرداخت شد» — به همین خزانه */
  pay?: { treasuryId: string; method: "CASH" | "POS" | "BANK_TRANSFER" | "CARD_TRANSFER" } | null;
}

export async function issueGiftCards(tx: Tx, input: IssueInput, actor: Actor) {
  if (input.amount <= 0n) throw new AccError("مبلغ بن را بنویسید");
  if (input.saleDiscount < 0n || input.saleDiscount >= input.amount) throw new AccError("تخفیف فروش بن باید کمتر از مبلغ آن باشد");
  if (input.minInvoice < 0n) throw new AccError("حداقل خرید منفی نمی‌شود");
  const today = todayKey();
  if (input.expiresAt && input.expiresAt < today) throw new AccError("تاریخ انقضا گذشته است");

  // ── شماره‌ها ──
  let numbers: string[];
  if (input.numbers?.length) {
    numbers = [...new Set(input.numbers.map(normalizeGiftNumber).filter(Boolean))];
    if (numbers.length !== input.numbers.filter((n) => n.trim()).length) throw new AccError("شماره‌ی تکراری در فهرست هست");
    const bad = numbers.find((n) => !/^[A-Z0-9]{4,32}$/.test(n));
    if (bad) throw new AccError(`شماره‌ی «${bad}» نامعتبر است — ۴ تا ۳۲ حرف لاتین یا رقم`);
    const taken = await tx.accGiftCard.findMany({ where: { number: { in: numbers } }, select: { number: true }, take: 5 });
    if (taken.length) throw new AccError(`این شماره‌ها قبلاً صادر شده‌اند: ${taken.map((t) => t.number).join("، ")}`);
  } else {
    const count = input.count ?? 0;
    if (!Number.isInteger(count) || count < 1) throw new AccError("تعداد بن را بنویسید");
    if (count > MAX_ISSUE) throw new AccError(`هر بار حداکثر ${faNum(MAX_ISSUE)} بن`);
    const prefix = normalizeGiftNumber(input.prefix || "GC").replace(/[^A-Z0-9]/g, "").slice(0, 8) || "GC";
    if (/^\d/.test(prefix)) throw new AccError("پیشوند با حرف شروع شود (مثلاً GC) تا با بارکد کالا قاطی نشود");
    const set = new Set<string>();
    for (let guard = 0; set.size < count && guard < 50; guard++) {
      const want = Array.from({ length: count - set.size }, () => `${prefix}${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`).filter((n) => !set.has(n));
      const taken = new Set((await tx.accGiftCard.findMany({ where: { number: { in: want } }, select: { number: true } })).map((t) => t.number));
      for (const n of want) if (!taken.has(n)) set.add(n);
    }
    numbers = [...set].slice(0, count);
  }
  if (numbers.length > MAX_ISSUE) throw new AccError(`هر بار حداکثر ${faNum(MAX_ISSUE)} بن`);

  // ── خریدار ──
  let buyer = input.buyerPartyId ? await tx.accParty.findUnique({ where: { id: input.buyerPartyId } }) : null;
  if (input.buyerPartyId && !buyer) throw new AccError("خریدار پیدا نشد");
  if (buyer && !buyer.isActive) throw new AccError(`«${buyer.name}» غیرفعال است`);
  if (!buyer) {
    if (!input.pay) throw new AccError("بن بی خریدار باید همان لحظه پرداخت شود؛ خریدار را انتخاب کنید یا «اکنون پرداخت شد» را بزنید");
    buyer = await walkInParty(tx);
  }

  await ensureGiftAccount(tx);
  const n = BigInt(numbers.length);
  const face = input.amount * n;
  const disc = input.saleDiscount * n;
  const batch = input.batch?.trim() || null;
  const title = `فروش ${faNum(numbers.length)} بن کارت ${formatAmount(input.amount)} تومانی${batch ? ` — ${batch}` : ""}`;
  const lines: LineInput[] = [{ accountKey: "AR", partyId: buyer.id, debit: face - disc, description: title }];
  if (disc > 0n) lines.push({ accountKey: "SALES_DISCOUNT", debit: disc, description: "تخفیف فروش بن" });
  lines.push({ accountKey: GIFT_KEY, credit: face, description: numbers.length === 1 ? `بن ${numbers[0]}` : `بن ${numbers[0]} تا ${numbers[numbers.length - 1]}` });
  const v = await postVoucher(tx, { date: today, description: title, source: "GIFT", lines, actor });

  await tx.accGiftCard.createMany({
    data: numbers.map((number) => ({
      number,
      batch,
      amount: input.amount,
      balance: input.amount,
      saleDiscount: input.saleDiscount,
      minInvoice: input.minInvoice,
      singleUse: input.singleUse,
      expiresAt: input.expiresAt,
      buyerPartyId: buyer!.platformCode === "walk-in" ? null : buyer!.id,
      issueVoucherId: v.id,
      note: input.note,
      createdByName: actor.name,
    })),
  });
  const cards = await tx.accGiftCard.findMany({ where: { number: { in: numbers } }, select: { id: true, number: true } });
  await tx.accGiftTx.createMany({ data: cards.map((c) => ({ cardId: c.id, kind: "ISSUE" as const, amount: input.amount, voucherId: v.id, actorName: actor.name })) });

  let receiptId: string | null = null;
  if (input.pay) {
    const doc = await createMoneyDoc(
      tx,
      { kind: "RECEIPT", date: today, partyId: buyer.id, description: `${title} — دریافت`, items: [{ method: input.pay.method, treasuryId: input.pay.treasuryId, amount: face - disc }], allocations: [] },
      actor,
    );
    receiptId = doc.id;
  }
  return { count: cards.length, numbers: cards.map((c) => c.number).sort(), voucherId: v.id, receiptId, total: face - disc, batch };
}

// ───────────────────────── صندوق ─────────────────────────

export interface GiftBrief {
  number: string;
  balance: bigint;
  amount: bigint;
  minInvoice: bigint;
  singleUse: boolean;
  expiresAt: Date | null;
}

/** بن برای صندوق — خطا اگر قابل خرج نیست */
export async function giftForPos(db: Db, raw: string): Promise<GiftBrief | null> {
  const number = normalizeGiftNumber(raw);
  if (!number) return null;
  const c = await db.accGiftCard.findUnique({ where: { number } });
  if (!c) return null;
  usable(c);
  return { number: c.number, balance: c.balance, amount: c.amount, minInvoice: c.minInvoice, singleUse: c.singleUse, expiresAt: c.expiresAt };
}

function usable(c: AccGiftCard) {
  if (c.status === "RETURNED") throw new AccError(`بن ${c.number} مرجوع شده و اعتبار ندارد`);
  if (c.status === "CLOSED" || c.balance <= 0n) throw new AccError(`بن ${c.number} مانده ندارد`);
  if (c.expiresAt && c.expiresAt < todayKey()) throw new AccError(`بن ${c.number} منقضی شده است`);
}

/**
 * خرج بن‌ها در رسید صندوق. سند جدا ندارد — همان ردیف `STORE_GIFT` دریافت رسید بدهکار بن می‌شود.
 * بن یک‌بارمصرف: باقی‌مانده بعد از همین خرج سوخت می‌شود (سند «سایر درآمدها»).
 */
export async function spendGifts(tx: Tx, uses: { number: string; amount: bigint }[], ctx: { ticketId: string; saleTotal: bigint; note: string }, actor: Actor) {
  const seen = new Set<string>();
  let total = 0n;
  const forfeits: { card: AccGiftCard; amount: bigint }[] = [];
  for (const u of uses) {
    const number = normalizeGiftNumber(u.number);
    if (seen.has(number)) throw new AccError(`بن ${number} دو بار آمده`);
    seen.add(number);
    if (u.amount <= 0n) continue;
    const found = await tx.accGiftCard.findUnique({ where: { number }, select: { id: true } });
    if (!found) throw new AccError(`بن ${number} پیدا نشد`);
    let card = await lockCard(tx, found.id);
    usable(card);
    if (card.minInvoice > 0n && ctx.saleTotal < card.minInvoice) throw new AccError(`بن ${number} برای خرید ${formatAmount(card.minInvoice)} تومان به بالاست`);
    if (u.amount > card.balance) throw new AccError(`مانده‌ی بن ${number} ${formatAmount(card.balance)} تومان است`);
    card = await addTx(tx, card, { kind: "SPEND", amount: -u.amount, ticketId: ctx.ticketId, note: ctx.note }, actor);
    total += u.amount;
    if (card.singleUse && card.balance > 0n) forfeits.push({ card, amount: card.balance });
  }
  if (forfeits.length) await forfeit(tx, forfeits, `سوخت باقی‌مانده‌ی بن یک‌بارمصرف — ${ctx.note}`, actor, ctx.ticketId);
  return total;
}

/**
 * مرجوعی رسیدی که با بن پرداخت شده: `amount` به همان بن‌ها برمی‌گردد — اول به بنی که دیرتر خرج شد،
 * هر بن حداکثر به اندازه‌ای که در آن رسید خرج شده بود منهای برگشت‌های قبلی. بن برگشت‌خورده دوباره فعال می‌شود.
 */
export async function restoreGifts(tx: Tx, origTicketId: string, amount: bigint, ticketId: string, note: string, actor: Actor) {
  if (amount <= 0n) return 0n;
  const txs = await tx.accGiftTx.findMany({ where: { ticketId: origTicketId, kind: "SPEND" }, orderBy: { createdAt: "desc" } });
  const returns = await tx.accPosTicket.findMany({ where: { refTicketId: origTicketId, voidedAt: null }, select: { id: true } });
  const restoredBefore = await tx.accGiftTx.groupBy({ by: ["cardId"], where: { kind: "RESTORE", ticketId: { in: returns.map((r) => r.id) } }, _sum: { amount: true } });
  const back = new Map(restoredBefore.map((r) => [r.cardId, r._sum.amount ?? 0n]));
  let left = amount;
  for (const s of txs) {
    if (left <= 0n) break;
    const room = -s.amount - (back.get(s.cardId) ?? 0n);
    if (room <= 0n) continue;
    const put = room < left ? room : left;
    const card = await lockCard(tx, s.cardId);
    await addTx(tx, { ...card, status: "ACTIVE" }, { kind: "RESTORE", amount: put, ticketId, note }, actor);
    back.set(s.cardId, (back.get(s.cardId) ?? 0n) + put);
    left -= put;
  }
  return amount - left;
}

/**
 * ابطال رسید صندوق: هر گردش بن همین رسید (خرج، برگشت، سوخت باقی یک‌بارمصرف) معکوس می‌شود؛
 * سند سوخت باطل می‌شود. بن بسته‌ای که پول به آن برگشت دوباره فعال است.
 */
export async function undoTicketGifts(tx: Tx, ticketId: string, reason: string, actor: Actor) {
  const txs = await tx.accGiftTx.findMany({ where: { ticketId }, orderBy: { createdAt: "desc" } });
  const vouchers = new Set<string>();
  for (const g of txs) {
    if (g.amount === 0n) continue;
    const card = await lockCard(tx, g.cardId);
    const note = `ابطال رسید — ${reason}`;
    if (g.amount < 0n) await addTx(tx, { ...card, status: "ACTIVE" }, { kind: "RESTORE", amount: -g.amount, ticketId, note }, actor);
    else await addTx(tx, card, { kind: "SPEND", amount: -g.amount, ticketId, note }, actor);
    if (g.kind === "FORFEIT" && g.voucherId) vouchers.add(g.voucherId);
  }
  for (const v of vouchers) await voidVoucher(tx, v, `ابطال رسید صندوق: ${reason}`, actor, { fromSource: true });
  return txs.length;
}

async function forfeit(tx: Tx, items: { card: AccGiftCard; amount: bigint }[], title: string, actor: Actor, ticketId?: string) {
  const total = items.reduce((s, i) => s + i.amount, 0n);
  if (total <= 0n) return null;
  await ensureGiftAccount(tx);
  const v = await postVoucher(tx, {
    date: todayKey(),
    description: title,
    source: "GIFT",
    sourceId: ticketId ?? null,
    lines: [
      { accountKey: GIFT_KEY, debit: total, description: items.length === 1 ? `بن ${items[0].card.number}` : `${faNum(items.length)} بن` },
      { accountKey: "OTHER_INCOME", credit: total, description: "مانده‌ی سوخت‌شده‌ی بن کارت" },
    ],
    actor,
  });
  for (const i of items) {
    const card = await lockCard(tx, i.card.id);
    await addTx(tx, card, { kind: "FORFEIT", amount: -i.amount, ticketId, voucherId: v.id, note: title }, actor);
  }
  return v;
}

// ───────────────────────── مرجوع و سوخت ─────────────────────────

/** مرجوع بن‌های خرج‌نشده (مانده = مبلغ اسمی) — معکوس فروش؛ طلب از خریدار به همان نسبت کم می‌شود */
export async function returnGiftCards(tx: Tx, numbers: string[], note: string | null, actor: Actor) {
  const list = [...new Set(numbers.map(normalizeGiftNumber).filter(Boolean))];
  if (!list.length) throw new AccError("شماره‌ی بن‌ها را بنویسید");
  const cards = await tx.accGiftCard.findMany({ where: { number: { in: list } } });
  const missing = list.filter((n) => !cards.some((c) => c.number === n));
  if (missing.length) throw new AccError(`پیدا نشد: ${missing.slice(0, 5).join("، ")}`);
  const byBuyer = new Map<string, AccGiftCard[]>();
  for (const c of cards) {
    const locked = await lockCard(tx, c.id);
    if (locked.status !== "ACTIVE" || locked.balance !== locked.amount) throw new AccError(`بن ${c.number} خرج شده یا بسته است؛ فقط بن دست‌نخورده مرجوع می‌شود`);
    const key = locked.buyerPartyId ?? "_walk";
    byBuyer.set(key, [...(byBuyer.get(key) ?? []), locked]);
  }
  await ensureGiftAccount(tx);
  const vouchers: string[] = [];
  for (const [key, group] of byBuyer) {
    const party = key === "_walk" ? await walkInParty(tx) : await tx.accParty.findUniqueOrThrow({ where: { id: key } });
    const face = group.reduce((s, c) => s + c.amount, 0n);
    const disc = group.reduce((s, c) => s + c.saleDiscount, 0n);
    const title = `مرجوع ${faNum(group.length)} بن کارت — ${party.name}`;
    const lines: LineInput[] = [{ accountKey: GIFT_KEY, debit: face, description: group.length === 1 ? `بن ${group[0].number}` : `${faNum(group.length)} بن` }];
    lines.push({ accountKey: "AR", partyId: party.id, credit: face - disc, description: title });
    if (disc > 0n) lines.push({ accountKey: "SALES_DISCOUNT", credit: disc, description: "برگشت تخفیف فروش بن" });
    const v = await postVoucher(tx, { date: todayKey(), description: note ? `${title} — ${note}` : title, source: "GIFT", lines, actor });
    vouchers.push(v.id);
    for (const c of group) await addTx(tx, c, { kind: "RETURN", amount: -c.balance, voucherId: v.id, note }, actor);
  }
  return { count: cards.length, vouchers };
}

/** سوخت مانده‌ی بن‌های منقضی تا امروز ← «سایر درآمدها» (یک سند) */
export async function forfeitExpired(tx: Tx, actor: Actor) {
  const cards = await tx.accGiftCard.findMany({ where: { status: "ACTIVE", balance: { gt: 0n }, expiresAt: { lt: todayKey() } } });
  if (!cards.length) return { count: 0, amount: 0n, voucherId: null };
  const v = await forfeit(tx, cards.map((card) => ({ card, amount: card.balance })), `سوخت مانده‌ی ${faNum(cards.length)} بن کارت منقضی`, actor);
  return { count: cards.length, amount: cards.reduce((s, c) => s + c.balance, 0n), voucherId: v?.id ?? null };
}

// ───────────────────────── فهرست ─────────────────────────

export async function giftList(db: Db, f: { q?: string | null; status?: string | null; batch?: string | null; page?: number }) {
  const q = f.q ? normalizeGiftNumber(f.q) : "";
  const today = todayKey();
  const where: Prisma.AccGiftCardWhereInput = {
    ...(f.batch ? { batch: f.batch } : {}),
    ...(f.status === "active"
      ? { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gte: today } }] }
      : f.status === "expired"
        ? { status: "ACTIVE", expiresAt: { lt: today } }
        : f.status === "closed"
          ? { status: "CLOSED" }
          : f.status === "returned"
            ? { status: "RETURNED" }
            : {}),
    ...(q ? { OR: [{ number: { contains: q } }, { batch: { contains: f.q!.trim() } }, { buyer: { name: { contains: f.q!.trim() } } }] } : {}),
  };
  const page = Math.max(1, f.page ?? 1);
  const [rows, total, outstanding, expired, batches] = await Promise.all([
    db.accGiftCard.findMany({ where, orderBy: [{ createdAt: "desc" }, { number: "asc" }], skip: (page - 1) * 100, take: 100, include: { buyer: { select: { id: true, name: true } } } }),
    db.accGiftCard.count({ where }),
    db.accGiftCard.aggregate({ where: { status: "ACTIVE" }, _sum: { balance: true }, _count: true }),
    db.accGiftCard.aggregate({ where: { status: "ACTIVE", balance: { gt: 0n }, expiresAt: { lt: today } }, _sum: { balance: true }, _count: true }),
    db.accGiftCard.groupBy({ by: ["batch"], where: { batch: { not: null } }, _count: true, _sum: { amount: true, balance: true }, _min: { createdAt: true }, orderBy: { _min: { createdAt: "desc" } }, take: 30 }),
  ]);
  return {
    rows,
    total,
    page,
    outstanding: { count: outstanding._count, amount: outstanding._sum.balance ?? 0n },
    expired: { count: expired._count, amount: expired._sum.balance ?? 0n },
    batches: batches.map((b) => ({ batch: b.batch!, count: b._count, amount: b._sum.amount ?? 0n, balance: b._sum.balance ?? 0n, createdAt: b._min.createdAt })),
  };
}

export async function giftDetail(db: Db, number: string) {
  const card = await db.accGiftCard.findUnique({ where: { number: normalizeGiftNumber(number) }, include: { buyer: { select: { id: true, name: true } }, txs: { orderBy: { createdAt: "asc" } } } });
  if (!card) throw new AccError("بن پیدا نشد", 404);
  const tickets = await db.accPosTicket.findMany({ where: { id: { in: card.txs.map((t) => t.ticketId).filter((x): x is string => !!x) } }, select: { id: true, number: true, saleInvoiceId: true, returnInvoiceId: true } });
  const vouchers = await db.accVoucher.findMany({ where: { id: { in: [card.issueVoucherId, ...card.txs.map((t) => t.voucherId)].filter((x): x is string => !!x) } }, select: { id: true, number: true } });
  return { card, tickets, vouchers };
}
