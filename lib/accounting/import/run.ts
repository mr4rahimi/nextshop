/**
 * ورود از اکسل — کالا، موجودی اول دوره، اشخاص و مانده، چک‌های باز.
 * docs/plans/inventory-items.md بخش ۶ (فاز ۳).
 *
 * هر ردیف اول **برنامه** می‌شود (`plan`): ساخت، به‌روزرسانی، رد («هست») یا ایراد —
 * با وضعیت دیتابیس و ردیف‌های قبلی همان فایل. پیش‌نمایش فقط برنامه‌ها را برمی‌گرداند
 * و چیزی نمی‌نویسد؛ ثبت همان برنامه‌ها را به ترتیب در یک تراکنش اجرا می‌کند و اگر
 * حتی یک ردیف ایراد داشته باشد هیچ چیز نمی‌نویسد (همه یا هیچ).
 *
 * ⚠️ مبلغ‌ها تومان‌اند؛ `opts.rial` = فایل ریالی است و ÷۱۰ می‌شود.
 */

import type { AccChequeDir, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { faNum, toLatinDigits } from "../money";
import { parseJalaliInput } from "@/lib/club/jalali";
import { firstYear } from "../ledger/fiscal-year";
import { hasCarriedOpening } from "../ledger/closing";
import { postVoucher, type Actor, type LineInput } from "../ledger/post";
import { readOpening, saveOpeningTx } from "../setup";
import { createParty, updateParty } from "../parties";
import { ensureDefaultWarehouse, OPENING_INV_SOURCE, saveOpeningInventory } from "../inventory/docs";
import { attrKeyOf, createItem, normalizeItemCode, updateItem } from "../inventory/items";
import { ensureAxisValues, groupByPath } from "../inventory/catalog";
import type { ImportKind } from "./kinds";

type Tx = Prisma.TransactionClient;

export interface ImportOpts {
  /** کالا/شخص موجود به‌روز شود (پیش‌فرض بله)؛ نه = «هست» و رد */
  update?: boolean;
  /** مبلغ‌های فایل ریالی‌اند */
  rial?: boolean;
}

export const IMPORT_MAX_ROWS = 5000;

export type RowAction = "create" | "update" | "skip" | "error";

export interface RowResult {
  /** شماره‌ی ردیف در فایل (۱ = اولین ردیف داده) */
  row: number;
  action: RowAction;
  label: string;
  message: string | null;
}

/** ردیف فایل بعد از نگاشت: کلید فیلد ← متن خانه */
export type ImportRow = Record<string, string>;

interface Plan extends RowResult {
  run?: (tx: Tx) => Promise<void>;
}

class RowError extends Error {}
const fail = (m: string): never => {
  throw new RowError(m);
};

// ── تبدیل خانه ───────────────────────────────────────────────────────

const v = (r: ImportRow, k: string) => (r[k] ?? "").replace(/\s+/g, " ").trim();

/** «۱٬۲۵۰٬۰۰۰»، «1,250,000.00»، «(500)» یا «500-» (منفی) → BigInt تومان */
export function parseImportAmount(raw: string, rial: boolean, label = "مبلغ"): bigint | null {
  let s = toLatinDigits(raw).replace(/[\s,٬،']/g, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  s = s.replace(/\.0+$/, "");
  if (!/^\d+$/.test(s)) fail(`${label} «${raw}» عدد نیست`);
  let n = BigInt(s);
  if (rial) n = (n + 5n) / 10n; // ریال ← تومان، گرد به نزدیک‌ترین
  return neg ? -n : n;
}

function parseQty(raw: string): number {
  const s = toLatinDigits(raw).replace(/[\s,٬،]/g, "").replace(/\.0+$/, "");
  if (!/^-?\d+$/.test(s)) fail(`تعداد «${raw}» عدد صحیح نیست`);
  return Number(s);
}

/** «۱۴۰۵/۰۸/۱۵»، «1405-8-15»، «2026/11/06» یا عدد تاریخ اکسل */
export function parseImportDate(raw: string): Date | null {
  const s = toLatinDigits(raw).trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial > 20_000 && serial < 80_000) return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  }
  const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  if (y < 1700) return parseJalaliInput(`${m[1]}/${m[2]}/${m[3]}`);
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

const digits = (s: string) => toLatinDigits(s).replace(/[\s\-()]/g, "");

function cleanMobile(raw: string): string | null {
  let d = digits(raw).replace(/^\+?98/, "0").replace(/^0098/, "0");
  if (!d) return null;
  if (/^9\d{9}$/.test(d)) d = `0${d}`;
  return /^09\d{9}$/.test(d) ? d : null;
}

// ── اجرا ─────────────────────────────────────────────────────────────

export interface ImportResult {
  rows: RowResult[];
  counts: Record<RowAction, number>;
  committed: boolean;
}

export async function runImport(
  tx: Tx,
  kind: ImportKind,
  rows: ImportRow[],
  opts: ImportOpts,
  commit: boolean,
  actor: Actor,
): Promise<ImportResult> {
  if (!rows.length) throw new AccError("ردیفی در فایل نیست");
  // ۳۰۰۰ کالا ≈ ۲۵ ثانیه؛ بیشتر از این به سقف زمان درخواست پشت CDN/nginx (≈۶۰ ثانیه) می‌خورد
  if (rows.length > IMPORT_MAX_ROWS) throw new AccError(`بیشتر از ${faNum(IMPORT_MAX_ROWS)} ردیف در یک بار — فایل را چند تکه کنید (ورود دوباره کالای تکراری نمی‌سازد)`);
  const planner = kind === "items" ? itemsPlanner : kind === "stock" ? stockPlanner : kind === "parties" ? partiesPlanner : chequesPlanner;
  const { plan, finish } = await planner(tx, opts, actor);
  const plans: Plan[] = [];
  for (const [i, r] of rows.entries()) {
    try {
      plans.push({ row: i + 1, ...(await plan(r)) });
    } catch (e) {
      if (!(e instanceof RowError) && !(e instanceof AccError)) throw e;
      plans.push({ row: i + 1, action: "error", label: v(r, "title") || v(r, "name") || v(r, "code") || v(r, "serialNo") || "—", message: e.message });
    }
  }
  const counts: Record<RowAction, number> = { create: 0, update: 0, skip: 0, error: 0 };
  for (const p of plans) counts[p.action]++;
  const result = { rows: plans.map((p) => ({ row: p.row, action: p.action, label: p.label, message: p.message })), counts, committed: false };
  if (!commit) return result;
  const bad = plans.find((p) => p.action === "error");
  if (bad) throw new AccError(`ردیف ${faNum(bad.row)}: ${bad.message} — تا همه‌ی ردیف‌ها درست نباشند چیزی ثبت نمی‌شود`);
  for (const p of plans) {
    try {
      await p.run?.(tx);
    } catch (e) {
      if (e instanceof AccError || e instanceof RowError) throw new AccError(`ردیف ${faNum(p.row)}: ${e.message}`);
      throw e;
    }
  }
  await finish?.(tx);
  return { ...result, committed: true };
}

type Planner = (tx: Tx, opts: ImportOpts, actor: Actor) => Promise<{ plan: (r: ImportRow) => Promise<Omit<Plan, "row">>; finish?: (tx: Tx) => Promise<void> }>;

async function openingYear(tx: Tx) {
  const year = await firstYear(tx);
  if (!year) throw new AccError("اول حسابداری داخلی را راه‌اندازی کنید (سال مالی نیست)", 404);
  if (await hasCarriedOpening(tx, year.id)) throw new AccError("مانده‌های اول دوره فقط برای سال اول حسابداری است؛ این سال از بستن سال قبل آمده", 409);
  return year;
}

/** کالا با کد، کد قبلی یا بارکد */
async function findItemId(tx: Tx, raw: string): Promise<string | null> {
  const code = normalizeItemCode(raw);
  if (!code) return null;
  return (
    (await tx.accItem.findUnique({ where: { code }, select: { id: true } }))?.id ??
    (await tx.accItemAlias.findFirst({ where: { code }, select: { itemId: true } }))?.itemId ??
    (await tx.accItemBarcode.findUnique({ where: { barcode: code }, select: { itemId: true } }))?.itemId ??
    null
  );
}

// ── کالا ─────────────────────────────────────────────────────────────

const itemsPlanner: Planner = async (tx, opts, actor) => {
  const update = opts.update !== false;
  const axes = await tx.accAxis.findMany();
  const seenCode = new Set<string>();
  const seenBarcode = new Map<string, string>();
  const seenCombo = new Set<string>();
  const groups = new Map<string, string>();

  return {
    plan: async (r) => {
      const code = normalizeItemCode(v(r, "code")) ?? fail("کد کالا خالی است");
      const title = v(r, "title");
      const label = title || code;
      if (seenCode.has(code)) fail(`کد «${code}» دو بار در فایل آمده`);
      seenCode.add(code);
      const salePrice = parseImportAmount(v(r, "salePrice"), !!opts.rial, "قیمت فروش");
      if (salePrice !== null && salePrice < 0n) fail("قیمت فروش منفی است");
      const barcodes = v(r, "barcode").split(/[,،;\s]+/).map(normalizeItemCode).filter((x): x is string => !!x);
      const unit = v(r, "unit") || undefined;
      const groupPath = v(r, "group");
      const modelTitle = v(r, "model");
      const values = axes.map((a) => ({ axis: a, value: v(r, `axis:${a.id}`) })).filter((x) => x.value);
      if (values.length && !modelTitle) fail("رنگ/سایز بدون «مدل» — ستون مدل را هم پر کنید");

      let target = await tx.accItem.findUnique({ where: { code }, select: { id: true, title: true, modelId: true } });
      let linkedProduct: string | null = null;
      if (!target) {
        const alias = await tx.accItemAlias.findFirst({ where: { code }, select: { item: { select: { id: true, title: true, modelId: true } } } });
        target = alias?.item ?? null;
      }
      if (!target) {
        // کالای محصول سایت با sku یا بارکد همین ردیف — کد قبلی را می‌گیرد
        const [hit] = await tx.$queryRaw<{ id: string; title: string }[]>`
          SELECT p.id, p.title FROM "Product" p JOIN "AccItem" i ON i.id = p.id
          WHERE acc_norm_code(p.sku) = ${code} OR (${barcodes.length > 0} AND acc_norm_code(p.gtin13) = ANY(${barcodes}::text[]))
          ORDER BY (acc_norm_code(p.sku) = ${code}) DESC LIMIT 1`;
        if (hit) {
          target = await tx.accItem.findUnique({ where: { id: hit.id }, select: { id: true, title: true, modelId: true } });
          linkedProduct = hit.title;
        }
      }
      if (target && !update) return { action: "skip", label, message: `هست — «${target.title}»` };
      if (!target && !title) fail("نام کالا خالی است");

      for (const b of barcodes) {
        const owner = await tx.accItemBarcode.findUnique({ where: { barcode: b }, select: { itemId: true, item: { select: { title: true } } } });
        if (owner && owner.itemId !== target?.id) fail(`بارکد «${b}» مال «${owner.item.title}» است`);
        const other = seenBarcode.get(b);
        if (other && other !== code) fail(`بارکد «${b}» در ردیف کالای «${other}» هم آمده`);
        seenBarcode.set(b, code);
      }
      if (!target) {
        const alias = await tx.accItemAlias.findFirst({ where: { code } });
        if (alias) fail(`کد «${code}» کد قبلی کالای دیگری است`);
      }

      // ترکیب رنگ/سایز در مدل — فقط کالای تازه یا کالای بی‌مدل
      const place = values.length && !target?.modelId;
      if (place) {
        const comboKey = `${modelTitle}|${values.map((x) => `${x.axis.id}=${x.value}`).sort().join("|")}`;
        if (seenCombo.has(comboKey)) fail(`همین ${values.map((x) => x.value).join(" ")} در مدل «${modelTitle}» دو بار آمده`);
        seenCombo.add(comboKey);
        const model = await tx.accItemModel.findUnique({ where: { title: modelTitle } });
        if (model) {
          const vals = await tx.accAxisValue.findMany({ where: { OR: values.map((x) => ({ axisId: x.axis.id, value: x.value })) } });
          if (vals.length === values.length) {
            const key = attrKeyOf(vals.map((x) => ({ axisId: x.axisId, valueId: x.id })));
            const dup = await tx.accItem.findFirst({ where: { modelId: model.id, attrKey: key }, select: { code: true } });
            if (dup) fail(`${values.map((x) => x.value).join(" ")} در مدل «${modelTitle}» هست (کد ${dup.code})`);
          }
        }
      }

      const run = async (t: Tx) => {
        const groupId = groupPath ? await groupByPath(t, groupPath, groups) : undefined;
        let placement: { modelId: string; attrs: { axisId: string; valueId: string }[] } | undefined;
        if (place) {
          const model = (await t.accItemModel.findUnique({ where: { title: modelTitle } })) ?? (await t.accItemModel.create({ data: { title: modelTitle, groupId: groupId ?? null } }));
          const attrs = [];
          for (const x of values) attrs.push({ axisId: x.axis.id, valueId: (await ensureAxisValues(t, x.axis.id, [x.value])).values[0].id });
          placement = { modelId: model.id, attrs };
        }
        if (target) {
          const cur = await t.accItemBarcode.findMany({ where: { itemId: target.id } });
          await updateItem(t, target.id, {
            code,
            ...(title ? { title } : {}),
            ...(unit ? { unit } : {}),
            ...(salePrice !== null ? { salePrice } : {}),
            ...(groupId ? { groupId } : {}),
            ...(barcodes.length ? { barcodes: [...cur.map((b) => b.barcode), ...barcodes] } : {}),
          }, actor);
          if (placement) {
            await t.accItem.update({ where: { id: target.id }, data: { modelId: placement.modelId, attrKey: attrKeyOf(placement.attrs) } });
            await t.accItemAttr.createMany({ data: placement.attrs.map((a) => ({ itemId: target!.id, ...a })) });
          }
        } else {
          await createItem(t, { code, title, unit, salePrice, groupId: groupId ?? null, barcodes }, placement);
        }
      };
      if (target)
        return {
          action: "update",
          label: title || target.title,
          message: linkedProduct ? `کالای محصول سایت «${linkedProduct}» — کدش ${code} می‌شود` : null,
          run,
        };
      return { action: "create", label, message: null, run };
    },
  };
};

// ── موجودی اول دوره ──────────────────────────────────────────────────

const stockPlanner: Planner = async (tx, opts, actor) => {
  const year = await openingYear(tx);
  const def = await ensureDefaultWarehouse(tx);
  const warehouses = await tx.accWarehouse.findMany({ where: { isActive: true } });
  const current = await tx.accStockMove.findMany({ where: { sourceType: OPENING_INV_SOURCE, sourceId: year.id } });
  const lines = new Map(current.map((m) => [`${m.productId}|${m.warehouseId}`, { productId: m.productId, warehouseId: m.warehouseId, qty: m.qty, unitCost: m.unitCost }]));
  const seen = new Set<string>();

  return {
    plan: async (r) => {
      const raw = v(r, "code") || fail("کد کالا خالی است");
      const itemId = (await findItemId(tx, raw)) ?? fail(`کالای «${raw}» پیدا نشد — اول کالاها را وارد کنید`);
      const item = await tx.accItem.findUnique({ where: { id: itemId }, select: { title: true } });
      const qty = parseQty(v(r, "qty") || "0");
      if (qty < 0) fail("موجودی اول دوره منفی نمی‌شود");
      const unitCost = parseImportAmount(v(r, "unitCost"), !!opts.rial, "بها") ?? fail("بهای واحد خالی است");
      if (unitCost < 0n) fail("بها منفی است");
      const wname = v(r, "warehouse");
      const wh = wname
        ? (warehouses.find((w) => w.name === wname || String(w.code) === toLatinDigits(wname)) ?? fail(`انبار «${wname}» نیست — در «انبارها» بسازید`))
        : def;
      const key = `${itemId}|${wh.id}`;
      if (seen.has(key)) fail(`«${item!.title}» در «${wh.name}» دو بار آمده`);
      seen.add(key);
      const before = lines.get(key);
      lines.set(key, { productId: itemId, warehouseId: wh.id, qty, unitCost });
      return {
        action: before ? "update" : "create",
        label: `${item!.title} — ${wh.name}`,
        message: before ? `قبلاً ${faNum(before.qty)} عدد بود` : null,
        run: async () => {},
      };
    },
    finish: async (t) => {
      await saveOpeningInventory(t, year.id, [...lines.values()], actor);
    },
  };
};

// ── اشخاص و مانده ────────────────────────────────────────────────────

async function findParty(tx: Tx, r: { externalCode?: string; mobile?: string | null; name?: string; any?: string }) {
  if (r.externalCode) {
    const p = await tx.accParty.findFirst({ where: { externalCode: r.externalCode } });
    if (p) return p;
  }
  if (r.mobile) {
    const p = await tx.accParty.findFirst({ where: { mobile: r.mobile } });
    if (p) return p;
  }
  if (r.name) {
    const ps = await tx.accParty.findMany({ where: { name: r.name }, take: 2 });
    if (ps.length > 1) fail(`دو شخص به نام «${r.name}» هست — کد قبلی یا موبایل بدهید`);
    if (ps[0]) return ps[0];
  }
  return null;
}

const partiesPlanner: Planner = async (tx, opts, actor) => {
  const update = opts.update !== false;
  let year: Awaited<ReturnType<typeof openingYear>> | null = null;
  const balances = new Map<string, bigint>();
  const seenKey = new Set<string>();
  const seenMobile = new Map<string, string>();
  let wantsBalance = false;

  return {
    plan: async (r) => {
      const name = v(r, "name");
      const externalCode = toLatinDigits(v(r, "externalCode")) || undefined;
      const rawMobile = v(r, "mobile");
      const mobile = rawMobile ? cleanMobile(rawMobile) : null;
      const notes: string[] = [];
      if (rawMobile && !mobile) notes.push(`موبایل «${rawMobile}» نامعتبر — نادیده`);
      const key = externalCode ? `c:${externalCode}` : mobile ? `m:${mobile}` : `n:${name}`;
      if (seenKey.has(key)) fail("این شخص دو بار در فایل آمده");
      seenKey.add(key);

      const bal = v(r, "balance");
      const deb = v(r, "debit");
      const cred = v(r, "credit");
      let amount: bigint | null = null;
      if (bal) amount = parseImportAmount(bal, !!opts.rial, "مانده");
      else if (deb || cred) amount = (parseImportAmount(deb || "0", !!opts.rial, "بدهکار") ?? 0n) - (parseImportAmount(cred || "0", !!opts.rial, "بستانکار") ?? 0n);
      if (amount !== null) {
        wantsBalance = true;
        year ??= await openingYear(tx);
      }

      const existing = await findParty(tx, { externalCode, mobile, name });
      if (!existing && !name) fail("نام شخص خالی است");
      if (mobile) {
        const owner = await tx.accParty.findFirst({ where: { mobile, ...(existing ? { id: { not: existing.id } } : {}) }, select: { name: true } });
        if (owner) fail(`موبایل ${mobile} مال «${owner.name}» است`);
        const other = seenMobile.get(mobile);
        if (other) fail(`موبایل ${mobile} برای «${other}» هم آمده`);
        seenMobile.set(mobile, name);
      }
      const nid = digits(v(r, "nationalId"));
      const postal = digits(v(r, "postalCode"));
      if (nid && !/^\d{10,11}$/.test(nid)) notes.push("کد ملی نامعتبر — نادیده");
      if (postal && !/^\d{10}$/.test(postal)) notes.push("کد پستی نامعتبر — نادیده");
      const role = v(r, "role");
      const isSupplier = /تامین|تأمین|فروشنده|supplier|vendor/i.test(role);
      const isCustomer = /مشتری|خریدار|customer/i.test(role) || (!isSupplier && !role);
      const input = {
        ...(name ? { name } : {}),
        ...(mobile ? { mobile } : {}),
        ...(v(r, "phone") ? { phone: v(r, "phone") } : {}),
        ...(nid && /^\d{10,11}$/.test(nid) ? { nationalId: nid } : {}),
        ...(v(r, "economicCode") ? { economicCode: v(r, "economicCode") } : {}),
        ...(postal && /^\d{10}$/.test(postal) ? { postalCode: postal } : {}),
        ...(v(r, "city") ? { city: v(r, "city") } : {}),
        ...(v(r, "address") ? { address: v(r, "address") } : {}),
        ...(role ? { isCustomer, isSupplier } : {}),
      };
      if (existing && !update && amount === null) return { action: "skip", label: existing.name, message: "هست" };
      if (amount !== null) notes.push(amount === 0n ? "مانده صفر" : amount > 0n ? `بدهکار ${faNum(amount.toString())}` : `بستانکار ${faNum((-amount).toString())}`);

      const run = async (t: Tx) => {
        let id: string;
        if (existing) {
          if (update) await updateParty(t, existing.id, input);
          if (externalCode && !existing.externalCode) await t.accParty.update({ where: { id: existing.id }, data: { externalCode } });
          id = existing.id;
        } else {
          const p = await createParty(t, { ...input, name, isCustomer: role ? isCustomer : true, isSupplier: role ? isSupplier : false });
          if (externalCode) await t.accParty.update({ where: { id: p.id }, data: { externalCode } });
          id = p.id;
        }
        if (amount !== null) balances.set(id, amount);
      };
      return { action: existing ? "update" : "create", label: existing?.name ?? name, message: notes.join(" · ") || null, run };
    },
    finish: async (t) => {
      if (!wantsBalance || !year) return;
      const cur = await readOpening(t, year.id);
      const parties = new Map(cur.parties.map((p) => [p.partyId, p.amount]));
      for (const [id, a] of balances) parties.set(id, a);
      await saveOpeningTx(t, year.id, { treasuries: cur.treasuries, parties: [...parties].map(([partyId, amount]) => ({ partyId, amount })), wallets: cur.wallets !== null }, actor);
    },
  };
};

// ── چک‌های باز ───────────────────────────────────────────────────────

const chequesPlanner: Planner = async (tx, opts, actor) => {
  const year = await openingYear(tx);
  const banks = await tx.accTreasury.findMany({ where: { kind: "BANK", isActive: true } });
  const seen = new Set<string>();
  const made: { direction: AccChequeDir; partyId: string; amount: bigint; id: string }[] = [];
  const batch = `${Date.now().toString(36)}`;

  return {
    plan: async (r) => {
      const dirRaw = v(r, "direction");
      const direction: AccChequeDir = /دریافت|ورود|received|in/i.test(dirRaw)
        ? "RECEIVED"
        : /پرداخت|صادر|خروج|issued|out/i.test(dirRaw)
          ? "ISSUED"
          : fail(`نوع چک «${dirRaw}» — «دریافتی» یا «پرداختی» بنویسید`);
      const serialNo = toLatinDigits(v(r, "serialNo")).replace(/[\s-]/g, "") || fail("شماره‌ی چک خالی است");
      const amount = parseImportAmount(v(r, "amount"), !!opts.rial) ?? fail("مبلغ خالی است");
      if (amount <= 0n) fail("مبلغ چک باید بیشتر از صفر باشد");
      const dueDate = parseImportDate(v(r, "dueDate")) ?? fail(`سررسید «${v(r, "dueDate")}» تاریخ نیست — مثل ۱۴۰۵/۰۸/۱۵`);
      const issueDate = parseImportDate(v(r, "issueDate"));
      const who = v(r, "party") || fail("شخص خالی است");
      const party =
        (await findParty(tx, { externalCode: toLatinDigits(who), mobile: cleanMobile(who), name: who })) ?? fail(`شخص «${who}» پیدا نشد — اول اشخاص را وارد کنید`);
      const notes: string[] = [];
      let bankName = v(r, "bankName") || null;
      let treasuryId: string | null = null;
      if (direction === "ISSUED") {
        const t = v(r, "treasury");
        const bank = t ? banks.find((b) => b.name === t || b.bankName === t || b.accountNo === toLatinDigits(t)) : banks.length === 1 ? banks[0] : null;
        if (!bank) fail(t ? `حساب بانکی «${t}» در پنل نیست` : "چک صادره از کدام حساب بانکی؟ ستون «حساب بانکی ما» را بدهید");
        treasuryId = bank!.id;
        bankName ??= bank!.bankName ?? bank!.name;
      } else if (!bankName) fail("بانک چک دریافتی خالی است");
      const sayadRaw = digits(v(r, "sayadId"));
      const sayadId = /^\d{16}$/.test(sayadRaw) ? sayadRaw : null;
      if (sayadRaw && !sayadId) notes.push("شناسه‌ی صیادی ۱۶ رقمی نیست — نادیده");

      const key = direction === "ISSUED" ? `I|${treasuryId}|${serialNo}` : `R|${party.id}|${bankName}|${serialNo}`;
      if (seen.has(key)) fail("این چک دو بار در فایل آمده");
      seen.add(key);
      const dup = await tx.accCheque.findFirst({
        where: direction === "ISSUED" ? { direction, treasuryId, serialNo } : { direction, partyId: party.id, bankName: bankName!, serialNo },
        select: { id: true },
      });
      const label = `${direction === "RECEIVED" ? "دریافتی" : "صادره"} ${serialNo} — ${party.name}`;
      if (dup) return { action: "skip", label, message: "هست" };

      return {
        action: "create",
        label,
        message: notes.join(" · ") || null,
        run: async (t) => {
          const status = direction === "RECEIVED" ? "IN_HAND" : "ISSUED";
          const c = await t.accCheque.create({
            data: {
              direction,
              status,
              serialNo,
              sayadId,
              bankName: bankName!,
              branch: v(r, "branch") || null,
              ownerName: v(r, "ownerName") || null,
              amount,
              issueDate,
              dueDate,
              partyId: party.id,
              treasuryId,
              note: v(r, "note") || "اول دوره — ورود از اکسل",
              createdById: actor.id ?? null,
              createdByName: actor.name,
            },
          });
          made.push({ direction, partyId: party.id, amount, id: c.id });
        },
      };
    },
    finish: async (t) => {
      if (!made.length) return;
      const lines: LineInput[] = made.map((c) =>
        c.direction === "RECEIVED"
          ? { accountKey: "CHEQUE_RECEIVABLE", partyId: c.partyId, debit: c.amount, description: "چک دریافتی اول دوره" }
          : { accountKey: "CHEQUE_PAYABLE", partyId: c.partyId, credit: c.amount, description: "چک صادره‌ی اول دوره" },
      );
      const net = made.reduce((s, c) => s + (c.direction === "RECEIVED" ? c.amount : -c.amount), 0n);
      if (net !== 0n) lines.push(net > 0n ? { accountKey: "OPENING_BALANCE", credit: net, description: "تراز افتتاحیه" } : { accountKey: "OPENING_BALANCE", debit: -net, description: "تراز افتتاحیه" });
      // رویداد ساخت چک سند جدا ندارد (`voucherId` یکتاست) — سند همه‌ی چک‌ها یکی است، مثل چکِ دریافت/پرداخت
      await postVoucher(t, {
        date: year.startDate,
        description: `چک‌های باز اول دوره‌ی سال ${year.title} — ورود از اکسل`,
        lines,
        actor,
        source: "OPENING",
        sourceId: `opening:${year.id}:cheques:${batch}`,
      });
      await t.accChequeEvent.createMany({
        data: made.map((c) => ({ chequeId: c.id, from: null, to: c.direction === "RECEIVED" ? "IN_HAND" : "ISSUED", date: year.startDate, note: "اول دوره — ورود از اکسل", byName: actor.name })),
      });
    },
  };
};

