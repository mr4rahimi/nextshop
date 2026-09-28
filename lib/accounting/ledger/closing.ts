/**
 * بستن و بازگشایی سال مالی — docs/plans/accounting.md بخش ۱۷.
 *
 * بستن سال Y (پایان E) چهار سند می‌سازد، همه در یک تراکنش:
 *   ۱. `CLOSING` «بستن حساب‌های موقت» (تاریخ E) — مانده‌ی هر درآمد و هزینه‌ی سال
 *      (با تفصیلی‌اش) صفر و خالصش به «خلاصه‌ی سود و زیان» می‌رود.
 *      `sourceId = closing:<yearId>:temp`
 *   ۲. `CLOSING` «انتقال سود به سود انباشته» (تاریخ E) — خلاصه‌ی سود و زیان ← سود انباشته.
 *      `sourceId = closing:<yearId>:pl`
 *   ۳. `CLOSING` «اختتامیه‌ی حساب‌های دائم» (تاریخ E) — مانده‌ی هر دارایی، بدهی و
 *      سرمایه (با تفصیلی) صفر می‌شود. `sourceId = carry:<yearId>:close`
 *   ۴. `OPENING` «افتتاحیه» سال بعد (روز اول) — عکس سند ۳. `sourceId = carry:<yearId>:open`
 *
 * ⚠️ سندهای ۳ و ۴ («انتقال مانده» — پیشوند `carry:`) دقیقاً هم را خنثی می‌کنند؛
 *    گزارش‌ها و گردش‌ها آن‌ها را کنار می‌گذارند (`NOT_CARRY`) تا صورت‌حساب شخص و
 *    ترازنامه دو ردیف بی‌معنی نشان ندهند و مانده‌ی ابتدای سال بعد درست بماند.
 *    مانده‌ها (`balancesBy`) هر دو را می‌شمارند — جمعشان صفر است.
 * ⚠️ کاردکس پیوسته است و سال نمی‌شناسد؛ موجودی کالا حرکت `OPENING` تازه
 *    نمی‌گیرد (برخلاف پیش‌نویس سند) — فقط حساب «موجودی کالا» منتقل می‌شود.
 */

import type { AccFiscalYear, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatJalali } from "@/lib/club/jalali";
import { AccError } from "../errors";
import { faNum, formatAmount } from "../money";
import { todayKey, jalaliYearOf } from "../dates";
import { ensureFiscalYear } from "./fiscal-year";
import { postVoucher, voidVoucher, type Actor, type LineInput } from "./post";
import { NOT_CARRY } from "./balances";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const DAY_MS = 86_400_000;

export const closingKeys = (yearId: string) => ({
  temp: `closing:${yearId}:temp`,
  pl: `closing:${yearId}:pl`,
  carryClose: `carry:${yearId}:close`,
  carryOpen: `carry:${yearId}:open`,
});

export { NOT_CARRY };

/** آیا این سال افتتاحیه‌ی خودکار از بستن سال قبل دارد؟ (اول دوره‌ی دستی دیگر مجاز نیست) */
export async function hasCarriedOpening(db: Db, yearId: string): Promise<boolean> {
  const n = await db.accVoucher.count({
    where: { yearId, source: "OPENING", status: "POSTED", sourceId: { startsWith: "carry:" } },
  });
  return n > 0;
}

export interface ClosingCheck {
  key: string;
  ok: boolean;
  /** خطا مانع بستن است؛ هشدار نه */
  level: "error" | "warning";
  title: string;
  detail?: string;
  href?: string;
}

async function nextYearOf(db: Db, year: AccFiscalYear) {
  const start = new Date(year.endDate.getTime() + DAY_MS);
  return db.accFiscalYear.findUnique({ where: { startDate: start } });
}

