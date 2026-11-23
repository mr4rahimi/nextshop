/**
 * اقساط سازمانی — انتقال قراردادهای «وب حساب» (docs/plans/org-installments.md بخش ۷).
 *
 * ورودی: CSV خروجی `scripts/webhesab/export-installments.py` (یک سطر برای هر قسط، مبلغ‌ها ریال).
 * سازمان در وب حساب ستون ندارد؛ از نام مشتری درمی‌آید: «علیخانی (منابع طبیعی)» ← برچسب «منابع طبیعی».
 * برچسب‌ها با قاعده‌های پیش‌فرض به سازمان پیشنهاد می‌شوند و کاربر در پیش‌نمایش عوضشان می‌کند.
 * بی‌برچسب‌ها = اقساط شخصی (سازمان «خودپرداز»: طلب روی مشتری می‌ماند، قسط را خودش می‌پردازد).
 *
 * حسابداری: مانده‌ی مشتری‌ها از قبل (ورود مانده‌ی اشخاص، معین ۱۰۳۰۰۱ + ۱۰۳۰۰۳) در پنل است. انتقال، مانده‌ی
 * اقساط باز هر قرارداد را از مشتری به سازمان می‌برد — یک سند برای هر سازمان (منبع IMPORT):
 * بدهکار AR سازمان (سهم سازمان بعد از پورسانت)، بدهکار «کارمزد فروش اقساطی سازمانی» (پورسانت)، بستانکار AR هر مشتری.
 * ورود دوباره (تا روز قطع وب حساب) قراردادها را به‌روز و سند هر سازمان را بازسازی می‌کند؛ قراردادی که در پنل
 * دریافت خورده دست نمی‌خورد («قفل»).
 */

import type { AccInstallmentOrg, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromJalali } from "@/lib/club/jalali";
import { AccError } from "./errors";
import { createParty } from "./parties";
import { GLOBAL_SEQ, nextNumber } from "./ledger/sequence";
import { postVoucher, rebuildVoucher, voidVoucher, type Actor } from "./ledger/post";
import { ensureOrgFeeAccount } from "./org-installments-hooks";
import { saveOrg } from "./org-installments";
import { faNum } from "./money";
import { todayKey } from "./dates";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const PERSONAL_ORG = "اقساط شخصی (وب حساب)";
/** مقدار نگاشت برای «شخصی» */
export const PERSONAL = "__personal__";

// ───────────────────────── خواندن فایل ─────────────────────────

