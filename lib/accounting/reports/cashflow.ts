/**
 * صورت جریان وجوه نقد به روش مستقیم (استاندارد ۲) — docs/plans/webhesab-parity.md بخش ۳۴.۶.
 *
 * وجه نقد = صندوق، بانک و «در راه»‌ها (هر ردیف سند با `treasuryId`). جابه‌جایی میان خودشان جریان نیست.
 * هر سندی که خالص نقدش صفر نیست:
 *   ۱. ردیف‌های غیرنقد هر حساب با هم خالص می‌شوند و جفت‌های غیرنقدی (بهای تمام‌شده ↔ موجودی کالا،
 *      استهلاک ↔ انباشته، کاهش ارزش ↔ ذخیره) هم‌دیگر را خنثی می‌کنند.
 *   ۲. خالص نقد به نسبت مبلغ میان حساب‌های طرف مقابل پخش می‌شود (ورود ← بستانکارها، خروج ← بدهکارها)؛
 *      خرده‌ی تقسیم به بزرگ‌ترین سهم.
 *   ۳. حساب طرف مقابل طبقه را می‌گوید: تسهیلات، سود وام و حقوق صاحبان سرمایه ← تأمین مالی؛ دارایی غیرجاری و
 *      سود فروش دارایی ← سرمایه‌گذاری؛ بقیه ← عملیاتی (مشتریان، تأمین‌کنندگان، هزینه‌ها، مالیات، سایر).
 * سند «انتقال مانده» (`carry:`) کنار است؛ سند افتتاحیه‌ی داخل بازه جزو «موجودی ابتدا» می‌آید.
 * تطبیق: موجودی ابتدا + خالص جریان = موجودی پایان (از خود دفتر).
 */

import type { AccAccount } from "@prisma/client";
import { NOT_CARRY } from "../ledger/balances";
import { accountIndex, type AccountIndex, type DateRange, type Db } from "./common";

export type CashCat = "operating" | "investing" | "financing";
export const CAT_TITLES: Record<CashCat, string> = {
  operating: "فعالیت‌های عملیاتی",
  investing: "فعالیت‌های سرمایه‌گذاری",
  financing: "فعالیت‌های تأمین مالی",
};
const GROUP_TITLES: Record<string, string> = {
  customers: "دریافت از مشتریان و فروش",
  suppliers: "پرداخت به تأمین‌کنندگان و خرید کالا",
  expenses: "پرداخت هزینه‌ها و حقوق",
  tax: "مالیات",
  other: "سایر دریافت‌ها و پرداخت‌ها",
  assets: "خرید و فروش دارایی ثابت",
  deposits: "ودیعه، سپرده و سایر دارایی‌های بلندمدت",
  loans: "وام و تسهیلات (اصل و سود)",
  owners: "سرمایه و برداشت صاحبان",
  longdebt: "سایر بدهی‌های بلندمدت",
};
const GROUP_ORDER = ["customers", "suppliers", "expenses", "tax", "other", "assets", "deposits", "loans", "owners", "longdebt"];

const CUSTOMER_KEYS = new Set(["AR", "CHEQUE_RECEIVABLE", "CHEQUE_IN_COLLECTION", "CUSTOMER_ADVANCE", "WALLET_LIABILITY", "GIFT_LIABILITY", "CLUB_LIABILITY", "INSTALLMENT_DEFERRED", "SHIPPING_REVENUE", "SERVICE_REVENUE", "INSTALLMENT_INCOME"]);
const SUPPLIER_KEYS = new Set(["AP", "CHEQUE_PAYABLE", "INVENTORY", "PREPAYMENT", "INSTALLMENT_PREPAID", "COGS", "INVENTORY_ADJUSTMENT", "MARKETPLACE_FEE"]);
const TAX_KEYS = new Set(["VAT_SALES", "VAT_PURCHASE", "WITHHOLDING_TAX", "INCOME_TAX_PROVISION"]);
const STAFF_KEYS = new Set(["SALARY_PAYABLE", "INSURANCE_PAYABLE", "END_OF_SERVICE", "PREPAID_EXPENSE"]);
const LOAN_KEYS = new Set(["LOAN_PAYABLE", "LOAN_INTEREST"]);
/** جفت‌های غیرنقدی که در یک سند هم‌دیگر را خنثی می‌کنند */
const NONCASH_PAIRS: [string, string][] = [
  ["COGS", "INVENTORY"],
  ["DEPRECIATION", "ACCUM_DEPRECIATION"],
  ["INVENTORY_WRITEDOWN", "INVENTORY_PROVISION"],
];

