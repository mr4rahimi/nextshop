"use client";

import { useState } from "react";
import type { PageFaqItem } from "@/lib/pages";

export default function FaqAccordion({ items }: { items: PageFaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const on = open === i;
        return (
          <div key={i}
            className={`rounded-3xl border transition-colors overflow-hidden ${on
              ? "border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-900/10"
              : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60"}`}>
            <button type="button" onClick={() => setOpen(on ? null : i)}
              aria-expanded={on}
              className="w-full flex items-center gap-3 p-5 text-right">
              <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm flex-shrink-0 transition-transform duration-300 ${on ? "rotate-45 bg-primary-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                +
              </span>
              <span className="flex-1 text-sm font-black text-gray-900 dark:text-white">{item.q}</span>
            </button>
            {/* grid-rows برای انیمیشن ارتفاع بدون دانستن ارتفاع نهایی */}
            <div className={`grid transition-all duration-300 ease-out ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <p className="px-5 pb-5 pr-15 text-sm leading-8 text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
