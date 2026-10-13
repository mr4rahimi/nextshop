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

console.log(`\n${pass} درست، ${fail} نادرست`);
process.exit(fail ? 1 : 0);
