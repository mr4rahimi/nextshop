/**
 * «اپ»های بخش‌های بزرگ پنل — کارتابل و حسابداری.
 *
 * هر بخشِ این دو ماژول یک کاشی مربعی (مثل آیکن اپلیکیشن) در صفحه‌ی خانه‌ی
 * ماژول و در پنجره‌ی «همه‌ی بخش‌ها» دارد. زیرمنوی کارتابل در سایدبار هم از
 * همین فهرست ساخته می‌شود، پس بخش تازه فقط اینجا اضافه می‌شود.
 *
 * مستندات: docs/features/admin-ui.md
 */

import {
  ArrowLeftRight, Banknote, CalendarClock, ChartColumn, ChartPie, ClipboardList,
  ClockCheck, Coins, FolderTree, House, Landmark, Link2, ListTodo, NotebookPen,
  Package, PenLine, PhoneCall, PhoneForwarded, Receipt, SearchCheck, Settings,
  ShieldCheck, ShoppingBag, StickyNote, TrendingUp, Truck, Users, Wallet, Warehouse, Zap,
  type LucideIcon,
} from "lucide-react";

/** رنگ کاشی — کلاس‌ها کامل نوشته شده‌اند تا Tailwind پیدایشان کند */
export type AppTone =
  | "blue" | "indigo" | "violet" | "fuchsia" | "rose" | "red" | "orange" | "amber"
  | "lime" | "emerald" | "teal" | "cyan" | "sky" | "slate";

export const TONE_TILE: Record<AppTone, string> = {
  blue: "from-blue-400 to-blue-600 shadow-blue-600/30",
  indigo: "from-indigo-400 to-indigo-600 shadow-indigo-600/30",
  violet: "from-violet-400 to-violet-600 shadow-violet-600/30",
  fuchsia: "from-fuchsia-400 to-fuchsia-600 shadow-fuchsia-600/30",
  rose: "from-rose-400 to-rose-600 shadow-rose-600/30",
  red: "from-red-400 to-red-600 shadow-red-600/30",
  orange: "from-orange-400 to-orange-600 shadow-orange-600/30",
  amber: "from-amber-400 to-amber-600 shadow-amber-600/30",
  lime: "from-lime-500 to-lime-700 shadow-lime-700/30",
  emerald: "from-emerald-400 to-emerald-600 shadow-emerald-600/30",
  teal: "from-teal-400 to-teal-600 shadow-teal-600/30",
  cyan: "from-cyan-400 to-cyan-600 shadow-cyan-600/30",
  sky: "from-sky-400 to-sky-600 shadow-sky-600/30",
  slate: "from-slate-400 to-slate-600 shadow-slate-600/30",
};

/** نسخه‌ی کم‌رنگ برای آیکن‌های کوچک (نوار بخش، دکمه‌ها) */
export const TONE_SOFT: Record<AppTone, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  lime: "bg-lime-500/10 text-lime-700 dark:text-lime-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

export interface AppItem {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: AppTone;
  /** مجوزهای لازم — یکی کافی است. نبودنش یعنی خودِ صفحه مجوز را چک می‌کند */
  perm?: string[];
  /** برچسب کوچک کنار نام، مثل «حسابدار» */
  tag?: string;
  /** فقط وقتی مسیر دقیقاً برابر باشد فعال است */
  exact?: boolean;
  /**
   * نام فایل آیکن رنگی در `public/admin-icons` (بدون .svg). اگر باشد جای آیکن
   * lucide را می‌گیرد؛ `icon` و `tone` برای جاهای بی‌تصویر می‌مانند.
   */
  img?: string;
}

// ── کارتابل — docs/features/staff-worklist.md ─────────────────────────────

export const WORKLIST_APPS: AppItem[] = [
  { href: "/admin/worklist", label: "کارهای من", icon: ListTodo, tone: "blue", exact: true, img: "wl-my-tasks" },
  { href: "/admin/worklist/calls", label: "تماس‌ها", icon: PhoneCall, tone: "emerald", img: "wl-calls" },
  { href: "/admin/club/members?owner=me", label: "مشتریان من", icon: Users, tone: "violet", img: "wl-customers" },
  { href: "/admin/worklist/phone-order", label: "ثبت سفارش تلفنی", icon: PhoneForwarded, tone: "orange", img: "wl-phone-order" },
  { href: "/admin/worklist/orders", label: "سفارش‌های من", icon: Package, tone: "amber", img: "wl-orders" },
  { href: "/admin/worklist/credit", label: "موعدهای پرداخت", icon: CalendarClock, tone: "rose", img: "wl-credit" },
  { href: "/admin/worklist/tasks", label: "همه‌ی کارها", icon: ClipboardList, tone: "sky", img: "wl-all-tasks" },
  { href: "/admin/worklist/seo", label: "کارهای سئو", icon: SearchCheck, tone: "teal", img: "wl-seo" },
  { href: "/admin/worklist/content", label: "کارهای محتوا", icon: PenLine, tone: "fuchsia", img: "wl-content" },
  { href: "/admin/worklist/links", label: "لینک‌سازی", icon: Link2, tone: "indigo", img: "wl-links" },
  { href: "/admin/worklist/attendance", label: "حضور", icon: ClockCheck, tone: "cyan", img: "wl-attendance" },
  { href: "/admin/worklist/deals", label: "سود معاملات", icon: TrendingUp, tone: "lime", img: "wl-deals" },
  { href: "/admin/worklist/payouts", label: "پورسانت", icon: Coins, tone: "amber", img: "wl-payouts" },
  { href: "/admin/worklist/notes", label: "یادداشت‌های من", icon: StickyNote, tone: "orange", img: "wl-notes" },
  { href: "/admin/worklist/reports", label: "گزارش عملکرد تیم", icon: ChartColumn, tone: "blue", img: "wl-reports" },
  { href: "/admin/worklist/suppliers", label: "تأمین‌کننده‌ها", icon: Truck, tone: "slate", img: "wl-suppliers" },
  { href: "/admin/worklist/settings", label: "تنظیمات کارتابل", icon: Settings, tone: "slate", img: "wl-settings" },
  { href: "/admin/worklist/roles", label: "نقش‌ها و دسترسی‌ها", icon: ShieldCheck, tone: "red", img: "wl-roles" },
];

