"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/pages";

/**
 * فهرست مطالب چسبان با هایلایت بخش فعال.
 *
 * از IntersectionObserver استفاده می‌شود نه از رویداد scroll: هم ارزان‌تر است
 * هم نیازی به محاسبه‌ی دستی موقعیت سرتیترها ندارد. `rootMargin` بالایی منفی
 * است تا سرتیتری که تازه زیر هدر چسبان رفته «فعال» حساب شود.
 */
export default function PageToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const nodes = items
      .map(i => document.getElementById(i.id))
      .filter((n): n is HTMLElement => !!n);
    if (nodes.length === 0) return;

    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => seen.set(e.target.id, e.isIntersecting));
        const firstVisible = items.find(i => seen.get(i.id));
        if (firstVisible) setActive(firstVisible.id);
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 }
    );

    nodes.forEach(n => io.observe(n));
    return () => io.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <nav className="lg:sticky lg:top-28 bg-white dark:bg-gray-900/60 rounded-3xl border border-gray-100 dark:border-gray-800 p-5">
      <h2 className="text-xs font-black text-gray-400 mb-3">فهرست مطالب</h2>
      <ul className="space-y-1">
        {items.map(item => {
          const on = active === item.id;
          return (
            <li key={item.id}>
              <a href={`#${item.id}`}
                className={`block text-xs leading-6 py-1.5 px-3 rounded-xl transition-colors ${item.level === 3 ? "pr-6" : ""} ${on
                  ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-black"
                  : "text-gray-500 dark:text-gray-400 hover:text-primary-600 font-bold"}`}>
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
