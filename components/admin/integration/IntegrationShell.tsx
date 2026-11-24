"use client";

/**
 * قاب همه‌ی صفحه‌های یکپارچه‌سازی — هم‌شکل حسابداری (docs/features/admin-ui.md).
 *
 * خانه: کاشی بخش‌ها در دسته‌ها (خود صفحه‌ی خانه می‌سازد).
 * صفحه‌های داخلی: نوار «یکپارچه‌سازی › بخش جاری ▾» که همه‌ی بخش‌ها را در یک
 * پنجره باز می‌کند، و دکمه‌ی «راهنمای نگاشت».
 * بخش‌هایی که کسب‌وکار در «تنظیمات» خاموش کرده (`hidden`) در هیچ‌کدام نمی‌آیند.
 *
 * مستندات: docs/integrations/settings-and-guide.md
 */

import "@/app/styles/accounting.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Blocks, Compass, House, LayoutGrid, Map as MapIcon, ShoppingBag, type LucideIcon } from "lucide-react";
import { INTEGRATION_APPS, type AppItem } from "../apps";
import { AppLauncher, ModuleBar } from "../AppGrid";
import { sectionForPath, type IntegSectionKey } from "@/lib/integration/core/sections";

const MODULE = { href: "/admin/integration", label: "یکپارچه‌سازی", icon: Blocks, tone: "teal" as const };

const HiddenContext = createContext<Set<string>>(new Set());

/** بخش‌های خاموش — برای صفحه‌هایی که لینک به بخش دیگر دارند */
export function useHiddenSections(): Set<string> {
  return useContext(HiddenContext);
}

export default function IntegrationShell({ hidden, children }: { hidden: IntegSectionKey[]; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [launcher, setLauncher] = useState(false);
  const hiddenSet = useMemo(() => new Set<string>(hidden), [hidden]);
  const apps: AppItem[] = useMemo(() => INTEGRATION_APPS.filter((a) => !hiddenSet.has(a.key)), [hiddenSet]);

  const home = pathname === "/admin/integration";
  const section = sectionForPath(pathname);
  const current = section ? INTEGRATION_APPS.find((a) => a.key === section.key) ?? null : null;
  const off = section && hiddenSet.has(section.key);

  return (
    <HiddenContext.Provider value={hiddenSet}>
      <div className="acc-theme mx-auto max-w-6xl p-4 pb-28 text-gray-900 md:pb-8 lg:p-6 dark:text-gray-100" dir="rtl">
        {!home && (
          <ModuleBar
            module={MODULE}
            current={current}
            onOpenLauncher={() => setLauncher(true)}
            action={
              section?.key !== "guide" ? (
                <Link
                  href="/admin/integration/guide"
                  className="acc-btn-soft hidden h-[50px] flex-shrink-0 items-center gap-2 rounded-2xl bg-[var(--adm-surface)] px-4 text-sm font-bold text-gray-700 transition md:flex dark:text-gray-200"
                >
                  <Compass className="h-4 w-4" aria-hidden />
                  راهنمای نگاشت
                </Link>
              ) : undefined
            }
          />
        )}

        {off && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="flex-1">این بخش در تنظیمات یکپارچه‌سازی خاموش است و در منوها دیده نمی‌شود.</span>
            <Link href="/admin/integration/settings" className="text-xs font-black underline">
              تنظیمات
            </Link>
          </div>
        )}

        {children}

        {/* موبایل: نوار پایین */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--adm-border)] bg-[var(--adm-chrome)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
          <div className="grid h-16 grid-cols-5 items-center">
            <BottomLink href="/admin/integration" icon={House} label="خانه" active={home} />
            <BottomLink href="/admin/integration/orders" icon={ShoppingBag} label="سفارش" active={pathname.startsWith("/admin/integration/orders")} />
            <BottomLink href="/admin/integration/mapping" icon={MapIcon} label="نگاشت" active={pathname.startsWith("/admin/integration/mapping")} />
            <BottomLink href="/admin/integration/guide" icon={Compass} label="راهنما" active={pathname.startsWith("/admin/integration/guide")} />
            <button
              type="button"
              onClick={() => setLauncher(true)}
              className="flex h-full flex-col items-center justify-center gap-1 text-gray-500 dark:text-gray-400"
            >
              <LayoutGrid className="h-[22px] w-[22px]" aria-hidden />
              <span className="text-[10px] font-bold">همه</span>
            </button>
          </div>
        </nav>

        <AppLauncher
          open={launcher}
          onClose={() => setLauncher(false)}
          title="بخش‌های یکپارچه‌سازی"
          apps={apps}
          active={current?.href ?? null}
          footer={
            <Link
              href="/admin/integration/settings"
              onClick={() => setLauncher(false)}
              className="block text-center text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              بخشی را نمی‌بینید؟ در «تنظیمات» روشنش کنید
            </Link>
          }
        />
      </div>
    </HiddenContext.Provider>
  );
}

function BottomLink({ href, icon: I, label, active }: { href: string; icon: LucideIcon; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-full flex-col items-center justify-center gap-1 transition-colors ${
        active ? "text-teal-600 dark:text-teal-400" : "text-gray-500 dark:text-gray-400"
      }`}
    >
      <I className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
      <span className="text-[10px] font-bold">{label}</span>
    </Link>
  );
}
