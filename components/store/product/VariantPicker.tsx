"use client";

/**
 * انتخاب تنوع (رنگ، سایز…) روی صفحه‌ی محصول — docs/plans/inventory-items.md فاز ۴.
 * محور به محور؛ مقداری که با انتخاب‌های دیگر ترکیبی ندارد کم‌رنگ است ولی کلیک
 * می‌خورد و بقیه را به نزدیک‌ترین ترکیب موجود می‌برد. `?v=<تنوع>` در آدرس.
 */

import { useEffect, useMemo, useState } from "react";
import type { VariantView } from "@/lib/variants";

export type VariantItem = VariantView["items"][number];

function initial(view: VariantView): VariantItem {
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(window.location.search).get("v");
  } catch {}
  return view.items.find((v) => v.id === fromUrl) ?? view.items.find((v) => v.stock > 0) ?? view.items[0];
}

export function useVariantSelection(view: VariantView | null | undefined) {
  // سمت سرور اولین تنوع؛ بعد از hydrate از آدرس (بی ناهمخوانی رندر)
  const [current, setCurrent] = useState<VariantItem | null>(view ? (view.items.find((v) => v.stock > 0) ?? view.items[0]) : null);
  useEffect(() => {
    // عمداً بعد از hydrate: سرور `?v=` را نمی‌بیند و خواندنش در مقدار اولیه ناهمخوانی رندر می‌ساخت
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view) setCurrent(initial(view));
  }, [view]);

  function choose(attributeId: string, valueId: string) {
    if (!view || !current) return;
    const want = { ...current.options, [attributeId]: valueId };
    const exact = view.items.find((v) => Object.entries(want).every(([a, x]) => v.options[a] === x));
    // نبود ترکیب ← تنوعی با همین مقدار که بیشترین هم‌خوانی را دارد، موجودها اول
    const next =
      exact ??
      [...view.items]
        .filter((v) => v.options[attributeId] === valueId)
        .sort((a, b) => score(b, want) - score(a, want) || Number(b.stock > 0) - Number(a.stock > 0))[0];
    if (!next) return;
    setCurrent(next);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("v", next.id);
      window.history.replaceState(null, "", u);
    } catch {}
  }
  return { current, choose };
}

const score = (v: VariantItem, want: Record<string, string>) => Object.entries(want).filter(([a, x]) => v.options[a] === x).length;

export default function VariantPicker({ view, current, onChoose }: { view: VariantView; current: VariantItem | null; onChoose: (attributeId: string, valueId: string) => void }) {
  const others = useMemo(() => view.items, [view]);
  if (!current) return null;
  return (
    <div className="space-y-4">
      {view.axes.map((axis) => {
        const selectedId = current.options[axis.attributeId];
        const selected = axis.values.find((v) => v.id === selectedId);
        return (
          <div key={axis.attributeId} className="space-y-2">
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">
              {axis.title}: <span className="text-gray-900 dark:text-white font-black">{selected?.value}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {axis.values.map((val) => {
                const want = { ...current.options, [axis.attributeId]: val.id };
                const match = others.find((v) => Object.entries(want).every(([a, x]) => v.options[a] === x));
                const on = val.id === selectedId;
                const dim = !match || match.stock <= 0;
                const swatch = axis.display === "SWATCH" && val.colorHex;
                return (
                  <button
                    key={val.id}
                    type="button"
                    onClick={() => onChoose(axis.attributeId, val.id)}
                    aria-pressed={on}
                    aria-label={`${axis.title} ${val.value}${dim ? " — ناموجود" : ""}`}
                    title={val.value}
                    className={
                      swatch
                        ? `relative w-9 h-9 rounded-full border-2 transition ${on ? "border-primary-600 ring-2 ring-primary-500/30" : "border-white dark:border-white/20 shadow"} ${dim ? "opacity-40" : ""}`
                        : `min-w-11 h-10 px-3 rounded-xl text-sm font-black border transition ${on ? "bg-primary-600 border-primary-600 text-white" : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:border-primary-400"} ${dim ? "opacity-40 line-through decoration-1" : ""}`
                    }
                    style={swatch ? { backgroundColor: val.colorHex! } : undefined}
                  >
                    {swatch ? null : val.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
