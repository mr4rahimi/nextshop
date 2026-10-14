/**
 * بررسی مرز دسترسی راهنمای هوشمند
 *
 *   pnpm tsx scripts/assistant-access-check.ts
 *
 * به دیتابیس وصل نمی‌شود — فقط فهرست ابزار، صفحه‌ها و مقاله‌هایی را می‌سنجد که هر نقش
 * می‌بیند. مرز امنیتی دستیار در همین‌هاست، نه در پرامپت.
 *
 * مستندات: docs/plans/admin-assistant.md بخش ۲ و ۱۱
 */

// prisma هنگام import ساخته می‌شود (بی اتصال) و آدرس دیتابیس را لازم دارد
import "../lib/load-env";
import type { StaffAccess } from "../lib/permissions";
import { ALL_PERMISSIONS } from "../lib/permissions";
import { ALL_TOOLS, toolsFor } from "../lib/assistant/tools";
import { canSeePage, visiblePages } from "../lib/assistant/pages";
import { articleForPage, readArticle, searchHelp, visibleArticles } from "../lib/assistant/help";
import { faDate, startOfTehranDay } from "../lib/assistant/dates";
import { resolvePeriod, type Period } from "../lib/assistant/period";

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`✓ ${label}`);
  } else {
    fail++;
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function staff(permissions: string[], isUnrestricted = false): StaffAccess {
  return {
    userId: "u1", name: "آزمون", phone: "09120000000", role: isUnrestricted ? "ADMIN" : "SELLER",
    roleId: isUnrestricted ? null : "r1", roleTitle: isUnrestricted ? null : "آزمون",
    permissions: isUnrestricted ? ALL_PERMISSIONS : permissions, isUnrestricted,
  };
}
const gate = (a: StaffAccess) => ({ isUnrestricted: a.isUnrestricted, permissions: a.permissions });

const nobody = staff([]);
const writer = staff(["CONTENT_TASK_WORK", "WORK_VIEW_OWN"]);
const seller = staff(["ORDER_CREATE", "WORK_VIEW_OWN", "CUSTOMER_VIEW_OWN"]);
const admin = staff([], true);

// ── ابزار ────────────────────────────────────────────────────────
const names = (a: StaffAccess) => toolsFor(a).map((t) => t.name).sort();

check(
  "کارمند بی‌مجوز فقط ابزار راهنما و واژه‌نامه دارد",
  JSON.stringify(names(nobody)) === JSON.stringify(["explain_current_page", "read_help_article", "search_help", "seo_glossary"]),
  names(nobody).join(","),
);
check("محتوانویس ابزار کارهای مارکتینگ دارد", names(writer).includes("get_my_marketing_tasks"));
check("محتوانویس ابزار سفارش ندارد", !names(writer).includes("get_my_orders"));
check("محتوانویس مربی کار دارد", ["explain_task", "analyze_content_draft", "inspect_page"].every((n) => names(writer).includes(n)));
check("محتوانویس پورسانت و حضور ندارد", !names(writer).includes("get_my_commission") && !names(writer).includes("get_my_attendance"));
check("فروشنده بررسی متن محتوا ندارد", !names(seller).includes("analyze_content_draft") && !names(seller).includes("explain_task"));
const seoOnly = staff(["SEO_TASK_WORK"]);
check("کارمند سئو بررسی متن محتوا ندارد", !names(seoOnly).includes("analyze_content_draft") && names(seoOnly).includes("explain_task"));
check("فروشنده ابزار سفارش‌های خودش را دارد", names(seller).includes("get_my_orders"));
check("فروشنده ابزار مارکتینگ ندارد", !names(seller).includes("get_my_marketing_tasks"));
check("مدیر کل همه‌ی ابزارها را دارد", names(admin).length === ALL_TOOLS.length);

// هیچ ابزاری شناسه‌ی کاربر را از مدل نمی‌گیرد — «من» همیشه از سشن است
const userArgs = ALL_TOOLS.filter((t) =>
  Object.keys((t.parameters as { properties?: Record<string, unknown> }).properties ?? {}).some((k) =>
    /user|staff|owner|assignee|writer/i.test(k),
  ),
);
check("هیچ ابزاری ورودی شناسه‌ی کاربر ندارد", userArgs.length === 0, userArgs.map((t) => t.name).join(","));

// ── ابزارهای گزارش (فاز ۳): نگهبان = نگهبان روت همان گزارش ──────────
const REPORT_GUARDS: Record<string, string[][]> = {
  // هر ردیف یک مجموعه‌ی کافی؛ هر مجموعه باید کافی باشد و هیچ زیرمجموعه‌ی کوچک‌ترش نه
  report_sales: [["PANEL_REPORTS"], ["PANEL_ORDERS"]],
  report_orders_status: [["PANEL_ORDERS"]],
  report_panel_activity: [["PANEL_REPORTS"]],
  report_sales_sources: [["SEO_ANALYTICS_VIEW"], ["MARKETING_SETTINGS_MANAGE"]],
  report_traffic: [["SEO_ANALYTICS_VIEW"], ["MARKETING_SETTINGS_MANAGE"]],
  report_campaigns: [["TOOLS_VIEW"], ["TOOLS_MANAGE"]],
  report_sms_campaigns: [["PANEL_CLUB"]],
  catalog_health: [["PANEL_CATALOG"]],
  report_team: [["WORK_REPORT_VIEW"]],
  report_marketing_team: [["MARKETING_VIEW_ALL"]],
  report_finance: [["ACC_REPORTS"]],
  report_profit: [["ACC_REPORTS", "ACC_COST_VIEW"]],
  report_marketplaces: [["PANEL_INTEGRATION"]],
};
for (const [tool, sets] of Object.entries(REPORT_GUARDS)) {
  check(`${tool} در فهرست ابزارهاست`, ALL_TOOLS.some((t) => t.name === tool));
  for (const set of sets) {
    check(`${tool} با ${set.join("+")} هست`, names(staff(set)).includes(tool));
    for (const p of set) {
      const rest = set.filter((x) => x !== p);
      if (rest.length) check(`${tool} با ${rest.join("+")} تنها نیست`, !names(staff(rest)).includes(tool));
    }
  }
}
const reportNames = ALL_TOOLS.filter((t) => t.name.startsWith("report_") || t.name === "catalog_health").map((t) => t.name);
check("همه‌ی ابزارهای گزارش نگهبان آزموده دارند", reportNames.every((n) => n in REPORT_GUARDS), reportNames.join(","));
check("محتوانویس و فروشنده هیچ ابزار گزارشی ندارند", [writer, seller].every((a) => !names(a).some((n) => reportNames.includes(n))));
const orderStaff = staff(["PANEL_ORDERS"]);
check("کارمند سفارش‌ها سود و هزینه ندارد", !names(orderStaff).includes("report_profit") && !names(orderStaff).includes("report_finance"));

// اجرای مستقیم بی مجوز (اگر مدل نام ابزار را حدس بزند) — نگهبان دوم، پیش از دیتابیس
const runAs = async (tool: string, a: StaffAccess) =>
  (await ALL_TOOLS.find((t) => t.name === tool)!.run({}, { access: a })) as { error?: string };
const guardRunsP = Promise.all([
  runAs("report_profit", staff(["ACC_REPORTS"])),
  runAs("report_finance", nobody),
  runAs("report_sales", writer),
  runAs("catalog_health", seller),
]);

// ── بازه ─────────────────────────────────────────────────────────
const DAY = 86_400_000;
// پنج‌شنبه ۲۳ مهر ۱۴۰۵، ساعت ۱۶ تهران
const now = new Date("2026-10-15T12:30:00Z");
const per = (args: Record<string, unknown>) => resolvePeriod(args, now) as Period;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const month = per({ period: "this_month" });
check("این ماه از ۱ مهر است", ymd(month.fromDay) === "2026-09-23", ymd(month.fromDay));
check("این ماه ناتمام است و تا همین لحظه بریده شده", month.unfinished && month.end.getTime() === now.getTime() && month.days === 23, `${month.days}`);
check(
  "دوره‌ی قبلِ این ماه هم‌طول و چسبیده است",
  month.previous.end.getTime() === month.start.getTime() &&
    month.previous.end.getTime() - month.previous.start.getTime() === month.end.getTime() - month.start.getTime(),
);
check("شروع ماه نیمه‌شب تهران است", month.start.toISOString() === "2026-09-22T20:30:00.000Z", month.start.toISOString());
const mehr = per({ period: "month", jYear: 1405, jMonth: 6 });
check("شهریور ۱۴۰۵ کامل و ۳۱ روز است", !mehr.unfinished && mehr.days === 31 && mehr.label.includes("شهریور"), `${mehr.days} ${mehr.label}`);
const week = per({ period: "this_week" });
check("این هفته از شنبه است", week.fromDay.getUTCDay() === 6 && week.days === 6, `${ymd(week.fromDay)} ${week.days}`);
const lastWeek = per({ period: "last_week" });
check("هفته‌ی قبل ۷ روز کامل است", !lastWeek.unfinished && lastWeek.days === 7 && lastWeek.toDay.getTime() + DAY === week.fromDay.getTime());
const range = per({ period: "range", from: "۱۴۰۵/۰۷/۰۱", to: "1405/07/10" });
check("بازه‌ی دلخواه با رقم فارسی ۱۰ روز است", range.days === 10 && !range.unfinished, `${range.days}`);
check("بازه‌ی آینده خطا می‌دهد", "error" in (resolvePeriod({ period: "month", jYear: 1406, jMonth: 1 }, now) as object));
check("بازه‌ی نامعتبر خطا می‌دهد", "error" in (resolvePeriod({ period: "range", from: "دیروز" }, now) as object));

// ── صفحه‌ها ───────────────────────────────────────────────────────
check("محتوانویس کارهای محتوا را می‌بیند", canSeePage("/admin/worklist/content", gate(writer)));
check("محتوانویس کارهای سئو را نمی‌بیند", !canSeePage("/admin/worklist/seo", gate(writer)));
check("محتوانویس سفارش‌ها را نمی‌بیند", !canSeePage("/admin/orders", gate(writer)));
check("محتوانویس گزارش تیم را نمی‌بیند", !canSeePage("/admin/worklist/reports", gate(writer)));
check("فروشنده ثبت سفارش تلفنی را می‌بیند", canSeePage("/admin/worklist/phone-order", gate(seller)));
check("فروشنده تنظیمات هوش مصنوعی را نمی‌بیند", !canSeePage("/admin/ai-settings", gate(seller)));
check("بی‌مجوز حسابداری نمی‌بیند", !canSeePage("/admin/accounting/reports", gate(nobody)));
check("مدیر کل همه را می‌بیند", visiblePages(gate(admin)).length > 60, String(visiblePages(gate(admin)).length));

// ── مقاله‌ها ───────────────────────────────────────────────────────
const writerArticles = visibleArticles(gate(writer));
check(
  "محتوانویس مقاله‌ی صفحه‌های بسته را نمی‌بیند",
  writerArticles.every((a) => !a.href || canSeePage(a.href, gate(writer))),
);
check("محتوانویس راهنمای کارهای محتوا را می‌بیند", writerArticles.some((a) => a.id === "help-contentTasks"));
check("محتوانویس راهنمای حسابداری را نمی‌بیند", !writerArticles.some((a) => a.id.startsWith("help-accounting")));
check("خواندن مقاله‌ی بسته با شناسه هم رد می‌شود", readArticle(gate(writer), "help-teamReport") === null);
check(
  "جستجوی «ریدایرکت» برای محتوانویس مقاله‌ی ریدایرکت را نمی‌آورد",
  !searchHelp(gate(writer), "ریدایرکت").articles.some((a) => a.id === "redirects"),
);
check(
  "جستجوی «ریدایرکت» برای مدیر مقاله‌ی ریدایرکت را می‌آورد",
  searchHelp(gate(admin), "ریدایرکت آدرس قدیمی").articles.some((a) => a.id === "redirects"),
);
check(
  "جستجو در changelog نتیجه دارد",
  searchHelp(gate(admin), "لینک خارجی فایل دانلودی").changelog.length > 0,
);
check(
  "راهنمای صفحه‌ی فعلی کارهای سئو",
  articleForPage(gate(admin), "/admin/worklist/seo")?.id === "help-seoTasks",
  articleForPage(gate(admin), "/admin/worklist/seo")?.id,
);
const ids = visibleArticles(gate(admin)).map((a) => a.id);
check("شناسه‌ی مقاله‌ها یکتاست", new Set(ids).size === ids.length);

// ── تاریخ ─────────────────────────────────────────────────────────
const tomorrowNoon = new Date(startOfTehranDay().getTime() + 36 * 3_600_000);
check("تاریخ فردا برچسب «فردا» دارد", faDate(tomorrowNoon)?.includes("(فردا)") === true, faDate(tomorrowNoon) ?? "");
check("تاریخ نام ماه دارد", /فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند/.test(faDate(new Date()) ?? ""));

void guardRunsP.then((guardRuns) => {
  check("اجرای مستقیم گزارش بی مجوز «دسترسی ندارید» می‌دهد", guardRuns.every((r) => r.error?.includes("دسترسی")), JSON.stringify(guardRuns));
  console.log(`\n${pass} درست، ${fail} نادرست`);
  process.exit(fail ? 1 : 0);
});
