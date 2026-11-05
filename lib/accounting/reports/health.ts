/**
 * سلامت دفتر — docs/plans/webhesab-parity.md بخش ۱۵ (معادل «چک کردن تراکنش‌ها»ی وب حساب).
 *
 * هر آزمون یک پرس‌وجوی فقط‌خواندنی است: تعداد کل + حداکثر `LIMIT` ردیف با لینک به خود سند.
 * دو آزمون «کش» (`fix`) اصلاح بی‌خطر دارند: موجودی هر انبار از جمع کاردکس و «دریافت‌شده»ی فاکتور از
 * جمع تخصیص‌ها — هر دو فقط کش را با منبع یکی می‌کنند و هیچ سندی نمی‌سازند.
 */

import { Prisma } from "@prisma/client";
import { faNum, formatAmount } from "../money";
import { INVOICE_TYPE_LABELS } from "../invoices/calc";
import { recalcPaid } from "../cash/allocation";
import { resyncStockRows } from "../inventory/stock";
import { todayKey } from "../dates";
import type { Db } from "./common";

type Tx = Prisma.TransactionClient;

const LIMIT = 50;
const A = "/admin/accounting";

export type Severity = "error" | "warn" | "info";

export interface HealthRow {
  label: string;
  detail: string;
  href: string;
}

