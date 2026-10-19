"use client";

/**
 * پنجره‌ی رنگ × سایز — اسکن کد قبلیِ چندتنوعی در صندوق (docs/plans/inventory-items.md بخش ۱۳).
 * دو محور ← جدول (سطر محور اول، ستون محور دوم)؛ یک محور یا بیشتر از دو ← فهرست.
 * کیبورد: جهت‌ها جابه‌جا، Enter انتخاب، Esc بستن. مدیر ترکیب نبود را می‌سازد.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../ui";
import { formatAmount, faNum, type ModelPick, type PosItem } from "./shared";

export default function ModelPicker({
  pick,
  terminalId,
  canCreate,
  onPick,
  onClose,
}: {
  pick: ModelPick;
  terminalId: string;
  canCreate: boolean;
  onPick: (item: PosItem) => void;
  onClose: () => void;
}) {
  const [a0, a1] = pick.axes;
  const grid = pick.axes.length === 2;
  const valuesOf = useCallback(
    (axisId: string) => {
      const used = new Set(pick.items.map((i) => i.attrs[axisId]).filter(Boolean));
      return pick.axes.find((a) => a.id === axisId)!.values.filter((v) => used.has(v.id));
    },
    [pick],
  );
  const rows = useMemo(() => (grid ? valuesOf(a0.id) : []), [grid, a0, valuesOf]);
  const cols = useMemo(() => (grid ? valuesOf(a1.id) : []), [grid, a1, valuesOf]);
  const cell = useCallback((r: string, c: string) => pick.items.find((i) => i.attrs[a0.id] === r && i.attrs[a1.id] === c) ?? null, [pick, a0, a1]);
  const label = (i: ModelPick["items"][number]) =>
    pick.axes.map((a) => a.values.find((v) => v.id === i.attrs[a.id])?.value).filter(Boolean).join(" · ") || i.title;

  // جای نشانگر کیبورد
  const [pos, setPos] = useState<[number, number]>(() => {
    if (!grid) return [0, 0];
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols.length; c++) if (cell(rows[r].id, cols[c].id)) return [r, c];
    return [0, 0];
  });
  const [creating, setCreating] = useState(false);
  const [newVals, setNewVals] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (creating) return;
      if (e.key === "Escape") return onClose();
      const [r, c] = pos;
      if (grid) {
        // RTL: راست = قبلی
        if (e.key === "ArrowLeft") setPos([r, Math.min(cols.length - 1, c + 1)]);
        else if (e.key === "ArrowRight") setPos([r, Math.max(0, c - 1)]);
        else if (e.key === "ArrowDown") setPos([Math.min(rows.length - 1, r + 1), c]);
        else if (e.key === "ArrowUp") setPos([Math.max(0, r - 1), c]);
        else if (e.key === "Enter") {
          const it = rows[r] && cols[c] ? cell(rows[r].id, cols[c].id) : null;
          if (it) onPick(it);
        } else return;
      } else {
        if (e.key === "ArrowDown" || e.key === "ArrowLeft") setPos([Math.min(pick.items.length - 1, r + 1), 0]);
        else if (e.key === "ArrowUp" || e.key === "ArrowRight") setPos([Math.max(0, r - 1), 0]);
        else if (e.key === "Enter" && pick.items[r]) onPick(pick.items[r]);
        else return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [pos, grid, rows, cols, cell, pick, onPick, onClose, creating]);

  async function create() {
    setError(null);
    try {
      const r = await api<{ item: PosItem }>("/api/admin/accounting/pos/variant", {
        method: "POST",
        json: { terminalId, modelId: pick.modelId, legacyCode: pick.legacyCode, values: newVals },
      });
      onPick(r.item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ساخته نشد");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="adm-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="adm-sheet-in relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#111620]">
        <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-gray-400">{pick.legacyCode ? `کد قبلی ${pick.legacyCode} — رنگ و سایز را انتخاب کنید` : "تنوع را انتخاب کنید"}</p>
            <h3 className="mt-0.5 truncate text-lg font-black text-gray-900 dark:text-white">{pick.title}</h3>
            {pick.fixed.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {pick.fixed.map((f) => (
                  <span key={f.axis} className="rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600 dark:bg-white/5 dark:text-gray-300">
                    {f.axis}: {f.value}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5" aria-label="بستن">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {!pick.items.length ? (
            <p className="py-10 text-center text-sm font-bold text-gray-500">هنوز هیچ رنگ و سایزی از این کد کالا نشده — «برچسب‌گذاری دوباره» یا «ترکیب تازه» را بزنید.</p>
          ) : grid ? (
            <table className="w-full border-separate border-spacing-1.5">
              <thead>
                <tr>
                  <th className="text-[11px] font-bold text-gray-400">
                    {a0.name} \ {a1.name}
                  </th>
                  {cols.map((c) => (
                    <th key={c.id} className="min-w-[72px] text-sm font-black text-gray-700 dark:text-gray-200">
                      {c.value}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={r.id}>
                    <th className="whitespace-nowrap pl-2 text-right text-sm font-black text-gray-700 dark:text-gray-200">{r.value}</th>
                    {cols.map((c, ci) => {
                      const it = cell(r.id, c.id);
                      const on = pos[0] === ri && pos[1] === ci;
                      if (!it) return <td key={c.id} className="h-16 rounded-xl bg-gray-50 dark:bg-white/[0.02]" />;
                      return (
                        <td key={c.id} className="p-0">
                          <button
                            onClick={() => onPick(it)}
                            onMouseEnter={() => setPos([ri, ci])}
                            className={`flex h-16 w-full flex-col items-center justify-center rounded-xl border-2 transition active:scale-95 ${
                              on ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 bg-white hover:border-emerald-300 dark:border-white/10 dark:bg-white/5"
                            }`}
                          >
                            <span className={`text-base font-black tabular-nums ${it.stock > 0 ? "text-gray-900 dark:text-white" : "text-gray-300 dark:text-gray-600"}`}>{faNum(it.stock)}</span>
                            <span className="text-[10px] font-bold text-gray-400">{it.code}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pick.items.map((it, i) => (
                <button
                  key={it.id}
                  onClick={() => onPick(it)}
                  onMouseEnter={() => setPos([i, 0])}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-right transition active:scale-[0.98] ${pos[0] === i ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 dark:border-white/10"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-gray-900 dark:text-white">{label(it)}</span>
                    <span className="text-[11px] text-gray-400">
                      {it.code} · {formatAmount(it.price)} تومان
                    </span>
                  </span>
                  <span className={`text-lg font-black tabular-nums ${it.stock > 0 ? "text-emerald-600" : "text-gray-300"}`}>{faNum(it.stock)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-gray-400">عدد هر خانه موجودی انبار همین صندوق است. جهت‌ها برای جابه‌جایی، Enter برای انتخاب.</p>
        </div>

        {canCreate && (
          <div className="border-t border-gray-100 px-5 py-3 dark:border-white/5">
            {!creating ? (
              <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">
                <Plus className="h-3.5 w-3.5" aria-hidden /> ترکیب تازه (رنگ/سایزی که هنوز کد ندارد)
              </button>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                {pick.axes.map((a) => (
                  <label key={a.id} className="text-xs font-bold text-gray-500">
                    {a.name}
                    <input
                      list={`ax-${a.id}`}
                      value={newVals[a.id] ?? ""}
                      onChange={(e) => setNewVals((v) => ({ ...v, [a.id]: e.target.value }))}
                      className="mt-1 block w-32 rounded-xl border border-gray-200 bg-gray-50 px-2 py-2 text-sm outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5"
                    />
                    <datalist id={`ax-${a.id}`}>
                      {a.values.map((v) => (
                        <option key={v.id} value={v.value} />
                      ))}
                    </datalist>
                  </label>
                ))}
                <button onClick={create} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">
                  ساخت و افزودن
                </button>
                <button onClick={() => setCreating(false)} className="px-2 py-2 text-xs font-bold text-gray-500">
                  انصراف
                </button>
                {error && <p className="w-full text-xs font-bold text-red-600">{error}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
