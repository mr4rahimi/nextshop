"use client";

/**
 * اسکلت پنل مدیریت — سایدبار، نوار بالا و ظرف محتوا.
 *
 * درخت منو اینجا نیست؛ در `components/admin/nav.tsx` است. خودِ سایدبار هم
 * `components/admin/AdminSidebar.tsx` است. این فایل فقط چیدمان می‌کند.
 *
 * مستندات: docs/features/admin-sidebar.md
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "@/components/layout/ThemeProvider";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { BREADCRUMB_LABELS, Icon } from "@/components/admin/nav";
import WorklistNotifier from "@/components/admin/worklist/WorklistNotifier";
import HeartbeatPing from "@/components/admin/worklist/HeartbeatPing";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // با هر جابه‌جایی کشوی موبایل بسته می‌شود، حتی وقتی مقصد از داخل خود صفحه
  // انتخاب شده باشد نه از منو.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // صفحه‌ی ورود هیچ‌کدام از عناصر پنل را نباید ببیند — نه سایدبار، نه هدر.
  // کاربر ناشناس با /admin به همین‌جا ریدایرکت می‌شود (proxy.ts) و باید فقط
  // فرم ورود را ببیند، نه اسکلت پنل را در پس‌زمینه.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#080b12]" dir="rtl">

        <AdminSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6 dark:border-white/[0.06] dark:bg-[#0f1117]">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="باز کردن منو"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
              <Breadcrumb />
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              <ThemeToggle />
              <Link
                href="/"
                target="_blank"
                className="hidden items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:flex dark:border-white/[0.06] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                <Icon name="external" className="h-3.5 w-3.5" />
                سایت
              </Link>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-600/15 text-xs font-black text-blue-500 dark:text-blue-400">
                A
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#080b12]">
            {children}
          </main>
        </div>

        {/* پاپ‌آپ ارجاع فوری و نشان کارتابل — در همه‌ی صفحات ادمین زنده است.
            بدون دسترسی یا بدون داده، هیچ‌چیز رندر نمی‌کند. */}
        <WorklistNotifier />
        <HeartbeatPing />
      </div>
    </ThemeProvider>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "حالت روشن" : "حالت تیره"}
      className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-white/[0.06] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
    >
      {theme === "dark" ? (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

function Breadcrumb() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs font-bold">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gray-300 dark:text-gray-700">/</span>}
          <span
            className={`truncate ${
              i === parts.length - 1
                ? "text-gray-900 dark:text-gray-200"
                : "text-gray-400 dark:text-gray-600"
            }`}
          >
            {BREADCRUMB_LABELS[part] ?? part}
          </span>
        </span>
      ))}
    </nav>
  );
}
