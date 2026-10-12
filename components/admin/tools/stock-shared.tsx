"use client";

/**
 * اجزای مشترک «موجودی و نقطه‌ی سفارش» و «سرمایه‌ی درگیر در موجودی» —
 * خواندن `/api/admin/tools/stock`، فیلتر بازه و انبار، پیام «حسابداری داخلی فعال نیست». docs/features/tools.md بخش ۱۴ و ۱۵
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatJalali } from "@/lib/club/jalali";
import type { StockClass, VelocityRow } from "@/lib/tools/stock-velocity";
import { api, Chips, inputCls } from "../accounting/ui";
import { fa } from "./calc-inputs";

export interface StockData {
  mode: "NONE" | "HESABAN" | "INTERNAL";
  withCost: boolean;
  canEdit: boolean;
  warehouses: { id: string; name: string }[];
  rows: VelocityRow[];
}

export const WINDOWS = ["30", "60", "90", "180"] as const;
export type WindowDays = (typeof WINDOWS)[number];

export function useStockData(days: WindowDays, warehouseId: string) {
  const [state, setState] = useState<{ key: string | null; data: StockData | null; error: string | null }>({ key: null, data: null, error: null });
  const key = `${days}|${warehouseId}`;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ days, ...(warehouseId ? { warehouseId } : {}) });
    api<StockData>(`/api/admin/tools/stock?${qs}`)
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((e: Error) => alive && setState((s) => ({ ...s, key, error: e.message })));
    return () => {
      alive = false;
    };
  }, [days, warehouseId, key, tick]);

  return { data: state.data, error: state.error, loading: state.key !== key, reload: useCallback(() => setTick((t) => t + 1), []) };
}

export function StockFilters({
  days,
  onDays,
  warehouseId,
  onWarehouse,
  warehouses,
}: {
  days: WindowDays;
  onDays: (d: WindowDays) => void;
  warehouseId: string;
  onWarehouse: (id: string) => void;
  warehouses: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-gray-500">فروش</span>
      <Chips<WindowDays> value={days} onChange={onDays} options={WINDOWS.map((d) => ({ value: d, label: `${fa(Number(d))} روز اخیر` }))} />
      {warehouses.length > 1 && (
        <select className={`${inputCls} w-auto`} value={warehouseId} onChange={(e) => onWarehouse(e.target.value)}>
          <option value="">همه‌ی انبارها</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
    </div>
  );
}

export function NoAccountingNotice({ what }: { what: string }) {
  return (
    <div className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
      <b>حسابداری داخلی فعال نیست</b>، پس {what} از انبار خوانده نمی‌شود و باید عددها را دستی وارد کنید. با فعال شدن
      حسابداری داخلی (<Link href="/admin/accounting" className="underline">حسابداری</Link>) همه‌ی کالاها خودکار حساب می‌شوند.
    </div>
  );
}

/** روزهای پوشش برای نمایش */
export function daysText(n: number | null): string {
  if (n === null) return "بی‌فروش";
  if (n >= 999) return "بیش از ۹۹۹";
  return fa(Math.round(n));
}

export function lastSaleText(iso: string | null): string {
  return iso ? formatJalali(new Date(iso)) : "—";
}

export const CLASS_TONE: Record<StockClass, string> = {
  FAST: "bg-emerald-500",
  SLOW: "bg-sky-500",
  STALE: "bg-amber-500",
  DEAD: "bg-red-500",
  OUT: "bg-gray-400",
};

export const CLASS_BADGE: Record<StockClass, string> = {
  FAST: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  SLOW: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  STALE: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  DEAD: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  OUT: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
};

/** جستجوی ساده روی نام و کد، با ارقام فارسی */
export function matchQuery(row: VelocityRow, q: string): boolean {
  const n = (s: string) => s.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
  const t = n(q.trim());
  return !t || n(row.title).includes(t) || n(row.code).includes(t);
}