export interface HealthCheck {
  key: string;
  group: "ledger" | "docs" | "stock" | "other";
  title: string;
  severity: Severity;
  /** چرا مهم است و چطور درست می‌شود */
  hint: string;
  count: number;
  rows: HealthRow[];
  /** اصلاح خودکار بی‌خطر دارد */
  fix?: "stock" | "paid";
  /** فهرست کامل جای دیگری است */
  more?: string;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const invLabel = (type: string, number: number | null) =>
  `${INVOICE_TYPE_LABELS[type as keyof typeof INVOICE_TYPE_LABELS] ?? "فاکتور"} ${number != null ? faNum(number) : "پیش‌نویس"}`;
const MONEY: Record<string, string> = { RECEIPT: "دریافت", PAYMENT: "پرداخت", TRANSFER: "انتقال وجه", EXPENSE: "هزینه", INCOME: "درآمد" };

/** لینک منبع یک گردش کاردکس */
function sourceHref(sourceType: string, sourceId: string, productId: string): string {
  switch (sourceType) {
    case "AccInvoice":
      return `${A}/invoices/${sourceId}`;
    case "AccStockAdjust":
      return `${A}/inventory/adjustments/${sourceId}`;
    case "AccTransfer":
      return `${A}/inventory/transfers?id=${sourceId}`;
    case "AccStockCount":
      return `${A}/inventory/counts/${sourceId}`;
    case "OpeningInventory":
      return `${A}/inventory/opening`;
  }
  return `${A}/inventory/${productId}`;
}

const SOURCE_LABEL: Record<string, string> = {
  AccInvoice: "فاکتور",
  AccStockAdjust: "ورود و خروج دستی",
  AccTransfer: "حواله",
  AccStockCount: "انبارگردانی",
  OpeningInventory: "موجودی اول دوره",
};

const MOVE_LABEL: Record<string, string> = {
  OPENING: "اول دوره",
  PURCHASE: "خرید",
  SALE_RETURN: "برگشت از فروش",
};

type Counted<T> = { total: number; rows: T[] };

async function counted<T>(db: Db, sql: Prisma.Sql): Promise<Counted<T>> {
  const rows = await db.$queryRaw<(T & { _total: number })[]>(Prisma.sql`SELECT *, (COUNT(*) OVER ())::int AS "_total" FROM (${sql}) q LIMIT ${LIMIT}`);
  return { total: rows[0]?._total ?? 0, rows };
}

export interface HealthOpts {
  /** بازه‌ی آزمون‌های کاردکس (منفی شدن، بهای صفر) */
  from: Date;
  to: Date;
}

export async function ledgerHealth(db: Db, opts: HealthOpts): Promise<{ checks: HealthCheck[]; at: Date }> {
  const end = opts.to;
  const start = opts.from;
  const today = todayKey();

  const [
    years,
    unbalanced,
    badLines,
    lineDrift,
    outOfYear,
    invNoVoucher,
    invVoidLive,
    moneyNoVoucher,
    moneyVoidLive,
    orphanVouchers,
    paidDrift,
    stockDrift,
    costDrift,
    negativeNow,
    negativeInRange,
    zeroCost,
    serialOver,
    events,
    inTransit,
    oldDrafts,
    noTitle,
    dupParties,
    settings,
  ] = await Promise.all([
    db.accFiscalYear.findMany({ orderBy: { startDate: "asc" }, select: { id: true, title: true, startDate: true, endDate: true, status: true } }),

    counted<{ id: string; number: number; date: Date; d: bigint; c: bigint; t: bigint; n: number }>(db, Prisma.sql`
      SELECT v."id", v."number", v."date", COALESCE(SUM(l."debit"), 0)::bigint AS d, COALESCE(SUM(l."credit"), 0)::bigint AS c, v."totalDebit" AS t, COUNT(l."id")::int AS n
      FROM "AccVoucher" v LEFT JOIN "AccVoucherLine" l ON l."voucherId" = v."id"
      WHERE v."status" = 'POSTED'
      GROUP BY v."id"
      HAVING COALESCE(SUM(l."debit"), 0) <> COALESCE(SUM(l."credit"), 0) OR COALESCE(SUM(l."debit"), 0) <> v."totalDebit" OR COUNT(l."id") < 2
      ORDER BY v."date" DESC`),

    counted<{ id: string; number: number; date: Date; problems: string[] }>(db, Prisma.sql`
      SELECT v."id", v."number", v."date", ARRAY_AGG(DISTINCT
        CASE
          WHEN a."level" <> 'SUBLEDGER' THEN 'حساب «' || a."name" || '» معین نیست'
          WHEN a."detailKind" = 'PARTY' AND l."partyId" IS NULL THEN '«' || a."name" || '» بی شخص'
          WHEN a."detailKind" <> 'PARTY' AND l."partyId" IS NOT NULL THEN '«' || a."name" || '» شخص نمی‌پذیرد'
          WHEN a."detailKind" = 'TREASURY' AND l."treasuryId" IS NULL THEN '«' || a."name" || '» بی صندوق/بانک'
          WHEN a."detailKind" <> 'TREASURY' AND l."treasuryId" IS NOT NULL THEN '«' || a."name" || '» صندوق نمی‌پذیرد'
          ELSE 'ردیف هم بدهکار و هم بستانکار (یا هیچ‌کدام)'
        END) AS problems
      FROM "AccVoucherLine" l
      JOIN "AccVoucher" v ON v."id" = l."voucherId"
      JOIN "AccAccount" a ON a."id" = l."accountId"
      WHERE v."status" = 'POSTED' AND (
        a."level" <> 'SUBLEDGER'
        OR (a."detailKind" = 'PARTY') <> (l."partyId" IS NOT NULL)
        OR (a."detailKind" = 'TREASURY') <> (l."treasuryId" IS NOT NULL)
        OR (l."debit" > 0) = (l."credit" > 0)
      )
      GROUP BY v."id"
      ORDER BY v."date" DESC`),

    counted<{ id: string; number: number; date: Date; n: number }>(db, Prisma.sql`
      SELECT v."id", v."number", v."date", COUNT(*)::int AS n
      FROM "AccVoucherLine" l JOIN "AccVoucher" v ON v."id" = l."voucherId"
      WHERE l."isVoid" <> (v."status" = 'VOID') OR l."date" <> v."date" OR l."yearId" <> v."yearId"
      GROUP BY v."id"
      ORDER BY v."date" DESC`),

    counted<{ id: string; number: number; date: Date; title: string }>(db, Prisma.sql`
      SELECT v."id", v."number", v."date", y."title"
      FROM "AccVoucher" v JOIN "AccFiscalYear" y ON y."id" = v."yearId"
      WHERE v."status" = 'POSTED' AND (v."date" < y."startDate" OR v."date" > y."endDate")
      ORDER BY v."date" DESC`),

    counted<{ id: string; type: string; number: number | null; date: Date; partyName: string; total: bigint }>(db, Prisma.sql`
      SELECT i."id", i."type"::text AS type, i."number", i."date", i."partyName", i."total"
      FROM "AccInvoice" i LEFT JOIN "AccVoucher" v ON v."id" = i."voucherId"
      WHERE i."status" = 'ISSUED' AND i."type" <> 'PROFORMA' AND i."total" > 0 AND (v."id" IS NULL OR v."status" = 'VOID')
      ORDER BY i."date" DESC`),

    counted<{ id: string; type: string; number: number | null; date: Date; vnum: number }>(db, Prisma.sql`
      SELECT i."id", i."type"::text AS type, i."number", i."date", v."number" AS vnum
      FROM "AccInvoice" i JOIN "AccVoucher" v ON v."id" = i."voucherId"
      WHERE i."status" = 'VOID' AND v."status" = 'POSTED'
      ORDER BY i."date" DESC`),

    counted<{ id: string; kind: string; number: number; date: Date; total: bigint }>(db, Prisma.sql`
      SELECT m."id", m."kind"::text AS kind, m."number", m."date", m."total"
      FROM "AccMoneyDoc" m LEFT JOIN "AccVoucher" v ON v."id" = m."voucherId"
      WHERE m."status" = 'POSTED' AND m."total" > 0 AND (v."id" IS NULL OR v."status" = 'VOID')
      ORDER BY m."date" DESC`),

    counted<{ id: string; kind: string; number: number; date: Date; vnum: number }>(db, Prisma.sql`
      SELECT m."id", m."kind"::text AS kind, m."number", m."date", v."number" AS vnum
      FROM "AccMoneyDoc" m JOIN "AccVoucher" v ON v."id" = m."voucherId"
      WHERE m."status" = 'VOID' AND v."status" = 'POSTED'
      ORDER BY m."date" DESC`),

    // سند خودکار فاکتور یا دریافت/پرداخت که هیچ سند منبعی به آن اشاره نمی‌کند
    counted<{ id: string; number: number; date: Date; source: string; description: string }>(db, Prisma.sql`
      SELECT v."id", v."number", v."date", v."source"::text AS source, v."description"
      FROM "AccVoucher" v
      WHERE v."status" = 'POSTED' AND (
        (v."source" IN ('SALES_INVOICE', 'PURCHASE_INVOICE', 'SALES_RETURN', 'PURCHASE_RETURN') AND NOT EXISTS (SELECT 1 FROM "AccInvoice" i WHERE i."voucherId" = v."id"))
        OR (v."source" IN ('RECEIPT', 'PAYMENT', 'TRANSFER', 'EXPENSE', 'INCOME') AND NOT EXISTS (SELECT 1 FROM "AccMoneyDoc" m WHERE m."voucherId" = v."id"))
      )
      ORDER BY v."date" DESC`),

    counted<{ id: string; type: string; number: number | null; paid: bigint; real: bigint }>(db, Prisma.sql`
      SELECT i."id", i."type"::text AS type, i."number", i."paidTotal" AS paid, COALESCE(a.s, 0)::bigint AS real
      FROM "AccInvoice" i
      LEFT JOIN (
        SELECT al."invoiceId", SUM(al."amount") AS s FROM "AccAllocation" al JOIN "AccMoneyDoc" m ON m."id" = al."moneyDocId"
        WHERE m."status" = 'POSTED' GROUP BY al."invoiceId"
      ) a ON a."invoiceId" = i."id"
      WHERE i."paidTotal" <> COALESCE(a.s, 0)
      ORDER BY i."date" DESC`),

    counted<{ productId: string; warehouseId: string; cached: number; real: number; title: string | null; wname: string | null }>(db, Prisma.sql`
      SELECT x."productId", x."warehouseId", x.cached, x.real, it."title", w."name" AS wname FROM (
        SELECT COALESCE(s."productId", m."productId") AS "productId", COALESCE(s."warehouseId", m."warehouseId") AS "warehouseId",
               COALESCE(s."qty", 0)::int AS cached, COALESCE(m.q, 0)::int AS real
        FROM "AccStock" s
        FULL OUTER JOIN (SELECT "productId", "warehouseId", SUM("qty") AS q FROM "AccStockMove" GROUP BY 1, 2) m
          ON m."productId" = s."productId" AND m."warehouseId" = s."warehouseId"
        WHERE COALESCE(s."qty", 0) <> COALESCE(m.q, 0)
      ) x
      LEFT JOIN "AccItem" it ON it."id" = x."productId"
      LEFT JOIN "AccWarehouse" w ON w."id" = x."warehouseId"`),

    counted<{ productId: string; cached: number; real: number; title: string | null }>(db, Prisma.sql`
      SELECT c."productId", c."qtyOnHand" AS cached, COALESCE(m.q, 0)::int AS real, it."title"
      FROM "AccProductCost" c
      LEFT JOIN (SELECT "productId", SUM("qty") AS q FROM "AccStockMove" GROUP BY 1) m ON m."productId" = c."productId"
      LEFT JOIN "AccItem" it ON it."id" = c."productId"
      WHERE c."qtyOnHand" <> COALESCE(m.q, 0)`),

    counted<{ productId: string; qty: number; title: string | null; wname: string | null }>(db, Prisma.sql`
      SELECT s."productId", s."qty", it."title", w."name" AS wname
      FROM "AccStock" s LEFT JOIN "AccItem" it ON it."id" = s."productId" LEFT JOIN "AccWarehouse" w ON w."id" = s."warehouseId"
      WHERE s."qty" < 0
      ORDER BY s."qty" ASC`),

    counted<{ productId: string; first: Date; low: number; title: string | null }>(db, Prisma.sql`
      SELECT m."productId", MIN(m."date") AS first, MIN(m."balanceQty")::int AS low, it."title"
      FROM "AccStockMove" m LEFT JOIN "AccItem" it ON it."id" = m."productId"
      WHERE m."balanceQty" < 0 AND m."date" >= ${start} AND m."date" <= ${end}
      GROUP BY m."productId", it."title"
      ORDER BY low ASC`),

    counted<{ sourceType: string; sourceId: string; productId: string; type: string; date: Date; title: string | null }>(db, Prisma.sql`
      SELECT DISTINCT ON (m."sourceType", m."sourceId") m."sourceType", m."sourceId", m."productId", m."type"::text AS type, m."date", it."title"
      FROM "AccStockMove" m LEFT JOIN "AccItem" it ON it."id" = m."productId"
      WHERE m."type" IN ('OPENING', 'PURCHASE', 'SALE_RETURN') AND m."unitCost" = 0 AND m."date" >= ${start} AND m."date" <= ${end}
      ORDER BY m."sourceType", m."sourceId", m."date" DESC`),

    counted<{ itemId: string; warehouseId: string; n: number; qty: number; title: string | null; wname: string | null }>(db, Prisma.sql`
      SELECT s."itemId", s."warehouseId", COUNT(*)::int AS n, COALESCE(MAX(st."qty"), 0)::int AS qty, it."title", w."name" AS wname
      FROM "AccSerial" s
      LEFT JOIN "AccStock" st ON st."productId" = s."itemId" AND st."warehouseId" = s."warehouseId"
      LEFT JOIN "AccItem" it ON it."id" = s."itemId"
      LEFT JOIN "AccWarehouse" w ON w."id" = s."warehouseId"
      WHERE s."status" = 'IN_STOCK'
      GROUP BY s."itemId", s."warehouseId", it."title", w."name"
      HAVING COUNT(*) > GREATEST(COALESCE(MAX(st."qty"), 0), 0)`),

    db.accEvent.findMany({
      where: { status: { in: ["BLOCKED", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, type: true, status: true, blockedReason: true, lastError: true, createdAt: true },
    }).then(async (rows) => ({ rows, total: await db.accEvent.count({ where: { status: { in: ["BLOCKED", "FAILED"] } } }) })),

    counted<{ id: string; number: number; date: Date; from: string; to: string }>(db, Prisma.sql`
      SELECT t."id", t."number", t."date", f."name" AS from, w."name" AS to
      FROM "AccTransfer" t JOIN "AccWarehouse" f ON f."id" = t."fromWarehouseId" JOIN "AccWarehouse" w ON w."id" = t."toWarehouseId"
      WHERE t."status" = 'POSTED' AND t."needsReceipt" AND t."receivedAt" IS NULL AND t."date" < ${new Date(today.getTime() - 7 * 86_400_000)}
      ORDER BY t."date" ASC`),

    counted<{ id: string; type: string; date: Date; partyName: string; total: bigint }>(db, Prisma.sql`
      SELECT i."id", i."type"::text AS type, i."date", i."partyName", i."total"
      FROM "AccInvoice" i
      WHERE i."status" = 'DRAFT' AND i."createdAt" < ${new Date(Date.now() - 30 * 86_400_000)}
      ORDER BY i."createdAt" ASC`),

    counted<{ id: string; code: string }>(db, Prisma.sql`
      SELECT i."id", i."code" FROM "AccItem" i WHERE TRIM(i."title") = '' ORDER BY i."code"`),

    counted<{ key: string; kind: string; ids: string[]; names: string[] }>(db, Prisma.sql`
      SELECT k AS key, kind, ARRAY_AGG(id ORDER BY "createdAt") AS ids, ARRAY_AGG(name ORDER BY "createdAt") AS names FROM (
        SELECT p."id", p."name", p."createdAt", REGEXP_REPLACE(p."mobile", '\\D', '', 'g') AS k, 'mobile' AS kind FROM "AccParty" p WHERE p."isActive" AND COALESCE(p."mobile", '') <> ''
        UNION ALL
        SELECT p."id", p."name", p."createdAt", p."nationalId" AS k, 'nationalId' AS kind FROM "AccParty" p WHERE p."isActive" AND COALESCE(p."nationalId", '') <> ''
      ) x
      GROUP BY k, kind HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC`),

    db.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true } }),
  ]);

