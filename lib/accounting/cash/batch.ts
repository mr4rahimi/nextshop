/**
 * دریافت/پرداخت گروهی — docs/plans/webhesab-parity.md بخش ۱۸.
 *
 * معادل «دریافت/پرداخت دسته‌ای» وب حساب: یک فرم، چند ردیف، هر ردیف یک سند دریافت یا پرداخت
 * جدا با همان `createMoneyDoc` فرم تکی (پس هیچ قاعده‌ای دور زده نمی‌شود). ردیف‌ها از جدول یا
 * اکسل می‌آیند؛ شخص با شناسه یا «کلید» (کد شخص، موبایل، کد ملی یا نام دقیق) پیدا می‌شود.
 *
 * همه‌ی ردیف‌ها در یک تراکنش. هر ردیف داخل SAVEPOINT خودش اجرا می‌شود تا خطای یکی بقیه را
 * نخواباند و **همه‌ی** خطاها یک‌جا برگردند. پیش‌نمایش (`commit: false`) همان اجراست که آخر
 * برمی‌گردد؛ ثبت (`commit: true`) فقط وقتی هیچ ردیفی خطا ندارد می‌ماند — وگرنه هیچ‌کدام.
 */

import { randomUUID } from "node:crypto";
import type { AccMoneyMethod, AccParty, AccTreasury, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { faNum, formatAmount, toLatinDigits } from "../money";
import { balancesBy, PARTY_BALANCE } from "../ledger/balances";
import { parseJalaliInput } from "@/lib/club/jalali";
import type { Actor } from "../ledger/post";
import { createMoneyDoc, METHOD_LABELS } from "./docs";

type Tx = Prisma.TransactionClient;

export const BATCH_MAX_ROWS = 300;
export type BatchKind = "RECEIPT" | "PAYMENT";
/** روش‌های مجاز در گروهی — کیف پول، تهاتر و خرج چک فقط از فرم تکی */
export const BATCH_METHODS: AccMoneyMethod[] = ["CASH", "CARD_TRANSFER", "BANK_TRANSFER", "POS", "CHEQUE"];

export interface BatchRowInput {
  /** شماره‌ی ردیف در جدول/اکسل — فقط برای پیام */
  line?: number;
  partyId?: string | null;
  /** کد شخص، موبایل، کد ملی یا نام دقیق */
  partyKey?: string | null;
  amount: string | number | bigint;
  method?: string | null;
  treasuryId?: string | null;
  /** نام یا کد صندوق/بانک از اکسل */
  treasuryKey?: string | null;
  /** «YYYY-MM-DD» یا شمسی «۱۴۰۵/۰۸/۱۴»؛ خالی = تاریخ سربرگ */
  date?: string | null;
  trackingCode?: string | null;
  description?: string | null;
  cheque?: { serialNo?: string | null; dueDate?: string | null; bankName?: string | null; sayadId?: string | null } | null;
}

export interface BatchInput {
  kind: BatchKind;
  date: Date;
  /** پیش‌فرض ردیف‌هایی که روش/صندوق ندارند */
  method?: string | null;
  treasuryId?: string | null;
  /** تخصیص خودکار به قدیمی‌ترین فاکتور باز هر شخص */
  allocate?: boolean;
  description?: string | null;
  rows: BatchRowInput[];
}

export interface BatchRowResult {
  line: number;
  party: { id: string; code: number; name: string } | null;
  amount: string;
  method: string;
  treasury: string | null;
  date: Date | null;
  /** مانده‌ی شخص پیش از این ثبت (مثبت = طلب ما) */
  balanceBefore: string | null;
  doc: { id: string; number: number } | null;
  error: string | null;
  warnings: string[];
}

export interface BatchResult {
  committed: boolean;
  batchId: string | null;
  rows: BatchRowResult[];
  ok: number;
  failed: number;
  total: string;
}

const METHOD_ALIASES: [RegExp, AccMoneyMethod][] = [
  [/^(نقد|نقدی|cash|صندوق)$/i, "CASH"],
  [/^(کارت|کارت.?به.?کارت|card)$/i, "CARD_TRANSFER"],
  [/^(واریز|واریز بانکی|حواله|پایا|ساتنا|انتقال|bank|transfer)$/i, "BANK_TRANSFER"],
  [/^(کارتخوان|پوز|pos)$/i, "POS"],
  [/^(چک|cheque|check)$/i, "CHEQUE"],
];

export function methodOf(raw: string | null | undefined): AccMoneyMethod | null {
  const v = raw?.trim();
  if (!v) return null;
  if ((BATCH_METHODS as string[]).includes(v.toUpperCase())) return v.toUpperCase() as AccMoneyMethod;
  for (const [re, m] of METHOD_ALIASES) if (re.test(v)) return m;
  return null;
}

const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\s‌‍]+/g, "");