const fa2en = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
export const normFa = (s: string) =>
  fa2en(String(s ?? "").normalize("NFKC"))
    .replace(/[\u064A\u0649]/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .replace(/[\u200c\u200e\u200f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface LegacyItem {
  seq: number;
  due: Date;
  amount: bigint; // ریال
  paid: bigint; // ریال
  lastPay: Date | null;
}
export interface LegacyContract {
  ref: string;
  code: string;
  name: string;
  mobile: string | null;
  pos: string;
  date: Date;
  desc: string;
  items: LegacyItem[];
}

const COLS = {
  ref: /کد قرارداد|شماره پرداخت اقساطی/,
  code: /کد تفصیل/,
  name: /^مشتری$/,
  mobile: /موبایل/,
  pos: /نقطه فروش/,
  seq: /شماره قسط/,
  due: /سررسید/,
  date: /تاریخ سند/,
  amount: /مبلغ قسط/,
  paid: /پرداخت شده/,
  lastPay: /آخرین بازپرداخت/,
  desc: /شرح|توضیحات/,
};

const jdate = (s: string): Date | null => {
  const m = fa2en(s ?? "").match(/(1[34]\d\d)\/(\d{1,2})\/(\d{1,2})/);
  return m ? fromJalali(+m[1], +m[2], +m[3]) : null;
};
const rial = (s: string) => {
  const t = fa2en(s ?? "").replace(/[,،\s]/g, "");
  if (!t) return 0n;
  if (!/^-?\d+$/.test(t)) throw new AccError(`مبلغ نامعتبر «${s}»`);
  return BigInt(t);
};

export function parseLegacySheet(rows: string[][]): LegacyContract[] {
  const hi = rows.findIndex((r) => r.some((c) => COLS.ref.test(normFa(c))) && r.some((c) => COLS.amount.test(normFa(c))));
  if (hi < 0) throw new AccError("سرستون «کد قرارداد» و «مبلغ قسط» پیدا نشد؛ فایل را با scripts/webhesab/export-installments.py بسازید");
  const head = rows[hi].map(normFa);
  const col = Object.fromEntries(Object.entries(COLS).map(([k, re]) => [k, head.findIndex((h) => re.test(h))])) as Record<keyof typeof COLS, number>;
  for (const k of ["ref", "code", "name", "seq", "due", "amount", "paid"] as const) {
    if (col[k] < 0) throw new AccError(`ستون «${k}» در فایل نیست`);
  }
  const by = new Map<string, LegacyContract>();
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const ref = fa2en(r[col.ref] ?? "").trim();
    if (!/^\d+$/.test(ref)) continue;
    const due = jdate(r[col.due]);
    if (!due) throw new AccError(`ردیف ${faNum(i + 1)}: سررسید نامعتبر`);
    const c =
      by.get(ref) ??
      {
        ref,
        code: fa2en(r[col.code] ?? "").trim(),
        name: normFa(r[col.name] ?? ""),
        mobile: normalizeMobile(r[col.mobile] ?? ""),
        pos: col.pos >= 0 ? normFa(r[col.pos] ?? "") : "",
        date: (col.date >= 0 && jdate(r[col.date])) || due,
        desc: col.desc >= 0 ? normFa(r[col.desc] ?? "") : "",
        items: [],
      };
    c.items.push({ seq: Number(fa2en(r[col.seq] ?? "0")) || c.items.length + 1, due, amount: rial(r[col.amount]), paid: rial(r[col.paid]), lastPay: col.lastPay >= 0 ? jdate(r[col.lastPay]) : null });
    by.set(ref, c);
  }
  const out = [...by.values()];
  for (const c of out) {
    c.items.sort((a, b) => a.seq - b.seq || a.due.getTime() - b.due.getTime());
    // شماره‌ی قسط تکراری (اقساط حذف‌شده‌ی وب حساب) — شماره‌گذاری دوباره به ترتیب
    c.items.forEach((x, i) => (x.seq = i + 1));
  }
  if (!out.length) throw new AccError("هیچ قسطی در فایل نیست");
  return out;
}

function normalizeMobile(v: string) {
  let d = fa2en(v).replace(/\D/g, "");
  if (d.startsWith("0098")) d = d.slice(4);
  else if (d.startsWith("98") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith("9")) d = `0${d}`;
  return /^09\d{9}$/.test(d) ? d : null;
}

// ───────────────────────── برچسب و سازمان ─────────────────────────

/** قاعده‌های پیش‌فرض برچسب ← نام سازمان (ترتیب مهم است) */
const RULES: [RegExp, string][] = [
  [/سرمایه ?گذاری/, "سرمایه‌گذاری چوب و کاغذ"],
  [/چوب|کاغذ/, "صنایع چوب و کاغذ"],
  [/بازنش?س/, "فرهنگیان بازنشسته"],
  [/فرهنگی|ناحیه|شاغل/, "آموزش و پرورش (فرهنگیان)"],
  [/علوم ?پزشکی|بهداشت|بیمارستان|دانشکده|بوعلی|رازی|پیراپزشکی|فاطمه ?الزهرا|فطمه/, "دانشگاه علوم پزشکی"],
  [/نیروگاه/, "نیروگاه"],
  [/برق/, "برق منطقه‌ای"],
  [/صدا ?و? ?سیما/, "صدا و سیما"],
  [/استانداری/, "استانداری"],
  [/ورزش/, "اداره ورزش و جوانان"],
  [/دانشگاه آزاد/, "دانشگاه آزاد"],
  [/محیط ?زیست/, "محیط زیست"],
  [/منابع ?طبیعی/, "منابع طبیعی"],
  [/جهاد ?کشاورزی/, "جهاد کشاورزی"],
  [/بندر ?امیر ?آباد/, "بندر امیرآباد"],
  [/تعزیرات/, "تعزیرات حکومتی"],
  [/دارایی/, "اداره دارایی"],
  [/دامپزشکی/, "دامپزشکی"],
  [/کمیته امداد/, "کمیته امداد"],
  [/زندان/, "اداره زندان‌ها"],
  [/سیمان/, "کارخانه سیمان"],
  [/درمانگاه نبض/, "درمانگاه نبض"],
  [/سامانه بتا/, "سامانه بتا"],
  [/راه ?آهن/, "راه‌آهن"],
];
/** کلیدواژه‌ی سازمان بی پرانتز: «رحمتی مجتبی فرهنگیان»، «علیخانی منابع طبیعی» */
const BARE = /(فرهنگیان|منابع طبیعی|علوم پزشکی|استانداری|صدا و سیما|محیط زیست|جهاد کشاورزی|دانشگاه آزاد|اداره ورزش|برق منطقه ?ای|چوب و کاغذ|نیروگاه|تعزیرات|بندر ?امیر ?آباد|شاغل ناحیه ?1|بازنشسته ناحیه ?1)/;

/** برچسب سازمان داخل نام (آخرین پرانتز/آکولاد، وگرنه کلیدواژه)؛ null = شخصی */
export function legacyTag(name: string): string | null {
  const n = normFa(name);
  const groups = [...n.matchAll(/[({]([^)}]*)[)}]/g)].map((m) => normFa(m[1]).replace(/^[\s.،-]+|[\s.،-]+$/g, "")).filter(Boolean);
  for (let i = groups.length - 1; i >= 0; i--) if (RULES.some(([re]) => re.test(groups[i]))) return groups[i];
  if (groups.length) return groups[groups.length - 1];
  const bare = n.match(BARE);
  return bare ? normFa(bare[1]) : null;
}

