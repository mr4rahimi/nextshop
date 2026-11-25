/**
 * دارایی ثابت و استهلاک — docs/plans/webhesab-parity.md بخش ۳۴.۵.
 *
 *   خرید          بد «حساب دارایی» / بس صندوق‌وبانک یا حساب‌های پرداختنی (شخص)
 *                 — از فاکتور خرید: سند همان فاکتور است (ردیف خدمت روی حساب دارایی)؛ قدیمی: بی‌سند
 *   استهلاک ماه   بد «هزینه‌ی استهلاک» / بس «استهلاک انباشته» — آخر هر ماه شمسی، خودکار
 *   فروش/اسقاط    استهلاک تا آخر ماه قبل + بد انباشته و دریافتی / بس بها؛ تفاوت «سود (زیان) فروش دارایی»
 *
 * پیش‌پرداخت هزینه و ودیعه در `prepaid.ts`؛ هر دو در همان کار ماهانه‌ی `runMonthly`.
 */

import type { AccAssetCategory, AccDepMethod, AccFixedAsset, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError, toAmount } from "../errors";
import { ensureChartRows } from "../ledger/accounts";
import { balanceOf } from "../ledger/balances";
import { postVoucher, voidVoucher, type Actor, type LineInput } from "../ledger/post";
import { parseDay, todayKey } from "../dates";
import { faNum, formatAmount } from "../money";
import { ASSET_CHART_CODES } from "../chart";
import { TREASURY_ACCOUNT_KEY } from "../treasury";
import { lastClosedMonthEnd, monthTitle, postableOn } from "../installment-income";
import { ASSET_CATEGORIES, depTarget, monthEndAt, monthIndex, type DepParams } from "./calc";
import { runPrepaidMonthly } from "./prepaid";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const ACCUM_KEY = "ACCUM_DEPRECIATION";
export const DEP_KEY = "DEPRECIATION";
export const DISPOSAL_KEY = "ASSET_DISPOSAL";

/** حساب‌های ۲.۱۶۸.۰ برای نصب‌های قبلی — idempotent */
export async function ensureAssetChart(tx: Tx) {
  await ensureChartRows(tx, ASSET_CHART_CODES);
}

/** حساب‌های معین بهای دارایی: هم‌کلِ «استهلاک انباشته»، بی‌تفصیلی، غیرسیستمی */
export async function assetAccounts(db: Db) {
  const accum = await db.accAccount.findUnique({ where: { systemKey: ACCUM_KEY }, select: { parentId: true } });
  if (!accum?.parentId) return [];
  return db.accAccount.findMany({
    where: { parentId: accum.parentId, level: "SUBLEDGER", isActive: true, detailKind: "NONE", systemKey: null, class: "ASSET" },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
}

export async function activeTreasury(db: Db, id: string | null | undefined) {
  if (!id) throw new AccError("صندوق یا بانک را انتخاب کنید");
  const t = await db.accTreasury.findUnique({ where: { id } });
  if (!t) throw new AccError("صندوق یا بانک پیدا نشد", 404);
  if (!t.isActive) throw new AccError(`«${t.name}» غیرفعال است`);
  return t;
}

export async function activeParty(db: Db, id: string | null | undefined) {
  if (!id) throw new AccError("شخص را انتخاب کنید");
  const p = await db.accParty.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } });
  if (!p) throw new AccError("شخص پیدا نشد", 404);
  if (!p.isActive) throw new AccError(`«${p.name}» غیرفعال است`);
  return p;
}

const params = (a: Pick<AccFixedAsset, "cost" | "salvage" | "method" | "lifeMonths" | "rateBp" | "openingAccum">): DepParams => ({
  cost: a.cost,
  salvage: a.salvage,
  method: a.method,
  lifeMonths: a.lifeMonths,
  rateBp: a.rateBp,
  openingAccum: a.openingAccum,
});

export const assetLabel = (a: { number: number; name: string }) => `${a.name} (دارایی ${faNum(a.number)})`;

