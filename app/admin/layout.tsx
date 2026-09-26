"use client";

/**
 * اسکلت پنل مدیریت — سایدبار، نوار بالا و ظرف محتوا.
 *
 * درخت منو اینجا نیست؛ در `components/admin/nav.tsx` است. خودِ سایدبار هم
 * `components/admin/AdminSidebar.tsx` است. این فایل فقط چیدمان می‌کند.
 * رنگ سطح‌ها و حرکت‌ها در `app/styles/admin.css` زیر کلاس `admin-shell` است.
 *
 * مستندات: docs/features/admin-sidebar.md و docs/features/admin-ui.md
 */

import "@/app/styles/admin.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ExternalLink, Menu, Moon, Search, Sun, X } from "lucide-react";
import { ThemeProvider, useTheme } from "@/components/layout/ThemeProvider";
import AdminSidebar from "@/components/admin/AdminSidebar";
import CommandPalette from "@/components/admin/CommandPalette";
import { BREADCRUMB_LABELS } from "@/components/admin/nav";
import { initialOf, useAdminMe } from "@/components/admin/useAdminMe";
import WorklistNotifier from "@/components/admin/worklist/WorklistNotifier";
import HeartbeatPing from "@/components/admin/worklist/HeartbeatPing";
import OnlineOrderSound from "@/components/admin/orders/OnlineOrderSound";

/**
 * پیام «به این بخش دسترسی ندارید» وقتی proxy صفحه‌ی بسته را به کارتابل برگرداند.
 * بدون این، کارمند فکر می‌کند لینک خراب است.
 */
function DeniedBanner({ pathname }: { pathname: string }) {
  const [denied, setDenied] = useState<string | null>(null);
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("denied");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- پارامتر آدرس فقط بعد از mount در دسترس است
    setDenied(d);
  }, [pathname]);
  if (!denied) return null;
  return (
    <div className="adm-pop-in mx-4 mt-4 lg:mx-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 flex items-center justify-between gap-3">
      <span>به بخش «{denied}» دسترسی ندارید. اگر لازم دارید، از مدیر بخواهید در نقش شما باز کند.</span>
      <button
        onClick={() => setDenied(null)}
        aria-label="بستن"
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-amber-500/15"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

const ICON_BTN =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-[var(--adm-hover)] hover:text-gray-900 dark:text-gray-400 dark:hover:text-white";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // با هر جابه‌جایی کشوی موبایل بسته می‌شود، حتی وقتی مقصد از داخل خود صفحه
  // انتخاب شده باشد نه از منو.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- بستن کشو با تغییر مسیر
    setSidebarOpen(false);
  }, [pathname]);

  // Ctrl+K (یا ⌘K) — جستجوی سریع صفحه‌ها از هر جای پنل
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // صفحه‌ی ورود هیچ‌کدام از عناصر پنل را نباید ببیند — نه سایدبار، نه هدر.
  // کاربر ناشناس با /admin به همین‌جا ریدایرکت می‌شود (proxy.ts) و باید فقط
  // فرم ورود را ببیند، نه اسکلت پنل را در پس‌زمینه.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // صفحه‌های چاپ (فاکتور حسابداری) بی‌قاب‌اند — فقط برگه روی کاغذ می‌آید
  if (pathname?.startsWith("/admin/accounting/") && pathname.endsWith("/print")) {
    return <>{children}</>;
  }

  return (
    <ThemeProvider>
      <div className="admin-shell flex h-dvh overflow-hidden" dir="rtl">

        <AdminSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          <header className="relative z-30 flex h-16 flex-shrink-0 items-center justify-between gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-chrome)] px-3 backdrop-blur-xl sm:px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button onClick={() => setSidebarOpen(true)} aria-label="باز کردن منو" className={`${ICON_BTN} lg:hidden`}>
                <Menu className="h-5 w-5" aria-hidden />
              </button>
              <Breadcrumb />
            </div>

            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
              {/* جعبه‌ی جستجوی سریع — در موبایل فقط آیکن */}
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden h-9 w-56 items-center gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-right text-[13px] font-medium text-gray-400 shadow-[var(--adm-shadow)] transition-colors hover:border-[var(--adm-border-strong)] md:flex xl:w-72"
              >
                <Search className="h-4 w-4 flex-shrink-0" aria-hidden />
                <span className="flex-1 truncate">جستجوی سریع…</span>
                <kbd className="rounded-md border border-[var(--adm-border-strong)] px-1.5 font-sans text-[10px] font-bold" dir="ltr">
                  Ctrl K
                </kbd>
              </button>
              <button onClick={() => setPaletteOpen(true)} aria-label="جستجوی سریع" className={`${ICON_BTN} md:hidden`}>
                <Search className="h-[18px] w-[18px]" aria-hidden />
              </button>

              <OnlineOrderSound />
              <ThemeToggle />
              <Link href="/" target="_blank" aria-label="مشاهده سایت" title="مشاهده سایت" className={`${ICON_BTN} hidden sm:flex`}>
                <ExternalLink className="h-[18px] w-[18px]" aria-hidden />
              </Link>
              <HeaderAvatar />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <DeniedBanner pathname={pathname} />
            {children}
          </main>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

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
      title={theme === "dark" ? "حالت روشن" : "حالت تیره"}
      className={ICON_BTN}
    >
      {theme === "dark" ? <Sun className="h-[18px] w-[18px]" aria-hidden /> : <Moon className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  );
}

function HeaderAvatar() {
  const me = useAdminMe();
  return (
    <div
      className="mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-black text-white shadow-md shadow-indigo-600/25 ring-2 ring-[var(--adm-surface)]"
      title={me?.name ? `${me.name}${me.roleTitle ? ` — ${me.roleTitle}` : ""}` : undefined}
    >
      {initialOf(me?.name)}
    </div>
  );
}

function Breadcrumb() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const label = (i: number) =>
    BREADCRUMB_LABELS[`${parts[i - 1]}/${parts[i]}`] ??
    BREADCRUMB_LABELS[parts[i]] ??
    (/^c[a-z0-9]{20,}$/.test(parts[i]) ? "جزئیات" : parts[i]);

  return (
    <nav aria-label="مسیر صفحه" className="flex min-w-0 items-center gap-1 overflow-hidden text-[13px] font-bold">
      {parts.map((_, i) => {
        const last = i === parts.length - 1;
        return (
          <span key={i} className={`items-center gap-1 ${last ? "flex min-w-0" : "hidden flex-shrink-0 sm:flex"}`}>
            {i > 0 && (
              <ChevronLeft className={`h-3.5 w-3.5 flex-shrink-0 text-gray-300 dark:text-gray-600 ${last ? "hidden sm:block" : ""}`} aria-hidden />
            )}
            <span
              aria-current={last ? "page" : undefined}
              className={`truncate ${last ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}
            >
              {label(i)}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
