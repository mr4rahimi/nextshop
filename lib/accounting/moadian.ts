/**
 * خروجی اکسل سامانه‌ی مودیان — docs/plans/webhesab-parity.md بخش ۳۰.
 *
 * قالب همان «خروجی اکسل سامانه مودیان» وب حساب است: دو برگه، سطر ۱ کد فیلد رسمی و سطر ۲
 * نام فارسی، بعد داده. فایل به نرم‌افزار واسط/شرکت معتمد داده می‌شود؛ فایل نتیجه‌ی واسط
 * (inno ← شماره‌ی منحصربه‌فرد مالیاتی) با `importMoadianResult` برمی‌گردد.
 *
 * قاعده‌های رسمی (دستورالعمل صدور صورتحساب الکترونیکی RC_IITP.IS V7.8):
 * - همه‌ی مبالغ **ریال** و با **قطع** اعشار (نه گرد): vam = ⌊adis × vra ÷ ۱۰۰⌋.
 * - dis تخفیف کل ردیف است، adis = prdis − dis، tsstam = adis + vam؛ جمع‌های سرآمد = جمع ردیف‌ها.
 * - نوع ۱ خریدار می‌خواهد: حقوقی شماره‌ی اقتصادی؛ حقیقی شماره‌ی اقتصادی یا کد ملی + کد پستی.
 *   نوع ۲ خریدار نمی‌خواهد و تسویه‌اش نقدی است.
 * - ins: ۱ اصلی، ۳ ابطالی، ۴ برگشت از فروش (اقلام فروش منهای برگشتی‌ها) — ۳ و ۴ با irtaxid.
 * - mu (کد واحد) در الگوی فروش اختیاری است و فرستاده نمی‌شود (فهرست رسمی کدها در دست نیست).
 *
 * ⚠️ مبالغ پنل تومان‌اند و مالیات پنل گرد می‌شود؛ پس عدد مودیان از نو و جدا ساخته می‌شود
 *    و ممکن است چند ریال با جمع فاکتور فرق کند (`diff` در پیش‌نمایش).
 */