export interface AssetBody {
  name?: string;
  category?: string;
  accountId?: string;
  acquiredOn?: string;
  inServiceOn?: string | null;
  cost?: unknown;
  salvage?: unknown;
  method?: string;
  lifeMonths?: unknown;
  rateBp?: unknown;
  openingAccum?: unknown;
  funding?: string;
  treasuryId?: string | null;
  partyId?: string | null;
  invoiceLineId?: string | null;
  note?: string | null;
}

function depFields(b: AssetBody, cost: bigint) {
  const method = b.method === "DECLINING" ? "DECLINING" : b.method === "STRAIGHT" ? "STRAIGHT" : null;
  if (!method) throw new AccError("روش استهلاک را انتخاب کنید");
  const salvage = toAmount(b.salvage, "ارزش اسقاط");
  if (salvage < 0n || salvage >= cost) throw new AccError("ارزش اسقاط باید از بها کمتر باشد");
  let lifeMonths: number | null = null;
  let rateBp: number | null = null;
  if (method === "STRAIGHT") {
    lifeMonths = Number(b.lifeMonths);
    if (!Number.isInteger(lifeMonths) || lifeMonths < 1 || lifeMonths > 600) throw new AccError("عمر مفید بین ۱ ماه تا ۵۰ سال است");
  } else {
    rateBp = Number(b.rateBp);
    if (!Number.isInteger(rateBp) || rateBp < 100 || rateBp > 10000) throw new AccError("نرخ نزولی بین ۱ تا ۱۰۰ درصد است");
  }
  return { method: method as AccDepMethod, salvage, lifeMonths, rateBp };
}

export async function createAsset(tx: Tx, b: AssetBody, actor: Actor): Promise<AccFixedAsset> {
  await ensureAssetChart(tx);
  const name = String(b.name ?? "").trim();
  if (!name) throw new AccError("نام دارایی را بنویسید");
  const category = b.category as AccAssetCategory;
  if (!ASSET_CATEGORIES.includes(category)) throw new AccError("گروه دارایی را انتخاب کنید");
  const funding = b.funding;
  if (funding !== "INVOICE" && funding !== "TREASURY" && funding !== "CREDIT" && funding !== "EXISTING") throw new AccError("بگویید پول دارایی از کجا پرداخت شد");
  const accounts = await assetAccounts(tx);

  let accountId = b.accountId ?? "";
  let cost: bigint;
  let acquiredOn = parseDay(b.acquiredOn);
  let partyId: string | null = null;
  let treasuryId: string | null = null;
  let invoiceLineId: string | null = null;

  if (funding === "INVOICE") {
    const line = b.invoiceLineId ? await tx.accInvoiceLine.findUnique({ where: { id: b.invoiceLineId }, include: { invoice: true } }) : null;
    if (!line) throw new AccError("ردیف فاکتور خرید را انتخاب کنید");
    if (line.invoice.type !== "PURCHASE" || line.invoice.status !== "ISSUED") throw new AccError("فقط ردیف فاکتور خرید صادرشده");
    if (line.productId || !line.accountId || !accounts.some((a) => a.id === line.accountId)) throw new AccError("این ردیف روی حساب دارایی ثابت نیست");
    if (await tx.accFixedAsset.findFirst({ where: { invoiceLineId: line.id, status: { not: "VOID" } } })) throw new AccError("این ردیف قبلاً دارایی شده است", 409);
    accountId = line.accountId;
    cost = line.lineTotal - line.vatAmount;
    acquiredOn = line.invoice.date;
    partyId = line.invoice.partyId;
    invoiceLineId = line.id;
  } else {
    cost = toAmount(b.cost, "بهای خرید");
    if (!accounts.some((a) => a.id === accountId)) throw new AccError("حساب دارایی را انتخاب کنید");
    if (funding === "TREASURY") treasuryId = (await activeTreasury(tx, b.treasuryId)).id;
    if (funding === "CREDIT") partyId = (await activeParty(tx, b.partyId)).id;
  }
  if (cost <= 0n) throw new AccError("بهای خرید را وارد کنید");
  if (!acquiredOn) throw new AccError("تاریخ خرید را انتخاب کنید");
  const inServiceOn = parseDay(b.inServiceOn) ?? acquiredOn;
  if (inServiceOn.getTime() < acquiredOn.getTime()) throw new AccError("تاریخ بهره‌برداری پیش از خرید نمی‌شود");
  const dep = depFields(b, cost);
  const openingAccum = funding === "EXISTING" ? toAmount(b.openingAccum, "استهلاک انباشته‌ی قبلی") : 0n;
  if (openingAccum < 0n || openingAccum > cost - dep.salvage) throw new AccError("استهلاک انباشته‌ی قبلی از بها منهای اسقاط بیشتر است");

  const asset = await tx.accFixedAsset.create({
    data: {
      name,
      category,
      accountId,
      acquiredOn,
      inServiceOn,
      cost,
      ...dep,
      openingAccum,
      funding,
      treasuryId,
      partyId,
      invoiceLineId,
      note: b.note?.trim() || null,
      createdById: actor.id ?? null,
      createdByName: actor.name,
    },
  });
  if (funding !== "TREASURY" && funding !== "CREDIT") return asset;

  const t = treasuryId ? await activeTreasury(tx, treasuryId) : null;
  const v = await postVoucher(tx, {
    date: acquiredOn,
    description: `خرید دارایی ثابت — ${assetLabel(asset)}`,
    source: "FIXED_ASSET",
    sourceId: `asset:${asset.id}`,
    lines: [
      { accountId, debit: cost, description: name },
      t ? { accountKey: TREASURY_ACCOUNT_KEY[t.kind], treasuryId: t.id, credit: cost } : { accountKey: "AP", partyId, credit: cost, description: `خرید ${name}` },
    ],
    actor,
  });
  return tx.accFixedAsset.update({ where: { id: asset.id }, data: { voucherId: v.id } });
}