  const checks: HealthCheck[] = [];
  const push = (c: Omit<HealthCheck, "count" | "rows">, data: { total: number; rows: HealthRow[] }) =>
    checks.push({ ...c, count: data.total, rows: data.rows });
  const map = <T,>(d: Counted<T>, fn: (r: T) => HealthRow) => ({ total: d.total, rows: d.rows.map(fn) });

  // ── سال مالی ──
  const covering = years.find((y) => y.startDate <= today && y.endDate >= today);
  const yearRows: HealthRow[] = [];
  if (!covering) yearRows.push({ label: "امروز", detail: "برای امروز سال مالی تعریف نشده؛ هیچ فاکتور و سندی صادر نمی‌شود", href: `${A}/settings?tab=years` });
  else if (covering.status !== "OPEN") yearRows.push({ label: `سال ${covering.title}`, detail: "سال جاری بسته است", href: `${A}/settings/years/${covering.id}` });
  for (let i = 1; i < years.length; i++) {
    const gap = (years[i].startDate.getTime() - years[i - 1].endDate.getTime()) / 86_400_000;
    if (gap > 1) yearRows.push({ label: `${years[i - 1].title} ← ${years[i].title}`, detail: `${faNum(gap - 1)} روز بین دو سال بی سال مالی است`, href: `${A}/settings?tab=years` });
    if (gap < 1) yearRows.push({ label: `${years[i - 1].title} و ${years[i].title}`, detail: "دو سال مالی روی هم افتاده‌اند", href: `${A}/settings?tab=years` });
  }
  if (settings?.mode === "INTERNAL" || years.length) {
    push({ key: "years", group: "ledger", title: "سال مالی امروز و پیوستگی سال‌ها", severity: "error", hint: "بدون سال مالیِ باز برای امروز، صدور فاکتور و ثبت سند ممکن نیست. از «تنظیمات ← سال مالی» سال تازه بسازید." }, { total: yearRows.length, rows: yearRows });
  }

