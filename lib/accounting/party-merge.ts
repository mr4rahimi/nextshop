/**
 * ادغام اشخاص تکراری — docs/plans/webhesab-parity.md بخش ۱۷.
 *
 * معادل «انتقال تراکنش‌های یک تفصیل به تفصیل دیگر» وب حساب، ولی کامل: هر جایی که به
 * شخص «حذفی» اشاره می‌کند (ردیف سند، فاکتور، دریافت/پرداخت، چک، اقساط، سفارش خرید،
 * صندوق، سریال، ورود/خروج، عرضه‌کننده‌ی کالا، پیوست) به شخص «ماندنی» می‌رود؛ جاهای خالی
 * پرونده‌ی ماندنی از حذفی پر می‌شود؛ حذفی غیرفعال می‌ماند با `mergedIntoId` (لینک‌های قدیمی
 * به ماندنی می‌رسند). همه در یک تراکنش با قفل هر دو ردیف.
 */

import { Prisma, type AccParty } from "@prisma/client";
import { AccError } from "./errors";
import { faNum } from "./money";
import { balanceOf, PARTY_BALANCE } from "./ledger/balances";
import { logDoc, type DocChange } from "./doc-log";
import { todayKey } from "./dates";
import type { Actor } from "./ledger/post";
import type { Db } from "./reports/common";

type Tx = Prisma.TransactionClient;