async function lockAsset(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "AccFixedAsset" WHERE id = ${id} FOR UPDATE`;
  const a = await tx.accFixedAsset.findUnique({ where: { id } });
  if (!a) throw new AccError("دارایی پیدا نشد", 404);
  return a;
}

/** ویرایش: نام، گروه و یادداشت همیشه؛ بها و روش فقط تا وقتی استهلاکی سند نخورده */
export async function updateAsset(tx: Tx, id: string, b: AssetBody) {
  const a = await lockAsset(tx, id);
  if (a.status !== "ACTIVE") throw new AccError("فقط دارایی فعال ویرایش می‌شود");
  const data: Prisma.AccFixedAssetUpdateInput = {};
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name) throw new AccError("نام دارایی را بنویسید");
    data.name = name;
  }
  if (b.category !== undefined) {
    if (!ASSET_CATEGORIES.includes(b.category as AccAssetCategory)) throw new AccError("گروه دارایی نامعتبر است");
    data.category = b.category as AccAssetCategory;
  }
  if (b.note !== undefined) data.note = b.note?.trim() || null;
  if (b.method !== undefined) {
    if (a.depreciated !== 0n) throw new AccError("برای این دارایی استهلاک ثبت شده؛ روش و عمر دیگر عوض نمی‌شود");
    const dep = depFields(b, a.cost);
    const inServiceOn = parseDay(b.inServiceOn) ?? a.inServiceOn;
    if (inServiceOn.getTime() < a.acquiredOn.getTime()) throw new AccError("تاریخ بهره‌برداری پیش از خرید نمی‌شود");
    const openingAccum = a.funding === "EXISTING" ? toAmount(b.openingAccum ?? a.openingAccum, "استهلاک انباشته‌ی قبلی") : 0n;
    if (openingAccum < 0n || openingAccum > a.cost - dep.salvage) throw new AccError("استهلاک انباشته‌ی قبلی از بها منهای اسقاط بیشتر است");
    Object.assign(data, dep, { inServiceOn, openingAccum, depreciatedThrough: null });
  }
  return tx.accFixedAsset.update({ where: { id }, data });
}

/** ابطال دارایی اشتباهی: سند خرید باطل، استهلاک ثبت‌شده با یک سند امروز برمی‌گردد */
export async function voidAsset(tx: Tx, id: string, reason: string, actor: Actor) {
  const a = await lockAsset(tx, id);
  if (a.status === "VOID") return a;
  if (a.status === "DISPOSED") throw new AccError("اول فروش یا اسقاط را برگردانید");
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  if (a.voucherId) await voidVoucher(tx, a.voucherId, reason, actor, { fromSource: true });
  if (a.depreciated > 0n) {
    await postVoucher(tx, {
      date: todayKey(),
      description: `برگشت استهلاک ${assetLabel(a)} — ابطال دارایی`,
      source: "FIXED_ASSET",
      sourceId: `asset:${a.id}:void`,
      lines: [
        { accountKey: ACCUM_KEY, debit: a.depreciated, description: assetLabel(a) },
        { accountKey: DEP_KEY, credit: a.depreciated, description: "برگشت استهلاک" },
      ],
      actor,
    });
  }
  return tx.accFixedAsset.update({ where: { id }, data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` } });
}