export function suggestOrg(tag: string | null): string {
  if (!tag) return PERSONAL;
  for (const [re, org] of RULES) if (re.test(tag)) return org;
  return PERSONAL;
}
/** برچسبی که قاعده‌ای نشناخت («سبحان») — پیش‌فرض شخصی، در پیش‌نمایش جدا نشان داده می‌شود */
export const knownTag = (tag: string | null) => !!tag && RULES.some(([re]) => re.test(tag));

// ───────────────────────── محاسبه‌ی هر قرارداد ─────────────────────────

const toToman = (r: bigint) => (r >= 0n ? (r + 5n) / 10n : -((-r + 5n) / 10n));
const commissionOf = (amount: bigint, bp: number) => (amount * BigInt(bp) + 5_000n) / 10_000n;

/** قسط‌ها به تومان؛ پرداخت‌شده‌ی وب حساب به ترتیب (اولی اول) روی قسط‌ها پخش می‌شود؛ پورسانت فقط روی مانده‌ی باز */
export function computeContract(c: LegacyContract, bp: number) {
  const paidRial = c.items.reduce((s, x) => s + (x.paid > 0n ? x.paid : 0n), 0n);
  const amountRial = c.items.reduce((s, x) => s + x.amount, 0n);
  let left = paidRial;
  const lastPay = c.items.reduce<Date | null>((m, x) => (x.lastPay && (!m || x.lastPay > m) ? x.lastPay : m), null);
  const items = c.items.map((x) => {
    const p = left >= x.amount ? x.amount : left > 0n ? left : 0n;
    left -= p;
    const gross = toToman(x.amount);
    const paidT = p === x.amount ? gross : toToman(p) > gross ? gross : toToman(p);
    const open = gross - paidT;
    const net = gross - commissionOf(gross, bp);
    const openNet = open - commissionOf(open, bp);
    const legacyPaid = net - openNet < 0n ? 0n : net - openNet > net ? net : net - openNet;
    return { seq: x.seq, dueDate: x.due, gross, amount: net, legacyPaid, legacyPaidAt: legacyPaid > 0n ? x.lastPay ?? lastPay : null, open, openNet: net - legacyPaid };
  });
  const total = items.reduce((s, x) => s + x.gross, 0n);
  const net = items.reduce((s, x) => s + x.amount, 0n);
  return {
    items,
    total,
    net,
    commission: total - net,
    legacyOpen: items.reduce((s, x) => s + x.open, 0n),
    legacyOpenNet: items.reduce((s, x) => s + x.openNet, 0n),
    overpaid: paidRial > amountRial ? toToman(paidRial - amountRial) : 0n,
  };
}

