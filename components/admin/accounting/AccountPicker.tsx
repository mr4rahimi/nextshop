"use client";

/**
 * انتخاب حساب معین — فقط در نمای حسابدار (سند دستی).
 * کل فهرست معین‌ها یک بار گرفته و همین‌جا فیلتر می‌شود؛ چند ده حساب است.
 */

import { useEffect, useRef, useState } from "react";
import { api, inputCls } from "./ui";
import { faNum } from "@/lib/accounting/money";

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  detailKind: "NONE" | "PARTY" | "TREASURY";
}

let cache: Promise<AccountOption[]> | null = null;
export function loadLeafAccounts(fresh = false): Promise<AccountOption[]> {
  if (!cache || fresh) {
    cache = api<{ accounts: AccountOption[] }>("/api/admin/accounting/accounts?leaf=1").then((d) => d.accounts);
    cache.catch(() => (cache = null));
  }
  return cache;
}

export default function AccountPicker({ value, onChange, compact }: { value: AccountOption | null; onChange: (a: AccountOption | null) => void; compact?: boolean }) {
  const [all, setAll] = useState<AccountOption[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLeafAccounts().then(setAll).catch(() => setAll([]));
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const term = q.trim();
  const list = term ? all.filter((a) => a.name.includes(term) || a.code.startsWith(term.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))))) : all;

  return (
    <div ref={box} className="relative">
      <input
        value={open ? q : value ? `${faNum(value.code)} — ${value.name}` : ""}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQ("");
          setOpen(true);
        }}
        placeholder="کد یا نام حساب"
        className={compact ? inputCls.replace("py-2.5", "py-2") : inputCls}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[240px] rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-xl max-h-72 overflow-y-auto">
          {list.slice(0, 60).map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(a);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-right text-sm hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <span className="text-gray-900 dark:text-white">{a.name}</span>
              <span className="text-[11px] text-gray-400 tabular-nums">{faNum(a.code)}</span>
            </button>
          ))}
          {!list.length && <p className="px-3 py-3 text-xs text-gray-400">حسابی پیدا نشد.</p>}
        </div>
      )}
    </div>
  );
}
