"use client";

/**
 * مرجوعی با رسید — بارکد رسید (`POS12`) یا شماره‌ی رسید/فاکتور را بزنید، تعداد برگشتی هر
 * ردیف را انتخاب کنید و «افزودن به سبد». مبلغ هر عدد همان سهم فروش اولیه است.
 * مدیر صندوق «مرجوعی بی‌رسید» دارد: بعد از آن هر اسکن یک ردیف مرجوعی با قیمت امروز است.
 */

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, ScanLine, X } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { api } from "../ui";
import { faNum, formatAmount } from "./shared";

export interface Returnable {
  invoiceId: string;
  invoiceNumber: number | null;
  ticketNumber: number | null;
  date: string;
  partyId: string;
  partyName: string;
  walkIn: boolean;
  lines: { refLineId: string; productId: string; title: string; qty: number; left: number; each: string }[];
}

export default function ReturnSheet({
  initialCode,
  canBlind,
  onAdd,
  onBlind,
  onClose,
}: {
  initialCode?: string;
  canBlind: boolean;
  onAdd: (src: Returnable, picks: { refLineId: string; qty: number }[]) => void;
  onBlind: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(initialCode ?? "");
  const [src, setSrc] = useState<Returnable | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function load(code: string) {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<Returnable>(`/api/admin/accounting/pos/returnable?q=${encodeURIComponent(code.trim())}`);
      setSrc(r);
      // یک ردیف تک‌عددی ← همان پیش‌فرض
      const open = r.lines.filter((l) => l.left > 0);
      setQty(open.length === 1 && open[0].left === 1 ? { [open[0].refLineId]: 1 } : {});
    } catch (e) {
      setSrc(null);
      setError(e instanceof Error ? e.message : "پیدا نشد");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialCode) load(initialCode);
    else input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const picks = Object.entries(qty).filter(([, n]) => n > 0).map(([refLineId, n]) => ({ refLineId, qty: n }));
  const sum = src ? picks.reduce((s, p) => s + BigInt(src.lines.find((l) => l.refLineId === p.refLineId)!.each) * BigInt(p.qty), 0n) : 0n;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="adm-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="adm-sheet-in relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#111620]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/5">
          <h3 className="text-lg font-black text-rose-600">مرجوعی</h3>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5" aria-label="بستن">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(q);
            }}
            className="relative"
          >
            <ScanLine className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بارکد رسید را اسکن کنید یا شماره‌ی رسید/فاکتور را بنویسید"
              className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 py-3.5 pl-4 pr-12 text-base font-bold outline-none focus:border-rose-400 dark:border-white/10 dark:bg-white/5"
            />
          </form>
          {busy && <p className="text-xs text-gray-400">در حال جستجو…</p>}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10">{error}</p>}

          {src && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500">
                {src.ticketNumber ? `رسید ${faNum(src.ticketNumber)} · ` : ""}فاکتور {faNum(src.invoiceNumber ?? 0)} · {formatJalali(new Date(src.date))} · {src.partyName}
              </p>
              {src.lines.map((l) => {
                const n = qty[l.refLineId] ?? 0;
                return (
                  <div key={l.refLineId} className={`flex items-center gap-3 rounded-2xl border p-3 ${n > 0 ? "border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10" : "border-gray-200 dark:border-white/10"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-900 dark:text-white">{l.title}</p>
                      <p className="text-[11px] text-gray-500">
                        خرید {faNum(l.qty)} · قابل برگشت {faNum(l.left)} · هر عدد {formatAmount(l.each)}
                      </p>
                    </div>
                    {l.left > 0 ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty((x) => ({ ...x, [l.refLineId]: Math.max(0, n - 1) }))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5" aria-label="کم">
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <span className="w-8 text-center text-lg font-black tabular-nums">{faNum(n)}</span>
                        <button onClick={() => setQty((x) => ({ ...x, [l.refLineId]: Math.min(l.left, n + 1) }))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5" aria-label="زیاد">
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-gray-400">برگشت شده</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3 dark:border-white/5">
          {canBlind && (
            <button onClick={onBlind} className="rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">
              مرجوعی بی‌رسید (مدیر)
            </button>
          )}
          <button
            disabled={!src || !picks.length}
            onClick={() => src && onAdd(src, picks)}
            className="mr-auto rounded-2xl bg-rose-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-rose-600/25 disabled:opacity-40"
          >
            افزودن به سبد {sum > 0n && `— ≈ ${formatAmount(sum)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