import type { AccInvoice, AccInvoiceLine, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "./errors";
import { faNum, toLatinDigits } from "./money";
import { lineGross } from "./invoices/calc";
import { GLOBAL_SEQ, nextNumber } from "./ledger/sequence";
import type { Actor } from "./ledger/post";
import { writeXlsx, type Cell } from "./import/xlsx-write";
import type { Sheet } from "./import/sheet";
import { toJalali } from "@/lib/club/jalali";

type Db = Prisma.TransactionClient | typeof prisma;
type Inv = AccInvoice & { lines: AccInvoiceLine[] };

export const MOADIAN_STATUS: Record<string, string> = {
  EXPORTED: "در فایل — منتظر نتیجه",
  SENT: "ثبت شد",
  FAILED: "رد شد",
  CANCEL_EXPORTED: "ابطال در فایل",
  CANCELED: "ابطال شد",
};

export const digitsOnly = (v: string | null | undefined) => toLatinDigits(v ?? "").replace(/\D/g, "");
export const isSstid = (v: string | null | undefined) => /^\d{13}$/.test(digitsOnly(v));

// ── محاسبه‌ی ریالی ردیف ────────────────────────────────────────────────

export interface BodyRow {
  sstid: string;
  sstt: string;
  /** تعداد — رشته تا اعشار احتمالی دقیق بماند */
  am: string;
  fee: string;
  prdis: bigint;
  dis: bigint;
  adis: bigint;
  /** درصد با حداکثر دو رقم اعشار */
  vra: string;
  vam: bigint;
  tsstam: bigint;
}

const SCALE = 100_000_000n; // ۸ رقم اعشار fee

/** «12.5» از مقدار مقیاس‌شده با ۸ رقم */
function scaled(v: bigint): string {
  const int = v / SCALE;
  const frac = (v % SCALE).toString().padStart(8, "0").replace(/0+$/, "");
  return frac ? `${int}.${frac}` : `${int}`;
}

/**
 * یک ردیف با مبالغ هدف (ریال). fee = prdis ÷ am؛ اگر بخش‌پذیر نیست با ۸ رقم قطع می‌شود و
 * prdis = ⌊am × fee⌋ — اختلاف (حداکثر ۱ ریال) از تخفیف کم می‌شود تا adis همان بماند.
 */
export function bodyRow(p: { sstid: string; sstt: string; am: number; prdis: bigint; dis: bigint; vatBp: number }): BodyRow {
  const am = BigInt(p.am);
  const adisTarget = p.prdis - p.dis;
  let prdis = p.prdis;
  let fee: string;
  if (prdis % am === 0n) fee = (prdis / am).toString();
  else {
    const f = (prdis * SCALE) / am;
    fee = scaled(f);
    prdis = (am * f) / SCALE;
  }
  const dis = prdis - adisTarget > 0n ? prdis - adisTarget : 0n;
  const adis = prdis - dis;
  const vam = (adis * BigInt(p.vatBp)) / 10000n;
  const vra = p.vatBp % 100 ? (p.vatBp / 100).toFixed(2).replace(/0$/, "") : String(p.vatBp / 100);
  return { sstid: p.sstid, sstt: p.sstt.slice(0, 400), am: String(p.am), fee, prdis, dis, adis, vra, vam, tsstam: adis + vam };
}

/** ردیف‌های ریالی یک ردیف فاکتور — با تعداد `qty` (برای برگشت از فروش: مانده) */
function lineRows(l: AccInvoiceLine, qty: number, inclVat: boolean, sstid: string): BodyRow | null {
  if (qty <= 0) return null;
  const whole = l.packSize && qty % l.packSize === 0;
  const ratioNum = BigInt(qty);
  const ratioDen = BigInt(l.qty);
  // مبالغ تومانی کل ردیف ← ریال، به نسبت تعداد (برای ردیف کامل نسبت ۱ است)
  const grossR = (lineGross(l) * 10n * ratioNum) / ratioDen;
  const netR = ((l.lineTotal - l.vatAmount) * 10n * ratioNum) / ratioDen;
  const discR = ((l.discount + l.invoiceDiscountShare) * 10n * ratioNum) / ratioDen;
  let prdis: bigint;
  let dis: bigint;
  if (!inclVat) {
    prdis = grossR;
    dis = discR;
    if (prdis - dis !== netR) dis = prdis - netR > 0n ? prdis - netR : 0n; // خرده‌ی تقسیم نسبت
  } else {
    // قیمت با مالیات: پیش از مالیات = ⌊ناخالص × ۱۰۰۰۰ ÷ (۱۰۰۰۰ + نرخ)⌋
    prdis = (grossR * 10000n) / BigInt(10000 + l.vatRateBp);
    if (prdis < netR) prdis = netR;
    dis = prdis - netR;
  }
  if (netR <= 0n && prdis <= 0n) return null;
  const am = whole && l.packSize ? qty / l.packSize : qty;
  const sstt = whole && l.packSize ? `${l.title} (${l.unit ?? "بسته"} ${faNum(l.packSize)}تایی)` : l.title;
  return bodyRow({ sstid, sstt, am, prdis, dis, vatBp: l.vatRateBp });
}

// ── پیش‌نمایش ──────────────────────────────────────────────────────────

export interface MoadianRow {
  invoiceId: string;
  /** فاکتوری که این ردیف درباره‌اش است (برگشتی: خودش؛ ابطال: فاکتور باطل‌شده) */
  type: AccInvoice["type"];
  number: number | null;
  date: Date;
  partyName: string;
  partyId: string;
  ins: 1 | 3 | 4;
  inty: 1 | 2;
  /** چرا نوع ۲: «خریدار کد ملی/پستی ندارد» … */
  intyNote: string | null;
  status: string | null;
  taxId: string | null;
  irtaxid: string | null;
  refId: string | null;
  inno: string | null;
  setm: 1 | 2 | 3;
  header: {
    tob: number | null;
    bid: string | null;
    tinb: string | null;
    bpc: string | null;
    tprdis: bigint;
    tdis: bigint;
    tadis: bigint;
    tvam: bigint;
    tbill: bigint;
    cap: bigint | null;
    insp: bigint | null;
  };
  body: BodyRow[];
  /** جمع فاکتور به ریال − tbill (خرده‌ی قطع اعشار) */
  diff: bigint;
  /** مانع ارسال — ردیف در فایل نمی‌آید */
  issues: string[];
  /** کالاهای بی‌شناسه (لینک کاردکس) */
  missing: { id: string; title: string }[];
}

export interface PreviewFilter {
  from: Date;
  to: Date;
  /** همه نوع ۲ (بی‌خریدار) — مثل «بدون اطلاعات خریدار» وب حساب */
  allType2?: boolean;
  /** فقط وضعیت‌های خاص — پیش‌فرض: هر چه هنوز ثبت نشده */
  scope?: "pending" | "exported" | "sent" | "all";
}

interface Ctx {
  settings: { tins: string; sbc: string | null; defaultSstid: string | null; shippingSstid: string | null };
  sstidOf: (l: AccInvoiceLine) => string | null;
}

async function context(db: Db, productIds: string[]): Promise<Ctx> {
  const [s, costs, items, groups] = await Promise.all([
    db.accSettings.findUnique({ where: { id: "singleton" } }),
    db.accProductCost.findMany({ where: { productId: { in: productIds }, taxCode: { not: null } }, select: { productId: true, taxCode: true } }),
    db.accItem.findMany({ where: { id: { in: productIds } }, select: { id: true, groupId: true } }),
    db.accItemGroup.findMany({ select: { id: true, parentId: true, taxCode: true } }),
  ]);
  const byCost = new Map(costs.map((c) => [c.productId, digitsOnly(c.taxCode)]));
  const groupOf = new Map(items.map((i) => [i.id, i.groupId]));
  const g = new Map(groups.map((x) => [x.id, x]));
  const groupCode = (id: string | null | undefined): string | null => {
    for (let cur = id, i = 0; cur && i < 50; i++) {
      const row = g.get(cur);
      if (!row) return null;
      if (isSstid(row.taxCode)) return digitsOnly(row.taxCode);
      cur = row.parentId;
    }
    return null;
  };
  const def = isSstid(s?.moadianSstid) ? digitsOnly(s?.moadianSstid) : null;
  return {
    settings: {
      tins: digitsOnly(s?.sellerEconomicCode),
      sbc: digitsOnly(s?.sellerBranchCode) || null,
      defaultSstid: def,
      shippingSstid: isSstid(s?.moadianShippingSstid) ? digitsOnly(s?.moadianShippingSstid) : null,
    },
    sstidOf: (l) => {
      if (isSstid(l.taxCode)) return digitsOnly(l.taxCode);
      if (l.productId) {
        const c = byCost.get(l.productId);
        if (c && /^\d{13}$/.test(c)) return c;
        const gc = groupCode(groupOf.get(l.productId));
        if (gc) return gc;
      }
      return def;
    },
  };
}

/** خریدار نوع ۱ — یا دلیل اینکه نمی‌شود */
function buyerOf(inv: AccInvoice, personType: "REAL" | "LEGAL"): { ok: true; tob: number; bid: string | null; tinb: string | null; bpc: string | null } | { ok: false; why: string } {
  const tinb = digitsOnly(inv.partyEconomicCode);
  const bid = digitsOnly(inv.partyNationalId);
  const bpc = digitsOnly(inv.partyPostalCode);
  const okTinb = /^(\d{11}|\d{14})$/.test(tinb);
  if (personType === "LEGAL") {
    return okTinb ? { ok: true, tob: 2, bid: /^\d{11}$/.test(bid) ? bid : null, tinb, bpc: /^\d{10}$/.test(bpc) ? bpc : null } : { ok: false, why: "خریدار حقوقی شماره‌ی اقتصادی ۱۱ یا ۱۴ رقمی ندارد" };
  }
  const okBid = /^\d{10}$/.test(bid);
  const okBpc = /^\d{10}$/.test(bpc);
  if (okTinb || (okBid && okBpc)) return { ok: true, tob: 1, bid: okBid ? bid : null, tinb: okTinb ? tinb : null, bpc: okBpc ? bpc : null };
  return { ok: false, why: "خریدار کد ملی و کد پستی ۱۰ رقمی (یا شماره‌ی اقتصادی) ندارد" };
}

function settle(inv: AccInvoice, inty: number, tadis: bigint): { setm: 1 | 2 | 3; cap: bigint | null; insp: bigint | null } {
  if (inty === 2 || inv.paidTotal >= inv.total) return { setm: 1, cap: null, insp: null };
  if (inv.paidTotal <= 0n) return { setm: 2, cap: null, insp: null };
  // نقد/نسیه — هر دو بی‌مالیات: cap + insp = tadis
  const cap = (tadis * inv.paidTotal) / inv.total;
  return { setm: 3, cap, insp: tadis - cap };
}

function totals(body: BodyRow[]) {
  const sum = (f: (b: BodyRow) => bigint) => body.reduce((s, b) => s + f(b), 0n);
  return { tprdis: sum((b) => b.prdis), tdis: sum((b) => b.dis), tadis: sum((b) => b.adis), tvam: sum((b) => b.vam), tbill: sum((b) => b.tsstam) };
}

function bodyOf(ctx: Ctx, inv: Inv, remaining?: Map<string, number>, additions: bigint = inv.additions): { body: BodyRow[]; missing: { id: string; title: string }[]; issues: string[] } {
  const body: BodyRow[] = [];
  const missing: { id: string; title: string }[] = [];
  const issues: string[] = [];
  for (const l of inv.lines) {
    const sstid = ctx.sstidOf(l);
    const qty = remaining ? remaining.get(l.id) ?? 0 : l.qty;
    if (qty <= 0) continue;
    if (!sstid) {
      if (l.productId) missing.push({ id: l.productId, title: l.title });
      else issues.push(`ردیف «${l.title}» شناسه‌ی مالیاتی ندارد`);
      continue;
    }
    const row = lineRows(l, qty, inv.pricesIncludeVat, sstid);
    if (row) body.push(row);
  }
  if (additions > 0n) {
    if (!ctx.settings.shippingSstid) issues.push(`${inv.additionsTitle ?? "هزینه‌ی ارسال"}: شناسه‌ی خدمت ارسال در تنظیمات نیست`);
    else body.push(bodyRow({ sstid: ctx.settings.shippingSstid, sstt: inv.additionsTitle ?? "هزینه‌ی ارسال", am: 1, prdis: additions * 10n, dis: 0n, vatBp: 0 }));
  }
  if (missing.length) issues.push(`${faNum(missing.length)} کالا شناسه‌ی مالیاتی ندارد`);
  return { body, missing, issues };
}

/** فهرست فاکتورهای مودیان در بازه — با همه‌ی عددهای فایل و ایرادها */
export async function moadianPreview(db: Db, f: PreviewFilter): Promise<{ rows: MoadianRow[]; blockers: string[] }> {
  const scope = f.scope ?? "pending";
  const statusWhere: Prisma.AccInvoiceWhereInput =
    scope === "pending" ? { OR: [{ taxStatus: null }, { taxStatus: "FAILED" }] } :
    scope === "exported" ? { taxStatus: { in: ["EXPORTED", "CANCEL_EXPORTED"] } } :
    scope === "sent" ? { taxStatus: { in: ["SENT", "CANCELED"] } } :
    {};
  const [main, voided] = await Promise.all([
    db.accInvoice.findMany({
      where: { type: { in: ["SALES", "SALES_RETURN"] }, status: "ISSUED", date: { gte: f.from, lte: f.to }, ...statusWhere },
      include: { lines: { orderBy: { seq: "asc" } } },
      orderBy: [{ date: "asc" }, { number: "asc" }],
      take: 3000,
    }),
    // ابطال: فاکتور ثبت‌شده‌ای که بعداً باطل شد — بی‌بازه، چون کار مانده است
    scope === "pending" || scope === "all" || scope === "exported"
      ? db.accInvoice.findMany({
          where: { type: "SALES", status: "VOID", taxId: { not: null }, taxStatus: scope === "exported" ? "CANCEL_EXPORTED" : scope === "pending" ? "SENT" : { in: ["SENT", "CANCEL_EXPORTED"] } },
          include: { lines: { orderBy: { seq: "asc" } } },
          take: 500,
        })
      : Promise.resolve([] as Inv[]),
  ]);
  const refIds = [...new Set(main.filter((i) => i.refInvoiceId).map((i) => i.refInvoiceId!))];
  const refs = new Map(
    (await db.accInvoice.findMany({ where: { id: { in: refIds } }, include: { lines: { orderBy: { seq: "asc" } } } })).map((r) => [r.id, r]),
  );
  // همه‌ی برگشتی‌های معتبر هر فاکتور مرجع — مانده‌ی اقلام برای ins = 4
  const siblings = refIds.length
    ? await db.accInvoice.findMany({
        where: { refInvoiceId: { in: refIds }, status: "ISSUED", type: "SALES_RETURN" },
        include: { lines: { select: { refLineId: true, qty: true } } },
        // additions هم لازم است: ارسالِ برگشت‌داده‌شده از ردیف ارسال کم می‌شود
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      })
    : [];
  const all = [...main, ...voided, ...refs.values()];
  const ctx = await context(db, [...new Set(all.flatMap((i) => i.lines.map((l) => l.productId).filter((x): x is string => !!x)))]);
  const parties = new Map(
    (await db.accParty.findMany({ where: { id: { in: [...new Set(all.map((i) => i.partyId))] } }, select: { id: true, personType: true } })).map((p) => [p.id, p.personType]),
  );

  const blockers: string[] = [];
  if (!/^(\d{11}|\d{14})$/.test(ctx.settings.tins)) blockers.push("شماره‌ی اقتصادی فروشنده (۱۱ یا ۱۴ رقم) در تنظیمات ← اطلاعات کسب‌وکار ثبت نشده");

  const rows: MoadianRow[] = [];
  const base = (inv: Inv) => ({
    invoiceId: inv.id,
    type: inv.type,
    number: inv.number,
    date: inv.date,
    partyName: inv.partyName,
    partyId: inv.partyId,
    status: inv.taxStatus,
    taxId: inv.taxId,
    inno: inv.moadianInno,
  });

  for (const inv of main) {
    if (inv.type === "SALES") {
      const { body, missing, issues } = bodyOf(ctx, inv);
      let inty: 1 | 2 = 2;
      let intyNote: string | null = f.allType2 ? "همه بدون اطلاعات خریدار" : null;
      let buyer: { tob: number | null; bid: string | null; tinb: string | null; bpc: string | null } = { tob: null, bid: null, tinb: null, bpc: null };
      if (!f.allType2) {
        const b = buyerOf(inv, parties.get(inv.partyId) ?? "REAL");
        if (b.ok) {
          inty = 1;
          buyer = { tob: b.tob, bid: b.bid, tinb: b.tinb, bpc: b.bpc };
        } else intyNote = b.why;
      }
      if (inv.taxStatus === "EXPORTED" && inv.moadianInty && inv.moadianInty !== inty) {
        inty = inv.moadianInty as 1 | 2; // همان فایل قبلی — نوع عوض نمی‌شود تا نتیجه بیاید
      }
      const t = totals(body);
      if (body.length && t.tprdis <= 0n) issues.push("مبلغ صورتحساب صفر است");
      if (!body.length && !issues.length) issues.push("ردیفی برای ارسال ندارد");
      const st = settle(inv, inty, t.tadis);
      rows.push({ ...base(inv), ins: 1, inty, intyNote, irtaxid: null, refId: null, setm: st.setm, header: { ...buyer, ...t, cap: st.cap, insp: st.insp }, body, diff: inv.total * 10n - t.tbill, issues, missing });
      continue;
    }
    // برگشت از فروش: اقلام فروش منهای همه‌ی برگشتی‌ها تا همین یکی؛ همه برگشت‌شده = ابطال
    const ref = inv.refInvoiceId ? refs.get(inv.refInvoiceId) : null;
    const issues: string[] = [];
    if (!ref) {
      rows.push({ ...base(inv), ins: 4, inty: 2, intyNote: null, irtaxid: null, refId: null, setm: 1, header: { tob: null, bid: null, tinb: null, bpc: null, tprdis: 0n, tdis: 0n, tadis: 0n, tvam: 0n, tbill: 0n, cap: null, insp: null }, body: [], diff: 0n, issues: ["برگشتی بی‌فاکتور مرجع — در سامانه‌ی مودیان برگشت فقط با ارجاع به صورتحساب اصلی ثبت می‌شود"], missing: [] });
      continue;
    }
    const chain = siblings.filter((s) => s.refInvoiceId === ref.id);
    const upto = chain.slice(0, chain.findIndex((s) => s.id === inv.id) + 1);
    const prev = chain[chain.findIndex((s) => s.id === inv.id) - 1];
    const irtaxid = prev ? prev.taxId : ref.taxId;
    if (!ref.taxId || ref.taxStatus !== "SENT") issues.push(`فاکتور فروش ${faNum(ref.number ?? 0)} هنوز در سامانه ثبت نشده (شماره‌ی مالیاتی ندارد)`);
    else if (prev && (!prev.taxId || prev.taxStatus !== "SENT")) issues.push("برگشتی قبلیِ همین فاکتور هنوز شماره‌ی مالیاتی ندارد — اول آن");
    const returned = new Map<string, number>();
    for (const s of upto) for (const l of s.lines) if (l.refLineId) returned.set(l.refLineId, (returned.get(l.refLineId) ?? 0) + l.qty);
    const remaining = new Map(ref.lines.map((l) => [l.id, l.qty - (returned.get(l.id) ?? 0)]));
    const allBack = [...remaining.values()].every((q) => q <= 0);
    const shipLeft = ref.additions - upto.reduce((s, x) => s + x.additions, 0n);
    const b = allBack ? { body: [], missing: [], issues: [] } : bodyOf(ctx, ref, remaining, shipLeft > 0n ? shipLeft : 0n);
    issues.push(...b.issues);
    const inty = (ref.moadianInty ?? 2) as 1 | 2;
    const t = totals(b.body);
    const st = settle(ref, inty, t.tadis);
    rows.push({
      ...base(inv),
      ins: allBack ? 3 : 4,
      inty,
      intyNote: allBack ? "همه‌ی اقلام برگشت خورده — ابطال صورتحساب" : null,
      irtaxid: irtaxid ?? null,
      refId: ref.id,
      setm: st.setm,
      header: { tob: null, bid: null, tinb: null, bpc: null, ...t, cap: st.cap, insp: st.insp },
      body: b.body,
      diff: 0n,
      issues,
      missing: b.missing,
    });
  }

  for (const inv of voided) {
    rows.push({
      ...base(inv),
      // ابطالِ هنوز نفرستاده «آماده» است، نه «ثبت شد» (وضعیت فاکتور اصلی)
      status: inv.taxStatus === "SENT" ? null : inv.taxStatus,
      ins: 3,
      inty: (inv.moadianInty ?? 2) as 1 | 2,
      intyNote: "فاکتور باطل شد — ابطال صورتحساب",
      irtaxid: inv.taxId,
      refId: null,
      setm: 1,
      header: { tob: null, bid: null, tinb: null, bpc: null, tprdis: 0n, tdis: 0n, tadis: 0n, tvam: 0n, tbill: 0n, cap: null, insp: null },
      body: [],
      diff: 0n,
      issues: [],
      missing: [],
    });
  }
  return { rows, blockers };
}

// ── فایل ────────────────────────────────────────────────────────────────

const HEAD_CODES = ["check", "", "inty", "inno", "irtaxid", "inp", "ins", "tins", "tob", "bid", "tinb", "spc", "bpc", "bbc", "ft", "bpn", "scln", "scc", "cdcn", "cdcd", "crn", "billid", "tprdis", "tdis", "tadis", "tvam", "todam", "tbill", "tonw", "torv", "tocv", "setm", "cap", "insp"];
const HEAD_FA = ["فرآیند ارسال", "تاریخ صورتحساب ", "نوع صورتحساب", "سريال صورتحساب داخلي حافظه مالياتي", "شماره منحصر به فرد مالیاتی صورتحساب مرجع", "الگوی صورتحساب", "موضوع صورتحساب", "شماره اقتصادی فروشنده", "نوع شخص خریدار", "شماره/شناسه ملی/شناسه مشارکت مدنی/کد فراگیر", "شماره اقتصادی خریدار", "کد شعبه فروشنده", "کد پستی خریدار", "کد شعبه خریدار", "نوع پرواز", "شماره گذرنامه خریدار", "شماره پروانه گمرکی", "کد گمرک محل اظهار فروشنده", "شماره کوتاژ اظهارنامه گمرکی", "تاریخ کوتاژ اظهارنامه گمرکی", "شناسه یکتای ثبت قرارداد فروشنده", "شماره اشتراک/ شناسه قبض بهره بردار", "مجموع مبلغ قبل از کسر تخفیف", "مجموع تخفیفات", "مجموع مبلغ پس از کسر تخفیف", "مجموع مالیات بر ارزش افزوده", "مجموع سایر مالیات، عوارض و وجوه قانونی", "مجموع صورتحساب", "مجموع وزن خالص", "مجموع ارزش ریالی", "مجموع ارزش ارزی", "روش تسویه", "مبلغ پرداختی نقدی", "مبلغ نسیه"];
const BODY_CODES = ["inno", "", "", "sstid", "sstt", "am", "mu", "fee", "prdis", "dis", "adis", "vra", "vam", "tsstam"];
const BODY_FA = ["سريال صورتحساب داخلي حافظه مالياتي", "تاریخ صورتحساب ", "ردیف", "شناسه کالا/خدمت", "عنوان کالا/خدمت", "تعداد/مقدار", "واحد اندازه گیری", "مبلغ واحد", "مبلغ قبل از تخفیف", "مبلغ تخفیف", "مبلغ بعد از تخفیف", "نرخ مالیات بر ارزش افزوده", "مبلغ مالیات بر ارزش افزوده", "مبلغ کل کالا/خدمت"];

export function jalaliKey(d: Date): string {
  const j = toJalali(d);
  return `${j.year}/${String(j.month).padStart(2, "0")}/${String(j.day).padStart(2, "0")}`;
}

/** ردیف «آماده» در فایل می‌آید؛ تاریخ ابطال = امروز (باید بعد از صورتحساب مرجع باشد) */
export function buildMoadianXlsx(rows: (MoadianRow & { inno: string })[], tins: string, sbc: string | null, today: Date): Buffer {
  const head: Cell[][] = [HEAD_CODES, HEAD_FA];
  const body: Cell[][] = [BODY_CODES, BODY_FA];
  for (const r of rows) {
    const date = jalaliKey(r.ins === 3 ? today : r.date);
    const h = r.header;
    const referring = r.ins !== 1;
    head.push([
      "",
      date,
      r.inty,
      r.inno,
      r.irtaxid ?? "",
      1,
      r.ins,
      tins,
      referring ? "" : h.tob ?? "",
      referring ? "" : h.bid ?? "",
      referring ? "" : h.tinb ?? "",
      sbc ?? "",
      referring ? "" : h.bpc ?? "",
      "", "", "", "", "", "", "", "", "",
      h.tprdis, h.tdis, h.tadis, h.tvam, 0n, h.tbill,
      "", "", "",
      r.setm,
      r.setm === 3 ? h.cap ?? "" : "",
      r.setm === 3 ? h.insp ?? "" : "",
    ]);
    r.body.forEach((b, i) => body.push([r.inno, date, i + 1, b.sstid, b.sstt, Number(b.am), "", Number(b.fee), b.prdis, b.dis, b.adis, Number(b.vra), b.vam, b.tsstam]));
  }
  return writeXlsx([
    { name: "Sheet1", rows: head },
    { name: "Sheet2", rows: body },
  ]);
}

/**
 * فایل برای ردیف‌های انتخاب‌شده: inno تازه (یا همان قبلی اگر هنوز منتظر نتیجه است)، وضعیت
 * «در فایل». ردیف ایرادار یا مانع سراسری = خطا.
 */
export async function exportMoadian(tx: Prisma.TransactionClient, f: PreviewFilter & { ids: string[] }, actor: Actor, today: Date) {
  const pv = await moadianPreview(tx, { ...f, scope: "all" });
  if (pv.blockers.length) throw new AccError(pv.blockers.join("؛ "));
  const want = new Set(f.ids);
  const picked = pv.rows.filter((r) => want.has(r.invoiceId) && r.status !== "SENT" && r.status !== "CANCELED");
  if (!picked.length) throw new AccError("فاکتور آماده‌ای انتخاب نشده");
  const bad = picked.filter((r) => r.issues.length);
  if (bad.length) throw new AccError(`${faNum(bad.length)} فاکتور ایراد دارد و در فایل نمی‌آید (مثلاً شماره‌ی ${faNum(bad[0].number ?? 0)}: ${bad[0].issues[0]})؛ از انتخاب بردارید`);
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" } });
  const out: (MoadianRow & { inno: string })[] = [];
  for (const r of picked) {
    const waiting = r.status === "EXPORTED" || r.status === "CANCEL_EXPORTED";
    const inno = waiting && r.inno ? r.inno : (await nextNumber(tx, GLOBAL_SEQ, "moadian-inno")).toString(16).toUpperCase().padStart(10, "0");
    const cancelOfVoid = r.ins === 3 && !r.refId; // ابطال فاکتور باطل‌شده — روی همان فاکتور
    await tx.accInvoice.update({
      where: { id: r.invoiceId },
      data: { moadianInno: inno, moadianAt: new Date(), moadianNote: null, ...(cancelOfVoid ? { taxStatus: "CANCEL_EXPORTED" } : { taxStatus: "EXPORTED", moadianInty: r.inty }) },
    });
    out.push({ ...r, inno });
  }
  void actor;
  return { buffer: buildMoadianXlsx(out, digitsOnly(s?.sellerEconomicCode), digitsOnly(s?.sellerBranchCode) || null, today), count: out.length };
}

/** برگرداندن «در فایل» به آماده — وقتی فایل هرگز به واسط نرسید */
export async function resetMoadian(tx: Prisma.TransactionClient, ids: string[]) {
  const rows = await tx.accInvoice.findMany({ where: { id: { in: ids }, taxStatus: { in: ["EXPORTED", "CANCEL_EXPORTED", "FAILED"] } }, select: { id: true, taxStatus: true } });
  for (const r of rows) {
    await tx.accInvoice.update({ where: { id: r.id }, data: { taxStatus: r.taxStatus === "CANCEL_EXPORTED" ? "SENT" : null, moadianInno: null, moadianNote: null } });
  }
  return rows.length;
}

/** ثبت دستی شماره‌ی مالیاتی یک فاکتور (از کارپوشه یا پیامک واسط) */
export async function setTaxId(tx: Prisma.TransactionClient, id: string, taxId: string) {
  const t = toLatinDigits(taxId).trim().toUpperCase();
  if (!/^[0-9A-Z]{22}$/.test(t)) throw new AccError("شماره‌ی منحصربه‌فرد مالیاتی ۲۲ نویسه است");
  const inv = await tx.accInvoice.findUnique({ where: { id } });
  if (!inv || (inv.type !== "SALES" && inv.type !== "SALES_RETURN")) throw new AccError("فاکتور فروش پیدا نشد", 404);
  if (inv.taxStatus === "CANCEL_EXPORTED") return tx.accInvoice.update({ where: { id }, data: { taxStatus: "CANCELED", moadianNote: `ابطالیه: ${t}` } });
  return tx.accInvoice.update({ where: { id }, data: { taxId: t, taxStatus: "SENT", moadianNote: null } });
}

const norm = (s: string) => toLatinDigits(s).replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * فایل نتیجه‌ی واسط: هر برگه‌ای که ستون inno («سریال صورتحساب داخلی») دارد؛ ستون شماره‌ی
 * مالیاتی (taxid، «شماره منحصر به فرد مالیاتی» — نه «مرجع») و اختیاری وضعیت/خطا.
 * ردیف با شماره‌ی مالیاتی ← ثبت شد؛ بی‌شماره و با خطا ← رد شد.
 */
export async function importMoadianResult(tx: Prisma.TransactionClient, sheets: Sheet[]) {
  let sent = 0, failed = 0, unknown = 0;
  const notFound: string[] = [];
  let found = false;
  for (const sh of sheets) {
    const hi = sh.rows.findIndex((r) => r.some((c) => /^inno$/i.test(c.trim()) || norm(c).includes("سریال صورتحساب داخلی")));
    if (hi < 0) continue;
    // سطر کد و سطر نام فارسی هر دو ممکن است باشند — ستون از هر کدام پیدا شود
    const heads = [sh.rows[hi], sh.rows[hi + 1] ?? []];
    const col = (test: (h: string) => boolean) => {
      for (const row of heads) {
        const i = row.findIndex((c) => test(norm(c)));
        if (i >= 0) return i;
      }
      return -1;
    };
    const cInno = col((h) => h === "inno" || h.includes("سریال صورتحساب داخلی"));
    const cTax = col((h) => h === "taxid" || (h.includes("منحصر به فرد مالیاتی") && !h.includes("مرجع")));
    const cStatus = col((h) => h === "status" || h.includes("وضعیت"));
    const cErr = col((h) => h === "error" || h === "errors" || h.includes("خطا") || h === "data");
    if (cInno < 0 || cTax < 0) continue;
    found = true;
    const start = hi + (heads[1].some((c) => norm(c).includes("سریال صورتحساب داخلی")) && heads[0].some((c) => /^inno$/i.test(c.trim())) ? 2 : 1);
    for (const r of sh.rows.slice(start)) {
      const inno = toLatinDigits(r[cInno] ?? "").trim().toUpperCase();
      if (!inno) continue;
      const inv = await tx.accInvoice.findUnique({ where: { moadianInno: inno.padStart(10, "0") } });
      if (!inv) {
        unknown++;
        if (notFound.length < 10) notFound.push(inno);
        continue;
      }
      const tax = toLatinDigits(r[cTax] ?? "").trim().toUpperCase();
      const st = norm(cStatus >= 0 ? r[cStatus] ?? "" : "");
      const err = cErr >= 0 ? (r[cErr] ?? "").trim().slice(0, 500) : "";
      const rejected = /fail|reject|error|نامعتبر|رد|خطا|ناموفق/.test(st);
      if (/^[0-9A-Z]{22}$/.test(tax) && !rejected) {
        if (inv.taxStatus === "CANCEL_EXPORTED") await tx.accInvoice.update({ where: { id: inv.id }, data: { taxStatus: "CANCELED", moadianNote: `ابطالیه: ${tax}` } });
        else await tx.accInvoice.update({ where: { id: inv.id }, data: { taxId: tax, taxStatus: "SENT", moadianNote: null } });
        sent++;
      } else if (rejected || err) {
        await tx.accInvoice.update({
          where: { id: inv.id },
          data: { taxStatus: inv.taxStatus === "CANCEL_EXPORTED" ? "SENT" : "FAILED", moadianNote: err || r[cStatus] || "رد شد" },
        });
        failed++;
      }
    }
  }
  if (!found) throw new AccError("ستون «سریال صورتحساب داخلی» (inno) و «شماره منحصر به فرد مالیاتی» (taxid) در فایل پیدا نشد");
  return { sent, failed, unknown, notFound };
}
