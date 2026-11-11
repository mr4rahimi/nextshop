/**
 * اعتبار باشگاه و کارت اشتراک — docs/plans/webhesab-parity.md بخش ۲۳.
 *
 * یک دفتر برای سایت و صندوق: `PointTransaction`. ارزش هر امتیاز = `pointRedeemRate`
 * تومان. کارت (`ClubCard`) فقط شناسه‌ی عضو است.
 */

import type { PointReason, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { replayLedger, pointsToToman, type LedgerState } from "./credit-calc";

type Db = Prisma.TransactionClient | typeof prisma;

export interface CreditSettings {
  posEnabled: boolean;
  enforceExpiry: boolean;
  rate: number;
  perToman: number;
  expiryDays: number;
}

export async function creditSettings(db: Db = prisma): Promise<CreditSettings> {
  const s = await db.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { clubCardPosEnabled: true, pointExpiryEnforced: true, pointRedeemRate: true, pointPerToman: true, pointExpiryDays: true },
  });
  return {
    posEnabled: s?.clubCardPosEnabled ?? false,
    enforceExpiry: s?.pointExpiryEnforced ?? false,
    rate: s?.pointRedeemRate ?? 1,
    perToman: s?.pointPerToman ?? 0,
    expiryDays: s?.pointExpiryDays ?? 0,
  };
}

export const expiryFrom = (s: CreditSettings, from = new Date()) => (s.expiryDays > 0 ? new Date(from.getTime() + s.expiryDays * 86_400_000) : null);

const ROW_SELECT = { id: true, amount: true, reason: true, refType: true, refId: true, expiresAt: true, createdAt: true } as const;

export async function ledgerState(db: Db, profileId: string, s?: CreditSettings, now = new Date()): Promise<LedgerState> {
  const settings = s ?? (await creditSettings(db));
  const rows = await db.pointTransaction.findMany({ where: { profileId }, select: ROW_SELECT });
  return replayLedger(rows, now, settings.enforceExpiry);
}

/** وضعیت چند عضو با یک کوئری (فهرست کارت‌ها و گزارش‌ها) */
export async function ledgerStates(db: Db, profileIds: string[], s: CreditSettings, now = new Date()) {
  const rows = profileIds.length ? await db.pointTransaction.findMany({ where: { profileId: { in: profileIds } }, select: { ...ROW_SELECT, profileId: true } }) : [];
  const by = new Map<string, typeof rows>();
  for (const r of rows) by.set(r.profileId, [...(by.get(r.profileId) ?? []), r]);
  return new Map(profileIds.map((id) => [id, replayLedger(by.get(id) ?? [], now, s.enforceExpiry)]));
}

/** قفل ردیف عضو تا دو صندوق (یا صندوق و سایت) هم‌زمان یک اعتبار را خرج نکنند */
export async function lockProfile(tx: Prisma.TransactionClient, profileId: string) {
  await tx.$queryRaw`SELECT id FROM "ClubProfile" WHERE id = ${profileId} FOR UPDATE`;
}