  // ── دفتر ──
  push(
    { key: "unbalanced", group: "ledger", title: "اسنادی که تراز نیستند", severity: "error", hint: "جمع بدهکار و بستانکار سند باید برابر باشد. سند تراز نشده همه‌ی ترازها را به هم می‌ریزد؛ سند دستی را باطل و دوباره ثبت کنید، سند خودکار را از منبعش دوباره ذخیره کنید." },
    map(unbalanced, (r) => ({
      label: `سند ${faNum(r.number)}`,
      detail: r.n < 2 ? `${faNum(r.n)} ردیف` : `بدهکار ${formatAmount(r.d)} / بستانکار ${formatAmount(r.c)}${r.d !== r.t ? ` / جمع ثبت‌شده ${formatAmount(r.t)}` : ""}`,
      href: `${A}/vouchers/${r.id}`,
    })),
  );
  push(
    { key: "badLines", group: "ledger", title: "اسناد با معین یا تفصیل اشتباه", severity: "error", hint: "ردیفی که روی حساب غیرمعین نشسته، یا حساب شخص‌دار بی شخص است (و برعکس). معمولاً از تغییر نوع تفصیل حساب بعد از ثبت سند می‌آید." },
    map(badLines, (r) => ({ label: `سند ${faNum(r.number)}`, detail: r.problems.join("، "), href: `${A}/vouchers/${r.id}` })),
  );
  push(
    { key: "lineDrift", group: "ledger", title: "ردیف‌های ناهمگام با سند", severity: "error", hint: "تاریخ، سال یا وضعیت ابطال ردیف با خود سند یکی نیست؛ گزارش‌ها ردیف را می‌خوانند و ممکن است عدد اشتباه نشان دهند." },
    map(lineDrift, (r) => ({ label: `سند ${faNum(r.number)}`, detail: `${faNum(r.n)} ردیف`, href: `${A}/vouchers/${r.id}` })),
  );
  push(
    { key: "outOfYear", group: "ledger", title: "اسناد بیرون از بازه‌ی سال مالی خود", severity: "error", hint: "تاریخ سند در بازه‌ی سالی که به آن تعلق دارد نیست — معمولاً بعد از عوض کردن تاریخ‌های سال." },
    map(outOfYear, (r) => ({ label: `سند ${faNum(r.number)}`, detail: `سال ${r.title}`, href: `${A}/vouchers/${r.id}` })),
  );
  push(
    { key: "orphanVouchers", group: "ledger", title: "سند خودکار بی منبع", severity: "error", hint: "سندی از فاکتور یا دریافت/پرداخت که منبعش دیگر به آن وصل نیست — مبلغش دوبار شمرده می‌شود. با پشتیبانی بررسی کنید." },
    map(orphanVouchers, (r) => ({ label: `سند ${faNum(r.number)}`, detail: r.description, href: `${A}/vouchers/${r.id}` })),
  );

