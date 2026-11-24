"use client";

import { INTEGRATION_APPS } from "../apps";
import { AppGrid } from "../AppGrid";
import { INTEG_GROUPS } from "@/lib/integration/core/sections";

/**
 * کاشی بخش‌های یکپارچه‌سازی در چهار دسته — خانه‌ی یکپارچه‌سازی.
 * سمت مرورگر ساخته می‌شود چون آیکن‌ها کامپوننت‌اند و از سرور رد نمی‌شوند.
 */
export default function HomeTiles({ hidden, badges }: { hidden: string[]; badges: Record<string, number> }) {
  const off = new Set(hidden);
  const apps = INTEGRATION_APPS.filter((a) => a.key !== "home" && !off.has(a.key));
  return (
    <>
      {INTEG_GROUPS.map((g) => {
        const list = apps.filter((a) => a.group === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key}>
            <div className="mb-1 flex items-baseline gap-2 px-2">
              <h2 className="text-sm font-black text-gray-900 dark:text-white">{g.label}</h2>
              <span className="text-[11px] text-gray-400">{g.hint}</span>
            </div>
            <AppGrid apps={list} mobileLimit={12} badges={badges} />
          </div>
        );
      })}
    </>
  );
}