/** روز آخر ماه پیش از ماهِ `day` */
const prevMonthEnd = (day: Date) => lastClosedMonthEnd(day);

/** استهلاک تکمیلی تا آخر ماه پیش از `day` — منفی یعنی بیش از آن ثبت شده (فروش با تاریخ گذشته) */
export function catchUpAt(a: AccFixedAsset, day: Date): bigint {
  return depTarget(params(a), monthIndex(a.inServiceOn, prevMonthEnd(day))) - a.depreciated;
}

export interface DisposeBody {
  date?: string;
  amount?: unknown;
  /** صندوق/بانک دریافت، یا شخص (نسیه)، یا هیچ (اسقاط بی‌دریافت) */
  treasuryId?: string | null;
  partyId?: string | null;
}

export async function disposeAsset(tx: Tx, id: string, b: DisposeBody, actor: Actor) {
  const a = await lockAsset(tx, id);
  if (a.status !== "ACTIVE") throw new AccError(a.status === "VOID" ? "این دارایی باطل شده است" : "این دارایی قبلاً فروخته یا اسقاط شده است", 409);
  const date = parseDay(b.date);
  if (!date) throw new AccError("تاریخ فروش یا اسقاط را انتخاب کنید");
  if (date.getTime() < a.acquiredOn.getTime()) throw new AccError("تاریخ فروش پیش از خرید نمی‌شود");
  const amount = toAmount(b.amount, "مبلغ فروش");
  if (amount < 0n) throw new AccError("مبلغ منفی مجاز نیست");
  const t = amount > 0n && b.treasuryId ? await activeTreasury(tx, b.treasuryId) : null;
  const p = amount > 0n && !t ? await activeParty(tx, b.partyId).catch(() => null) : null;
  if (amount > 0n && !t && !p) throw new AccError("پول فروش به کدام صندوق یا بانک آمد؟ یا خریدار را برای نسیه انتخاب کنید");

  const delta = catchUpAt(a, date);
  const accum = a.openingAccum + a.depreciated + delta;
  const gain = amount + accum - a.cost;
  const label = assetLabel(a);
  const lines: LineInput[] = [];
  if (delta > 0n) lines.push({ accountKey: DEP_KEY, debit: delta, description: `استهلاک تا پیش از فروش — ${label}` }, { accountKey: ACCUM_KEY, credit: delta, description: label });
  if (delta < 0n) lines.push({ accountKey: ACCUM_KEY, debit: -delta, description: label }, { accountKey: DEP_KEY, credit: -delta, description: `برگشت استهلاک ماه‌های بعد از فروش — ${label}` });
  if (accum > 0n) lines.push({ accountKey: ACCUM_KEY, debit: accum, description: `حذف استهلاک انباشته — ${label}` });
  if (t) lines.push({ accountKey: TREASURY_ACCOUNT_KEY[t.kind], treasuryId: t.id, debit: amount, description: `فروش ${a.name}` });
  if (p) lines.push({ accountKey: "AR", partyId: p.id, debit: amount, description: `فروش ${a.name}` });
  lines.push({ accountId: a.accountId, credit: a.cost, description: label });
  if (gain > 0n) lines.push({ accountKey: DISPOSAL_KEY, credit: gain, description: `سود فروش ${a.name}` });
  if (gain < 0n) lines.push({ accountKey: DISPOSAL_KEY, debit: -gain, description: amount > 0n ? `زیان فروش ${a.name}` : `زیان اسقاط ${a.name}` });

  const v = await postVoucher(tx, {
    date,
    description: `${amount > 0n ? "فروش" : "اسقاط"} دارایی ثابت — ${label}`,
    source: "FIXED_ASSET",
    sourceId: `asset:${a.id}:dispose`,
    lines,
    actor,
  });
  if (delta !== 0n) await tx.accDepreciation.create({ data: { assetId: a.id, month: date, amount: delta, voucherId: v.id } });
  return tx.accFixedAsset.update({
    where: { id },
    data: {
      status: "DISPOSED",
      disposedOn: date,
      disposalAmount: amount,
      disposalDep: delta,
      depreciated: a.depreciated + delta,
      disposalTreasuryId: t?.id ?? null,
      disposalPartyId: p?.id ?? null,
      disposalVoucherId: v.id,
    },
  });
}