  // ── اسناد ──
  push(
    { key: "invNoVoucher", group: "docs", title: "فاکتور صادرشده بی سند حسابداری", severity: "error", hint: "مبلغ این فاکتورها در دفتر نیست. فاکتور را باز کنید و یک بار «ذخیره» بزنید تا سندش ساخته شود." },
    map(invNoVoucher, (r) => ({ label: invLabel(r.type, r.number), detail: `${r.partyName} · ${formatAmount(r.total)}`, href: `${A}/invoices/${r.id}` })),
  );
  push(
    { key: "invVoidLive", group: "docs", title: "فاکتور باطل با سند زنده", severity: "error", hint: "فاکتور باطل شده ولی سندش هنوز در دفتر شمرده می‌شود." },
    map(invVoidLive, (r) => ({ label: invLabel(r.type, r.number), detail: `سند ${faNum(r.vnum)}`, href: `${A}/invoices/${r.id}` })),
  );
  push(
    { key: "moneyNoVoucher", group: "docs", title: "دریافت/پرداخت بی سند حسابداری", severity: "error", hint: "این مبلغ در صندوق و حساب شخص دیده نمی‌شود." },
    map(moneyNoVoucher, (r) => ({ label: `${MONEY[r.kind] ?? r.kind} ${faNum(r.number)}`, detail: formatAmount(r.total), href: `${A}/money/${r.id}` })),
  );
  push(
    { key: "moneyVoidLive", group: "docs", title: "دریافت/پرداخت باطل با سند زنده", severity: "error", hint: "سند باطل شده ولی مبلغش هنوز در دفتر است." },
    map(moneyVoidLive, (r) => ({ label: `${MONEY[r.kind] ?? r.kind} ${faNum(r.number)}`, detail: `سند ${faNum(r.vnum)}`, href: `${A}/money/${r.id}` })),
  );
  push(
    { key: "paidDrift", group: "docs", title: "«دریافت‌شده»ی فاکتور با تخصیص‌ها یکی نیست", severity: "warn", fix: "paid", hint: "مانده‌ی فاکتور از جمع دریافت‌های وصل‌شده حساب می‌شود؛ اینجا عدد ذخیره‌شده با آن جمع فرق دارد. «اصلاح» فقط همین عدد را از تخصیص‌ها دوباره می‌سازد." },
    map(paidDrift, (r) => ({ label: invLabel(r.type, r.number), detail: `ذخیره ${formatAmount(r.paid)} / واقعی ${formatAmount(r.real)}`, href: `${A}/invoices/${r.id}` })),
  );
  push(
    { key: "oldDrafts", group: "docs", title: "پیش‌نویس‌های قدیمی (بیش از ۳۰ روز)", severity: "info", hint: "پیش‌نویس در دفتر و کاردکس نیست؛ یا صادرش کنید یا حذفش." },
    map(oldDrafts, (r) => ({ label: `${invLabel(r.type, null)} ${day(r.date)}`, detail: `${r.partyName} · ${formatAmount(r.total)}`, href: `${A}/invoices/${r.id}` })),
  );

