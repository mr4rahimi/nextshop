/**
 * بررسی محاسبه‌ی موعد کار دوره‌ای سئو
 *
 *   pnpm tsx scripts/seo-recurrence-check.ts
 *
 * به دیتابیس وصل نمی‌شود — فقط توابع خالص `lib/marketing/seo-recurrence.ts`
 * را با تاریخ‌های واقعی می‌سنجد. این تنها جایی است که تعریف «ماه شمسی» برای
 * کار دوره‌ای آزموده می‌شود.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵.۶
 */

import {
  addJalaliMonths,
  nextRunAfter,
  advanceToFuture,
} from "../lib/marketing/seo-recurrence";
import {
  fromJalali,
  toJalali,
  formatJalaliShort,
  isoToTehranLocal,
  tehranLocalToIso,
} from "../lib/club/jalali";

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** تاریخ شمسی با ساعت تهران */
function j(year: number, month: number, day: number, time = "09:00"): Date {
  const base = fromJalali(year, month, day);
  if (!base) throw new Error(`تاریخ نامعتبر: ${year}/${month}/${day}`);
  const ymd = base.toISOString().slice(0, 10);
  // همان مسیری که خودِ ماژول استفاده می‌کند
  return new Date(tehranLocalToIso(`${ymd}T${time}`));
}

function show(d: Date): string {
  return `${formatJalaliShort(d)} ساعت ${isoToTehranLocal(d.toISOString()).slice(11, 16)}`;
}

console.log("— ماه شمسی، نه میلادی —");
{
  // اول فروردین + ۱ ماه = اول اردیبهشت
  const from = j(1405, 1, 1);
  const to = addJalaliMonths(from, 1);
  const p = toJalali(to);
  check(
    "۱/۱ + یک ماه = ۲/۱",
    p.month === 2 && p.day === 1 && p.year === 1405,
    show(to),
  );
}
{
  // اسفند + ۱ ماه باید سال را جلو ببرد
  const from = j(1405, 12, 5);
  const to = addJalaliMonths(from, 1);
  const p = toJalali(to);
  check(
    "۱۲/۵ + یک ماه = سال بعد ۱/۵",
    p.year === 1406 && p.month === 1 && p.day === 5,
    show(to),
  );
}

console.log("\n— بریدن روزِ ته‌ماه —");
{
  // ۳۱ فروردین + ۶ ماه = مهر که ۳۰ روزه است
  const from = j(1405, 1, 31);
  const to = addJalaliMonths(from, 6);
  const p = toJalali(to);
  check("۱/۳۱ + شش ماه = ۷/۳۰ (نه ۷/۳۱)", p.month === 7 && p.day === 30, show(to));

  // و ماه بعدش دوباره ۳۱ نمی‌شود — مبنا تاریخ اجرای قبلی است
  const next = addJalaliMonths(to, 1);
  const pn = toJalali(next);
  check("و ماه بعد ۸/۳۰ می‌ماند، به ۳۱ برنمی‌گردد", pn.month === 8 && pn.day === 30, show(next));
}
{
  // ۳۰ آبان + ۴ ماه = اسفند (۲۹ یا ۳۰ روزه)
  const from = j(1404, 8, 30);
  const to = addJalaliMonths(from, 4);
  const p = toJalali(to);
  const len = p.month === 12 ? 1 : 0;
  check(
    "۸/۳۰ + چهار ماه به اسفند می‌رسد و از طول ماه بیرون نمی‌زند",
    len === 1 && p.day <= 30,
    show(to),
  );
}

console.log("\n— ساعت دیواری حفظ می‌شود —");
{
  const from = j(1405, 3, 10, "09:30");
  const to = addJalaliMonths(from, 1);
  const time = isoToTehranLocal(to.toISOString()).slice(11, 16);
  check("۹:۳۰ صبح، ماه بعد هم ۹:۳۰ صبح است", time === "09:30", show(to));
}
{
  // گذر از تغییر سال هم نباید ساعت را جابه‌جا کند
  const from = j(1405, 12, 20, "23:45");
  const to = addJalaliMonths(from, 1);
  const time = isoToTehranLocal(to.toISOString()).slice(11, 16);
  check("۲۳:۴۵ پایان سال، سال بعد هم ۲۳:۴۵", time === "23:45", show(to));
}

console.log("\n— هفته —");
{
  const from = j(1405, 5, 2, "08:00");
  const to = nextRunAfter(from, "WEEK", 2);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000);
  check("هر دو هفته = ۱۴ روز دقیق", days === 14, show(to));
}

console.log("\n— عقب‌افتادگی انباشته نمی‌شود —");
{
  // موعدی که سه ماه پیش بوده
  const now = j(1405, 6, 15, "12:00");
  const stale = j(1405, 3, 15, "09:00");
  const r = advanceToFuture(stale, "MONTH", 1, now);
  check(
    "موعدِ سه‌ماه‌پیش به اولین تاریخ آینده می‌پرد، نه به نوبت بعدیِ بلافاصله",
    r.nextRunAt.getTime() > now.getTime(),
    `${show(r.nextRunAt)} · ${r.skipped} نوبت رد شد`,
  );
  const p = toJalali(r.nextRunAt);
  check("و آن تاریخ ۷/۱۵ است", p.month === 7 && p.day === 15, show(r.nextRunAt));
  // کارِ ساخته‌شده مالِ نوبتِ ۳/۱۵ است؛ نوبت‌های ۴/۱۵ و ۵/۱۵ و ۶/۱۵ رد شدند
  check("سه نوبتِ ازدست‌رفته شمرده شد", r.skipped === 3, `skipped=${r.skipped}`);
}
{
  // موعدی که همین حالا رسیده: یک گام جلو، بدون ردشده
  const now = j(1405, 6, 15, "12:00");
  const due = j(1405, 6, 15, "09:00");
  const r = advanceToFuture(due, "MONTH", 1, now);
  const p = toJalali(r.nextRunAt);
  check(
    "موعدِ همین حالا فقط یک گام جلو می‌رود",
    p.month === 7 && p.day === 15 && r.skipped === 0,
    `${show(r.nextRunAt)} · skipped=${r.skipped}`,
  );
}
{
  // موعدی که هنوز نرسیده نباید تکان بخورد
  const now = j(1405, 6, 15, "12:00");
  const future = j(1405, 7, 1, "09:00");
  const r = advanceToFuture(future, "MONTH", 1, now);
  check(
    "موعدِ آینده دست‌نخورده می‌ماند",
    r.nextRunAt.getTime() === future.getTime() && r.skipped === 0,
    show(r.nextRunAt),
  );
}

console.log(`\nنتیجه: ${pass} قبول · ${fail} رد`);
process.exit(fail === 0 ? 0 : 1);