export function classifier(idx: AccountIndex) {
  const groupOf = (id: string) => idx.chain(id).find((x) => x.level === "GROUP")?.id ?? null;
  const ledgerOf = (id: string) => idx.chain(id).find((x) => x.level === "LEDGER")?.id ?? null;
  const curAsset = groupOf(idx.byKey.get("INVENTORY")?.id ?? "");
  const curLiab = groupOf(idx.byKey.get("AP")?.id ?? "");
  const salesLedger = ledgerOf(idx.byKey.get("SALES")?.id ?? "");
  const fixedLedger = ledgerOf(idx.byKey.get("ACCUM_DEPRECIATION")?.id ?? "");
  const cache = new Map<string, { cat: CashCat; group: string }>();
  return (a: AccAccount): { cat: CashCat; group: string } => {
    const hit = cache.get(a.id);
    if (hit) return hit;
    const k = a.systemKey ?? "";
    let r: { cat: CashCat; group: string };
    if (LOAN_KEYS.has(k)) r = { cat: "financing", group: "loans" };
    else if (a.class === "EQUITY") r = { cat: "financing", group: "owners" };
    else if (k === "ASSET_DISPOSAL") r = { cat: "investing", group: "assets" };
    else if (a.class === "ASSET" && curAsset && groupOf(a.id) !== curAsset) r = { cat: "investing", group: ledgerOf(a.id) === fixedLedger ? "assets" : "deposits" };
    else if (a.class === "LIABILITY" && curLiab && groupOf(a.id) !== curLiab && k !== "END_OF_SERVICE") r = { cat: "financing", group: "longdebt" };
    else if (CUSTOMER_KEYS.has(k) || (salesLedger && ledgerOf(a.id) === salesLedger)) r = { cat: "operating", group: "customers" };
    else if (SUPPLIER_KEYS.has(k)) r = { cat: "operating", group: "suppliers" };
    else if (TAX_KEYS.has(k)) r = { cat: "operating", group: "tax" };
    else if (STAFF_KEYS.has(k) || a.class === "EXPENSE") r = { cat: "operating", group: "expenses" };
    else r = { cat: "operating", group: "other" };
    cache.set(a.id, r);
    return r;
  };
}

/** خالص نقد یک سند میان حساب‌های طرف مقابل — خالص هر حساب: بدهکار − بستانکار */
export function allocate(cash: bigint, nets: Map<string, bigint>, keyOf: (accountId: string) => string | null): Map<string, bigint> {
  const n = new Map(nets);
  // جفت‌های غیرنقدی
  const byKey = new Map<string, string>();
  for (const id of n.keys()) {
    const k = keyOf(id);
    if (k) byKey.set(k, id);
  }
  for (const [a, b] of NONCASH_PAIRS) {
    const ia = byKey.get(a);
    const ib = byKey.get(b);
    if (!ia || !ib) continue;
    const sa = n.get(ia)!;
    const sb = n.get(ib)!;
    if (sa === 0n || sb === 0n || sa > 0n === sb > 0n) continue;
    const c = (sa < 0n ? -sa : sa) < (sb < 0n ? -sb : sb) ? (sa < 0n ? -sa : sa) : sb < 0n ? -sb : sb;
    n.set(ia, sa > 0n ? sa - c : sa + c);
    n.set(ib, sb > 0n ? sb - c : sb + c);
  }
  // ورود نقد ← حساب‌های بستانکار؛ خروج ← بدهکار
  const side = [...n.entries()].filter(([, s]) => (cash > 0n ? s < 0n : s > 0n)).map(([id, s]) => [id, s < 0n ? -s : s] as const);
  const W = side.reduce((t, [, w]) => t + w, 0n);
  const out = new Map<string, bigint>();
  if (W === 0n) {
    out.set("", cash);
    return out;
  }
  let given = 0n;
  let big = side[0];
  for (const e of side) {
    if (e[1] > big[1]) big = e;
    const share = (cash * e[1]) / W;
    out.set(e[0], share);
    given += share;
  }
  out.set(big[0], out.get(big[0])! + cash - given);
  return out;
}