/** پیش‌نمایش ویزارد: بررسی‌ها، سود سال، سال بعد */
export async function closingPreview(db: Db, yearId: string) {
  const year = await db.accFiscalYear.findUnique({ where: { id: yearId } });
  if (!year) throw new AccError("سال مالی پیدا نشد", 404);
  const inYear = { gte: year.startDate, lte: year.endDate };

  const [earlierOpen, events, draftInvoices, draftCounts, draftTransfers, negative, profitRows, next, laterClosed] = await Promise.all([
    db.accFiscalYear.findMany({ where: { startDate: { lt: year.startDate }, status: "OPEN" }, select: { title: true } }),
    db.accEvent.count({ where: { status: { in: ["BLOCKED", "FAILED"] } } }),
    db.accInvoice.count({ where: { status: "DRAFT", date: inYear, type: { not: "PROFORMA" } } }),
    db.accStockCount.count({ where: { status: "DRAFT", date: inYear } }),
    db.accTransfer.count({ where: { status: "DRAFT", date: inYear } }),
    db.accProductCost.count({ where: { qtyOnHand: { lt: 0 } } }),
    db.accVoucherLine.groupBy({
      by: ["accountId"],
      where: { yearId: year.id, isVoid: false, account: { class: { in: ["REVENUE", "EXPENSE"] } } },
      _sum: { debit: true, credit: true },
    }),
    nextYearOf(db, year),
    db.accFiscalYear.count({ where: { startDate: { gt: year.startDate }, status: "CLOSED" } }),
  ]);
  const profit = profitRows.reduce((s, r) => s + (r._sum.credit ?? 0n) - (r._sum.debit ?? 0n), 0n);
  const ended = year.endDate.getTime() < todayKey().getTime();

  const checks: ClosingCheck[] =
    year.status === "CLOSED"
      ? []
      : [
          {
            key: "ended",
            ok: ended,
            level: "error",
            title: ended ? "سال تمام شده است" : "سال هنوز تمام نشده",
            detail: ended ? undefined : `سال ${faNum(year.title)} تا ${formatJalali(year.endDate)} ادامه دارد؛ بعد از آن بسته می‌شود.`,
          },
          {
            key: "earlier",
            ok: earlierOpen.length === 0,
            level: "error",
            title: earlierOpen.length ? "سال قبل هنوز باز است" : "سال‌های قبل بسته‌اند",
            detail: earlierOpen.length ? `اول سال ${earlierOpen.map((y) => faNum(y.title)).join("، ")} را ببندید.` : undefined,
          },
          {
            key: "events",
            ok: events === 0,
            level: "error",
            title: events ? `${faNum(events)} رویداد مالی ثبت‌نشده` : "همه‌ی رویدادهای فروشگاه ثبت شده‌اند",
            detail: events ? "رویداد مسدود یعنی فروش یا پرداختی هنوز به دفتر نرسیده؛ بعد از بستن دیگر در این سال ثبت نمی‌شود." : undefined,
            href: events ? "/admin/accounting/events" : undefined,
          },
          {
            key: "drafts",
            ok: draftInvoices + draftCounts + draftTransfers === 0,
            level: "error",
            title:
              draftInvoices + draftCounts + draftTransfers
                ? `${faNum(draftInvoices + draftCounts + draftTransfers)} پیش‌نویس در این سال`
                : "پیش‌نویسی نمانده",
            detail:
              draftInvoices + draftCounts + draftTransfers
                ? [
                    draftInvoices && `${faNum(draftInvoices)} فاکتور`,
                    draftCounts && `${faNum(draftCounts)} انبارگردانی`,
                    draftTransfers && `${faNum(draftTransfers)} حواله`,
                  ]
                    .filter(Boolean)
                    .join("، ") + " — صادر یا حذفشان کنید."
                : undefined,
            href: draftInvoices ? "/admin/accounting/sales?status=DRAFT" : draftCounts ? "/admin/accounting/inventory/counts" : undefined,
          },
          {
            key: "negative",
            ok: negative === 0,
            level: "warning",
            title: negative ? `${faNum(negative)} کالا موجودی منفی دارد` : "موجودی منفی نداریم",
            detail: negative ? "بهای این کالاها برآوردی است و بعد از بستن، جبرانش به این سال برنمی‌گردد. بهتر است اول خرید یا انبارگردانی‌اش ثبت شود." : undefined,
            href: negative ? "/admin/accounting/inventory?filter=negative" : undefined,
          },
        ];

  return {
    year,
    profit,
    nextYear: next ? { id: next.id, title: next.title, status: next.status } : null,
    nextTitle: next?.title ?? String(jalaliYearOf(year.startDate) + 1),
    checks,
    canClose: year.status === "OPEN" && checks.every((c) => c.ok || c.level === "warning"),
    canReopen: year.status === "CLOSED" && laterClosed === 0,
  };
}

type Group = { accountId: string; partyId: string | null; treasuryId: string | null; net: bigint };

