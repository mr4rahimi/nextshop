/**
 * صفحه‌های پنل که هر کاربر می‌تواند باز کند — docs/plans/admin-assistant.md بخش ۵
 *
 * دیدن راهنما = دیدن صفحه. مبنا همان `canOpenPath` سایدبار و proxy است، به‌اضافه‌ی مجوز
 * صفحه‌های داخل کارتابل، حسابداری و ابزارها: آن بخش‌ها در `admin-sections.ts` یا «باز برای
 * هر کارمند»اند (`self`) یا مجوزشان کلی است و خودِ صفحه مجوز دقیق را چک می‌کند. بدون این
 * لایه، دستیار به کارمند فروش «کارهای سئو» را پیشنهاد می‌داد.
 *
 * ⚠️ صفحه‌ی تازه‌ی کارتابل که مجوز خودش را دارد، در `WORKLIST_PAGE_PERMS` هم ثبت شود.
 */
import { canOpenPath, type GateAccess } from "@/lib/admin-sections";
import { MENU_GROUPS } from "@/components/admin/nav";
import { ACCOUNTING_APPS, TOOLS_APPS, WORKLIST_APPS } from "@/components/admin/apps";

/** مجوز صفحه‌های کارتابل — یکی کافی است. نبودن کلید یعنی هر کارمند */
const WORKLIST_PAGE_PERMS: Record<string, string[]> = {
  "/admin/worklist": ["WORK_VIEW_OWN", "WORK_VIEW_ALL"],
  "/admin/worklist/calls": ["CALL_VIEW_OWN", "CALL_VIEW_ALL", "CALL_LOG"],
  "/admin/club/members": ["CUSTOMER_VIEW_OWN", "CUSTOMER_VIEW_ALL", "PANEL_CLUB"],
  "/admin/worklist/phone-order": ["ORDER_CREATE", "PANEL_ORDERS"],
  "/admin/worklist/orders": ["ORDER_CREATE"],
  "/admin/worklist/credit": ["CREDIT_VIEW_OWN", "CREDIT_VIEW_ALL", "CREDIT_MANAGE"],
  "/admin/worklist/tasks": ["WORK_VIEW_OWN", "WORK_VIEW_ALL"],
  "/admin/worklist/seo": ["SEO_TASK_WORK", "SEO_TASK_MANAGE", "MARKETING_VIEW_ALL"],
  "/admin/worklist/content": ["CONTENT_TASK_WORK", "CONTENT_TASK_MANAGE", "MARKETING_VIEW_ALL"],
  "/admin/worklist/links": ["LINK_WORK", "LINK_MANAGE", "MARKETING_VIEW_ALL"],
  "/admin/worklist/analytics": ["SEO_ANALYTICS_VIEW", "MARKETING_SETTINGS_MANAGE"],
  "/admin/worklist/attendance": ["ATTENDANCE_VIEW_OWN", "ATTENDANCE_VIEW_ALL"],
  "/admin/worklist/deals": ["DEAL_LOG", "DEAL_VIEW_ALL"],
  "/admin/worklist/payouts": ["COMMISSION_VIEW_OWN", "COMMISSION_VIEW_ALL", "COMMISSION_MANAGE"],
  "/admin/worklist/reports": ["WORK_REPORT_VIEW"],
  "/admin/worklist/suppliers": ["SUPPLIER_VIEW", "SUPPLIER_MANAGE"],
  "/admin/worklist/settings": ["WORK_SETTINGS_MANAGE"],
  "/admin/worklist/roles": ["ROLE_MANAGE"],
};

const base = (href: string) => href.split("?")[0];

/** مجوز دقیق یک صفحه، اگر جایی ثبت شده باشد */
const PAGE_PERMS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>(Object.entries(WORKLIST_PAGE_PERMS));
  for (const app of [...ACCOUNTING_APPS, ...TOOLS_APPS]) {
    if (app.perm?.length && !map.has(base(app.href))) map.set(base(app.href), app.perm);
  }
  return map;
})();

export function canSeePage(href: string, access: GateAccess): boolean {
  const path = base(href);
  if (!canOpenPath(path, access)) return false;
  if (access.isUnrestricted) return true;
  const perms = PAGE_PERMS.get(path);
  return !perms || perms.some((p) => access.permissions.includes(p));
}

export interface PanelPage {
  href: string;
  label: string;
  group: string;
}

/** همه‌ی صفحه‌های منو با نام گروه — زیرمنوی کارتابل از `WORKLIST_APPS` می‌آید */
const ALL_PAGES: PanelPage[] = (() => {
  const pages: PanelPage[] = [];
  const seen = new Set<string>();
  const add = (href: string, label: string, group: string) => {
    if (!href.startsWith("/admin") || seen.has(href)) return;
    seen.add(href);
    pages.push({ href, label: label.trim(), group });
  };
  for (const group of MENU_GROUPS) {
    for (const item of group.items) {
      if (item.children?.length) {
        for (const child of item.children) add(child.href, child.label, item.label);
      } else {
        add(item.href, item.label, group.label);
      }
    }
  }
  for (const app of [...WORKLIST_APPS, ...ACCOUNTING_APPS, ...TOOLS_APPS]) add(app.href, app.label, "");
  return pages;
})();

export function visiblePages(access: GateAccess): PanelPage[] {
  return ALL_PAGES.filter((p) => canSeePage(p.href, access));
}

/** فهرست فشرده برای پرامپت: «گروه: نام (مسیر)، …» */
export function accessiblePagesText(access: GateAccess): string {
  const byGroup = new Map<string, string[]>();
  for (const p of visiblePages(access)) {
    const key = p.group || "سایر";
    byGroup.set(key, [...(byGroup.get(key) ?? []), `${p.label} (${p.href})`]);
  }
  return [...byGroup.entries()].map(([g, items]) => `${g}: ${items.join("، ")}`).join("\n");
}

/** نام صفحه‌ی فعلی — طولانی‌ترین پیشوند */
export function pageLabel(pathname: string | undefined): string | null {
  if (!pathname) return null;
  let best: PanelPage | null = null;
  for (const p of ALL_PAGES) {
    const path = base(p.href);
    const hit = pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));
    if (hit && (!best || path.length > base(best.href).length)) best = p;
  }
  return best ? (best.group ? `${best.group} ← ${best.label}` : best.label) : null;
}
