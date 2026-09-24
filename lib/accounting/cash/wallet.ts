/**
 * کیف پول مشتریان در دفتر — docs/plans/accounting.md بخش ۵ و فاز ۶.
 *
 * موجودی کیف پول بدهی فروشگاه به مشتری است (`WALLET_LIABILITY` با تفصیلی شخص):
 * - پرداخت سفارش از کیف پول ← دریافت با روش «کیف پول» (`cash/channel.ts`).
 * - شارژ/کسر دستی ادمین ← رویداد `WALLET_ADJUSTED` و سند همین فایل. طرف دیگر
 *   سند «بابت» شارژ است: `credit` = طلب مشتری (استرداد، جبران وجه) روی حساب
 *   دریافتنی همان شخص؛ `gift` = هدیه و جبران به مشتری (هزینه).
 * - موجودی پیش از حسابداری داخلی ← مانده‌ی اول دوره (`walletOpeningLines`).
 *
 * ⚠️ تراکنش کیف پولی که `meta.orderId` دارد پرداخت سفارش است و از مسیر
 *    `Payment` ثبت می‌شود، نه اینجا — وگرنه دو بار کم می‌شود.
 */

import type { AccVoucher, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { dayKey } from "../dates";
import { accountByKey } from "../ledger/accounts";
import { postVoucher, type LineInput } from "../ledger/post";
import { formatAmount } from "../money";
import { partyForUser } from "../parties";
import { AUTO_ACTOR } from "../invoices/channel";

type Tx = Prisma.TransactionClient;

export type WalletPurpose = "credit" | "gift";
export const WALLET_PURPOSE_LABELS: Record<WalletPurpose, string> = {
  credit: "طلب مشتری (استرداد یا جبران وجه)",
  gift: "هدیه و جبران (هزینه‌ی فروشگاه)",
};

/** سند شارژ یا کسر دستی کیف پول — idempotent با منبع `WALLET` + شناسه‌ی تراکنش */
export async function voucherFromWalletTx(tx: Tx, walletTxId: string): Promise<AccVoucher | null> {
  const existing = await tx.accVoucher.findFirst({ where: { source: "WALLET", sourceId: walletTxId } });
  if (existing) return existing;
  const w = await tx.walletTransaction.findUnique({ where: { id: walletTxId } });
  if (!w) throw new AccError("تراکنش کیف پول پیدا نشد", 404);
  const meta = (w.meta ?? {}) as { orderId?: string; purpose?: string; byName?: string };
  if (w.amount === 0n || meta.orderId) return null;

  const party = await partyForUser(tx, w.userId);
  const purpose: WalletPurpose = meta.purpose === "gift" ? "gift" : "credit";
  const amount = w.amount > 0n ? w.amount : -w.amount;
  const counter: LineInput = purpose === "gift" ? { accountKey: "CUSTOMER_REWARD" } : { accountKey: "AR", partyId: party.id };
  const wallet: LineInput = { accountKey: "WALLET_LIABILITY", partyId: party.id };
  const lines: LineInput[] =
    w.amount > 0n
      ? [
          { ...counter, debit: amount, description: w.reason },
          { ...wallet, credit: amount, description: "شارژ کیف پول" },
        ]
      : [
          { ...wallet, debit: amount, description: "کسر از کیف پول" },
          { ...counter, credit: amount, description: w.reason },
        ];
  return postVoucher(tx, {
    date: dayKey(w.createdAt),
    description: `${w.amount > 0n ? "شارژ" : "کسر"} کیف پول ${party.name} — ${w.reason}`.slice(0, 500),
    source: "WALLET",
    sourceId: w.id,
    lines,
    actor: meta.byName ? { name: meta.byName } : AUTO_ACTOR,
  });
}

/**
 * مانده‌ی اول دوره‌ی کیف پول‌ها = موجودی امروز هر کاربر − آنچه از کیف پولش
 * بعد از راه‌اندازی در دفتر آمده. پس ذخیره‌ی دوباره‌ی اول دوره (حتی ماه‌ها بعد)
 * همان عدد را می‌سازد و شارژ/خرج‌های ثبت‌شده دو بار حساب نمی‌شوند.
 */
export async function walletOpeningLines(
  tx: Tx,
  openingVoucherId: string | null,
  opts: { preview?: boolean } = {},
): Promise<{ lines: LineInput[]; count: number; total: bigint }> {
  const acc = await accountByKey(tx, "WALLET_LIABILITY");
  const booked = await tx.accVoucherLine.groupBy({
    by: ["partyId"],
    where: { accountId: acc.id, isVoid: false, ...(openingVoucherId ? { voucherId: { not: openingVoucherId } } : {}) },
    _sum: { debit: true, credit: true },
  });
  const bookedParty = new Map(booked.filter((b) => b.partyId).map((b) => [b.partyId!, (b._sum.credit ?? 0n) - (b._sum.debit ?? 0n)]));
  const bookedUsers = bookedParty.size
    ? await tx.accParty.findMany({ where: { id: { in: [...bookedParty.keys()] }, userId: { not: null } }, select: { userId: true } })
    : [];
  const users = await tx.user.findMany({
    where: { OR: [{ walletBalance: { not: 0n } }, { id: { in: bookedUsers.map((p) => p.userId!) } }] },
    select: { id: true, walletBalance: true },
  });
  const partyOf = new Map(
    (await tx.accParty.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true, userId: true } })).map((p) => [p.userId!, p.id]),
  );

  const lines: LineInput[] = [];
  let total = 0n;
  for (const u of users) {
    const known = partyOf.get(u.id);
    const opening = u.walletBalance - (known ? bookedParty.get(known) ?? 0n : 0n);
    if (opening === 0n) continue;
    total += opening;
    // پیش‌نمایش شخص نمی‌سازد؛ ذخیره برای کاربری که هنوز شخص ندارد می‌سازد
    const partyId = known ?? (opts.preview ? "" : (await partyForUser(tx, u.id)).id);
    lines.push(
      opening > 0n
        ? { accountKey: "WALLET_LIABILITY", partyId, credit: opening, description: "موجودی کیف پول اول دوره" }
        : { accountKey: "WALLET_LIABILITY", partyId, debit: -opening, description: `کیف پول اول دوره (${formatAmount(opening)})` },
    );
  }
  return { lines, count: lines.length, total };
}
