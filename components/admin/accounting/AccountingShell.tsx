"use client";

/**
 * قاب همه‌ی صفحه‌های حسابداری — docs/plans/accounting.md بخش ۱۳.۳ و ۱۳.۴.
 *
 * دسکتاپ: نوار زبانه‌ی بخش‌ها بالای صفحه.
 * موبایل: نوار پایین «خانه · فروش · ➕ · اشخاص · بیشتر»؛ ➕ کارهای
 * پرتکرار را در یک پنجره‌ی پایین‌کش باز می‌کند.
 *
 * هر بخش تازه‌ی حسابداری اینجا یک ردیف در `SECTIONS` می‌گیرد.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAccess } from "./access";
import { Sheet } from "./ui";

interface Section {
  href: string;
  label: string;
  icon: string;
  perm: string[];
  /** فقط در نمای حسابدار */
  accountant?: boolean;
  exact?: boolean;
}

export const SECTIONS: Section[] = [
  { href: "/admin/accounting", label: "خانه", icon: "🏠", perm: ["ACC_VIEW", "ACC_SETTINGS"], exact: true },
  { href: "/admin/accounting/sales", label: "فروش", icon: "🧾", perm: ["ACC_VIEW", "ACC_SALES"] },
  { href: "/admin/accounting/purchases", label: "خرید", icon: "📥", perm: ["ACC_VIEW", "ACC_PURCHASE"] },
  { href: "/admin/accounting/money", label: "دریافت و پرداخت", icon: "💸", perm: ["ACC_VIEW", "ACC_TREASURY"] },
  { href: "/admin/accounting/cheques", label: "چک‌ها", icon: "🧾", perm: ["ACC_VIEW", "ACC_CHEQUE"] },
  { href: "/admin/accounting/parties", label: "اشخاص", icon: "👥", perm: ["ACC_VIEW", "ACC_PARTY_MANAGE"] },
  { href: "/admin/accounting/treasury", label: "صندوق و بانک", icon: "🏦", perm: ["ACC_VIEW", "ACC_SETTINGS"] },
  { href: "/admin/accounting/inventory", label: "کالا و انبار", icon: "📦", perm: ["ACC_VIEW", "ACC_INVENTORY"] },
  { href: "/admin/accounting/vouchers", label: "اسناد", icon: "📒", perm: ["ACC_VOUCHER", "ACC_VIEW"], accountant: true },
  { href: "/admin/accounting/accounts", label: "سرفصل حساب‌ها", icon: "🗂️", perm: ["ACC_VOUCHER", "ACC_SETTINGS"], accountant: true },
  { href: "/admin/accounting/events", label: "رویدادها", icon: "⚡", perm: ["ACC_VIEW", "ACC_SETTINGS"] },
  { href: "/admin/accounting/settings", label: "تنظیمات", icon: "⚙️", perm: ["ACC_VIEW", "ACC_SETTINGS"] },
];

interface QuickAction {
  href: string;
  label: string;
  icon: string;
  perm: string[];
  soon?: string;
}

const QUICK: QuickAction[] = [
  { href: "/admin/accounting/money/new?kind=RECEIPT", label: "دریافت", icon: "📥", perm: ["ACC_TREASURY"] },
  { href: "/admin/accounting/money/new?kind=PAYMENT", label: "پرداخت", icon: "📤", perm: ["ACC_TREASURY"] },
  { href: "/admin/accounting/invoices/new?type=SALES", label: "فاکتور فروش", icon: "🛒", perm: ["ACC_SALES"] },
  { href: "/admin/accounting/invoices/new?type=PURCHASE", label: "فاکتور خرید", icon: "📥", perm: ["ACC_PURCHASE"] },
  { href: "/admin/accounting/invoices/new?type=PROFORMA", label: "پیش‌فاکتور", icon: "📄", perm: ["ACC_SALES"] },
  { href: "/admin/accounting/money/new?kind=TRANSFER", label: "انتقال وجه", icon: "🔁", perm: ["ACC_TREASURY"] },
  { href: "/admin/accounting/cheques", label: "چک‌ها", icon: "🧾", perm: ["ACC_CHEQUE"] },
  { href: "/admin/accounting/parties?new=1", label: "شخص تازه", icon: "👤", perm: ["ACC_PARTY_MANAGE"] },
  { href: "/admin/accounting/treasury?new=1", label: "صندوق یا بانک تازه", icon: "🏦", perm: ["ACC_SETTINGS"] },
  { href: "/admin/accounting/opening", label: "مانده‌های اول دوره", icon: "🧮", perm: ["ACC_SETTINGS"] },
  { href: "/admin/accounting/inventory/counts", label: "انبارگردانی", icon: "📋", perm: ["ACC_INVENTORY"] },
  { href: "/admin/accounting/inventory/transfers", label: "حواله‌ی انتقال", icon: "🔁", perm: ["ACC_INVENTORY"] },
  { href: "/admin/accounting/vouchers/new", label: "سند دستی", icon: "📝", perm: ["ACC_VOUCHER"] },
  { href: "#", label: "ثبت هزینه", icon: "🧾", perm: [], soon: "فاز ۶" },
];