async function groupedBalances(tx: Tx, where: Prisma.AccVoucherLineWhereInput): Promise<Group[]> {
  const rows = await tx.accVoucherLine.groupBy({
    by: ["accountId", "partyId", "treasuryId"],
    where: { isVoid: false, ...where },
    _sum: { debit: true, credit: true },
  });
  return rows
    .map((r) => ({
      accountId: r.accountId,
      partyId: r.partyId,
      treasuryId: r.treasuryId,
      net: (r._sum.debit ?? 0n) - (r._sum.credit ?? 0n),
    }))
    .filter((r) => r.net !== 0n);
}

/** ردیفی که مانده‌ی `net` (بدهکار − بستانکار) را صفر می‌کند */
const zeroing = (g: Group, description: string): LineInput => ({
  accountId: g.accountId,
  partyId: g.partyId,
  treasuryId: g.treasuryId,
  debit: g.net < 0n ? -g.net : 0n,
  credit: g.net > 0n ? g.net : 0n,
  description,
});

export async function closeYear(yearId: string, actor: Actor) {
  return prisma.$transaction(
    async (tx) => {
      // قفل ردیف سال — دو بستن هم‌زمان
      await tx.$queryRaw`SELECT id FROM "AccFiscalYear" WHERE id = ${yearId} FOR UPDATE`;
      const pre = await closingPreview(tx, yearId);
      const { year } = pre;
      if (year.status === "CLOSED") throw new AccError(`سال ${faNum(year.title)} قبلاً بسته شده است`, 409);
      const blocking = pre.checks.find((c) => !c.ok && c.level === "error");
      if (blocking) throw new AccError(`${blocking.title}${blocking.detail ? ` — ${blocking.detail}` : ""}`);

      const next = await ensureFiscalYear(tx, jalaliYearOf(year.startDate) + 1);
      if (next.status === "CLOSED") throw new AccError(`سال ${faNum(next.title)} بسته است`);
      const keys = closingKeys(year.id);
      const E = year.endDate;
      const made: { temp?: string; pl?: string; carryClose?: string; carryOpen?: string } = {};

      // ۱. بستن درآمد و هزینه‌ی همین سال
      const temps = await groupedBalances(tx, { yearId: year.id, account: { class: { in: ["REVENUE", "EXPENSE"] } } });
      const profit = temps.reduce((s, g) => s - g.net, 0n); // بستانکار − بدهکار
      if (temps.length) {
        const lines = temps.map((g) => zeroing(g, "بستن حساب"));
        if (profit !== 0n) {
          lines.push(
            profit > 0n
              ? { accountKey: "PL_SUMMARY", credit: profit, description: "سود سال" }
              : { accountKey: "PL_SUMMARY", debit: -profit, description: "زیان سال" },
          );
        }
        if (lines.length >= 2) {
          made.temp = (
            await postVoucher(tx, { date: E, description: `بستن حساب‌های درآمد و هزینه‌ی سال ${faNum(year.title)}`, source: "CLOSING", sourceId: keys.temp, lines, actor })
          ).id;
        }
      }

      // ۲. خلاصه‌ی سود و زیان ← سود انباشته (کل مانده‌اش، اگر از قبل هم چیزی مانده بود)
      const pl = await groupedBalances(tx, { account: { systemKey: "PL_SUMMARY" }, date: { lte: E } });
      const plNet = pl.reduce((s, g) => s + g.net, 0n);
      if (plNet !== 0n) {
        made.pl = (
          await postVoucher(tx, {
            date: E,
            description: `انتقال ${plNet < 0n ? "سود" : "زیان"} سال ${faNum(year.title)} به سود انباشته`,
            source: "CLOSING",
            sourceId: keys.pl,
            lines: [
              { accountKey: "PL_SUMMARY", debit: plNet < 0n ? -plNet : 0n, credit: plNet > 0n ? plNet : 0n },
              { accountKey: "RETAINED_EARNINGS", debit: plNet > 0n ? plNet : 0n, credit: plNet < 0n ? -plNet : 0n },
            ],
            actor,
          })
        ).id;
      }

      // ۳ و ۴. انتقال مانده‌ی حساب‌های دائم به سال بعد
      const perms = await groupedBalances(tx, { date: { lte: E }, account: { class: { in: ["ASSET", "LIABILITY", "EQUITY"] } } });
      const leftover = await groupedBalances(tx, { date: { lte: E }, account: { class: { in: ["REVENUE", "EXPENSE"] } } });
      if (leftover.length) {
        // درآمد/هزینه‌ی سال‌های قبل که بسته نشده بود — نباید پیش بیاید (سال‌ها به ترتیب بسته می‌شوند)
        throw new AccError("حساب‌های درآمد و هزینه بعد از بستن صفر نشدند؛ دفتر سال‌های قبل را بررسی کنید");
      }
      if (perms.length) {
        const sum = perms.reduce((s, g) => s + g.net, 0n);
        if (sum !== 0n) throw new AccError(`دفتر تراز نیست (اختلاف ${formatAmount(sum)})؛ بستن سال انجام نشد`);
        made.carryClose = (
          await postVoucher(tx, {
            date: E,
            description: `اختتامیه‌ی حساب‌های دائم سال ${faNum(year.title)}`,
            source: "CLOSING",
            sourceId: keys.carryClose,
            lines: perms.map((g) => zeroing(g, "اختتامیه")),
            actor,
          })
        ).id;
        made.carryOpen = (
          await postVoucher(tx, {
            date: next.startDate,
            description: `افتتاحیه‌ی سال ${faNum(next.title)} — مانده‌های منتقل‌شده از ${faNum(year.title)}`,
            source: "OPENING",
            sourceId: keys.carryOpen,
            lines: perms.map((g) => ({
              accountId: g.accountId,
              partyId: g.partyId,
              treasuryId: g.treasuryId,
              debit: g.net > 0n ? g.net : 0n,
              credit: g.net < 0n ? -g.net : 0n,
              description: "افتتاحیه",
            })),
            actor,
          })
        ).id;
      }

      await tx.accFiscalYear.update({ where: { id: year.id }, data: { status: "CLOSED", closedAt: new Date(), closedByName: actor.name } });
      const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { lockDate: true, currentYearId: true } });
      await tx.accSettings.update({
        where: { id: "singleton" },
        data: {
          lockDate: !s?.lockDate || s.lockDate.getTime() < E.getTime() ? E : s.lockDate,
          ...(s?.currentYearId === year.id ? { currentYearId: next.id } : {}),
        },
      });
      return { year, nextYear: next, profit, vouchers: made };
    },
    { timeout: 300_000 },
  );
}