// ───────────────────────── تطبیق مشتری ─────────────────────────

async function resolveParties(db: Db, contracts: LegacyContract[]) {
  const codes = [...new Set(contracts.map((c) => c.code).filter(Boolean))];
  const mobiles = [...new Set(contracts.map((c) => c.mobile).filter((x): x is string => !!x))];
  const byCodeRows = await db.accParty.findMany({ where: { externalCode: { in: codes } }, select: { id: true, externalCode: true, mergedIntoId: true, name: true, isActive: true } });
  const byMobileRows = await db.accParty.findMany({ where: { mobile: { in: mobiles }, mergedIntoId: null }, select: { id: true, mobile: true, name: true, isActive: true } });
  const ids = new Map<string, { id: string; via: "code" | "mobile" }>();
  for (const c of contracts) {
    if (ids.has(c.ref)) continue;
    const hits = byCodeRows.filter((p) => p.externalCode === c.code);
    const hit = hits.find((p) => !p.mergedIntoId) ?? hits[0];
    if (hit) {
      ids.set(c.ref, { id: hit.mergedIntoId ?? hit.id, via: "code" });
      continue;
    }
    const m = c.mobile ? byMobileRows.filter((p) => p.mobile === c.mobile) : [];
    if (m.length === 1) ids.set(c.ref, { id: m[0].id, via: "mobile" });
  }
  return ids;
}

async function arBalances(db: Db, partyIds: string[]) {
  if (!partyIds.length) return new Map<string, bigint>();
  const rows = await db.accVoucherLine.groupBy({
    by: ["partyId"],
    where: { partyId: { in: partyIds }, isVoid: false, account: { systemKey: "AR" } },
    _sum: { debit: true, credit: true },
  });
  return new Map(rows.map((r) => [r.partyId!, (r._sum.debit ?? 0n) - (r._sum.credit ?? 0n)]));
}

// ───────────────────────── پیش‌نمایش ─────────────────────────

export interface LegacyOptions {
  /** برچسب ← نام سازمان یا PERSONAL؛ نیامده = پیشنهاد پیش‌فرض */
  mapping?: Record<string, string>;
  /** نام سازمان ← درصد پورسانت (فقط برای مانده‌ی باز) */
  commission?: Record<string, number>;
}

const orgFor = (c: LegacyContract, o: LegacyOptions) => {
  const tag = legacyTag(c.name);
  const key = tag ?? "";
  const m = o.mapping?.[key];
  const name = (m !== undefined ? m : suggestOrg(tag)).trim() || PERSONAL;
  return { tag, name: name === PERSONAL ? PERSONAL_ORG : name, personal: name === PERSONAL || name === PERSONAL_ORG };
};

