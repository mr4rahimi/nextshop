/**
 * کارت اشتراک در صندوق — docs/plans/webhesab-parity.md بخش ۲۳.
 *
 * شخص صندوق (`AccParty`) ← کاربر (`userId`، وگرنه هم‌موبایل) ← عضو باشگاه با کارت فعال.
 * بی کارت فعال، شارژ و خرج اعتبار در صندوق نیست (مثل وب حساب).
 */

import type { AccParty, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { partyForUser } from "../parties";
import { creditSettings, memberBrief, type CreditSettings, type MemberBrief } from "@/lib/club/credit";
import { normalizeCardNumber } from "@/lib/club/credit-calc";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export interface PosClub {
  profileId: string;
  tier: { pointRate: number; cardChargeBp: number | null; posDiscountBp: number } | null;
}

async function profileOfParty(db: Db, party: Pick<AccParty, "userId" | "mobile" | "platformCode">) {
  if (party.platformCode === "walk-in") return null;
  const userId =
    party.userId ?? (party.mobile ? (await db.user.findUnique({ where: { phone: party.mobile }, select: { id: true } }))?.id : null) ?? null;
  if (!userId) return null;
  return db.clubProfile.findUnique({
    where: { userId },
    select: { id: true, tier: { select: { pointRate: true, cardChargeBp: true, posDiscountBp: true } }, cards: { where: { isActive: true }, select: { id: true }, take: 1 } },
  });
}

/** عضو کارت‌دارِ این شخص در صندوق، یا null */
export async function posClubOf(db: Db, party: Pick<AccParty, "userId" | "mobile" | "platformCode">): Promise<PosClub | null> {
  const p = await profileOfParty(db, party);
  if (!p || !p.cards.length) return null;
  return { profileId: p.id, tier: p.tier };
}

export type PosMember = MemberBrief & { partyId: string; partyName: string };

/** برای نمایش در صندوق پس از انتخاب مشتری */
export async function posMemberForParty(partyId: string, s?: CreditSettings): Promise<PosMember | null> {
  const settings = s ?? (await creditSettings());
  if (!settings.posEnabled) return null;
  const party = await prisma.accParty.findUnique({ where: { id: partyId } });
  if (!party) return null;
  const p = await profileOfParty(prisma, party);
  if (!p) return null;
  const brief = await memberBrief(prisma, p.id, settings);
  return brief ? { ...brief, partyId: party.id, partyName: party.name } : null;
}

/** کارت اسکن‌شده ← عضو و شخص حسابداری‌اش (ساخته می‌شود اگر نبود). null = چنین کارتی نیست */
export async function posMemberByCard(raw: string): Promise<PosMember | null> {
  const number = normalizeCardNumber(raw);
  if (number.length < 4) return null;
  const settings = await creditSettings();
  if (!settings.posEnabled) return null;
  const card = await prisma.clubCard.findUnique({ where: { number }, include: { profile: { select: { id: true, userId: true } } } });
  if (!card) return null;
  if (!card.isActive) throw new AccError("این کارت اشتراک غیرفعال است");
  const party = await prisma.$transaction((tx) => partyForUser(tx, card.profile.userId));
  const brief = await memberBrief(prisma, card.profile.id, settings);
  return brief ? { ...brief, partyId: party.id, partyName: party.name } : null;
}