// ── حسابداری — docs/plans/accounting.md بخش ۱۳ ───────────────────────────

export const ACCOUNTING_APPS: AppItem[] = [
  { href: "/admin/accounting", label: "خانه", icon: House, tone: "blue", perm: ["ACC_VIEW", "ACC_SETTINGS"], exact: true, img: "acc-home" },
  { href: "/admin/accounting/sales", label: "فروش", icon: Receipt, tone: "emerald", perm: ["ACC_VIEW", "ACC_SALES"], img: "acc-sales" },
  { href: "/admin/accounting/purchases", label: "خرید", icon: ShoppingBag, tone: "orange", perm: ["ACC_VIEW", "ACC_PURCHASE"], img: "acc-purchases" },
  { href: "/admin/accounting/money", label: "دریافت و پرداخت", icon: ArrowLeftRight, tone: "sky", perm: ["ACC_VIEW", "ACC_TREASURY"], img: "acc-money" },
  { href: "/admin/accounting/cheques", label: "چک‌ها", icon: Banknote, tone: "teal", perm: ["ACC_VIEW", "ACC_CHEQUE"], img: "acc-cheques" },
  { href: "/admin/accounting/expenses", label: "هزینه‌ها", icon: Wallet, tone: "rose", perm: ["ACC_VIEW", "ACC_EXPENSE"], img: "acc-expenses" },
  { href: "/admin/accounting/reports", label: "گزارش‌ها", icon: ChartPie, tone: "violet", perm: ["ACC_REPORTS"], img: "acc-reports" },
  { href: "/admin/accounting/parties", label: "اشخاص", icon: Users, tone: "indigo", perm: ["ACC_VIEW", "ACC_PARTY_MANAGE"], img: "acc-parties" },
  { href: "/admin/accounting/treasury", label: "صندوق و بانک", icon: Landmark, tone: "cyan", perm: ["ACC_VIEW", "ACC_SETTINGS"], img: "acc-treasury" },
  { href: "/admin/accounting/inventory", label: "کالا و انبار", icon: Warehouse, tone: "amber", perm: ["ACC_VIEW", "ACC_INVENTORY"], img: "acc-inventory" },
  { href: "/admin/accounting/vouchers", label: "اسناد", icon: NotebookPen, tone: "fuchsia", perm: ["ACC_VOUCHER", "ACC_VIEW"], tag: "حسابدار", img: "acc-vouchers" },
  { href: "/admin/accounting/accounts", label: "سرفصل حساب‌ها", icon: FolderTree, tone: "lime", perm: ["ACC_VOUCHER", "ACC_SETTINGS"], tag: "حسابدار", img: "acc-accounts" },
  { href: "/admin/accounting/events", label: "رویدادهای مالی", icon: Zap, tone: "red", perm: ["ACC_VIEW", "ACC_SETTINGS"], img: "acc-events" },
  { href: "/admin/accounting/settings", label: "تنظیمات", icon: Settings, tone: "slate", perm: ["ACC_VIEW", "ACC_SETTINGS"], img: "acc-settings" },
];

// ── تطبیق مسیر ────────────────────────────────────────────────────────────

const base = (href: string) => href.split("?")[0];

/**
 * فعال‌ترین اپ برای مسیر جاری — طولانی‌ترین پیشوند برنده است، وگرنه در
 * `/admin/worklist/calls` هم «کارهای من» و هم «تماس‌ها» فعال می‌شدند.
 */
export function activeApp(pathname: string, apps: AppItem[]): AppItem | null {
  let best: AppItem | null = null;
  for (const a of apps) {
    const p = base(a.href);
    const hit = a.exact ? pathname === p : pathname === p || pathname.startsWith(`${p}/`);
    if (hit && (!best || p.length > base(best.href).length)) best = a;
  }
  return best;
}