export async function legacyPreview(db: Db, contracts: LegacyContract[], o: LegacyOptions = {}) {
  const orgsDb = await db.accInstallmentOrg.findMany();
  const orgByName = new Map(orgsDb.map((x) => [x.name, x]));
  const parties = await resolveParties(db, contracts);
  const existing = new Map(
    (
      await db.accOrgContract.findMany({
        where: { legacyRef: { in: contracts.map((c) => `webhesab:${c.ref}`) } },
        select: { legacyRef: true, status: true, items: { select: { _count: { select: { lines: true } } } } },
      })
    ).map((x) => [x.legacyRef!, x]),
  );
  const tags = new Map<string, { tag: string | null; known: boolean; org: string; personal: boolean; contracts: number; open: number; remaining: bigint; customers: Set<string>; sample: string }>();
  const orgs = new Map<string, { name: string; personal: boolean; exists: boolean; commissionPct: number; contracts: number; open: number; remaining: bigint; remainingNet: bigint; customers: Set<string>; tags: Set<string> }>();
  const transfer = new Map<string, { partyId: string; name: string; amount: bigint }>();
  const problems = { overpaid: [] as { ref: string; name: string; amount: bigint }[], oldOverdue: [] as { ref: string; name: string; org: string; amount: bigint; due: Date }[], locked: 0, newParties: [] as { code: string; name: string; mobile: string | null }[], noCode: 0 };
  const cutoff = new Date(todayKey().getTime() - 180 * 86_400_000);
  let totalRemaining = 0n;
  let open = 0;
  const seenNew = new Set<string>();
  for (const c of contracts) {
    const g = orgFor(c, o);
    const dbOrg = orgByName.get(g.name);
    const pct = o.commission?.[g.name] ?? (dbOrg ? dbOrg.commissionBp / 100 : 0);
    const k = computeContract(c, g.personal ? 0 : Math.round(pct * 100));
    const isOpen = k.legacyOpen > 0n;
    const t = tags.get(g.tag ?? "") ?? { tag: g.tag, known: knownTag(g.tag), org: g.name, personal: g.personal, contracts: 0, open: 0, remaining: 0n, customers: new Set<string>(), sample: c.name };
    t.contracts++;
    if (isOpen) t.open++;
    t.remaining += k.legacyOpen;
    t.customers.add(c.code || c.name);
    tags.set(g.tag ?? "", t);
    const og = orgs.get(g.name) ?? { name: g.name, personal: g.personal, exists: !!dbOrg, commissionPct: pct, contracts: 0, open: 0, remaining: 0n, remainingNet: 0n, customers: new Set<string>(), tags: new Set<string>() };
    og.contracts++;
    if (isOpen) og.open++;
    og.remaining += k.legacyOpen;
    og.remainingNet += k.legacyOpenNet;
    if (isOpen) og.customers.add(c.code || c.name);
    og.tags.add(g.tag ?? "");
    orgs.set(g.name, og);
    totalRemaining += k.legacyOpen;
    if (isOpen) open++;
    if (k.overpaid > 0n) problems.overpaid.push({ ref: c.ref, name: c.name, amount: k.overpaid });
    const firstOpen = k.items.find((x) => x.open > 0n);
    if (firstOpen && firstOpen.dueDate < cutoff) problems.oldOverdue.push({ ref: c.ref, name: c.name, org: g.name, amount: k.legacyOpen, due: firstOpen.dueDate });
    const ex = existing.get(`webhesab:${c.ref}`);
    if (ex && ex.items.some((i) => i._count.lines > 0)) problems.locked++;
    const p = parties.get(c.ref);
    if (!c.code) problems.noCode++;
    if (!p && !seenNew.has(c.code || c.name)) {
      seenNew.add(c.code || c.name);
      problems.newParties.push({ code: c.code, name: c.name, mobile: c.mobile });
    }
    if (p && !g.personal && k.legacyOpen > 0n) {
      const tr = transfer.get(p.id) ?? { partyId: p.id, name: c.name, amount: 0n };
      tr.amount += k.legacyOpen;
      transfer.set(p.id, tr);
    }
  }
  // مشتری‌هایی که مانده‌ی پنلشان از مبلغ انتقال کمتر است (بستانکار می‌شوند) — یعنی مانده‌ی اشخاص به‌روز نیست
  const bal = await arBalances(db, [...transfer.keys()]);
  const short = [...transfer.values()]
    .map((t) => ({ ...t, balance: bal.get(t.partyId) ?? 0n }))
    .filter((t) => t.balance < t.amount)
    .sort((a, b) => Number(b.amount - b.balance - (a.amount - a.balance)));
  return {
    contracts: contracts.length,
    open,
    installments: contracts.reduce((s, c) => s + c.items.length, 0),
    remaining: totalRemaining,
    tags: [...tags.values()].map((t) => ({ ...t, customers: t.customers.size })).sort((a, b) => Number(b.remaining - a.remaining) || b.contracts - a.contracts),
    orgs: [...orgs.values()].map((x) => ({ ...x, customers: x.customers.size, tags: [...x.tags] })).sort((a, b) => Number(b.remaining - a.remaining)),
    matched: { byCode: [...parties.values()].filter((p) => p.via === "code").length, byMobile: [...parties.values()].filter((p) => p.via === "mobile").length },
    problems: {
      ...problems,
      oldOverdue: problems.oldOverdue.sort((a, b) => a.due.getTime() - b.due.getTime()),
      short: short.slice(0, 300),
      shortCount: short.length,
      shortSum: short.reduce((s, t) => s + t.amount - t.balance, 0n),
    },
    existingOrgs: orgsDb.map((x) => x.name),
  };
}