/**
 * بازگشایی — فقط آخرین سال بسته (سال‌های بعدش باز باشند). چهار سند باطل،
 * تاریخ قفل به روز پیش از شروع همین سال برمی‌گردد (اگر خود بستن آن را جلو برده بود).
 */
export async function reopenYear(yearId: string, reason: string, actor: Actor) {
  if (!reason.trim()) throw new AccError("دلیل بازگشایی را بنویسید");
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AccFiscalYear" WHERE id = ${yearId} FOR UPDATE`;
      const year = await tx.accFiscalYear.findUnique({ where: { id: yearId } });
      if (!year) throw new AccError("سال مالی پیدا نشد", 404);
      if (year.status !== "CLOSED") throw new AccError("این سال باز است", 409);
      if (await tx.accFiscalYear.count({ where: { startDate: { gt: year.startDate }, status: "CLOSED" } })) {
        throw new AccError("اول سال‌های بعد را باز کنید");
      }
      const next = await nextYearOf(tx, year);
      const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { lockDate: true } });
      const dayBefore = new Date(year.startDate.getTime() - DAY_MS);
      const lockDate = s?.lockDate && s.lockDate.getTime() >= year.startDate.getTime() ? dayBefore : (s?.lockDate ?? null);
      // اول باز کن و قفل را عقب ببر، بعد باطل کن (ابطال تاریخ باز می‌خواهد)
      await tx.accFiscalYear.update({ where: { id: year.id }, data: { status: "OPEN", closedAt: null, closedByName: null } });
      await tx.accSettings.update({ where: { id: "singleton" }, data: { lockDate } });

      const keys = closingKeys(year.id);
      const vouchers = await tx.accVoucher.findMany({
        where: { status: "POSTED", sourceId: { in: [keys.temp, keys.pl, keys.carryClose, keys.carryOpen] } },
      });
      if (next && vouchers.some((v) => v.sourceId === keys.carryOpen) && next.status === "CLOSED") {
        throw new AccError(`سال ${faNum(next.title)} بسته است`);
      }
      for (const v of vouchers) await voidVoucher(tx, v.id, `بازگشایی سال ${faNum(year.title)}: ${reason.trim()}`, actor, { fromSource: true });
      return { year, voided: vouchers.length, lockDate };
    },
    { timeout: 300_000 },
  );
}
