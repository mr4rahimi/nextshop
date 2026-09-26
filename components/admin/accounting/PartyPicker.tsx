"use client";

/**
 * انتخاب شخص — docs/plans/accounting.md بخش ۱۳.۲ اصل ۴.
 *
 * جستجو با نام، موبایل، کد ملی یا کد شخص؛ مانده‌ی فعلی کنار هر نام؛ و ساخت
 * شخص تازه همین‌جا بدون ترک فرم (فقط نام و موبایل — بقیه بعداً).
 */

import { useEffect, useRef, useState } from "react";
import { api, BalanceLabel, inputCls } from "./ui";
import { faNum } from "@/lib/accounting/money";
import { Plus } from "lucide-react";

export interface PartyOption {
  id: string;
  code: number;
  name: string;
  mobile: string | null;
  balance?: string;
}

interface Props {
  value: PartyOption | null;
  onChange: (p: PartyOption | null) => void;
  placeholder?: string;
  /** اجازه‌ی ساخت شخص تازه از داخل انتخابگر */
  canCreate?: boolean;
  role?: "customer" | "supplier" | "employee" | "marketplace";
  compact?: boolean;
}

export default function PartyPicker({ value, onChange, placeholder = "نام، موبایل یا کد شخص", canCreate, role, compact }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PartyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<{ name: string; mobile: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams({ take: "12" });
        if (q.trim()) p.set("q", q.trim());
        if (role) p.set("role", role);
        const d = await api<{ parties: PartyOption[] }>(`/api/admin/accounting/parties?${p}`);
        setItems(d.parties);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(h);
  }, [q, open, role]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function create() {
    if (!creating) return;
    setError(null);
    try {
      const d = await api<{ party: PartyOption }>("/api/admin/accounting/parties", {
        method: "POST",
        json: {
          name: creating.name,
          mobile: creating.mobile || null,
          isCustomer: role === "customer" || !role,
          isSupplier: role === "supplier",
          isEmployee: role === "employee",
        },
      });
      onChange({ ...d.party, balance: "0" });
      setCreating(null);
      setOpen(false);
      setQ("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخته نشد");
    }
  }

  if (value) {
    return (
      <div className={`flex items-center justify-between gap-2 ${compact ? "px-2 py-1.5" : "px-3 py-2"} rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20`}>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{value.name}</p>
          <p className="text-[10px] text-gray-500">
            کد {faNum(value.code)}
            {value.mobile && <> · <span dir="ltr">{faNum(value.mobile)}</span></>}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-xs font-bold text-blue-600">
          تغییر
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={compact ? inputCls.replace("py-2.5", "py-2") : inputCls}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[260px] rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-xl max-h-80 overflow-y-auto">
          {loading && !items.length && <p className="px-3 py-3 text-xs text-gray-400">در حال جستجو…</p>}
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p);
                setOpen(false);
                setQ("");
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</span>
                <span className="block text-[10px] text-gray-400">
                  کد {faNum(p.code)}
                  {p.mobile && <> · <span dir="ltr">{faNum(p.mobile)}</span></>}
                </span>
              </span>
              {p.balance !== undefined && <BalanceLabel balance={p.balance} />}
            </button>
          ))}
          {!loading && !items.length && !creating && <p className="px-3 py-3 text-xs text-gray-400">کسی پیدا نشد.</p>}
          {canCreate && !creating && (
            <button
              type="button"
              onClick={() => setCreating({ name: /^\d/.test(q) ? "" : q, mobile: /^[0۰]9/.test(q) ? q : "" })}
              className="flex w-full items-center gap-1.5 px-3 py-2.5 text-right text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
            >
              <Plus className="h-4 w-4" aria-hidden />
              شخص تازه{q.trim() && !/^\d/.test(q) ? ` «${q.trim()}»` : ""}
            </button>
          )}
          {creating && (
            <div className="p-3 space-y-2 bg-gray-50 dark:bg-white/5">
              <input
                autoFocus
                value={creating.name}
                onChange={(e) => setCreating({ ...creating, name: e.target.value })}
                placeholder="نام و نام خانوادگی یا نام شرکت"
                className={inputCls}
              />
              <input
                value={creating.mobile}
                onChange={(e) => setCreating({ ...creating, mobile: e.target.value })}
                placeholder="موبایل (اختیاری)"
                inputMode="tel"
                dir="ltr"
                className={inputCls}
              />
              {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={create} className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold">
                  ساختن و انتخاب
                </button>
                <button type="button" onClick={() => setCreating(null)} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-white/10 text-xs font-bold">
                  انصراف
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
