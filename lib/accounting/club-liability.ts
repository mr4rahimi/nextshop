/**
 * تعهد اعتبار باشگاه — docs/plans/webhesab-parity.md بخش ۳۴.۲.
 *
 * اعتبار کارت باشگاه (و امتیاز سایت) بدهی فروشگاه به مشتری است. پیش از «راه‌اندازی تعهد»
 * شارژ سند نداشت و خرجش «تخفیفات فروش» می‌شد (بخش ۲۳). بعد از راه‌اندازی:
 *
 *   شارژ خرید (کش‌بک)        بد «تخفیفات فروش»          / بس «اعتبار باشگاه مشتریان»
 *   هدیه، دستی، معرفی، تولد  بد «هدیه و جبران به مشتری» / بس همان
 *   انتقال از نرم‌افزار قبلی  بد «تراز افتتاحیه»          / بس همان
 *   برگشت خرج سفارش لغوشده   بد «تخفیفات فروش»          / بس همان   (خرج سایت در فاکتور تخفیف شده بود)
 *   هر کسر دیگر (سوخت، کسر شارژ مرجوعی، خرج سایت، کسر دستی)  بد «اعتبار باشگاه» / بس «تخفیفات فروش»
 *   خرج در صندوق            بد «اعتبار باشگاه» / بس حساب مشتری — در خود دریافت (`cash/docs.ts`)
 *   برگشت سهم کارت مرجوعی   بد حساب مشتری / بس «اعتبار باشگاه» — در خود سند پس دادن (`pos/tickets.ts`)
 *
 * ردیف‌های دفتر امتیاز (`PointTransaction`) با `postClubLiability` گروهی به دفتر می‌روند:
 * صندوق بعد از هر رسید همان عضو را، worker هر ساعت بقیه (سایت، دستی، سوخت) را. `postedAt`
 * مرز «دو بار نرو» است. ابطال رسید ردیف‌ها را پاک می‌کند ← `reverseClubRows` سندشان را برمی‌گرداند.
 */

import type { PointTransaction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "./errors";
import { createAccount } from "./ledger/accounts";
import { balanceOf } from "./ledger/balances";
import { postVoucher, type Actor, type LineInput } from "./ledger/post";
import { todayKey } from "./dates";
import { faNum, formatAmount } from "./money";
import { creditSettings, ledgerStates } from "@/lib/club/credit";
import { pointsToToman } from "@/lib/club/credit-calc";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const CLUB_KEY = "CLUB_LIABILITY";

/** حساب «اعتبار باشگاه مشتریان» — اگر سرفصل ندارد، زیر «پیش‌دریافت‌ها» (۳۳) ساخته می‌شود */
export async function ensureClubAccount(tx: Tx) {
  const hit = await tx.accAccount.findUnique({ where: { systemKey: CLUB_KEY } });
  if (hit) return hit;
  const parent =
    (await tx.accAccount.findFirst({ where: { code: "33", level: "LEDGER" } })) ??
    (await tx.accAccount.findFirst({ where: { class: "LIABILITY", level: "LEDGER" }, orderBy: { code: "asc" } }));
  if (!parent) throw new AccError("سرفصل بدهی‌ها پیدا نشد؛ حساب «اعتبار باشگاه مشتریان» را دستی زیر پیش‌دریافت‌ها بسازید");
  const acc = await createAccount(tx, { parentId: parent.id, name: "اعتبار باشگاه مشتریان" });
  return tx.accAccount.update({ where: { id: acc.id }, data: { systemKey: CLUB_KEY, nature: "CREDIT", detailKind: "NONE" } });
}

/** تعهد روشن است؟ (حسابداری داخلی + راه‌اندازی شده) */
export async function clubLiabilityOn(db: Db): Promise<boolean> {
  const s = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, clubLiabilitySince: true } });
  return s?.mode === "INTERNAL" && !!s.clubLiabilitySince;
}

type Row = Pick<PointTransaction, "amount" | "reason" | "refType">;

/** طرف دیگر هر ردیف دفتر امتیاز؛ null = سند خودش دارد (خرج و برگشت صندوق) */
export function counterOf(r: Row): { key: string; label: string } | null {
  if (r.refType === "pos" && r.reason === "REDEEM") return null;
  if (r.refType === "pos_return_credit") return null;
  if (r.amount > 0) {
    if (r.refType === "card_import") return { key: "OPENING_BALANCE", label: "اعتبار منتقل‌شده از نرم‌افزار قبلی" };
    if (r.reason === "PURCHASE") return { key: "SALES_DISCOUNT", label: "کش‌بک خرید" };
    if (r.refType === "order_refund") return { key: "SALES_DISCOUNT", label: "برگشت اعتبار سفارش لغوشده" };
    return { key: "CUSTOMER_REWARD", label: "هدیه و شارژ دستی" };
  }
  return { key: "SALES_DISCOUNT", label: r.reason === "EXPIRE" ? "سوخت اعتبار" : r.reason === "REDEEM" ? "خرج در خرید اینترنتی" : "کسر اعتبار" };
}

