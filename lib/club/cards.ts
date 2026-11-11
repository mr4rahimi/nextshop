/**
 * مدیریت کارت اشتراک — فهرست، گردش، صدور، شارژ دستی و ورود از نرم‌افزار قبلی.
 * docs/plans/webhesab-parity.md بخش ۲۳.
 */

import { prisma } from "@/lib/prisma";
import { upsertClubCustomer } from "./profile";
import { normalizePhone } from "./phone";
import { parseJalaliInput } from "./jalali";
import { creditSettings, expiryFrom, ledgerLabel, ledgerState, ledgerStates, lockProfile, type CreditSettings } from "./credit";
import { normalizeCardNumber, pointsToToman, tomanToPoints } from "./credit-calc";

export class CardError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const DAY = 86_400_000;
const nameOf = (u: { firstName: string | null; lastName: string | null; phone: string }) => [u.firstName, u.lastName].filter(Boolean).join(" ") || u.phone;

// ── فهرست ──────────────────────────────────────────────────────────

export interface CardListFilter {
  q?: string;
  tierId?: string;
  status?: "active" | "inactive" | "all";
  sort?: "credit" | "name" | "expiry" | "recent";
}

export async function listCards(f: CardListFilter) {
  const s = await creditSettings();
  const q = f.q?.trim();
  const number = q ? normalizeCardNumber(q) : "";
  const cards = await prisma.clubCard.findMany({
    where: {
      ...(f.status === "inactive" ? { isActive: false } : f.status === "all" ? {} : { isActive: true }),
      ...(f.tierId ? { profile: { tierId: f.tierId } } : {}),
      ...(q
        ? {
            OR: [
              ...(number ? [{ number: { contains: number } }] : []),
              { profile: { user: { phone: { contains: q.replace(/\D/g, "") || q } } } },
              { profile: { user: { firstName: { contains: q, mode: "insensitive" as const } } } },
              { profile: { user: { lastName: { contains: q, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    include: { profile: { select: { id: true, user: { select: { id: true, firstName: true, lastName: true, phone: true } }, tier: { select: { id: true, title: true, color: true } } } } },
    take: 5000,
  });
  const states = await ledgerStates(prisma, [...new Set(cards.map((c) => c.profileId))], s);
  const soon = Date.now() + 30 * DAY;
  const rows = cards.map((c) => {
    const st = states.get(c.profileId)!;
    const first = st.live.find((l) => l.expiresAt);
    const soonPts = st.live.filter((l) => l.expiresAt && l.expiresAt.getTime() <= soon).reduce((a, l) => a + l.remaining, 0);
    return {
      cardId: c.id,
      number: c.number,
      isActive: c.isActive,
      issuedAt: c.issuedAt,
      profileId: c.profileId,
      userId: c.profile.user.id,
      name: nameOf(c.profile.user),
      mobile: c.profile.user.phone,
      tier: c.profile.tier,
      credit: pointsToToman(st.balance, s.rate),
      negative: st.balance < 0,
      nextExpiry: first?.expiresAt ? { at: first.expiresAt, credit: pointsToToman(first.remaining, s.rate) } : null,
      expiringSoon: pointsToToman(soonPts, s.rate),
    };
  });
  const sort = f.sort ?? "credit";
  rows.sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name, "fa")
      : sort === "expiry"
        ? (a.nextExpiry?.at.getTime() ?? Infinity) - (b.nextExpiry?.at.getTime() ?? Infinity)
        : sort === "recent"
          ? b.issuedAt.getTime() - a.issuedAt.getTime()
          : Number(b.credit - a.credit),
  );
  const totals = {
    cards: rows.length,
    credit: rows.reduce((a, r) => a + (r.credit > 0n ? r.credit : 0n), 0n),
    expiringSoon: rows.reduce((a, r) => a + r.expiringSoon, 0n),
    negative: rows.filter((r) => r.negative).length,
  };
  return { settings: s, totals, rows: rows.slice(0, 500), truncated: rows.length > 500 };
}

// ── یک عضو: کارت‌ها، شارژهای باز، گردش ─────────────────────────────

export async function memberDetail(profileId: string) {
  const s = await creditSettings();
  const p = await prisma.clubProfile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      tier: { select: { id: true, title: true, color: true, cardChargeBp: true, posDiscountBp: true } },
      cards: { orderBy: { issuedAt: "desc" } },
    },
  });
  if (!p) throw new CardError("عضو پیدا نشد", 404);
  const [st, rows, party] = await Promise.all([
    ledgerState(prisma, profileId, s),
    prisma.pointTransaction.findMany({ where: { profileId }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.accParty.findFirst({ where: { OR: [{ userId: p.user.id }, { mobile: p.user.phone }] }, select: { id: true } }),
  ]);
  // جمع پیش‌رونده از قدیم به جدید (مثل «تراز امتیاز» وب حساب)
  let run = 0;
  const asc = [...rows].reverse().map((r) => {
    run += r.amount;
    return { r, run };
  });
  const tickets = await prisma.accPosTicket.findMany({
    where: { id: { in: rows.filter((r) => r.refType?.startsWith("pos") && r.refId).map((r) => r.refId!) } },
    select: { id: true, number: true, saleTotal: true, returnTotal: true, saleInvoiceId: true, returnInvoiceId: true },
  });
  const tk = new Map(tickets.map((t) => [t.id, t]));
  return {
    profileId: p.id,
    userId: p.user.id,
    name: nameOf(p.user),
    mobile: p.user.phone,
    partyId: party?.id ?? null,
    tier: p.tier,
    cards: p.cards,
    credit: pointsToToman(st.balance, s.rate),
    points: st.balance,
    rate: s.rate,
    enforceExpiry: s.enforceExpiry,
    lots: st.live.map((l) => ({ id: l.id, credit: pointsToToman(l.remaining, s.rate), of: pointsToToman(l.amount, s.rate), expiresAt: l.expiresAt, createdAt: l.createdAt })),
    expiredUnposted: pointsToToman(st.expiredUnposted.reduce((a, l) => a + l.remaining, 0), s.rate),
    ledger: asc.reverse().map(({ r, run }) => {
      const t = r.refType?.startsWith("pos") && r.refId ? tk.get(r.refId) : null;
      return {
        id: r.id,
        label: ledgerLabel(r),
        reason: r.reason,
        note: r.note,
        amount: (r.amount < 0 ? -1n : 1n) * pointsToToman(Math.abs(r.amount), s.rate),
        balance: (run < 0 ? -1n : 1n) * pointsToToman(Math.abs(run), s.rate),
        createdAt: r.createdAt,
        expiresAt: r.amount > 0 ? r.expiresAt : null,
        ticket: t ? { id: t.id, number: t.number, invoiceId: t.saleInvoiceId ?? t.returnInvoiceId, total: t.saleTotal || t.returnTotal } : null,
        orderId: (r.refType === "order" || r.refType === "order_refund") && r.refId ? r.refId : null,
      };
    }),
  };
}

// ── صدور و تغییر کارت ──────────────────────────────────────────────

export async function issueCard(input: { mobile: string; name?: string | null; number: string; tierId?: string | null; note?: string | null }) {
  const phone = normalizePhone(input.mobile);
  if (!phone) throw new CardError("شماره موبایل درست نیست");
  const number = normalizeCardNumber(input.number || phone);
  if (number.length < 4) throw new CardError("شماره‌ی کارت را بکشید یا بنویسید");
  const clash = await prisma.clubCard.findUnique({ where: { number }, include: { profile: { select: { user: { select: { phone: true } } } } } });
  if (clash && clash.profile.user.phone !== phone) throw new CardError(`این کارت به نام ${clash.profile.user.phone} ثبت شده است`);
  const { profileId, isNewUser } = await upsertClubCustomer({ phone, lastName: input.name?.trim() || null, source: "IN_STORE" });
  if (input.tierId) {
    const tier = await prisma.clubTier.findUnique({ where: { id: input.tierId }, select: { id: true } });
    if (!tier) throw new CardError("سطح پیدا نشد");
    await prisma.clubProfile.update({ where: { id: profileId }, data: { tierId: tier.id } });
  }
  const card = await prisma.$transaction(async (tx) => {
    // کارت تازه جای کارت قبلی (گم‌شده/عوض‌شده) را می‌گیرد
    await tx.clubCard.updateMany({ where: { profileId, isActive: true, NOT: { number } }, data: { isActive: false } });
    return clash
      ? tx.clubCard.update({ where: { id: clash.id }, data: { isActive: true, note: input.note ?? clash.note } })
      : tx.clubCard.create({ data: { number, profileId, note: input.note ?? null } });
  });
  return { card, profileId, isNewUser };
}

export async function setCardActive(cardId: string, isActive: boolean) {
  const card = await prisma.clubCard.findUnique({ where: { id: cardId } });
  if (!card) throw new CardError("کارت پیدا نشد", 404);
  return prisma.$transaction(async (tx) => {
    if (isActive) await tx.clubCard.updateMany({ where: { profileId: card.profileId, isActive: true, NOT: { id: card.id } }, data: { isActive: false } });
    return tx.clubCard.update({ where: { id: card.id }, data: { isActive } });
  });
}

/** شارژ یا کسر دستی (تومان؛ منفی = کسر). کسر از موجودی بیشتر نمی‌شود */
export async function adjustCredit(input: { profileId: string; amount: bigint; note: string; expiryDays?: number | null }, actorName: string) {
  if (!input.amount) throw new CardError("مبلغ را بنویسید");
  if (!input.note.trim()) throw new CardError("دلیل را بنویسید");
  const s = await creditSettings();
  return prisma.$transaction(async (tx) => {
    await lockProfile(tx, input.profileId);
    const st = await ledgerState(tx, input.profileId, s);
    const pts = tomanToPoints(input.amount < 0n ? -input.amount : input.amount, s.rate);
    if (input.amount < 0n && pts > st.balance) throw new CardError(`اعتبار فعلی ${pointsToToman(st.balance, s.rate).toLocaleString("fa-IR")} تومان است`);
    const now = new Date();
    const expiresAt = input.amount > 0n ? (input.expiryDays ? new Date(now.getTime() + input.expiryDays * DAY) : expiryFrom(s, now)) : null;
    return tx.pointTransaction.create({
      data: { profileId: input.profileId, amount: input.amount < 0n ? -pts : pts, reason: "MANUAL", refType: "manual", refId: now.toISOString(), note: `${input.note.trim()} — ${actorName}`, expiresAt },
    });
  });
}

// ── گردش و انقضا ───────────────────────────────────────────────────

export const MOVE_KINDS: Record<string, { label: string; match: (r: { reason: string; refType: string | null; amount: number }) => boolean }> = {
  earn: { label: "شارژ خرید", match: (r) => r.reason === "PURCHASE" },
  spend: { label: "پرداخت با کارت", match: (r) => r.reason === "REDEEM" },
  restore: { label: "برگشت اعتبار مرجوعی", match: (r) => r.refType === "pos_return_credit" || r.refType === "order_refund" },
  reverse: { label: "کسر شارژ مرجوعی", match: (r) => r.refType === "pos_return_earn" },
  expire: { label: "سوخت", match: (r) => r.reason === "EXPIRE" },
  import: { label: "انتقال از نرم‌افزار قبلی", match: (r) => r.refType === "card_import" },
  manual: { label: "شارژ/کسر دستی", match: (r) => r.refType === "manual" },
  other: { label: "هدیه و سایر", match: () => true },
};
const kindOf = (r: { reason: string; refType: string | null; amount: number }) => Object.entries(MOVE_KINDS).find(([, k]) => k.match(r))![0];

export async function movements(from: Date, to: Date, kind: string | null) {
  const s = await creditSettings();
  const rows = await prisma.pointTransaction.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "desc" },
    take: 20_000,
    include: { profile: { select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } } } },
  });
  const sums: Record<string, { label: string; count: number; amount: bigint }> = Object.fromEntries(Object.entries(MOVE_KINDS).map(([k, v]) => [k, { label: v.label, count: 0, amount: 0n }]));
  const toman = (n: number) => (n < 0 ? -1n : 1n) * pointsToToman(Math.abs(n), s.rate);
  const list = [];
  for (const r of rows) {
    const k = kindOf(r);
    sums[k].count++;
    sums[k].amount += toman(r.amount);
    if (!kind || kind === k) {
      if (list.length < 500) {
        list.push({ id: r.id, kind: k, label: ledgerLabel(r), amount: toman(r.amount), createdAt: r.createdAt, profileId: r.profile.id, name: nameOf(r.profile.user), mobile: r.profile.user.phone, refType: r.refType, refId: r.refId });
      }
    }
  }
  return { sums, rows: list, truncated: rows.length >= 20_000 };
}