export async function addPoints(
  db: Db,
  input: { profileId: string; amount: number; reason: PointReason; refType: string; refId: string; note?: string | null; expiresAt?: Date | null; createdAt?: Date },
) {
  if (!input.amount) return null;
  return db.pointTransaction.create({
    data: {
      profileId: input.profileId,
      amount: input.amount,
      reason: input.reason,
      refType: input.refType,
      refId: input.refId,
      note: input.note ?? null,
      expiresAt: input.amount > 0 ? input.expiresAt ?? null : null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

/**
 * ثبت سوخت شارژهای منقضی (ردیف `EXPIRE` برای هر شارژ). فقط با «انقضا روشن».
 * تکرارش بی‌اثر است: شارژی که سوختش خورده دیگر مانده ندارد.
 */
export async function expireDuePoints(now = new Date()): Promise<{ profiles: number; points: number }> {
  const s = await creditSettings();
  if (!s.enforceExpiry) return { profiles: 0, points: 0 };
  const due = await prisma.pointTransaction.findMany({
    where: { amount: { gt: 0 }, expiresAt: { lte: now } },
    select: { profileId: true },
    distinct: ["profileId"],
  });
  let points = 0;
  for (const { profileId } of due) {
    points += await prisma.$transaction(async (tx) => {
      await lockProfile(tx, profileId);
      const st = await ledgerState(tx, profileId, s, now);
      let sum = 0;
      for (const lot of st.expiredUnposted) {
        await tx.pointTransaction.create({
          data: { profileId, amount: -lot.remaining, reason: "EXPIRE", refType: "lot", refId: lot.id, note: "سوخت اعتبار تاریخ‌گذشته", createdAt: lot.expiresAt ?? now },
        });
        sum += lot.remaining;
      }
      return sum;
    });
  }
  return { profiles: due.length, points };
}

export interface MemberBrief {
  profileId: string;
  userId: string;
  name: string;
  mobile: string;
  card: { id: string; number: string } | null;
  tier: { id: string; title: string; color: string | null; chargeBp: number | null; discountBp: number } | null;
  points: number;
  /** ارزش تومانی اعتبار قابل خرج */
  credit: bigint;
  nextExpiry: { at: Date; credit: bigint } | null;
}

export async function memberBrief(db: Db, profileId: string, s?: CreditSettings): Promise<MemberBrief | null> {
  const settings = s ?? (await creditSettings(db));
  const p = await db.clubProfile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      tier: { select: { id: true, title: true, color: true, cardChargeBp: true, posDiscountBp: true } },
      cards: { where: { isActive: true }, orderBy: { issuedAt: "desc" }, take: 1, select: { id: true, number: true } },
    },
  });
  if (!p) return null;
  const st = await ledgerState(db, profileId, settings);
  const first = st.live.find((l) => l.expiresAt);
  return {
    profileId: p.id,
    userId: p.user.id,
    name: [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || p.user.phone,
    mobile: p.user.phone,
    card: p.cards[0] ?? null,
    tier: p.tier ? { id: p.tier.id, title: p.tier.title, color: p.tier.color, chargeBp: p.tier.cardChargeBp, discountBp: p.tier.posDiscountBp } : null,
    points: st.balance,
    credit: pointsToToman(st.balance, settings.rate),
    nextExpiry: first?.expiresAt ? { at: first.expiresAt, credit: pointsToToman(first.remaining, settings.rate) } : null,
  };
}

/** عنوان فارسی هر ردیف دفتر برای کاربر و گزارش */
export function ledgerLabel(r: { reason: string; refType: string | null; note?: string | null }): string {
  switch (r.refType) {
    case "pos":
      return r.reason === "REDEEM" ? "پرداخت با کارت در فروشگاه" : "شارژ خرید از فروشگاه";
    case "pos_return_credit":
      return "برگشت اعتبار بابت مرجوعی";
    case "pos_return_earn":
      return "کسر شارژ بابت مرجوعی";
    case "card_import":
      return "انتقال مانده از نرم‌افزار قبلی";
    case "lot":
      return "سوخت اعتبار تاریخ‌گذشته";
    case "order":
      return r.reason === "REDEEM" ? "استفاده در خرید اینترنتی" : "شارژ خرید اینترنتی";
    case "order_refund":
      return "برگشت اعتبار سفارش لغوشده";
  }
  const map: Record<string, string> = {
    MANUAL: "شارژ یا کسر دستی",
    ADJUST: "اصلاح",
    SIGNUP: "هدیه‌ی عضویت",
    BIRTHDAY: "هدیه‌ی تولد",
    REFERRAL: "معرفی دوستان",
    REVIEW: "ثبت نظر",
    CONSENT: "عضویت پیامکی",
    PURCHASE: "شارژ خرید",
    REDEEM: "استفاده",
    EXPIRE: "سوخت",
  };
  return map[r.reason] ?? r.note ?? r.reason;
}

/**
 * اعتبار باشگاه برای کیف پول کاربر سایت. null = چیزی برای نشان دادن نیست
 * (نه کارت فعال دارد، نه اعتبار قابل خرج).
 */
export async function userClubCredit(userId: string, withHistory = false) {
  const p = await prisma.clubProfile.findUnique({
    where: { userId },
    select: { id: true, tier: { select: { title: true, color: true } }, cards: { where: { isActive: true }, orderBy: { issuedAt: "desc" }, take: 1, select: { number: true } } },
  });
  if (!p) return null;
  const [s, redeem] = await Promise.all([
    creditSettings(),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { pointRedeemEnabled: true } }),
  ]);
  const st = await ledgerState(prisma, p.id, s);
  const card = p.cards[0] ?? null;
  if (!card && !(redeem?.pointRedeemEnabled && st.balance > 0)) return null;
  const first = st.live.find((l) => l.expiresAt);
  const history = withHistory
    ? (await prisma.pointTransaction.findMany({ where: { profileId: p.id }, orderBy: { createdAt: "desc" }, take: 50 })).map((r) => ({
        id: r.id,
        label: ledgerLabel(r),
        amount: (r.amount < 0 ? -1n : 1n) * pointsToToman(Math.abs(r.amount), s.rate),
        createdAt: r.createdAt,
        expiresAt: r.amount > 0 ? r.expiresAt : null,
      }))
    : [];
  return {
    credit: pointsToToman(st.balance, s.rate),
    card: card ? `…${card.number.slice(-4)}` : null,
    tier: p.tier,
    /** در خرید اینترنتی هم خرج می‌شود */
    usableOnline: !!redeem?.pointRedeemEnabled,
    nextExpiry: first?.expiresAt && s.enforceExpiry ? { at: first.expiresAt, credit: pointsToToman(first.remaining, s.rate) } : null,
    history,
  };
}