  // ── کالا ──
  push(
    { key: "stockDrift", group: "stock", title: "موجودی انبار با جمع کاردکس یکی نیست", severity: "error", fix: "stock", hint: "موجودی هر انبار باید جمع گردش‌های کاردکس همان انبار باشد. «اصلاح» موجودی را از کاردکس دوباره می‌سازد؛ کاردکس و بها دست نمی‌خورند." },
    map(stockDrift, (r) => ({ label: r.title ?? r.productId, detail: `${r.wname ?? "انبار حذف‌شده"}: ذخیره ${faNum(r.cached)} / کاردکس ${faNum(r.real)}`, href: `${A}/inventory/${r.productId}` })),
  );
  push(
    { key: "costDrift", group: "stock", title: "موجودی کل بها با کاردکس یکی نیست", severity: "error", hint: "تعداد پایه‌ی میانگین بها با جمع کاردکس فرق دارد؛ بهای خروج‌های بعدی اشتباه می‌شود. یک گردش تازه (مثلاً ورود و ابطال) بها را از نو حساب می‌کند؛ اگر ماند با پشتیبانی." },
    map(costDrift, (r) => ({ label: r.title ?? r.productId, detail: `ذخیره ${faNum(r.cached)} / کاردکس ${faNum(r.real)}`, href: `${A}/inventory/${r.productId}` })),
  );
  push(
    { key: "negativeNow", group: "stock", title: "کالاهای با موجودی منفی (الان)", severity: "warn", hint: "بیشتر از موجودی فروخته یا حواله شده. خرید یا ورود جاافتاده را ثبت کنید، یا با انبارگردانی درستش کنید." },
    map(negativeNow, (r) => ({ label: r.title ?? r.productId, detail: `${r.wname ?? ""}: ${faNum(r.qty)}`, href: `${A}/inventory/${r.productId}` })),
  );
  push(
    { key: "negativeInRange", group: "stock", title: "کالاهایی که در این بازه منفی شده‌اند", severity: "warn", hint: "موجودی کل کالا در این بازه زیر صفر رفته؛ بهای فروش آن روزها با آخرین بهای ورود حساب شده و ممکن است سود را اشتباه نشان دهد." },
    map(negativeInRange, (r) => ({ label: r.title ?? r.productId, detail: `از ${day(r.first)} · کمترین ${faNum(r.low)}`, href: `${A}/inventory/${r.productId}` })),
  );
  push(
    { key: "zeroCost", group: "stock", title: "ورود کالا با بهای صفر (خرید، برگشت، اول دوره)", severity: "warn", hint: "کالایی که با بهای صفر وارد شده میانگین بها را پایین می‌آورد و سود فروش‌های بعد را بیشتر از واقع نشان می‌دهد. اگر هدیه نبوده، فی را در سند منبع درست کنید." },
    map(zeroCost, (r) => ({ label: `${SOURCE_LABEL[r.sourceType] ?? r.sourceType} · ${MOVE_LABEL[r.type] ?? r.type}`, detail: `${r.title ?? ""} · ${day(r.date)}`, href: sourceHref(r.sourceType, r.sourceId, r.productId) })),
  );
  push(
    { key: "serialOver", group: "stock", title: "سریال‌های در انبار بیشتر از موجودی", severity: "warn", hint: "انبارگردانی یا فروش سایت تعداد کالای سریال‌دار را بی سریال کم کرده. سریال‌های اضافه را با «خروج دستی» (با انتخاب سریال) بیرون ببرید." },
    map(serialOver, (r) => ({ label: r.title ?? r.itemId, detail: `${r.wname ?? ""}: ${faNum(r.n)} سریال / موجودی ${faNum(r.qty)}`, href: `${A}/inventory/serials?itemId=${r.itemId}&w=${r.warehouseId}&status=IN_STOCK` })),
  );
  push(
    { key: "inTransit", group: "stock", title: "حواله‌های در راه بیش از ۷ روز", severity: "info", hint: "مقصد هنوز دریافت را تأیید نکرده؛ کالا در هیچ انباری قابل فروش نیست." },
    map(inTransit, (r) => ({ label: `حواله ${faNum(r.number)}`, detail: `${r.from} ← ${r.to} · ${day(r.date)}`, href: `${A}/inventory/transfers?id=${r.id}` })),
  );
  push(
    { key: "noTitle", group: "stock", title: "کالای بدون نام", severity: "info", hint: "در فاکتور و گزارش فقط کد دیده می‌شود." },
    map(noTitle, (r) => ({ label: r.code, detail: "بی نام", href: `${A}/inventory/${r.id}` })),
  );