type Group = { key: string; label: string; points: number };

/** ردیف‌ها ← سطرهای سند (جمع امتیاز هر طرف، بعد تومان) */
function linesOf(rows: Row[], rate: number, sign: 1 | -1 = 1): LineInput[] {
  const by = new Map<string, Group>();
  for (const r of rows) {
    const c = counterOf(r);
    if (!c) continue;
    const k = `${c.key}|${c.label}`;
    const g = by.get(k) ?? { ...c, points: 0 };
    g.points += r.amount * sign;
    by.set(k, g);
  }
  return groupLines([...by.values()], rate);
}

/** گروه‌ها ← سطرها؛ + امتیاز = بدهی بیشتر. جمع «اعتبار باشگاه» از همان مبلغ‌های گردشده ← سند تراز */
function groupLines(groups: Group[], rate: number): LineInput[] {
  const lines: LineInput[] = [];
  let liab = 0n;
  for (const g of groups) {
    const t = (g.points < 0 ? -1n : 1n) * pointsToToman(Math.abs(g.points), rate);
    if (!t) continue;
    // + امتیاز = بدهی بیشتر: بد طرف / بس تعهد
    lines.push(t > 0n ? { accountKey: g.key, debit: t, description: g.label } : { accountKey: g.key, credit: -t, description: g.label });
    liab += t;
  }
  if (!lines.length) return [];
  lines.push(liab > 0n ? { accountKey: CLUB_KEY, credit: liab, description: "اعتبار باشگاه مشتریان" } : { accountKey: CLUB_KEY, debit: -liab, description: "اعتبار باشگاه مشتریان" });
  if (liab === 0n) lines.pop();
  return lines;
}

/**
 * ردیف‌های به دفتر نرفته ← یک سند. `profileIds` = فقط همین اعضا (صندوق بعد از رسید).
 * خاموش بودن تعهد ← هیچ.
 */
export async function postClubLiability(tx: Tx, actor: Actor, opts: { profileIds?: string[] } = {}) {
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, clubLiabilitySince: true } });
  if (s?.mode !== "INTERNAL" || !s.clubLiabilitySince) return null;
  const rows = await tx.pointTransaction.findMany({
    where: { postedAt: null, createdAt: { gte: s.clubLiabilitySince }, ...(opts.profileIds ? { profileId: { in: opts.profileIds } } : {}) },
    select: { id: true, amount: true, reason: true, refType: true },
    take: 20_000,
  });
  if (!rows.length) return null;
  const cs = await creditSettings(tx);
  const lines = linesOf(rows, cs.rate);
  const now = new Date();
  let voucherId: string | null = null;
  if (lines.length >= 2) {
    await ensureClubAccount(tx);
    const v = await postVoucher(tx, {
      date: todayKey(),
      description: `اعتبار باشگاه مشتریان — ${faNum(rows.length)} گردش کارت و امتیاز`,
      source: "CLUB",
      sourceId: `club:${now.getTime()}`,
      lines,
      actor,
    });
    voucherId = v.id;
  }
  await tx.pointTransaction.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { postedAt: now, voucherId } });
  return { rows: rows.length, voucherId };
}

/** ابطال رسید ردیف‌هایش را پاک می‌کند — سهم به‌دفتررفته‌شان با سند معکوس برمی‌گردد */
export async function reverseClubRows(tx: Tx, rows: (Row & { voucherId: string | null })[], why: string, actor: Actor) {
  const posted = rows.filter((r) => r.voucherId);
  if (!posted.length) return null;
  const cs = await creditSettings(tx);
  const lines = linesOf(posted, cs.rate, -1);
  if (lines.length < 2) return null;
  await ensureClubAccount(tx);
  return postVoucher(tx, { date: todayKey(), description: `برگشت اعتبار باشگاه — ${why}`, source: "CLUB", sourceId: `club-void:${Date.now()}`, lines, actor });
}

/** مانده‌ی دفتر امتیاز همه‌ی اعضا (قابل خرج + در انتظار، منهای کسری) به تفکیک منشأ شارژ */
async function outstanding(db: Db) {
  const cs = await creditSettings(db);
  const ids = (await db.pointTransaction.findMany({ distinct: ["profileId"], select: { profileId: true } })).map((r) => r.profileId);
  const states = await ledgerStates(db, ids, cs);
  const lotIds = [...states.values()].flatMap((st) => st.live.map((l) => l.id));
  const meta = new Map(
    (await db.pointTransaction.findMany({ where: { id: { in: lotIds } }, select: { id: true, amount: true, reason: true, refType: true } })).map((r) => [r.id, r]),
  );
  const by = new Map<string, Group>();
  let deficit = 0;
  let pending = 0;
  let total = 0;
  for (const st of states.values()) {
    deficit += st.deficit;
    pending += st.pending;
    for (const l of st.live) {
      const c = counterOf(meta.get(l.id) ?? { amount: 1, reason: "MANUAL", refType: null }) ?? { key: "SALES_DISCOUNT", label: "کش‌بک خرید" };
      const k = `${c.key}|${c.label}`;
      const g = by.get(k) ?? { ...c, points: 0 };
      g.points += l.remaining;
      by.set(k, g);
      total += l.remaining;
    }
  }
  return { cs, by: [...by.values()], deficit, pending, total, members: ids.length };
}

