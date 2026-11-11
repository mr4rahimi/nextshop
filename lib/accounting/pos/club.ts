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
import { CardError, issueCard } from "@/lib/club/cards";
import { normalizePhone } from "@/lib/club/phone";

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

/** سطح‌هایی که در پنجره‌ی صدور صندوق دیده می‌شوند و سطح پیش‌فرض کارت تازه */
export async function posIssueOptions(manage: boolean) {
  const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { clubCardDefaultTierId: true } });
  const tiers = await prisma.clubTier.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true, color: true, cardChargeBp: true, posDiscountBp: true } });
  const def = tiers.find((t) => t.id === s?.clubCardDefaultTierId) ?? null;
  return { defaultTier: def, tiers: manage ? tiers : [] };
}

/**
 * صدور کارت در صندوق — webhesab-parity.md بخش ۲۳.
 * مشتریِ انتخاب‌شده (`partyId`) به همان کاربرِ موبایل وصل می‌شود تا شخص تکراری ساخته نشود.
 * صندوقدار فقط با سطح پیش‌فرض صادر می‌کند؛ مدیر صندوق (`manage`) سطح را انتخاب می‌کند.
 */
export async function posIssueCard(
  input: { number: string; mobile: string; name?: string | null; partyId?: string | null; tierId?: string | null },
  actor: { name: string; manage: boolean; terminal?: string | null },
): Promise<PosMember & { replaced: boolean; isNewUser: boolean }> {
  const settings = await creditSettings();
  if (!settings.posEnabled) throw new AccError("کارت اشتراک در صندوق خاموش است");
  const phone = normalizePhone(input.mobile);
  if (!phone) throw new AccError("شماره موبایل مشتری درست نیست");
  const number = normalizeCardNumber(input.number);
  if (number.length < 4) throw new AccError("کارت را روی کارت‌خوان بکشید یا شماره‌اش را بنویسید");

  const party = input.partyId ? await prisma.accParty.findUnique({ where: { id: input.partyId } }) : null;
  if (party?.platformCode === "walk-in") throw new AccError("برای «مشتری حضوری» کارت صادر نمی‌شود — مشتری را انتخاب کنید");
  if (party?.userId) {
    const u = await prisma.user.findUnique({ where: { id: party.userId }, select: { phone: true } });
    if (u && u.phone !== phone) throw new AccError(`موبایل این مشتری ${u.phone} است — کارت به همان شماره صادر می‌شود`);
  }

  const { defaultTier } = await posIssueOptions(actor.manage);
  let r: Awaited<ReturnType<typeof issueCard>>;
  try {
    r = await issueCard({
      mobile: phone,
      name: input.name?.trim() || party?.name || null,
      number,
      tierId: actor.manage ? input.tierId || null : null,
      firstCardTierId: defaultTier?.id ?? null,
      issuedBy: [actor.name, actor.terminal].filter(Boolean).join(" — ") || null,
    });
  } catch (e) {
    if (e instanceof CardError) throw new AccError(e.message, e.status === 404 ? 404 : 400);
    throw e;
  }

  const profile = await prisma.clubProfile.findUniqueOrThrow({ where: { id: r.profileId }, select: { userId: true } });
  // شخص انتخاب‌شده (بی کاربر) همین مشتری است: به کاربر وصلش کن، نه شخص تازه
  if (party && !party.userId && (!party.mobile || normalizePhone(party.mobile) === phone) && !(await prisma.accParty.findUnique({ where: { userId: profile.userId }, select: { id: true } }))) {
    await prisma.accParty.update({ where: { id: party.id }, data: { userId: profile.userId, isCustomer: true, mobile: party.mobile ?? phone } });
  }
  const p = await prisma.$transaction((tx) => partyForUser(tx, profile.userId));
  const brief = await memberBrief(prisma, r.profileId, settings);
  if (!brief) throw new AccError("عضو پیدا نشد", 404);
  return { ...brief, partyId: p.id, partyName: p.name, replaced: r.replaced, isNewUser: r.isNewUser };
}
