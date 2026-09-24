"use client";

/** زبانه‌های زیربخش کالا و انبار — در موبایل افقی اسکرول می‌خورد */

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/accounting/inventory", label: "موجودی", exact: true },
  { href: "/admin/accounting/inventory/transfers", label: "حواله‌ها" },
  { href: "/admin/accounting/inventory/counts", label: "انبارگردانی" },
  { href: "/admin/accounting/inventory/warehouses", label: "انبارها" },
  { href: "/admin/accounting/inventory/opening", label: "اول دوره" },
];

export default function InventoryTabs() {
  const pathname = usePathname() ?? "";
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-4">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              active ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
