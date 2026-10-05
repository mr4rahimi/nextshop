"use client";

/**
 * قاب صفحه‌های ابزارها — docs/features/tools.md و docs/features/admin-ui.md.
 *
 * خانه: شبکه‌ی کاشی ابزارها. صفحه‌های داخلی: نوار «ابزارها › ابزار جاری ▾».
 * ابزار تازه فقط یک ردیف در `TOOLS_APPS` (components/admin/apps.ts) می‌گیرد.
 */

import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Wrench } from "lucide-react";
import { useAccess } from "../accounting/access";
import { TOOLS_APPS, activeApp } from "../apps";
import { AppLauncher, ModuleBar } from "../AppGrid";

const MODULE = { href: "/admin/tools", label: "ابزارها", icon: Wrench, tone: "violet" as const };

/** فقط برای ظاهر؛ مرز واقعی `toolsGuard` در هر route است */
export function useToolsAccess() {
  const { ready, can } = useAccess();
  return { ready, canManage: can("TOOLS_MANAGE") };
}

export default function ToolsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [launcher, setLauncher] = useState(false);
  const { ready, can } = useAccess();
  const apps = useMemo(() => TOOLS_APPS.filter((a) => !ready || !a.perm || can(a.perm)), [ready, can]);

  // ویرایشگر لندینگ تمام‌عرض است و نوار خودش را دارد
  const editor = /^\/admin\/tools\/landings\/[^/]+$/.test(pathname);
  const home = pathname === "/admin/tools";
  const current = activeApp(pathname, TOOLS_APPS);

  return (
    <div className={`mx-auto p-4 text-gray-900 lg:p-6 dark:text-gray-100 ${editor ? "max-w-[1400px]" : "max-w-6xl"}`}>
      {!home && !editor && <ModuleBar module={MODULE} current={current} onOpenLauncher={() => setLauncher(true)} />}
      {children}
      <AppLauncher open={launcher} onClose={() => setLauncher(false)} title="ابزارها" apps={apps} active={current?.href ?? null} />
    </div>
  );
}
