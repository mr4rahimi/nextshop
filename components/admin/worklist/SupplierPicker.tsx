"use client";

/**
 * انتخاب تأمین‌کننده از فهرست، با افزودن سریع.
 *
 * بخش ۱۹ مستندات، سؤال ۹: «از فهرست انتخاب شود و اگر نبود همان‌جا سریع اضافه
 * شود». افزودن فقط نام می‌خواهد؛ شماره و شهر بعداً در صفحه‌ی تأمین‌کننده‌ها.
 */

import { useEffect, useRef, useState } from "react";

export interface SupplierOption {
  id: string;
  name: string;
  city?: string | null;
}

interface Props {
  value: SupplierOption | null;
  onChange: (s: SupplierOption | null) => void;
  placeholder?: string;
}

export default function SupplierPicker({ value, onChange, placeholder = "جستجو یا افزودن تأمین‌کننده" }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SupplierOption[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      fetch(`/api/admin/worklist/suppliers?take=20&q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          setItems(d.suppliers ?? []);
          setCanCreate(Boolean(d.can?.create));
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function quickAdd() {
    const name = query.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/worklist/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "افزودن ناموفق بود");
      onChange({ id: d.supplier.id, name: d.supplier.name, city: d.supplier.city });
      setQuery("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "افزودن ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
        <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
          {value.name}
          {value.city && <span className="text-[11px] font-normal text-gray-500 mr-1.5">{value.city}</span>}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-gray-500 hover:text-red-500 shrink-0"
          aria-label="برداشتن تأمین‌کننده"
        >
          ✕
        </button>
      </div>
    );
  }

  const exact = items.some((i) => i.name.trim() === query.trim());

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (items.length === 1) {
              onChange(items[0]);
              setOpen(false);
            } else if (canCreate && query.trim() && !exact) {
              void quickAdd();
            }
          }
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400"
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-xl">
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-right px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              {s.name}
              {s.city && <span className="text-[11px] text-gray-400 mr-1.5">{s.city}</span>}
            </button>
          ))}
          {items.length === 0 && !query.trim() && (
            <p className="px-3 py-2 text-[11px] text-gray-400">هنوز تأمین‌کننده‌ای ثبت نشده است</p>
          )}
          {canCreate && query.trim() && !exact && (
            <button
              type="button"
              disabled={busy}
              onClick={quickAdd}
              className="w-full text-right px-3 py-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-t border-gray-100 dark:border-white/5 disabled:opacity-50"
            >
              {busy ? "در حال افزودن..." : `+ افزودن «${query.trim()}» به فهرست`}
            </button>
          )}
          {!canCreate && query.trim() && items.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-gray-400">
              پیدا نشد. اجازه‌ی افزودن تأمین‌کننده ندارید؛ از مدیر بخواهید اضافه کند.
            </p>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