export function dayOf(raw: string | null | undefined): Date | null | "bad" {
  const s = toLatinDigits(raw ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m && Number(m[1]) < 1700) return parseJalaliInput(`${m[1]}/${m[2]}/${m[3]}`) ?? "bad";
  return "bad";
}

function amountOf(v: BatchRowInput["amount"]): bigint | null {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return Number.isSafeInteger(v) ? BigInt(v) : null;
  const s = toLatinDigits(String(v ?? "")).replace(/[,٬\s]/g, "");
  return /^\d+$/.test(s) ? BigInt(s) : null;
}

/** پیدا کردن شخص‌ها با کلید — یک پرس‌وجو برای همه */
async function resolveParties(tx: Tx, rows: BatchRowInput[]): Promise<{ byId: Map<string, AccParty>; byKey: Map<string, AccParty | "many"> }> {
  const ids = [...new Set(rows.map((r) => r.partyId).filter((x): x is string => !!x))];
  const keys = [...new Set(rows.filter((r) => !r.partyId && r.partyKey?.trim()).map((r) => toLatinDigits(r.partyKey!).trim()))];
  const codes = keys.filter((k) => /^\d{1,9}$/.test(k) && !k.startsWith("0")).map(Number);
  const mobiles = keys.map((k) => k.replace(/[\s-]/g, "").replace(/^\+?98/, "0")).map((k) => (/^9\d{9}$/.test(k) ? `0${k}` : k)).filter((k) => /^09\d{9}$/.test(k));
  const nids = keys.filter((k) => /^\d{10,11}$/.test(k));
  const names = keys.filter((k) => !/^[\d\s+-]+$/.test(k));
  const found = await tx.accParty.findMany({
    where: {
      OR: [
        ...(ids.length ? [{ id: { in: ids } }] : []),
        ...(codes.length ? [{ code: { in: codes } }] : []),
        ...(mobiles.length ? [{ mobile: { in: mobiles } }] : []),
        ...(nids.length ? [{ nationalId: { in: nids } }] : []),
        // نام: نامزدها با «شامل» از پایگاه، تطبیق دقیق (با یکی کردن ی/ک و فاصله) در کد
        ...names.map((n) => ({ name: { contains: n.split(/[\s‌]+/)[0], mode: "insensitive" as const } })),
      ],
    },
  });
  const byId = new Map(found.map((p) => [p.id, p]));
  const byKey = new Map<string, AccParty | "many">();
  const put = (k: string, p: AccParty) => {
    const cur = byKey.get(k);
    byKey.set(k, cur && cur !== "many" && cur.id !== p.id ? "many" : cur === "many" ? "many" : p);
  };
  for (const k of keys) {
    const mob = k.replace(/[\s-]/g, "").replace(/^\+?98/, "0");
    const mobile = /^9\d{9}$/.test(mob) ? `0${mob}` : mob;
    // کد شخص بر بقیه مقدم است؛ ادغام‌شده و غیرفعال فقط اگر تنها گزینه باشد (و بعد خطای غیرفعال می‌گیرد)
    const pool = found
      .filter((p) =>
        /^\d{1,9}$/.test(k) && !k.startsWith("0")
          ? p.code === Number(k)
          : /^09\d{9}$/.test(mobile)
            ? p.mobile === mobile
            : /^\d{10,11}$/.test(k)
              ? p.nationalId === k
              : normName(p.name) === normName(k),
      )
      .sort((a, b) => Number(b.isActive) - Number(a.isActive));
    const active = pool.filter((p) => p.isActive);
    for (const p of active.length ? active : pool.slice(0, 1)) put(k, p);
  }
  return { byId, byKey };
}