// ───────────────────────── ثبت ─────────────────────────

export async function legacyApply(tx: Tx, contracts: LegacyContract[], o: LegacyOptions, actor: Actor) {
  const today = todayKey();
  // ۱. سازمان‌ها
  const orgCache = new Map<string, AccInstallmentOrg>();
  const orgOf = async (name: string, personal: boolean) => {
    const hit = orgCache.get(name);
    if (hit) return hit;
    let org = await tx.accInstallmentOrg.findUnique({ where: { name } });
    if (!org) {
      org = await saveOrg(tx, null, { name, requireRef: false, note: personal ? "اقساط شخصی منتقل‌شده از وب حساب — خود مشتری قسط را می‌پردازد" : "منتقل‌شده از وب حساب" }, actor);
      if (personal) org = await tx.accInstallmentOrg.update({ where: { id: org.id }, data: { selfPay: true } });
    }
    if (personal && !org.selfPay) throw new AccError(`«${name}» سازمان عادی است؛ اقساط شخصی نمی‌گیرد`);
    const pct = o.commission?.[name];
    if (!personal && pct !== undefined && Math.round(pct * 100) !== org.commissionBp) {
      if (!(pct >= 0 && pct < 50)) throw new AccError("پورسانت سازمان بین ۰ تا ۵۰ درصد");
      org = await tx.accInstallmentOrg.update({ where: { id: org.id }, data: { commissionBp: Math.round(pct * 100) } });
    }
    orgCache.set(name, org);
    return org;
  };

  // ۲. مشتری‌ها
  const parties = await resolveParties(tx, contracts);
  const created = new Map<string, string>();
  let newParties = 0;
  let activated = 0;
  for (const c of contracts) {
    if (parties.has(c.ref)) continue;
    const key = c.code || `${c.name}|${c.mobile ?? ""}`;
    let id = created.get(key);
    if (!id) {
      const p = await createParty(tx, { personType: "REAL", name: c.name, mobile: c.mobile, isCustomer: true, note: `از اقساط وب حساب (کد تفصیل ${c.code || "—"}) — ${actor.name}` });
      if (c.code) await tx.accParty.update({ where: { id: p.id }, data: { externalCode: c.code } });
      id = p.id;
      created.set(key, id);
      newParties++;
    }
    parties.set(c.ref, { id, via: "code" });
  }
  const partyRows = new Map((await tx.accParty.findMany({ where: { id: { in: [...new Set([...parties.values()].map((p) => p.id))] } } })).map((p) => [p.id, p]));

  // ۳. قراردادها
  const stats = { created: 0, updated: 0, locked: 0, voided: 0, unchanged: 0 };
  const touchedOrgs = new Set<string>();
  const refs = new Set<string>();
  for (const c of contracts) {
    const g = orgFor(c, o);
    const org = await orgOf(g.name, g.personal);
    touchedOrgs.add(org.id);
    const legacyRef = `webhesab:${c.ref}`;
    refs.add(legacyRef);
    const party = partyRows.get(parties.get(c.ref)!.id)!;
    if (!party.isActive) {
      await tx.accParty.update({ where: { id: party.id }, data: { isActive: true, note: [party.note, `فعال شد: اقساط باز وب حساب — ${actor.name}`].filter(Boolean).join("\n") } });
      party.isActive = true;
      activated++;
    }
    const k = computeContract(c, org.selfPay ? 0 : org.commissionBp);
    const ex = await tx.accOrgContract.findUnique({ where: { legacyRef }, include: { items: { include: { _count: { select: { lines: true } } } } } });
    if (ex && (ex.status === "VOID" || ex.items.some((i) => i._count.lines > 0) || ex.moneyDocId)) {
      stats.locked++;
      if (ex.status !== "VOID") touchedOrgs.add(ex.orgId);
      continue;
    }
    const tag = g.tag ? `واحد: ${g.tag}` : null;
    const note = [`وب حساب: پرداخت اقساطی ${faNum(Number(c.ref))}`, tag, c.desc || null, c.pos || null].filter(Boolean).join(" — ").slice(0, 500);
    const data = {
      orgId: org.id,
      partyId: party.id,
      customerName: party.name,
      mobile: party.mobile ?? c.mobile,
      nationalId: party.nationalId,
      total: k.total,
      commissionBp: org.selfPay ? 0 : org.commissionBp,
      commission: k.commission,
      net: k.net,
      months: k.items.length,
      firstDue: k.items[0].dueDate,
      status: k.legacyOpen > 0n ? ("ACTIVE" as const) : ("DONE" as const),
      legacyOpen: org.selfPay ? 0n : k.legacyOpen,
      legacyOpenNet: org.selfPay ? 0n : k.legacyOpenNet,
      note,
      createdAt: c.date,
    };
    const itemRows = k.items.map((x) => ({ seq: x.seq, dueDate: x.dueDate, amount: x.amount, legacyPaid: x.legacyPaid, legacyPaidAt: x.legacyPaidAt, paid: x.legacyPaid }));
    if (ex) {
      if (ex.orgId !== org.id) touchedOrgs.add(ex.orgId);
      const same =
        ex.orgId === data.orgId &&
        ex.partyId === data.partyId &&
        ex.total === data.total &&
        ex.net === data.net &&
        ex.legacyOpen === data.legacyOpen &&
        ex.legacyOpenNet === data.legacyOpenNet &&
        ex.items.length === itemRows.length &&
        ex.items.every((i) => {
          const n = itemRows.find((x) => x.seq === i.seq);
          return n && n.amount === i.amount && n.legacyPaid === i.legacyPaid && n.dueDate.getTime() === i.dueDate.getTime();
        });
      if (same) {
        stats.unchanged++;
        continue;
      }
      await tx.accOrgInstallment.deleteMany({ where: { contractId: ex.id } });
      await tx.accOrgContract.update({ where: { id: ex.id }, data });
      await tx.accOrgInstallment.createMany({ data: itemRows.map((x) => ({ ...x, contractId: ex.id })) });
      stats.updated++;
    } else {
      const number = await nextNumber(tx, GLOBAL_SEQ, "org:contract", 1);
      const row = await tx.accOrgContract.create({ data: { ...data, number, legacyRef, createdByName: actor.name } });
      await tx.accOrgInstallment.createMany({ data: itemRows.map((x) => ({ ...x, contractId: row.id })) });
      stats.created++;
    }
  }
  // قراردادهای وب حسابی که دیگر در فایل نیستند (در وب حساب حذف شده‌اند) — اگر قفل نیستند باطل.
  // فقط وقتی فایل کامل به نظر می‌رسد (دست‌کم ۹۵٪ قراردادهای قبلی را دارد)، تا فایل ناقص/فیلترشده چیزی را باطل نکند.
  const gone = await tx.accOrgContract.findMany({ where: { legacyRef: { startsWith: "webhesab:", notIn: [...refs] }, status: { not: "VOID" } }, include: { items: { include: { _count: { select: { lines: true } } } } } });
  const stored = await tx.accOrgContract.count({ where: { legacyRef: { startsWith: "webhesab:" }, status: { not: "VOID" } } });
  const fullFile = gone.length <= Math.max(5, Math.floor(stored * 0.05));
  const missing = gone.length;
  for (const g of fullFile ? gone : []) {
    if (g.items.some((i) => i._count.lines > 0)) continue;
    await tx.accOrgContract.update({ where: { id: g.id }, data: { status: "VOID", voidReason: `در خروجی تازه‌ی وب حساب نیست — ${actor.name}` } });
    touchedOrgs.add(g.orgId);
    stats.voided++;
  }

  // ۴. سند انتقال هر سازمان
  const withVoucher = await tx.accInstallmentOrg.findMany({ where: { OR: [{ id: { in: [...touchedOrgs] } }, { legacyVoucherId: { not: null } }] } });
  const vouchers: { org: string; number: number | null; amount: bigint }[] = [];
  for (const org of withVoucher) {
    const v = await rebuildLegacyVoucher(tx, org, today, actor);
    if (v) vouchers.push({ org: org.name, ...v });
  }
  return { ...stats, missing: fullFile ? 0 : missing, newParties, activated, vouchers };
}