interface Flow {
  in: bigint;
  out: bigint;
}

async function treasuryBalance(db: Db, where: Record<string, unknown>) {
  const s = await db.accVoucherLine.aggregate({ where: { isVoid: false, treasuryId: { not: null }, ...NOT_CARRY, ...where }, _sum: { debit: true, credit: true } });
  return (s._sum.debit ?? 0n) - (s._sum.credit ?? 0n);
}

const BATCH = 2000;

/** جریان هر حساب طرف مقابل در بازه؛ `detailAccount` ← فهرست سندهای همان حساب */
async function flows(db: Db, range: DateRange, detailAccount?: string | null) {
  const dateW = range.from || range.to ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {};
  const cashByVoucher = await db.accVoucherLine.groupBy({
    by: ["voucherId"],
    where: { isVoid: false, treasuryId: { not: null }, ...dateW, ...NOT_CARRY, voucher: { source: { not: "OPENING" }, OR: [{ sourceId: null }, { NOT: { sourceId: { startsWith: "carry:" } } }] } },
    _sum: { debit: true, credit: true },
  });
  const cash = new Map(cashByVoucher.map((v) => [v.voucherId, (v._sum.debit ?? 0n) - (v._sum.credit ?? 0n)] as const).filter(([, t]) => t !== 0n));
  const ids = [...cash.keys()];
  const accounts = await db.accAccount.findMany();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const keyOf = (id: string) => byId.get(id)?.systemKey ?? null;
  const per = new Map<string, Flow>();
  const detail: { voucherId: string; amount: bigint }[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const lines = await db.accVoucherLine.findMany({ where: { voucherId: { in: chunk }, treasuryId: null, isVoid: false }, select: { voucherId: true, accountId: true, debit: true, credit: true } });
    const nets = new Map<string, Map<string, bigint>>();
    for (const l of lines) {
      const m = nets.get(l.voucherId) ?? new Map<string, bigint>();
      m.set(l.accountId, (m.get(l.accountId) ?? 0n) + l.debit - l.credit);
      nets.set(l.voucherId, m);
    }
    for (const vid of chunk) {
      const alloc = allocate(cash.get(vid)!, nets.get(vid) ?? new Map(), keyOf);
      for (const [acc, amt] of alloc) {
        if (amt === 0n) continue;
        const f = per.get(acc) ?? { in: 0n, out: 0n };
        if (amt > 0n) f.in += amt;
        else f.out -= amt;
        per.set(acc, f);
        if (detailAccount !== undefined && acc === (detailAccount ?? "")) detail.push({ voucherId: vid, amount: amt });
      }
    }
  }
  return { per, byId, detail, vouchers: ids.length };
}