  // ── سایر ──
  push(
    { key: "events", group: "other", title: "رویدادهای مالی مسدود یا ناموفق", severity: "error", hint: "فروش یا دریافتی که باید در حسابداری ثبت می‌شد و نشده. دلیلش را در صفحه‌ی رویدادها ببینید و «تلاش دوباره» بزنید.", more: `${A}/events?status=BLOCKED` },
    {
      total: events.total,
      rows: events.rows.map((e) => ({
        label: e.type,
        detail: `${e.status === "FAILED" ? "ناموفق" : "مسدود"}: ${(e.status === "FAILED" ? e.lastError : e.blockedReason) ?? "—"}`,
        href: `${A}/events?status=${e.status}`,
      })),
    },
  );
  push(
    { key: "dupParties", group: "other", title: "اشخاص با موبایل یا کد ملی تکراری", severity: "info", hint: "احتمالاً یک نفر دو بار تعریف شده و حسابش دو تکه است. هر ردیف پنجره‌ی ادغام را باز می‌کند؛ همه‌ی نامزدها (با نام یکسان هم) در «اشخاص تکراری».", more: `${A}/parties/duplicates` },
    map(dupParties, (r) => ({
      label: r.names.join(" / "),
      detail: `${r.kind === "mobile" ? "موبایل" : "کد ملی"} ${r.key}`,
      href: `${A}/parties/${r.ids[0]}?merge=${r.ids[1]}`,
    })),
  );

