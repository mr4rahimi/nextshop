"use client";

/**
 * انتخاب کالا — جستجو با نام، کد کالا یا بارکد.
 *
 * بارکدخوان مثل کیبورد تایپ می‌کند و Enter می‌زند: اگر بارکد یا کد دقیق پیدا
 * شد، همان بی‌پرسش انتخاب می‌شود و فیلد برای اسکن بعدی خالی می‌ماند.
 */

import { useEffect, useRef, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { api, inputCls } from "./ui";

export interface ProductOption {
  id: string;
  title: string;
  sku: string | null;
  image: string | null;
  siteStock: number;
  qty: number;
  byWarehouse: Record<string, number>;
  avgCost?: string;
}

export default function ProductPicker({
  onPick,
  warehouseId,
  placeholder = "نام کالا، کد کالا یا اسکن بارکد",
  autoFocus,
}: {
  onPick: (p: ProductOption) => void;
  /** موجودی همین انبار کنار هر نتیجه نشان داده می‌شود */
  warehouseId?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProductOption[]>([]);
  const [exactId, setExactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  async function search(term: string) {
    setLoading(true);
    try {
      const d = await api<{ items: ProductOption[]; exactId: string | null }>(`/api/admin/accounting/inventory/products?q=${encodeURIComponent(term)}`);
      setItems(d.items);
      setExactId(d.exactId);
      return d;
    } catch {
      setItems([]);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !q.trim()) return;
    const h = setTimeout(() => search(q.trim()), 220);
    return () => clearTimeout(h);
  }, [q, open]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(p: ProductOption) {
    onPick(p);
    setQ("");
    setItems([]);
    setOpen(false);
    input.current?.focus();
  }

  async function onEnter() {
    const term = q.trim();
    if (!term) return;
    const d = exactId && items.length ? { items, exactId } : await search(term);
    const hit = d?.exactId ? d.items.find((i) => i.id === d.exactId) : d?.items.length === 1 ? d.items[0] : null;
    if (hit) pick(hit);
  }

  return (
    <div ref={box} className="relative">
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputCls}
        enterKeyHint="search"
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">⌕</span>
      {open && q.trim() && (
        <div className="absolute z-30 mt-1 w-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-xl max-h-80 overflow-y-auto">
          {loading && !items.length && <p className="px-3 py-3 text-xs text-gray-400">در حال جستجو…</p>}
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0"
            >
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0" />
              ) : (
                <span className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/10 shrink-0" />
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-gray-900 dark:text-white truncate">{p.title}</span>
                <span className="block text-[10px] text-gray-400">{p.sku ? `کد ${faNum(p.sku)}` : "بدون کد"}</span>
              </span>
              <span className="text-[11px] text-gray-500 shrink-0 tabular-nums">
                موجودی {faNum(warehouseId ? p.byWarehouse[warehouseId] ?? 0 : p.qty)}
              </span>
            </button>
          ))}
          {!loading && !items.length && <p className="px-3 py-3 text-xs text-gray-400">کالایی پیدا نشد.</p>}
        </div>
      )}
    </div>
  );
}