/** هر جایی که شناسه‌ی شخص می‌نشیند — شمارش پیش‌نمایش و انتقال از همین فهرست */
const REFS = [
  { key: "lines", label: "ردیف سند", count: (db: Db, id: string) => db.accVoucherLine.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accVoucherLine.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "invoices", label: "فاکتور", count: (db: Db, id: string) => db.accInvoice.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accInvoice.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "money", label: "دریافت و پرداخت", count: (db: Db, id: string) => db.accMoneyDoc.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accMoneyDoc.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "cheques", label: "چک", count: (db: Db, id: string) => db.accCheque.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accCheque.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "chequeHolder", label: "چک خرج‌شده به او", count: (db: Db, id: string) => db.accCheque.count({ where: { holderPartyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accCheque.updateMany({ where: { holderPartyId: a }, data: { holderPartyId: b } }) },
  { key: "chequeEvents", label: "گردش چک", count: (db: Db, id: string) => db.accChequeEvent.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accChequeEvent.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "installments", label: "برنامه‌ی اقساط", count: (db: Db, id: string) => db.accInstallmentPlan.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accInstallmentPlan.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "purchaseOrders", label: "سفارش خرید", count: (db: Db, id: string) => db.accPurchaseOrder.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accPurchaseOrder.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "tickets", label: "رسید صندوق", count: (db: Db, id: string) => db.accPosTicket.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accPosTicket.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "adjusts", label: "ورود و خروج کالا", count: (db: Db, id: string) => db.accStockAdjust.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accStockAdjust.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "serials", label: "شماره سریال", count: (db: Db, id: string) => db.accSerial.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accSerial.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "serialMoves", label: "گردش سریال", count: (db: Db, id: string) => db.accSerialMove.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accSerialMove.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  { key: "items", label: "کالا با این عرضه‌کننده", count: (db: Db, id: string) => db.accItem.count({ where: { supplierId: id } }), move: (tx: Tx, a: string, b: string) => tx.accItem.updateMany({ where: { supplierId: a }, data: { supplierId: b } }) },
  { key: "templateLines", label: "ردیف ورودی سریع", count: (db: Db, id: string) => db.accVoucherTemplateLine.count({ where: { partyId: id } }), move: (tx: Tx, a: string, b: string) => tx.accVoucherTemplateLine.updateMany({ where: { partyId: a }, data: { partyId: b } }) },
  {
    key: "attachments",
    label: "پیوست",
    count: (db: Db, id: string) => db.accAttachment.count({ where: { docType: "AccParty", docId: id, deletedAt: null } }),
    move: (tx: Tx, a: string, b: string) => tx.accAttachment.updateMany({ where: { docType: "AccParty", docId: a }, data: { docId: b } }),
  },
] as const;

export type RefKey = (typeof REFS)[number]["key"];

/** فیلدهایی که اگر در ماندنی خالی باشد از حذفی پر می‌شود */
const FILL = [
  ["firstName", "نام"],
  ["lastName", "نام خانوادگی"],
  ["companyName", "نام شرکت"],
  ["mobile", "موبایل"],
  ["phone", "تلفن"],
  ["nationalId", "کد ملی"],
  ["economicCode", "کد اقتصادی"],
  ["regNo", "شماره ثبت"],
  ["postalCode", "کد پستی"],
  ["address", "نشانی"],
  ["city", "شهر"],
  ["externalCode", "کد نرم‌افزار قبلی"],
] as const;
const ROLES = [
  ["isCustomer", "مشتری"],
  ["isSupplier", "تأمین‌کننده"],
  ["isEmployee", "کارمند"],
  ["isMarketplace", "بازارگاه"],
] as const;
/** پیوندهای یکتا — هر کدام فقط یک صاحب دارد */
const LINKS = [
  ["userId", "حساب کاربری سایت"],
  ["supplierId", "تأمین‌کننده‌ی کارتابل"],
  ["platformCode", "بازارگاه"],
] as const;

const WALK_IN = "walk-in";

export interface MergeSide {
  id: string;
  code: number;
  name: string;
  mobile: string | null;
  nationalId: string | null;
  personType: string;
  roles: string[];
  links: string[];
  isActive: boolean;
  createdAt: Date;
  balance: bigint;
  counts: Partial<Record<RefKey, number>>;
  total: number;
}

export interface MergePreview {
  a: MergeSide;
  b: MergeSide;
  /** شناسه‌ی پیشنهادی ماندنی: حساب سایت دارد، بیشتر گردش دارد، یا قدیمی‌تر است */
  suggestKeep: string;
  /** چرا نمی‌شود — خالی یعنی ادغام آزاد است */
  blockers: string[];
  labels: Record<string, string>;
}

function problems(a: AccParty, b: AccParty): string[] {
  const out: string[] = [];
  if (a.id === b.id) out.push("هر دو یک شخص‌اند");
  for (const p of [a, b]) {
    if (p.mergedIntoId) out.push(`«${p.name}» قبلاً در شخص دیگری ادغام شده است`);
    if (p.platformCode === WALK_IN) out.push("«مشتری حضوری» ادغام نمی‌شود — فروش‌های بی‌نام به یک شخص واقعی نمی‌چسبند");
  }
  for (const [k, label] of LINKS) {
    if (a[k] && b[k] && a[k] !== b[k]) out.push(`هر دو به ${label} جدا وصل‌اند؛ یک شخص فقط یکی می‌گیرد`);
  }
  return out;
}

async function side(db: Db, p: AccParty): Promise<MergeSide> {
  const [bal, ...counts] = await Promise.all([balanceOf(db, { partyId: p.id, ...PARTY_BALANCE }), ...REFS.map((r) => r.count(db, p.id))]);
  const c: Partial<Record<RefKey, number>> = {};
  REFS.forEach((r, i) => {
    if (counts[i]) c[r.key] = counts[i];
  });
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    mobile: p.mobile,
    nationalId: p.nationalId,
    personType: p.personType,
    roles: ROLES.filter(([k]) => p[k]).map(([, l]) => l),
    links: LINKS.filter(([k]) => p[k]).map(([k, l]) => (k === "platformCode" && p.platformCode === WALK_IN ? "مشتری حضوری" : l)),
    isActive: p.isActive,
    createdAt: p.createdAt,
    balance: bal.balance,
    counts: c,
    total: counts.reduce((s, n) => s + n, 0),
  };
}

export async function mergePreview(db: Db, aId: string, bId: string): Promise<MergePreview> {
  const [a, b] = await Promise.all([db.accParty.findUnique({ where: { id: aId } }), db.accParty.findUnique({ where: { id: bId } })]);
  if (!a || !b) throw new AccError("شخص پیدا نشد", 404);
  const [sa, sb] = await Promise.all([side(db, a), side(db, b)]);
  const score = (p: AccParty, s: MergeSide) => [p.userId || p.supplierId || p.platformCode ? 1 : 0, s.total, -p.code];
  const [x, y] = [score(a, sa), score(b, sb)];
  const aWins = x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] >= y[2];
  return {
    a: sa,
    b: sb,
    suggestKeep: aWins ? a.id : b.id,
    blockers: problems(a, b),
    labels: Object.fromEntries(REFS.map((r) => [r.key, r.label])),
  };
}

export interface MergeResult {
  keep: { id: string; code: number; name: string };
  moved: Partial<Record<RefKey, number>>;
  filled: string[];
}

/**
 * `dropId` در `keepId` ادغام می‌شود. ماندنی نام و نوع خودش را نگه می‌دارد؛ نقش‌ها جمع می‌شوند؛
 * سقف اعتبار اگر ماندنی نداشت از حذفی. شمارش «پیش‌نمایش» و انتقال از یک فهرست‌اند.
 */
export async function mergeParties(tx: Tx, keepId: string, dropId: string, actor: Actor): Promise<MergeResult> {
  if (keepId === dropId) throw new AccError("هر دو یک شخص‌اند");
  // قفل به ترتیب ثابت تا دو ادغام هم‌زمان بن‌بست نسازند
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "AccParty" WHERE "id" IN (${keepId}, ${dropId}) ORDER BY "id" FOR UPDATE`);
  const [keep, drop] = await Promise.all([tx.accParty.findUnique({ where: { id: keepId } }), tx.accParty.findUnique({ where: { id: dropId } })]);
  if (!keep || !drop) throw new AccError("شخص پیدا نشد", 404);
  const block = problems(keep, drop);
  if (block.length) throw new AccError(block[0], 409);

  const moved: Partial<Record<RefKey, number>> = {};
  for (const r of REFS) {
    const n = (await r.move(tx, drop.id, keep.id)).count;
    if (n) moved[r.key] = n;
  }

  // حذفی اول یکتاها و موبایل را رها می‌کند تا ماندنی بگیرد و چک «موبایل تکراری» دوباره نگیردش
  const trail = [drop.mobile && `موبایل ${faNum(drop.mobile)}`, drop.nationalId && `کد ملی ${faNum(drop.nationalId)}`].filter(Boolean).join("، ");
  await tx.accParty.update({
    where: { id: drop.id },
    data: {
      isActive: false,
      mergedIntoId: keep.id,
      mergedAt: new Date(),
      userId: null,
      supplierId: null,
      platformCode: null,
      mobile: null,
      nationalId: null,
      note: [drop.note, `ادغام‌شده در «${keep.name}» (کد ${faNum(keep.code)})${trail ? ` — ${trail}` : ""}`].filter(Boolean).join("\n"),
    },
  });

  const data: Prisma.AccPartyUncheckedUpdateInput = {};
  const changes: DocChange[] = [];
  const filled: string[] = [];
  for (const [k, label] of FILL) {
    if (!keep[k] && drop[k]) {
      data[k] = drop[k];
      filled.push(label);
      changes.push({ label, before: "—", after: String(drop[k]) });
    }
  }
  for (const [k, label] of ROLES) {
    if (!keep[k] && drop[k]) {
      data[k] = true;
      changes.push({ label: `نقش ${label}`, before: "نه", after: "بله" });
    }
  }
  for (const [k, label] of LINKS) {
    if (!keep[k] && drop[k]) {
      data[k] = drop[k];
      changes.push({ label, before: "—", after: "از شخص ادغام‌شده" });
    }
  }
  if (keep.creditLimit == null && drop.creditLimit != null) {
    data.creditLimit = drop.creditLimit;
    filled.push("سقف اعتبار");
  }
  if (drop.note?.trim()) data.note = [keep.note, `از کد ${faNum(drop.code)}: ${drop.note.trim()}`].filter(Boolean).join("\n");
  if (!keep.isActive) data.isActive = true;
  if (Object.keys(data).length) await tx.accParty.update({ where: { id: keep.id }, data });

  // هر شخصی که قبلاً در «حذفی» ادغام شده بود حالا به ماندنی اشاره کند (زنجیره نسازد)
  await tx.accParty.updateMany({ where: { mergedIntoId: drop.id }, data: { mergedIntoId: keep.id } });

  for (const r of REFS) if (moved[r.key]) changes.push({ label: r.label, before: `${faNum(moved[r.key]!)} مورد روی کد ${faNum(drop.code)}`, after: "منتقل شد" });
  await logDoc(
    tx,
    {
      docType: "AccParty",
      docId: keep.id,
      kind: "MERGE",
      number: keep.code,
      docDate: todayKey(),
      partyName: keep.name,
      action: "EDIT",
      reason: `ادغام «${drop.name}» (کد ${faNum(drop.code)})`,
      changes,
    },
    actor,
  );

  return { keep: { id: keep.id, code: keep.code, name: keep.name }, moved, filled };
}

// ── نامزدهای تکراری ─────────────────────────────────────────────────────────

export interface DupGroup {
  kind: "mobile" | "nationalId" | "name";
  key: string;
  parties: { id: string; code: number; name: string; mobile: string | null; createdAt: Date }[];
}

/**
 * گروه‌های هم‌موبایل، هم‌کد ملی و هم‌نام (نام با یکی کردن ی/ک، فاصله و نیم‌فاصله) میان اشخاص فعال.
 * «مشتری حضوری» کنار گذاشته می‌شود.
 */
export async function duplicateGroups(db: Db, kinds: DupGroup["kind"][] = ["mobile", "nationalId", "name"], limit = 300): Promise<DupGroup[]> {
  const rows = await db.$queryRaw<{ kind: DupGroup["kind"]; key: string; ids: string[] }[]>(Prisma.sql`
    SELECT kind, k AS key, ARRAY_AGG(id ORDER BY code) AS ids FROM (
      SELECT p."id", p."code", REGEXP_REPLACE(p."mobile", '\\D', '', 'g') AS k, 'mobile' AS kind FROM "AccParty" p
        WHERE p."isActive" AND COALESCE(p."mobile", '') <> '' AND COALESCE(p."platformCode", '') <> ${WALK_IN}
      UNION ALL
      SELECT p."id", p."code", p."nationalId", 'nationalId' FROM "AccParty" p
        WHERE p."isActive" AND COALESCE(p."nationalId", '') <> '' AND COALESCE(p."platformCode", '') <> ${WALK_IN}
      UNION ALL
      SELECT p."id", p."code", REGEXP_REPLACE(TRANSLATE(LOWER(p."name"), 'يكۀةأإآ', 'یکههااا'), '[[:space:]‌‍_.-]', '', 'g'), 'name' FROM "AccParty" p
        WHERE p."isActive" AND COALESCE(p."platformCode", '') <> ${WALK_IN}
    ) x
    WHERE kind IN (${Prisma.join(kinds)}) AND k <> ''
    GROUP BY kind, k HAVING COUNT(*) > 1
    ORDER BY CASE kind WHEN 'mobile' THEN 0 WHEN 'nationalId' THEN 1 ELSE 2 END, COUNT(*) DESC, k
    LIMIT ${limit}`);
  const ids = [...new Set(rows.flatMap((r) => r.ids))];
  const parties = await db.accParty.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true, mobile: true, createdAt: true } });
  const byId = new Map(parties.map((p) => [p.id, p]));
  return rows.map((r) => ({ kind: r.kind, key: r.key, parties: r.ids.map((id) => byId.get(id)!).filter(Boolean) }));
}
