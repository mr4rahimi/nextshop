/**
 * صحت‌سنجی گزارش عملکرد تیم — فقط خواندنی.
 *
 *   npx tsx scripts/smoke-team-report.ts          # ۹۰ روز اخیر
 *   npx tsx scripts/smoke-team-report.ts 30d
 *
 * عددهای کارت‌ها با جمع جدول، سری روزانه، نقشه‌ی ساعت و پنجره‌ی جزئیات
 * با هم مقایسه می‌شوند — اگر یکی از شرط‌ها در یک جا عوض شود و در جای دیگر نه،
 * اینجا می‌شکند. چیزی نمی‌نویسد، پس روی سرور هم بی‌خطر است.
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import { parseRange } from "../lib/reports";
import { teamReport, teamReportDetail } from "../lib/worklist/team-report";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

async function main() {
  const range = parseRange(new URLSearchParams({ preset: process.argv[2] ?? "90d" }));
  const r = await teamReport(range);
  const k = r.kpi;
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

  console.log(`بازه ${range.from.toISOString().slice(0, 10)} تا ${range.to.toISOString().slice(0, 10)} — ${k.done} بسته‌شده، ${r.staff.length} کارمند`);

  check("سری روزانه‌ی بسته‌شده = کارت", sum(r.series.done) === k.done, `${sum(r.series.done)} / ${k.done}`);
  check("سری ثبت‌شده = کارت", sum(r.series.created) === k.created);
  check("نقشه‌ی ساعت = کارت", sum(r.heatmap.flat()) === k.done);
  check("سطل‌های زمان بستن = کارت", sum(r.closeTime.map((b) => b.value)) === k.done);
  check("تفکیک حوزه = کارت", sum(r.byDomain.map((d) => d.value)) === k.done);
  check("به‌موقع ≤ مهلت‌دار", k.onTime <= k.withDue);
  check("موفق ≤ نتیجه‌دار ≤ بسته‌شده", k.success <= k.rated && k.rated <= k.done);
  check("دیرکرد روزانه ≤ بسته‌شده", r.series.late.every((v, i) => v <= r.series.done[i]));
  check("جمع دیرکرد = مهلت‌دار − به‌موقع", sum(r.series.late) === k.withDue - k.onTime);

  // جدول کارکنان فقط کار صاحب‌دار را دارد، پس ≤ کارت
  const staffDone = sum(r.staff.map((s) => s.done));
  check("جمع جدول ≤ کارت", staffDone <= k.done, `${staffDone} / ${k.done}`);
  check("اسپارک هر ردیف = بسته‌شده‌ی همان ردیف", r.staff.every((s) => sum(s.spark) === s.done));
  check("حوزه‌های هر ردیف = بسته‌شده‌ی همان ردیف", r.staff.every((s) => sum(Object.values(s.byDomain) as number[]) === s.done));
  check("بدون NaN", !JSON.stringify(r).includes("NaN"));

  // پنجره‌ی جزئیات باید همان عدد جدول را بدهد
  const top = r.staff.find((s) => s.done > 0);
  if (top) {
    const [done, late, success, overdue, calls, noOutcome] = await Promise.all([
      teamReportDetail(range, "done", top.userId),
      teamReportDetail(range, "late", top.userId),
      teamReportDetail(range, "success", top.userId),
      teamReportDetail(range, "overdue", top.userId),
      teamReportDetail(range, "calls", top.userId),
      teamReportDetail(range, "noOutcome", top.userId),
    ]);
    check(`جزئیات بسته‌شده‌ی ${top.name}`, done.total === top.done, `${done.total} / ${top.done}`);
    check("جزئیات دیرکرد", late.total === top.withDue - top.onTime, `${late.total} / ${top.withDue - top.onTime}`);
    check("جزئیات موفق", success.total === top.success);
    check("جزئیات عقب‌افتاده", overdue.total === top.overdue);
    check("جزئیات تماس", calls.total === top.calls);
    check("جزئیات بی‌نتیجه", noOutcome.total === top.created - top.withOutcome);

    // ریزشدن روی یک نفر: کارت‌ها همان ردیف جدول‌اند و جدول هنوز کل تیم است
    const one = await teamReport(range, top.userId);
    check("ریزشده: کارت = ردیف", one.kpi.done === top.done && one.kpi.onTime === top.onTime);
    check("ریزشده: جدول کل تیم می‌ماند", one.staff.length === r.staff.length);
  }

  console.log(failed ? `\n${failed} مورد ناموفق` : "\nهمه درست است");
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
