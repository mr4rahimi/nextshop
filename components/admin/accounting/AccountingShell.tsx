"use client";

/**
 * قاب همه‌ی صفحه‌های حسابداری — docs/plans/accounting.md بخش ۱۳.۳ و ۱۳.۴،
 * و docs/features/admin-ui.md.
 *
 * خانه: شبکه‌ی کاشی بخش‌ها (در `InternalDashboard`).
 * صفحه‌های داخلی: نوار «حسابداری › بخش جاری ▾» که همه‌ی بخش‌ها را در یک پنجره
 * باز می‌کند، و دکمه‌ی «ثبت سریع».
 * موبایل: نوار پایین «خانه · فروش · ➕ · اشخاص · همه»؛ ➕ کارهای پرتکرار را
 * در یک پنجره‌ی پایین‌کش باز می‌کند.
 *
 * هر بخش تازه‌ی حسابداری یک ردیف در `ACCOUNTING_APPS` (components/admin/apps.ts) می‌گیرد.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, Banknote, Calculator, ClipboardCheck, FilePen, FileText,
  House, Landmark, LayoutGrid, Plus, Receipt, Repeat, ShoppingBag, Store, Truck, UserPlus, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAccess } from "./access";
import { ACCOUNTING_APPS, activeApp, type AppItem } from "../apps";
import { AppLauncher, ModuleBar } from "../AppGrid";

const QUICK: AppItem[] = [
  { href: "/admin/accounting/money/new?kind=RECEIPT", label: "دریافت", icon: ArrowDownToLine, tone: "emerald", perm: ["ACC_TREASURY"], img: "quick-receipt" },
  { href: "/admin/accounting/money/new?kind=PAYMENT", label: "پرداخت", icon: ArrowUpFromLine, tone: "rose", perm: ["ACC_TREASURY"], img: "quick-payment" },
  { href: "/admin/accounting/expenses/new", label: "ثبت هزینه", icon: Wallet, tone: "amber", perm: ["ACC_EXPENSE"], img: "quick-expense" },
  { href: "/admin/accounting/invoices/new?type=SALES", label: "فاکتور فروش", icon: Receipt, tone: "blue", perm: ["ACC_SALES"], img: "quick-sales-invoice" },
  { href: "/admin/accounting/invoices/new?type=PURCHASE", label: "فاکتور خرید", icon: ShoppingBag, tone: "orange", perm: ["ACC_PURCHASE"], img: "quick-purchase-invoice" },
  { href: "/admin/accounting/invoices/new?type=PROFORMA", label: "پیش‌فاکتور", icon: FileText, tone: "slate", perm: ["ACC_SALES"], img: "quick-proforma" },
  { href: "/admin/accounting/money/new?kind=TRANSFER", label: "انتقال وجه", icon: Repeat, tone: "sky", perm: ["ACC_TREASURY"], img: "quick-transfer" },
  { href: "/admin/accounting/money/new?kind=RECEIPT&role=marketplace", label: "تسویه‌ی بازارگاه", icon: Store, tone: "violet", perm: ["ACC_TREASURY"], img: "quick-marketplace" },
  { href: "/admin/accounting/cheques", label: "چک‌ها", icon: Banknote, tone: "teal", perm: ["ACC_CHEQUE"], img: "quick-cheques" },
  { href: "/admin/accounting/parties?new=1", label: "شخص تازه", icon: UserPlus, tone: "indigo", perm: ["ACC_PARTY_MANAGE"], img: "quick-new-party" },
  { href: "/admin/accounting/treasury?new=1", label: "صندوق یا بانک تازه", icon: Landmark, tone: "cyan", perm: ["ACC_SETTINGS"], img: "quick-new-treasury" },
  { href: "/admin/accounting/opening", label: "مانده‌های اول دوره", icon: Calculator, tone: "lime", perm: ["ACC_SETTINGS"], img: "quick-opening" },
  { href: "/admin/accounting/inventory/counts", label: "انبارگردانی", icon: ClipboardCheck, tone: "amber", perm: ["ACC_INVENTORY"], img: "quick-count" },
  { href: "/admin/accounting/inventory/transfers", label: "حواله‌ی انتقال", icon: Truck, tone: "slate", perm: ["ACC_INVENTORY"], img: "quick-stock-transfer" },
  { href: "/admin/accounting/vouchers/new", label: "سند دستی", icon: FilePen, tone: "fuchsia", perm: ["ACC_VOUCHER"], img: "quick-voucher" },
];

const MODULE = { href: "/admin/accounting", label: "حسابداری", icon: Calculator, tone: "blue" as const };

// ── دسترسی صفحه‌ها به قاب ──────────────────────────────────────────────────

interface ShellApi {
  /** بخش‌هایی که کاربر اجازه‌ی دیدنشان را دارد */
  apps: AppItem[];
  openQuick: () => void;
  openLauncher: () => void;
}

