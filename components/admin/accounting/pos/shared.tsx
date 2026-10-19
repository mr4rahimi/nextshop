"use client";

/**
 * اجزای مشترک صندوق فروشگاهی — docs/plans/inventory-items.md بخش ۱۳.
 */

import { useEffect, useMemo, useState } from "react";
import { faNum, formatAmount, parseAmountInput } from "@/lib/accounting/money";

export interface PosItem {
  id: string;
  code: string;
  title: string;
  unit: string;
  image: string | null;
  price: string;
  stock: number;
  modelId: string | null;
}

export interface ModelPick {
  modelId: string;
  title: string;
  legacyCode: string | null;
  axes: { id: string; name: string; values: { id: string; value: string }[] }[];
  fixed: { axis: string; value: string }[];
  items: (PosItem & { attrs: Record<string, string> })[];
}

export type ScanResult =
  | { kind: "item"; item: PosItem }
  | { kind: "model"; pick: ModelPick }
  | { kind: "ticket"; code: string }
  | { kind: "list"; items: PosItem[] };

export interface ShiftSummary {
  shift: {
    id: string;
    number: number;
    status: "OPEN" | "CLOSED";
    openedAt: string;
    openedByName: string;
    openingFloat: string;
    openingBook: string;
    closedAt: string | null;
    closedByName: string | null;
    countedCash: string | null;
    cashDiff: string | null;
    countedCard: string | null;
    keptFloat: string | null;
    transferred: string | null;
    transferToId: string | null;
    note: string | null;
    terminal: { id: string; name: string; cashTreasuryId: string; cardTreasuryId: string | null };
  };
  counts: { sale: number; ret: number; exchange: number; tickets: number };
  saleTotal: string;
  returnTotal: string;
  net: string;
  discount: string;
  saleQty: number;
  returnQty: number;
  cashIn: string;
  cashOut: string;
  cardIn: string;
  cardOut: string;
  credit: string;
  otherCash: string;
  expectedCash: string;
  expectedCard: string;
  sellers: { sellerId: string | null; name: string; tickets: number; saleTotal: string; returnTotal: string; net: string; qty: number }[];
}

export const B = (v: string | bigint | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
};
export const abs = (v: bigint) => (v < 0n ? -v : v);

/** صدای کوتاه اسکن — موفق زیر، خطا بم */
let ctx: AudioContext | null = null;
export function beep(ok = true) {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = ok ? "sine" : "square";
    o.frequency.value = ok ? 1320 : 220;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.09 : 0.25));
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.1 : 0.26));
  } catch {
    /* بی‌صدا */
  }
}

/** مقدار ذخیره‌شده‌ی این دستگاه (سبد معلق، آخرین مقصد انتقال، …) — نبودِ localStorage ایرادی ندارد */
export const local = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, v: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* حالت خصوصی */
    }
  },
};

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-gray-300 bg-white px-1 font-sans text-[10px] font-bold text-gray-500 shadow-[0_1px_0_rgb(0_0_0/0.08)] dark:border-white/15 dark:bg-white/5 dark:text-gray-400">
      {children}
    </kbd>
  );
}

/** ورودی مبلغ بزرگ با جداکننده — برای صفحه‌ی لمسی و کیبورد */
export function BigAmount({
  value,
  onChange,
  autoFocus,
  placeholder = "۰",
  onEnter,
  className = "",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  onEnter?: () => void;
  className?: string;
  id?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value ? formatAmount(value) : ""}
        onChange={(e) => onChange(parseAmountInput(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        onFocus={(e) => e.target.select()}
        placeholder={placeholder}
        className="w-full rounded-2xl border-2 border-gray-200 bg-white py-3 pl-14 pr-4 text-left text-2xl font-black tabular-nums tracking-tight text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
        dir="ltr"
      />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">تومان</span>
    </div>
  );
}

/** اسکناس‌ها و ایران‌چک‌های رایج (تومان) — شمارش پول صندوق */
const DENOMS = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000];

export function CashCounter({ onTotal, initial }: { onTotal: (v: bigint) => void; initial?: Record<number, number> }) {
  const [counts, setCounts] = useState<Record<number, string>>(() =>
    Object.fromEntries(Object.entries(initial ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [coins, setCoins] = useState("");
  const total = useMemo(
    () => DENOMS.reduce((s, d) => s + BigInt(d) * BigInt(Number(counts[d] || 0) || 0), 0n) + B(coins),
    [counts, coins],
  );
  useEffect(() => onTotal(total), [total, onTotal]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {DENOMS.map((d) => (
          <label key={d} className="flex items-center gap-1.5 rounded-xl bg-gray-50 px-2 py-1.5 dark:bg-white/5">
            <span className="w-14 shrink-0 text-[11px] font-black tabular-nums text-gray-500">{formatAmount(d)}</span>
            <span className="text-[10px] text-gray-400">×</span>
            <input
              inputMode="numeric"
              value={counts[d] ?? ""}
              onChange={(e) => setCounts((c) => ({ ...c, [d]: e.target.value.replace(/[^\d۰-۹]/g, "").replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x))) }))}
              onFocus={(e) => e.target.select()}
              className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-center text-sm font-bold tabular-nums outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5"
              placeholder="۰"
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-2 py-1.5 dark:bg-white/5">
        <span className="shrink-0 text-[11px] font-bold text-gray-500">سکه و باقی</span>
        <input
          inputMode="numeric"
          value={coins ? formatAmount(coins) : ""}
          onChange={(e) => setCoins(parseAmountInput(e.target.value))}
          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-left text-sm font-bold tabular-nums outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5"
          dir="ltr"
          placeholder="۰"
        />
      </label>
      <p className="text-left text-xs font-bold text-gray-500">
        جمع شمرده: <span className="text-base font-black tabular-nums text-gray-900 dark:text-white">{formatAmount(total)}</span> تومان
      </p>
    </div>
  );
}

export const TICKET_KIND: Record<string, string> = { SALE: "فروش", RETURN: "مرجوعی", EXCHANGE: "تعویض" };

export function timeFa(iso: string) {
  return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
}

export { faNum, formatAmount };