export async function undisposeAsset(tx: Tx, id: string, actor: Actor) {
  const a = await lockAsset(tx, id);
  if (a.status !== "DISPOSED" || !a.disposalVoucherId) throw new AccError("این دارایی فروخته نشده است");
  await voidVoucher(tx, a.disposalVoucherId, "برگشت فروش یا اسقاط دارایی", actor, { fromSource: true });
  await tx.accDepreciation.deleteMany({ where: { assetId: a.id, voucherId: a.disposalVoucherId } });
  return tx.accFixedAsset.update({
    where: { id },
    data: {
      status: "ACTIVE",
      depreciated: a.depreciated - (a.disposalDep ?? 0n),
      disposedOn: null,
      disposalAmount: null,
      disposalDep: null,
      disposalTreasuryId: null,
      disposalPartyId: null,
      disposalVoucherId: null,
    },
  });
}

// ── کار ماهانه ──

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** سند استهلاک ماه‌های تمام‌شده؛ ماه بسته/قفل جا نمی‌ماند و در اولین ماه باز می‌نشیند */
export async function depreciateAssets(tx: Tx, actor: Actor, L: Date, postable: (d: Date) => Promise<boolean>) {
  const assets = await tx.accFixedAsset.findMany({ where: { status: "ACTIVE" }, orderBy: { number: "asc" } });
  const months = new Map<string, { end: Date; items: { a: AccFixedAsset; amount: bigint }[] }>();
  const through = new Map<string, { at: Date; added: bigint }>();
  for (const a of assets) {
    const p = params(a);
    const n0 = a.depreciatedThrough ? monthIndex(a.inServiceOn, a.depreciatedThrough) + 1 : 1;
    const nL = monthIndex(a.inServiceOn, L);
    if (nL < n0) continue;
    let posted = a.depreciated;
    for (let n = n0; n <= nL; n++) {
      const E = monthEndAt(a.inServiceOn, n);
      if (!(await postable(E))) continue;
      const d = depTarget(p, n) - posted;
      if (d <= 0n) continue;
      posted += d;
      const k = iso(E);
      const m = months.get(k) ?? { end: E, items: [] };
      m.items.push({ a, amount: d });
      months.set(k, m);
    }
    through.set(a.id, { at: L, added: posted - a.depreciated });
  }

  const vouchers: string[] = [];
  let total = 0n;
  for (const k of [...months.keys()].sort()) {
    const m = months.get(k)!;
    const sum = m.items.reduce((s, i) => s + i.amount, 0n);
    const v = await postVoucher(tx, {
      date: m.end,
      description: `استهلاک دارایی‌های ثابت — ${monthTitle(m.end)} (${faNum(m.items.length)} دارایی)`,
      source: "FIXED_ASSET",
      sourceId: `dep:${k}`,
      lines: [
        { accountKey: DEP_KEY, debit: sum, description: `استهلاک ${monthTitle(m.end)}` },
        ...m.items.map((i) => ({ accountKey: ACCUM_KEY, credit: i.amount, description: assetLabel(i.a) })),
      ],
      actor,
    });
    await tx.accDepreciation.createMany({ data: m.items.map((i) => ({ assetId: i.a.id, month: m.end, amount: i.amount, voucherId: v.id })) });
    vouchers.push(v.id);
    total += sum;
  }
  for (const [id, t] of through) {
    await tx.accFixedAsset.update({ where: { id }, data: { depreciatedThrough: t.at, ...(t.added ? { depreciated: { increment: t.added } } : {}) } });
  }
  return { vouchers, amount: total, assets: [...through.values()].filter((t) => t.added > 0n).length };
}