  return { checks, at: new Date() };
}

/** اصلاح کش‌ها — فقط همان ردیف‌هایی که آزمون نشان داد */
export async function fixHealth(tx: Tx, kind: "stock" | "paid"): Promise<number> {
  if (kind === "paid") {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT i."id" FROM "AccInvoice" i
      LEFT JOIN (
        SELECT al."invoiceId", SUM(al."amount") AS s FROM "AccAllocation" al JOIN "AccMoneyDoc" m ON m."id" = al."moneyDocId"
        WHERE m."status" = 'POSTED' GROUP BY al."invoiceId"
      ) a ON a."invoiceId" = i."id"
      WHERE i."paidTotal" <> COALESCE(a.s, 0)`);
    await recalcPaid(tx, rows.map((r) => r.id));
    return rows.length;
  }
  const rows = await tx.$queryRaw<{ productId: string }[]>(Prisma.sql`
    SELECT DISTINCT COALESCE(s."productId", m."productId") AS "productId"
    FROM "AccStock" s
    FULL OUTER JOIN (SELECT "productId", "warehouseId", SUM("qty") AS q FROM "AccStockMove" GROUP BY 1, 2) m
      ON m."productId" = s."productId" AND m."warehouseId" = s."warehouseId"
    WHERE COALESCE(s."qty", 0) <> COALESCE(m.q, 0)`);
  await resyncStockRows(tx, rows.map((r) => r.productId));
  return rows.length;
}