/**
 * راه‌اندازی تعهد: مانده‌ی امروز دفتر امتیاز یک‌جا بدهی می‌شود (منشأ هر شارژ طرف بدهکار را
 * می‌گوید؛ کسری‌ها از سهم کش‌بک کم می‌شوند) و از این لحظه هر گردش به دفتر می‌رود.
 */
export async function activateClubLiability(tx: Tx, actor: Actor, opts: { preview?: boolean } = {}) {
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, clubLiabilitySince: true } });
  if (s?.mode !== "INTERNAL") throw new AccError("تعهد اعتبار باشگاه فقط با حسابداری داخلی است");
  if (s.clubLiabilitySince) throw new AccError("تعهد اعتبار باشگاه قبلاً راه‌اندازی شده است", 409);
  const o = await outstanding(tx);
  const groups: Group[] = [...o.by, ...(o.deficit ? [{ key: "SALES_DISCOUNT", label: "کسری اعتبار مشتریان (بیش از مانده خرج شده)", points: -o.deficit }] : [])];
  const parts = o.by.map((g) => ({ label: g.label, amount: pointsToToman(g.points, o.cs.rate) }));
  const total = pointsToToman(o.total - o.deficit, o.cs.rate);
  if (opts.preview) return { preview: true as const, total, parts, deficit: pointsToToman(o.deficit, o.cs.rate), members: o.members, voucherId: null };
  const now = new Date();
  await ensureClubAccount(tx);
  // کسری (مشتری بیش از مانده خرج کرده) ← بستانکار «تخفیفات فروش»، از تعهد کم می‌شود
  const lines = groupLines(groups, o.cs.rate);
  let voucherId: string | null = null;
  if (lines.length >= 2) {
    const v = await postVoucher(tx, {
      date: todayKey(),
      description: `افتتاحیه‌ی اعتبار باشگاه مشتریان — مانده‌ی ${formatAmount(total)} تومان اعتبار کارت و امتیاز`,
      source: "CLUB",
      sourceId: "club:opening",
      lines,
      actor,
    });
    voucherId = v.id;
  }
  await tx.pointTransaction.updateMany({ where: { postedAt: null }, data: { postedAt: now } });
  await tx.accSettings.update({ where: { id: "singleton" }, data: { clubLiabilitySince: now } });
  return { preview: false as const, total, parts, deficit: pointsToToman(o.deficit, o.cs.rate), members: o.members, voucherId };
}

/** وضعیت برای صفحه‌ی «اعتبار باشگاه»: دفتر امتیاز در برابر حساب، و گردش‌های به دفتر نرفته */
export async function clubLiabilityStatus(db: Db) {
  const s = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, clubLiabilitySince: true } });
  const o = await outstanding(db);
  const acc = await db.accAccount.findUnique({ where: { systemKey: CLUB_KEY }, select: { id: true, code: true, name: true } });
  const bal = acc ? await balanceOf(db, { accountId: acc.id }) : null;
  const unposted = s?.clubLiabilitySince
    ? await db.pointTransaction.findMany({ where: { postedAt: null, createdAt: { gte: s.clubLiabilitySince } }, select: { amount: true, reason: true, refType: true } })
    : [];
  const pendingLines = linesOf(unposted, o.cs.rate);
  const unpostedToman = pendingLines.reduce((sum, l) => sum + (l.accountKey === CLUB_KEY ? (l.credit ?? 0n) - (l.debit ?? 0n) : 0n), 0n);
  const ledger = pointsToToman(o.total - o.deficit, o.cs.rate);
  const book = bal ? -bal.balance : 0n;
  return {
    mode: s?.mode ?? "NONE",
    active: !!s?.clubLiabilitySince,
    since: s?.clubLiabilitySince ?? null,
    account: acc,
    /** مانده‌ی دفتر امتیاز (قابل خرج + در انتظار − کسری) */
    ledger,
    pending: pointsToToman(o.pending, o.cs.rate),
    members: o.members,
    parts: o.by.map((g) => ({ label: g.label, amount: pointsToToman(g.points, o.cs.rate) })),
    /** مانده‌ی بستانکار حساب «اعتبار باشگاه» */
    book,
    unposted: { rows: unposted.length, amount: unpostedToman },
    /** اختلاف بعد از به دفتر رفتن گردش‌های مانده (گرد کردن امتیاز ← تومان) */
    diff: s?.clubLiabilitySince ? ledger - (book + unpostedToman) : null,
    settings: { onProfit: o.cs.onProfit, delayHours: o.cs.delayHours, rate: o.cs.rate },
  };
}