/**
 * کار ماهانه (worker هر ۶ ساعت؛ دکمه‌ی «همین حالا ثبت کن»): استهلاک دارایی‌ها و سهم ماه پیش‌پرداخت‌ها.
 * فقط بعد از تمام شدن هر ماه شمسی چیزی می‌نویسد.
 */
export async function runMonthly(tx: Tx, actor: Actor, opts: { today?: Date } = {}) {
  const empty = { vouchers: [] as string[], amount: 0n };
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } });
  if (s?.mode !== "INTERNAL" || !(await tx.accAccount.count())) return { depreciation: { ...empty, assets: 0 }, prepaid: { ...empty, items: 0 } };
  await ensureAssetChart(tx);
  const L = lastClosedMonthEnd(opts.today ?? todayKey());
  const cache = new Map<string, boolean>();
  const postable = async (d: Date) => {
    const k = iso(d);
    if (!cache.has(k)) cache.set(k, await postableOn(tx, d));
    return cache.get(k)!;
  };
  const depreciation = await depreciateAssets(tx, actor, L, postable);
  const prepaid = await runPrepaidMonthly(tx, actor, L, postable);
  return { depreciation, prepaid };
}

export function monthlySummary(r: Awaited<ReturnType<typeof runMonthly>>): string {
  const parts: string[] = [];
  if (r.depreciation.vouchers.length) parts.push(`${faNum(r.depreciation.vouchers.length)} سند استهلاک (${formatAmount(r.depreciation.amount)})`);
  if (r.prepaid.vouchers.length) parts.push(`${faNum(r.prepaid.vouchers.length)} سند سهم پیش‌پرداخت (${formatAmount(r.prepaid.amount)})`);
  return parts.length ? `ثبت شد: ${parts.join("، ")}` : "ماه تمام‌شده‌ای بی‌سند نمانده بود";
}

// ── فهرست و جزئیات ──

export async function assetsOverview(db: Db, opts: { today?: Date } = {}) {
  const L = lastClosedMonthEnd(opts.today ?? todayKey());
  const [assets, accounts, accumAcc] = await Promise.all([
    db.accFixedAsset.findMany({ orderBy: [{ status: "asc" }, { number: "desc" }], take: 500 }),
    assetAccounts(db),
    db.accAccount.findUnique({ where: { systemKey: ACCUM_KEY }, select: { id: true, name: true } }),
  ]);
  const accName = new Map((await db.accAccount.findMany({ where: { id: { in: [...new Set(assets.map((a) => a.accountId))] } }, select: { id: true, name: true } })).map((a) => [a.id, a.name]));
  const rows = assets.map((a) => {
    const accum = a.openingAccum + a.depreciated;
    const n = monthIndex(a.inServiceOn, L);
    const p = params(a);
    const monthly = a.status === "ACTIVE" ? depTarget(p, n + 1) - depTarget(p, n) : 0n;
    return {
      id: a.id,
      number: a.number,
      name: a.name,
      category: a.category,
      account: accName.get(a.accountId) ?? "—",
      acquiredOn: a.acquiredOn,
      cost: a.cost,
      accum,
      book: a.cost - accum,
      monthly,
      status: a.status,
      funding: a.funding,
      disposedOn: a.disposedOn,
      fully: a.status === "ACTIVE" && accum >= a.cost - a.salvage,
    };
  });
  const live = rows.filter((r) => r.status === "ACTIVE");
  const sum = (f: (r: (typeof rows)[number]) => bigint) => live.reduce((s, r) => s + f(r), 0n);
  const accumBook = accumAcc ? -(await balanceOf(db, { accountId: accumAcc.id })).balance : null;
  return {
    assets: rows,
    accounts,
    accumAccount: accumAcc,
    totals: { cost: sum((r) => r.cost), accum: sum((r) => r.accum), book: sum((r) => r.book), monthly: sum((r) => r.monthly), count: live.length },
    /** مانده‌ی حساب «استهلاک انباشته» در برابر جمع دفتر دارایی‌ها */
    accumBook,
    lastMonth: L,
  };
}