export async function cashFlow(db: Db, range: DateRange, compare: DateRange | null) {
  const idx = await accountIndex(db);
  const classify = classifier(idx);
  const [cur, prev] = await Promise.all([flows(db, range), compare ? flows(db, compare) : Promise.resolve(null)]);

  const opening = range.from ? await treasuryBalance(db, { date: { lt: range.from } }) : 0n;
  const dateW = range.from || range.to ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {};
  const openingDocs = await treasuryBalance(db, { ...dateW, voucher: { source: "OPENING", OR: [{ sourceId: null }, { NOT: { sourceId: { startsWith: "carry:" } } }] } });
  const closing = await treasuryBalance(db, range.to ? { date: { lte: range.to } } : {});

  type Line = { accountId: string; code: string; name: string; in: bigint; out: bigint; net: bigint; prev: bigint | null };
  const groups = new Map<string, { cat: CashCat; key: string; title: string; lines: Line[] }>();
  const keys = new Set([...cur.per.keys(), ...(prev?.per.keys() ?? [])]);
  for (const id of keys) {
    const a = cur.byId.get(id);
    const c = a ? classify(a) : { cat: "operating" as CashCat, group: "other" };
    const f = cur.per.get(id) ?? { in: 0n, out: 0n };
    const p = prev?.per.get(id);
    const g = groups.get(c.group) ?? { cat: c.cat, key: c.group, title: GROUP_TITLES[c.group], lines: [] };
    g.lines.push({ accountId: id, code: a?.code ?? "", name: a?.name ?? "بی‌طرف حساب", in: f.in, out: f.out, net: f.in - f.out, prev: prev ? (p ? p.in - p.out : 0n) : null });
    groups.set(c.group, g);
  }
  const sum = (ls: Line[], f: (l: Line) => bigint) => ls.reduce((s, l) => s + f(l), 0n);
  const sections = (["operating", "investing", "financing"] as CashCat[]).map((cat) => {
    const gs = GROUP_ORDER.map((k) => groups.get(k))
      .filter((g): g is NonNullable<typeof g> => !!g && g.cat === cat)
      .map((g) => {
        const lines = g.lines.sort((x, y) => x.code.localeCompare(y.code));
        return { key: g.key, title: g.title, lines, in: sum(lines, (l) => l.in), out: sum(lines, (l) => l.out), net: sum(lines, (l) => l.net), prev: prev ? sum(lines, (l) => l.prev ?? 0n) : null };
      });
    return {
      key: cat,
      title: CAT_TITLES[cat],
      groups: gs,
      in: gs.reduce((s, g) => s + g.in, 0n),
      out: gs.reduce((s, g) => s + g.out, 0n),
      net: gs.reduce((s, g) => s + g.net, 0n),
      prev: prev ? gs.reduce((s, g) => s + (g.prev ?? 0n), 0n) : null,
    };
  });
  const net = sections.reduce((s, x) => s + x.net, 0n);
  const prevNet = prev ? sections.reduce((s, x) => s + (x.prev ?? 0n), 0n) : null;
  return {
    sections,
    opening,
    openingDocs,
    net,
    prevNet,
    closing,
    /** موجودی ابتدا + افتتاحیه + خالص = موجودی پایان */
    reconciled: opening + openingDocs + net === closing,
    vouchers: cur.vouchers,
  };
}

/** سندهای سازنده‌ی جریان یک حساب — پاپ‌آپ هر عدد */
export async function cashFlowDetail(db: Db, range: DateRange, accountId: string) {
  const { detail } = await flows(db, range, accountId);
  detail.sort((a, b) => (a.amount < 0n ? -a.amount : a.amount) > (b.amount < 0n ? -b.amount : b.amount) ? -1 : 1);
  const top = detail.slice(0, 500);
  const vs = await db.accVoucher.findMany({ where: { id: { in: top.map((d) => d.voucherId) } }, select: { id: true, number: true, date: true, description: true, source: true } });
  const vmap = new Map(vs.map((v) => [v.id, v]));
  return {
    total: detail.reduce((s, d) => s + d.amount, 0n),
    count: detail.length,
    rows: top
      .map((d) => ({ ...vmap.get(d.voucherId)!, amount: d.amount }))
      .filter((r) => r.id)
      .sort((a, b) => b.date.getTime() - a.date.getTime() || b.number - a.number),
  };
}