function isActive(pathname: string, s: Section) {
  return s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(s.href + "/");
}

export default function AccountingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { can, ready } = useAccess();
  const [quick, setQuick] = useState(false);
  const [more, setMore] = useState(false);

  // چاپ فاکتور بی‌قاب است (قاب پنل هم در app/admin/layout.tsx کنار می‌رود)
  if (pathname.endsWith("/print")) return <>{children}</>;
  // صفحه‌ی راه‌اندازی قاب نمی‌خواهد — تمام‌صفحه است
  if (pathname.startsWith("/admin/accounting/setup")) return <div className="p-4 lg:p-6 max-w-3xl mx-auto text-gray-900 dark:text-gray-100">{children}</div>;

  const sections = SECTIONS.filter((s) => !ready || can(s.perm));
  const bottom = ["/admin/accounting", "/admin/accounting/sales", "/admin/accounting/parties"];
  const moreItems = sections.filter((s) => !bottom.includes(s.href));

  return (
    <div className="p-4 lg:p-6 pb-28 md:pb-6 max-w-6xl mx-auto text-gray-900 dark:text-gray-100">
      {/* دسکتاپ و تبلت: زبانه‌ها */}
      <nav className="hidden md:flex gap-1 mb-5 overflow-x-auto border-b border-gray-200 dark:border-white/10 -mx-1 px-1">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`shrink-0 px-3.5 py-2.5 text-sm font-bold border-b-2 -mb-px transition ${
              isActive(pathname, s)
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {s.label}
            {s.accountant && <span className="mr-1 text-[9px] font-bold text-gray-400 align-top">حسابدار</span>}
          </Link>
        ))}
        <button onClick={() => setQuick(true)} className="shrink-0 mr-auto my-1.5 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold">
          ➕ ثبت سریع
        </button>
      </nav>

      {children}

      {/* موبایل: نوار پایین */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 items-end h-16">
          <BottomLink href="/admin/accounting" icon="🏠" label="خانه" active={pathname === "/admin/accounting"} />
          <BottomLink
            href="/admin/accounting/sales"
            icon="🧾"
            label="فروش"
            active={pathname.startsWith("/admin/accounting/sales") || pathname.startsWith("/admin/accounting/invoices")}
          />
          <div className="flex justify-center">
            <button
              onClick={() => setQuick(true)}
              className="-mt-6 w-14 h-14 rounded-full bg-blue-600 text-white text-2xl shadow-lg shadow-blue-600/30 active:scale-95 transition"
              aria-label="ثبت سریع"
            >
              +
            </button>
          </div>
          <BottomLink href="/admin/accounting/parties" icon="👥" label="اشخاص" active={pathname.startsWith("/admin/accounting/parties")} />
          <button onClick={() => setMore(true)} className="flex flex-col items-center justify-center gap-0.5 h-full text-gray-500">
            <span className="text-lg leading-none">☰</span>
            <span className="text-[10px] font-bold">بیشتر</span>
          </button>
        </div>
      </nav>

      <Sheet open={quick} onClose={() => setQuick(false)} title="ثبت سریع" help="accountingQuick">
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK.map((q) => {
            const allowed = !q.soon && (!ready || can(q.perm));
            if (!q.soon && ready && !allowed) return null;
            return q.soon ? (
              <div key={q.label} className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 p-3.5 opacity-60">
                <span className="text-2xl">{q.icon}</span>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-1.5">{q.label}</p>
                <p className="text-[10px] text-gray-400">به‌زودی — {q.soon}</p>
              </div>
            ) : (
              <Link
                key={q.label}
                href={q.href}
                onClick={() => setQuick(false)}
                className="rounded-2xl border border-gray-200 dark:border-white/10 p-3.5 hover:border-blue-400 active:scale-[0.98] transition"
              >
                <span className="text-2xl">{q.icon}</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-1.5">{q.label}</p>
              </Link>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={more} onClose={() => setMore(false)} title="بخش‌های حسابداری">
        <div className="space-y-1">
          {moreItems.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              onClick={() => setMore(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl ${isActive(pathname, s) ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600" : "hover:bg-gray-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-100"}`}
            >
              <span className="text-xl">{s.icon}</span>
              <span className="text-sm font-bold">{s.label}</span>
              {s.accountant && <span className="mr-auto text-[10px] text-gray-400">نمای حسابدار</span>}
            </Link>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function BottomLink({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center justify-center gap-0.5 h-full ${active ? "text-blue-600" : "text-gray-500"}`}>
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px] font-bold">{label}</span>
    </Link>
  );
}