export async function assetDetail(db: Db, id: string) {
  const a = await db.accFixedAsset.findUnique({ where: { id }, include: { entries: { orderBy: { month: "asc" } } } });
  if (!a) throw new AccError("دارایی پیدا نشد", 404);
  const voucherIds = [...new Set([a.voucherId, a.disposalVoucherId, ...a.entries.map((e) => e.voucherId)].filter((x): x is string => !!x))];
  const [vouchers, account, treasury, party, invoiceLine, dTreasury, dParty] = await Promise.all([
    db.accVoucher.findMany({ where: { id: { in: voucherIds } }, select: { id: true, number: true, status: true, date: true } }),
    db.accAccount.findUnique({ where: { id: a.accountId }, select: { id: true, code: true, name: true } }),
    a.treasuryId ? db.accTreasury.findUnique({ where: { id: a.treasuryId }, select: { id: true, name: true } }) : null,
    a.partyId ? db.accParty.findUnique({ where: { id: a.partyId }, select: { id: true, name: true } }) : null,
    a.invoiceLineId ? db.accInvoiceLine.findUnique({ where: { id: a.invoiceLineId }, select: { title: true, invoice: { select: { id: true, number: true, date: true } } } }) : null,
    a.disposalTreasuryId ? db.accTreasury.findUnique({ where: { id: a.disposalTreasuryId }, select: { id: true, name: true } }) : null,
    a.disposalPartyId ? db.accParty.findUnique({ where: { id: a.disposalPartyId }, select: { id: true, name: true } }) : null,
  ]);
  const vmap = new Map(vouchers.map((v) => [v.id, v]));
  return {
    asset: a,
    account,
    treasury,
    party,
    invoiceLine,
    disposal: { treasury: dTreasury, party: dParty },
    voucher: a.voucherId ? vmap.get(a.voucherId) ?? null : null,
    disposalVoucher: a.disposalVoucherId ? vmap.get(a.disposalVoucherId) ?? null : null,
    entries: a.entries.map((e) => ({ id: e.id, month: e.month, amount: e.amount, voucher: vmap.get(e.voucherId) ?? null })),
    accum: a.openingAccum + a.depreciated,
    book: a.cost - a.openingAccum - a.depreciated,
    /** پیش‌نمایش فروش امروز */
    catchUpToday: a.status === "ACTIVE" ? catchUpAt(a, todayKey()) : 0n,
  };
}

/** ردیف‌های فاکتور خرید روی حساب دارایی ثابت که هنوز در دفتر دارایی نیامده‌اند */
export async function invoiceCandidates(db: Db) {
  const accounts = await assetAccounts(db);
  if (!accounts.length) return [];
  const used = new Set((await db.accFixedAsset.findMany({ where: { invoiceLineId: { not: null }, status: { not: "VOID" } }, select: { invoiceLineId: true } })).map((x) => x.invoiceLineId));
  const lines = await db.accInvoiceLine.findMany({
    where: { productId: null, accountId: { in: accounts.map((a) => a.id) }, invoice: { type: "PURCHASE", status: "ISSUED" } },
    select: { id: true, title: true, lineTotal: true, vatAmount: true, accountId: true, invoice: { select: { id: true, number: true, date: true, partyName: true } } },
    orderBy: { invoice: { date: "desc" } },
    take: 200,
  });
  return lines.filter((l) => !used.has(l.id)).map((l) => ({ id: l.id, title: l.title, cost: l.lineTotal - l.vatAmount, accountId: l.accountId, invoice: l.invoice }));
}