/** شارژهایی که تا `days` روز دیگر منقضی می‌شوند، یا (`days < 0`) سوخته‌های بازه */
export async function expiring(days: number) {
  const s = await creditSettings();
  const until = new Date(Date.now() + days * DAY);
  const lotsDue = await prisma.pointTransaction.findMany({ where: { amount: { gt: 0 }, expiresAt: { lte: until, gt: new Date() } }, select: { profileId: true }, distinct: ["profileId"] });
  const ids = lotsDue.map((l) => l.profileId);
  const states = await ledgerStates(prisma, ids, s);
  const users = await prisma.clubProfile.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } } });
  const rows = users
    .map((u) => {
      const lots = states.get(u.id)!.live.filter((l) => l.expiresAt && l.expiresAt <= until);
      return { profileId: u.id, name: nameOf(u.user), mobile: u.user.phone, credit: pointsToToman(lots.reduce((a, l) => a + l.remaining, 0), s.rate), first: lots[0]?.expiresAt ?? null };
    })
    .filter((r) => r.credit > 0n)
    .sort((a, b) => (a.first?.getTime() ?? 0) - (b.first?.getTime() ?? 0));
  return { rows, total: rows.reduce((a, r) => a + r.credit, 0n), enforced: s.enforceExpiry };
}

