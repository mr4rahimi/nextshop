"use client";

/**
 * قاب همه‌ی صفحه‌های کارتابل — docs/features/staff-worklist.md و docs/features/admin-ui.md.
 *
 * خانه (`/admin/worklist`): خوشامد و شبکه‌ی کاشی همه‌ی بخش‌های کارتابل، بعد «کارهای من».
 * صفحه‌های داخلی: نوار «کارتابل › بخش جاری ▾» که همه‌ی بخش‌ها را در یک پنجره باز می‌کند.
 *
 * قبل از این قاب، صفحه‌های کارتابل هیچ فاصله‌ای از لبه نداشتند و به دیواره‌ی
 * سایدبار می‌چسبیدند؛ فاصله‌ی صفحه حالا فقط اینجاست.
 *
 * بخش تازه‌ی کارتابل یک ردیف در `WORKLIST_APPS` (components/admin/apps.ts) می‌گیرد.
 */

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { WORKLIST_APPS, activeApp } from "../apps";
import { AppGrid, AppLauncher, ModuleBar } from "../AppGrid";
import { useAdminMe } from "../useAdminMe";

const MODULE = { href: "/admin/worklist", label: "کارتابل", icon: BriefcaseBusiness, tone: "indigo" as const };

export default function WorklistShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [launcher, setLauncher] = useState(false);
  const home = pathname === "/admin/worklist";
  const current = activeApp(pathname, WORKLIST_APPS);

  return (
    <div className="mx-auto max-w-7xl p-4 pb-24 lg:p-6 lg:pb-24">
      {home ? (
        <WorklistHome />
      ) : (
        <ModuleBar module={MODULE} current={current} onOpenLauncher={() => setLauncher(true)} />
      )}

      {children}

      <AppLauncher
        open={launcher}
        onClose={() => setLauncher(false)}
        title="بخش‌های کارتابل"
        apps={WORKLIST_APPS}
        active={current?.href ?? null}
      />
    </div>
  );
}

function WorklistHome() {
  const me = useAdminMe();
  const first = me?.name?.trim().split(/\s+/)[0];

  return (
    <section className="mb-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{formatJalali(new Date())}</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-gray-900 sm:text-2xl dark:text-white">
            {first ? `سلام ${first}، روز خوبی داشته باشید` : "کارتابل"}
          </h1>
        </div>
        {me?.roleTitle && (
          <span className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-1 text-[11px] font-bold text-gray-600 dark:text-gray-300">
            {me.roleTitle}
          </span>
        )}
      </div>

      <div className="rounded-3xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2 py-2 shadow-[var(--adm-shadow)] sm:px-3">
        <AppGrid apps={WORKLIST_APPS} active="/admin/worklist" wide />
      </div>
    </section>
  );
}
