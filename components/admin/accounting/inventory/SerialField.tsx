"use client";

/**
 * ورود شماره سریال یک ردیف (فاکتور، حواله، ورود و خروج دستی) — docs/plans/webhesab-parity.md بخش ۱۴.
 *
 * اسکن یا تایپ (Enter)، چسباندن چند سریال با هم (هر خط یکی)، و برای خروج انتخاب از سریال‌های در
 * انبار (`pick="stock"`) یا از سریال‌های ردیف مرجع (`choices`، برگشتی).
 */

import { useEffect, useState } from "react";
import { faNum, toLatinDigits } from "@/lib/accounting/money";
import { api } from "../ui";

const norm = (s: string) => toLatinDigits(s).replace(/\s+/g, " ").trim().toUpperCase();

export function splitSerials(raw: string): string[] {
  return raw.split(/[\n,،;\t]+/).map(norm).filter(Boolean);
}

export default function SerialField({
  value,
  onChange,
  qty,
  itemId,
  warehouseId,
  pick,
  choices,
  required,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  qty: number;
  itemId: string;
  warehouseId?: string | null;
  /** «stock» = پیشنهاد سریال‌های در همین انبار (فروش، خروج، حواله) */
  pick?: "stock";
  /** برگشتی: فقط همین‌ها */
  choices?: string[];
  /** فروش با «سریال اجباری» — کم بودن قرمز نشان داده می‌شود */
  required?: boolean;
}) {
  const [q, setQ] = useState("");
  const [stock, setStock] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (pick !== "stock" || !open || !itemId || !warehouseId) return;
    api<{ serials: string[] }>(`/api/admin/accounting/serials?available=1&itemId=${itemId}&warehouseId=${warehouseId}`)
      .then((d) => setStock(d.serials))
      .catch(() => setStock([]));
  }, [pick, open, itemId, warehouseId]);

  function add(list: string[]) {
    const next = [...value];
    for (const s of list) {
      if (next.includes(s)) {
        setMsg(`سریال ${s} تکراری است`);
        continue;
      }
      if (choices && !choices.includes(s)) {
        setMsg(`سریال ${s} در فاکتور مرجع نیست`);
        continue;
      }
      next.push(s);
    }
    if (next.length !== value.length) setMsg(null);
    onChange(next);
    setQ("");
  }

  const short = value.length < qty;
  const over = value.length > qty;
  const options = (choices ?? (pick === "stock" ? stock ?? [] : [])).filter((s) => !value.includes(s));
  return (
    <div className="mt-1.5 rounded-lg border border-dashed border-indigo-300/60 bg-white/60 p-1.5 dark:border-indigo-400/30 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-1">
        <span className={`text-[10px] font-bold ${over || (required && short) ? "text-red-600" : short ? "text-amber-600" : "text-indigo-600"}`}>
          🔢 سریال {faNum(value.length)}/{faNum(qty)}
        </span>
        {value.map((s) => (
          <button key={s} type="button" dir="ltr" onClick={() => onChange(value.filter((x) => x !== s))} className="rounded-md bg-indigo-600 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white" title="برداشتن">
            {s} ×
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(splitSerials(q));
            }
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (/[\n,،;\t]/.test(t)) {
              e.preventDefault();
              add(splitSerials(t));
            }
          }}
          onBlur={() => q.trim() && add(splitSerials(q))}
          placeholder={value.length < qty ? "اسکن یا تایپ سریال + Enter" : ""}
          dir="ltr"
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 font-mono text-xs outline-none"
        />
        {(pick === "stock" || choices?.length) && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-white/10 dark:text-gray-300">
            {choices ? "سریال‌های فاکتور مرجع" : "از موجودی"} {open ? "▴" : "▾"}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
          {pick === "stock" && !choices && stock === null ? (
            <span className="text-[10px] text-gray-400">…</span>
          ) : !options.length ? (
            <span className="text-[10px] text-gray-400">{pick === "stock" && !choices ? "سریال ثبت‌شده‌ای در این انبار نیست؛ سریال تازه را اسکن کنید." : "همه انتخاب شده‌اند."}</span>
          ) : (
            options.map((s) => (
              <button key={s} type="button" dir="ltr" onClick={() => add([s])} className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 hover:bg-indigo-100 dark:bg-white/10 dark:text-gray-200">
                {s}
              </button>
            ))
          )}
        </div>
      )}
      {msg && <p className="mt-0.5 text-[10px] font-bold text-red-600">{msg}</p>}
    </div>
  );
}