async function resolveTreasuries(tx: Tx): Promise<{ byId: Map<string, AccTreasury>; byKey: Map<string, AccTreasury> }> {
  const all = await tx.accTreasury.findMany({ where: { isActive: true } });
  const byKey = new Map<string, AccTreasury>();
  for (const t of all) {
    byKey.set(String(t.code), t);
    byKey.set(normName(t.name), t);
  }
  return { byId: new Map(all.map((t) => [t.id, t])), byKey };
}

/** کدام خزانه برای این روش — اگر کاربر نگفته، اولین سازگار */
const FITS: Record<AccMoneyMethod, AccTreasury["kind"][]> = {
  CASH: ["CASH"],
  CARD_TRANSFER: ["BANK"],
  BANK_TRANSFER: ["BANK"],
  POS: ["POS", "BANK"],
  CHEQUE: ["BANK"],
  GATEWAY: ["GATEWAY", "BANK"],
  GIFT_CARD: ["CASH", "BANK"],
  WALLET: [],
  OFFSET: [],
  CLUB_CREDIT: [],
};

export async function runMoneyBatch(tx: Tx, input: BatchInput, actor: Actor, commit: boolean): Promise<BatchResult> {
  if (input.kind !== "RECEIPT" && input.kind !== "PAYMENT") throw new AccError("نوع نامعتبر است");
  const rows = input.rows.filter((r) => r.partyId || r.partyKey?.trim() || String(r.amount ?? "").trim());
  if (!rows.length) throw new AccError("دست‌کم یک ردیف با شخص و مبلغ لازم است");
  if (rows.length > BATCH_MAX_ROWS) throw new AccError(`در هر ثبت گروهی حداکثر ${faNum(BATCH_MAX_ROWS)} ردیف`);
  const inbound = input.kind === "RECEIPT";
  const defMethod = methodOf(input.method) ?? "CASH";

  const [parties, treasuries] = await Promise.all([resolveParties(tx, rows), resolveTreasuries(tx)]);
  const partyIds = new Set<string>();
  const pre: { row: BatchRowInput; line: number; party: AccParty | null; error: string | null }[] = rows.map((row, i) => {
    const line = row.line ?? i + 1;
    let party: AccParty | null = null;
    let error: string | null = null;
    if (row.partyId) party = parties.byId.get(row.partyId) ?? null;
    else if (row.partyKey?.trim()) {
      const hit = parties.byKey.get(toLatinDigits(row.partyKey).trim());
      if (hit === "many") error = `«${row.partyKey.trim()}» با چند شخص جور است — کد شخص یا موبایل بنویسید`;
      else party = hit ?? null;
      if (!hit) error = `شخص «${row.partyKey.trim()}» پیدا نشد`;
    } else error = inbound ? "از چه کسی؟ شخص را انتخاب کنید" : "به چه کسی؟ شخص را انتخاب کنید";
    if (party) partyIds.add(party.id);
    return { row, line, party, error };
  });
  const balances = partyIds.size ? await balancesBy(tx, "partyId", { partyId: { in: [...partyIds] }, ...PARTY_BALANCE }) : new Map();

  const batchId = commit ? randomUUID() : null;
  const seen = new Map<string, number>();
  const running = new Map<string, bigint>();
  const out: BatchRowResult[] = [];

  for (const { row, line, party, error: resolveError } of pre) {
    const warnings: string[] = [];
    const rawMethod = row.method?.trim() ? methodOf(row.method) : defMethod;
    const method = rawMethod ?? defMethod;
    const amount = amountOf(row.amount);
    const before = party ? (running.get(party.id) ?? balances.get(party.id)?.balance ?? 0n) : null;
    const res: BatchRowResult = {
      line,
      party: party ? { id: party.id, code: party.code, name: party.name } : null,
      amount: amount?.toString() ?? String(row.amount ?? ""),
      method: METHOD_LABELS[method],
      treasury: null,
      date: null,
      balanceBefore: before?.toString() ?? null,
      doc: null,
      error: resolveError,
      warnings,
    };
    out.push(res);
    const fail = (m: string) => {
      res.error ??= m;
    };
    if (row.method?.trim() && !rawMethod) fail(`روش «${row.method.trim()}» شناخته نشد (نقد، کارت، واریز، کارتخوان، چک)`);
    if (amount === null || amount <= 0n) fail("مبلغ باید عدد بیشتر از صفر باشد");
    const day = dayOf(row.date);
    if (day === "bad") fail(`تاریخ «${row.date}» خوانده نشد — مثل ۱۴۰۵/۰۸/۱۴`);
    const date = day && day !== "bad" ? day : input.date;
    res.date = date;

    // خزانه: ردیف ← سربرگ (اگر به روش بخورد) ← اولین سازگار. دریافت چک خزانه نمی‌خواهد
    let treasury: AccTreasury | null = null;
    const needsTreasury = !(method === "CHEQUE" && inbound);
    if (needsTreasury) {
      if (row.treasuryId) treasury = treasuries.byId.get(row.treasuryId) ?? null;
      else if (row.treasuryKey?.trim()) {
        const k = toLatinDigits(row.treasuryKey).trim();
        treasury = treasuries.byKey.get(k) ?? treasuries.byKey.get(normName(k)) ?? null;
        if (!treasury) fail(`صندوق یا بانک «${row.treasuryKey.trim()}» پیدا نشد`);
      }
      if (!treasury && !row.treasuryKey?.trim()) {
        const head = input.treasuryId ? treasuries.byId.get(input.treasuryId) : null;
        treasury = head && FITS[method].includes(head.kind) ? head : [...treasuries.byId.values()].find((t) => FITS[method].includes(t.kind)) ?? null;
        if (!treasury) fail(`برای «${METHOD_LABELS[method]}» صندوق یا بانکی تعریف نشده`);
      }
      res.treasury = treasury?.name ?? null;
    }

    let cheque = null;
    if (method === "CHEQUE") {
      const due = dayOf(row.cheque?.dueDate);
      const serial = toLatinDigits(row.cheque?.serialNo ?? "").trim();
      if (!serial) fail("شماره‌ی چک را بنویسید");
      if (!due || due === "bad") fail("سررسید چک را بنویسید");
      cheque = { serialNo: serial, dueDate: due && due !== "bad" ? due : date, bankName: row.cheque?.bankName?.trim() || null, sayadId: row.cheque?.sayadId?.trim() || null };
    }

    if (party && amount && amount > 0n) {
      const dupKey = `${party.id}|${amount}`;
      if (seen.has(dupKey)) warnings.push(`همین شخص و مبلغ در ردیف ${faNum(seen.get(dupKey)!)} هم آمده`);
      else seen.set(dupKey, line);
      const owe = inbound ? (before ?? 0n) : -(before ?? 0n);
      if (amount > (owe > 0n ? owe : 0n)) {
        warnings.push(
          owe > 0n
            ? `${formatAmount(amount - owe)} تومان بیشتر از ${inbound ? "بدهی" : "طلب"} او — مازاد ${inbound ? "پیش‌دریافت" : "پیش‌پرداخت"} می‌شود`
            : inbound
              ? "بدهی‌ای ندارد — کل مبلغ پیش‌دریافت می‌شود"
              : "طلبی از ما ندارد — کل مبلغ پیش‌پرداخت می‌شود",
        );
      }
    }
    if (res.error || !party || !amount) continue;

    await tx.$executeRawUnsafe("SAVEPOINT acc_batch_row");
    try {
      const doc = await createMoneyDoc(
        tx,
        {
          kind: input.kind,
          date,
          partyId: party.id,
          description: [row.description?.trim(), input.description?.trim()].filter(Boolean).join(" — ") || null,
          items: [{ method, treasuryId: treasury?.id ?? null, amount, trackingCode: row.trackingCode?.trim() || null, cheque }],
          allocations: input.allocate === false ? undefined : "auto",
          batchId,
        },
        actor,
      );
      await tx.$executeRawUnsafe("RELEASE SAVEPOINT acc_batch_row");
      res.doc = { id: doc.id, number: doc.number };
      running.set(party.id, (before ?? 0n) + (inbound ? -amount : amount));
    } catch (e) {
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT acc_batch_row");
      if (e instanceof AccError) res.error = e.message;
      else throw e;
    }
  }

  const failed = out.filter((r) => r.error).length;
  const total = out.reduce((s, r) => s + (r.error ? 0n : BigInt(/^\d+$/.test(r.amount) ? r.amount : "0")), 0n);
  return { committed: commit && failed === 0, batchId: commit && failed === 0 ? batchId : null, rows: out, ok: out.length - failed, failed, total: total.toString() };
}

/** برای دور ریختن تراکنش پیش‌نمایش یا ثبت ناموفق */
export class BatchRollback extends Error {
  constructor(public result: BatchResult) {
    super("batch rollback");
  }
}