/** سند انتقال مانده‌ی اقساط وب حساب یک سازمان = Σ قراردادهای وب حسابی زنده؛ صفر ← باطل */
export async function rebuildLegacyVoucher(tx: Tx, org: AccInstallmentOrg, date: Date, actor: Actor) {
  if (org.selfPay) return null;
  const cs = await tx.accOrgContract.findMany({ where: { orgId: org.id, legacyRef: { not: null }, status: { not: "VOID" } }, select: { partyId: true, legacyOpen: true, legacyOpenNet: true } });
  const per = new Map<string, bigint>();
  let gross = 0n;
  let net = 0n;
  for (const c of cs) {
    if (c.legacyOpen <= 0n) continue;
    per.set(c.partyId, (per.get(c.partyId) ?? 0n) + c.legacyOpen);
    gross += c.legacyOpen;
    net += c.legacyOpenNet;
  }
  const description = `انتقال مانده‌ی اقساط وب حساب به «${org.name}» — ${faNum(per.size)} مشتری`;
  if (gross <= 0n) {
    if (org.legacyVoucherId) {
      await voidVoucher(tx, org.legacyVoucherId, "اقساط باز وب حسابی نماند", actor, { fromSource: true });
      await tx.accInstallmentOrg.update({ where: { id: org.id }, data: { legacyVoucherId: null } });
    }
    return null;
  }
  const lines: Parameters<typeof postVoucher>[1]["lines"] = [{ accountKey: "AR", partyId: org.partyId, debit: net, description }];
  if (gross > net) {
    await ensureOrgFeeAccount(tx);
    lines.push({ accountKey: "ORG_INSTALLMENT_FEE", debit: gross - net, description: `پورسانت «${org.name}» روی اقساط باز وب حساب` });
  }
  for (const [partyId, amount] of per) lines.push({ accountKey: "AR", partyId, credit: amount, description: `اقساط باز وب حساب ← ${org.name}` });
  const cur = org.legacyVoucherId ? await tx.accVoucher.findUnique({ where: { id: org.legacyVoucherId } }) : null;
  const v =
    cur && cur.status !== "VOID"
      ? await rebuildVoucher(tx, cur.id, { date, description, lines, actor })
      : await postVoucher(tx, { date, description, source: "IMPORT", sourceId: `org-legacy:${org.id}`, lines, actor });
  if (v.id !== org.legacyVoucherId) await tx.accInstallmentOrg.update({ where: { id: org.id }, data: { legacyVoucherId: v.id } });
  return { number: v.number, amount: gross };
}