// ── ورود از نرم‌افزار قبلی (اکسل/چسباندن) ─────────────────────────

const HEADERS: Record<string, string[]> = {
  number: ["شماره کارت", "کارت", "شماره کارت اشتراک", "card"],
  mobile: ["موبایل", "تلفن همراه", "شماره موبایل", "mobile"],
  name: ["نام", "نام مشتری", "مشتری", "صاحب کارت", "name"],
  tier: ["گروه", "سطح", "گروه امتیازدهی", "group", "tier"],
  amount: ["مانده", "مبلغ", "اعتبار", "مبلغ امتیاز", "مبلغ امتیاز (ریال)", "amount"],
  expiry: ["انقضا", "تاریخ انقضا", "تاریخ انقضاء", "تاریخ اعتبار", "اعتبار تا", "expiry"],
};
const norm = (h: string) => h.replace(/[‌\s_]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
const latin = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export interface ImportRow {
  line: number;
  number: string;
  mobile: string;
  name: string;
  tierId: string | null;
  tierTitle: string | null;
  amount: bigint;
  expiresAt: Date | null;
}

export async function parseImport(table: string[][], unit: "toman" | "rial") {
  const head = (table[0] ?? []).map((h) => norm(String(h ?? "")));
  const col = (k: string) => head.findIndex((h) => HEADERS[k].some((a) => norm(a) === h));
  const idx = Object.fromEntries(Object.keys(HEADERS).map((k) => [k, col(k)]));
  if (idx.mobile < 0) throw new CardError("ستون «موبایل» در سطر اول پیدا نشد");
  if (idx.number < 0) throw new CardError("ستون «شماره کارت» در سطر اول پیدا نشد");
  const tiers = await prisma.clubTier.findMany({ select: { id: true, title: true, slug: true } });
  const errors: { line: number; text: string }[] = [];
  const warnings: { line: number; text: string }[] = [];
  const rows: ImportRow[] = [];
  const now = Date.now();
  table.slice(1).forEach((raw, i) => {
    const line = i + 2;
    const v = (k: string) => (idx[k] >= 0 ? String(raw[idx[k]] ?? "").trim() : "");
    if (!raw.some((c) => String(c ?? "").trim())) return;
    const mobile = normalizePhone(latin(v("mobile")));
    if (!mobile) return errors.push({ line, text: `موبایل «${v("mobile")}» درست نیست` });
    const number = normalizeCardNumber(v("number"));
    if (number.length < 4) return errors.push({ line, text: "شماره‌ی کارت خالی است" });
    const tName = v("tier");
    const tier = tName ? tiers.find((t) => norm(t.title) === norm(tName) || t.slug === tName.toLowerCase()) : null;
    if (tName && !tier) return errors.push({ line, text: `سطح «${tName}» تعریف نشده — اول در «سطوح عضویت» بسازید` });
    const a = latin(v("amount")).replace(/[,،٬\s]/g, "");
    if (a && !/^-?\d+$/.test(a)) return errors.push({ line, text: `مبلغ «${v("amount")}» عدد نیست` });
    let amount = a ? BigInt(a) : 0n;
    if (unit === "rial") amount /= 10n;
    if (amount < 0n) return errors.push({ line, text: "مانده‌ی منفی وارد نمی‌شود" });
    const e = latin(v("expiry"));
    let expiresAt: Date | null = null;
    if (e) {
      expiresAt = parseJalaliInput(e);
      if (!expiresAt) return errors.push({ line, text: `تاریخ انقضای «${v("expiry")}» شمسی درست نیست` });
      expiresAt = new Date(expiresAt.getTime() + DAY - 1000); // تا پایان همان روز
      if (amount > 0n && expiresAt.getTime() <= now) {
        warnings.push({ line, text: "تاریخ انقضا گذشته — این مانده وارد نمی‌شود" });
        amount = 0n;
      }
    }
    rows.push({ line, number, mobile, name: v("name"), tierId: tier?.id ?? null, tierTitle: tier?.title ?? null, amount, expiresAt });
  });
  // یک کارت فقط یک موبایل
  const owner = new Map<string, string>();
  for (const r of rows) {
    const o = owner.get(r.number);
    if (o && o !== r.mobile) errors.push({ line: r.line, text: `کارت ${r.number} در فایل به دو موبایل داده شده` });
    owner.set(r.number, r.mobile);
  }
  const taken = await prisma.clubCard.findMany({ where: { number: { in: [...owner.keys()] } }, select: { number: true, profile: { select: { user: { select: { phone: true } } } } } });
  for (const t of taken) {
    if (t.profile.user.phone !== owner.get(t.number)) errors.push({ line: rows.find((r) => r.number === t.number)!.line, text: `کارت ${t.number} الان به نام ${t.profile.user.phone} است` });
  }
  const members = new Set(rows.map((r) => r.mobile));
  return {
    rows,
    errors,
    warnings,
    summary: { lines: rows.length, members: members.size, cards: owner.size, credit: rows.reduce((a, r) => a + r.amount, 0n) },
  };
}

/**
 * ثبت ورود. برای هر عضو، مانده‌های ورودِ قبلی (`card_import`) پاک و این‌ها جایشان
 * می‌نشیند — پس اجرای دوباره در روز قطع نرم‌افزار قبلی، مانده‌ی تازه را جایگزین می‌کند.
 */
export async function commitImport(rows: ImportRow[], s?: CreditSettings) {
  const settings = s ?? (await creditSettings());
  const by = new Map<string, ImportRow[]>();
  for (const r of rows) by.set(r.mobile, [...(by.get(r.mobile) ?? []), r]);
  let members = 0;
  let newUsers = 0;
  for (const [mobile, list] of by) {
    const first = list[0];
    const { profileId, isNewUser } = await upsertClubCustomer({ phone: mobile, lastName: list.find((r) => r.name)?.name || null, source: "IMPORT" });
    if (isNewUser) newUsers++;
    await prisma.$transaction(async (tx) => {
      await lockProfile(tx, profileId);
      const tierId = list.find((r) => r.tierId)?.tierId;
      if (tierId) await tx.clubProfile.update({ where: { id: profileId }, data: { tierId } });
      const numbers = [...new Set(list.map((r) => r.number))];
      const active = numbers[numbers.length - 1];
      for (const n of numbers) {
        await tx.clubCard.upsert({ where: { number: n }, create: { number: n, profileId, isActive: n === active, note: "انتقال از نرم‌افزار قبلی" }, update: { isActive: n === active } });
      }
      await tx.clubCard.updateMany({ where: { profileId, isActive: true, NOT: { number: active } }, data: { isActive: false } });
      await tx.pointTransaction.deleteMany({ where: { profileId, refType: "card_import" } });
      for (const r of list.filter((x) => x.amount > 0n)) {
        await tx.pointTransaction.create({
          data: { profileId, amount: tomanToPoints(r.amount, settings.rate), reason: "MANUAL", refType: "card_import", refId: first.number, note: "مانده از نرم‌افزار قبلی", expiresAt: r.expiresAt },
        });
      }
    });
    members++;
  }
  return { members, newUsers };
}