const ShellContext = createContext<ShellApi | null>(null);

/** برای خانه‌ی حسابداری — شبکه‌ی کاشی و دکمه‌ی ثبت سریع از قاب می‌آیند */
export function useAccountingShell(): ShellApi | null {
  return useContext(ShellContext);
}

/** فاکتورها زیر «فروش» و «خرید» باز می‌شوند ولی مسیرشان جداست */
function currentApp(pathname: string): AppItem | null {
  if (pathname.startsWith("/admin/accounting/invoices")) return ACCOUNTING_APPS.find((a) => a.href === "/admin/accounting/sales") ?? null;
  return activeApp(pathname, ACCOUNTING_APPS);
}

export default function AccountingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { can, ready } = useAccess();
  const [quick, setQuick] = useState(false);
  const [launcher, setLauncher] = useState(false);

  const apps = useMemo(() => ACCOUNTING_APPS.filter((a) => !ready || !a.perm || can(a.perm)), [ready, can]);
  const quickApps = useMemo(() => QUICK.filter((q) => !ready || !q.perm || can(q.perm)), [ready, can]);

  const openQuick = useCallback(() => setQuick(true), []);
  const openLauncher = useCallback(() => setLauncher(true), []);
  const api = useMemo(() => ({ apps, openQuick, openLauncher }), [apps, openQuick, openLauncher]);

  // چاپ فاکتور بی‌قاب است (قاب پنل هم در app/admin/layout.tsx کنار می‌رود)
  if (pathname.endsWith("/print")) return <>{children}</>;
  // صفحه‌ی راه‌اندازی قاب نمی‌خواهد — تمام‌صفحه است
  if (pathname.startsWith("/admin/accounting/setup")) return <div className="p-4 lg:p-6 max-w-3xl mx-auto text-gray-900 dark:text-gray-100">{children}</div>;

  const home = pathname === "/admin/accounting";
  const current = currentApp(pathname);

  return (
    <ShellContext.Provider value={api}>
      <div className="mx-auto max-w-6xl p-4 pb-28 text-gray-900 md:pb-8 lg:p-6 dark:text-gray-100">
        {!home && (
          <ModuleBar
            module={MODULE}
            current={current}
            onOpenLauncher={openLauncher}
            action={
              <button
                type="button"
                onClick={openQuick}
                className="hidden h-[50px] flex-shrink-0 items-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] md:flex"
              >
                <Plus className="h-4 w-4" aria-hidden />
                ثبت سریع
              </button>
            }
          />
        )}

        {children}

        {/* موبایل: نوار پایین */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--adm-border)] bg-[var(--adm-chrome)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
          <div className="grid h-16 grid-cols-5 items-center">
            <BottomLink href="/admin/accounting" icon={House} label="خانه" active={home} />
            <BottomLink
              href="/admin/accounting/sales"
              icon={Receipt}
              label="فروش"
              active={pathname.startsWith("/admin/accounting/sales") || pathname.startsWith("/admin/accounting/invoices")}
            />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={openQuick}
                className="-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-xl shadow-blue-600/35 ring-4 ring-[var(--adm-bg)] transition active:scale-95"
                aria-label="ثبت سریع"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
            <BottomLink href="/admin/accounting/parties" icon={Users} label="اشخاص" active={pathname.startsWith("/admin/accounting/parties")} />
            <button
              type="button"
              onClick={openLauncher}
              className="flex h-full flex-col items-center justify-center gap-1 text-gray-500 dark:text-gray-400"
            >
              <LayoutGrid className="h-[22px] w-[22px]" aria-hidden />
              <span className="text-[10px] font-bold">همه</span>
            </button>
          </div>
        </nav>

        <AppLauncher open={quick} onClose={() => setQuick(false)} title="ثبت سریع" apps={quickApps} />
        <AppLauncher
          open={launcher}
          onClose={() => setLauncher(false)}
          title="بخش‌های حسابداری"
          apps={apps}
          active={current?.href ?? null}
        />
      </div>
    </ShellContext.Provider>
  );
}

function BottomLink({ href, icon: I, label, active }: { href: string; icon: LucideIcon; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-full flex-col items-center justify-center gap-1 transition-colors ${
        active ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
      }`}
    >
      <I className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
      <span className="text-[10px] font-bold">{label}</span>
    </Link>
  );
}
