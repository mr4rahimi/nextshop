"use client";

/**
 * ورود گروهی کالا — جدول ویرایشی با چسباندن مستقیم از اکسل (docs/plans/inventory-items.md بخش ۴).
 * چسباندن چند خانه (تب/خط تازه) از همان خانه به راست و پایین پخش می‌شود.
 * ثبت همه یا هیچ؛ ایراد هر ردیف پیش از ثبت کنار همان ردیف.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { api, btn, Card, ErrorText } from "../ui";

const COLS = [
  { key: "title", label: "نام کالا", w: "2fr" },
  { key: "code", label: "کد (خالی = خودکار)", w: "1fr", ltr: true },
  { key: "barcode", label: "بارکد", w: "1fr", ltr: true },
  { key: "unit", label: "واحد", w: "0.6fr" },
  { key: "salePrice", label: "قیمت فروش", w: "1fr", ltr: true },
  { key: "group", label: "گروه (پوشاک/پیراهن)", w: "1.2fr" },
] as const;
type Key = (typeof COLS)[number]["key"];
type Row = Record<Key, string>;

const empty = (): Row => ({ title: "", code: "", barcode: "", unit: "", salePrice: "", group: "" });
const filled = (r: Row) => COLS.some((c) => r[c.key].trim());
const grid = COLS.map((c) => c.w).join(" ");

export default function BulkItemsGrid() {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 8 }, empty));
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; code: string; title: string }[] | null>(null);
  const cells = useRef<Map<string, HTMLInputElement>>(new Map());

  const used = rows.map((r, i) => ({ r, i })).filter((x) => filled(x.r));

  useEffect(() => {
    if (!used.length) {
      setErrors({});
      return;
    }
    const h = setTimeout(() => {
      api<{ checks: { index: number; error: string | null }[] }>("/api/admin/accounting/items/bulk", { method: "POST", json: { rows: used.map((x) => x.r) } })
        .then((d) => {
          const e: Record<number, string> = {};
          for (const c of d.checks) if (c.error) e[used[c.index].i] = c.error;
          setErrors(e);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, 500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function set(i: number, k: Key, v: string) {
    setRows((rs) => {
      const next = rs.map((r, j) => (j === i ? { ...r, [k]: v } : r));
      if (i >= next.length - 2) next.push(empty(), empty());
      return next;
    });
  }

  function paste(i: number, col: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").replace(/\n$/, "").split("\n");
    setRows((rs) => {
      const next = [...rs];
      lines.forEach((line, di) => {
        const r = { ...(next[i + di] ?? empty()) };
        line.split("\t").forEach((v, dc) => {
          const c = COLS[col + dc];
          if (c) r[c.key] = v.trim();
        });
        next[i + di] = r;
      });
      next.push(empty(), empty());
      return next;
    });
  }

  function move(i: number, col: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const to = e.key === "Enter" || e.key === "ArrowDown" ? [i + 1, col] : e.key === "ArrowUp" ? [i - 1, col] : null;
    if (!to) return;
    e.preventDefault();
    cells.current.get(`${to[0]}:${to[1]}`)?.focus();
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ created: { id: string; code: string; title: string }[] }>("/api/admin/accounting/items/bulk", { method: "POST", json: { rows: used.map((x) => x.r), commit: true } });
      setDone(r.created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <Card className="p-5 space-y-3">
        <p className="text-base font-black">✅ {faNum(done.length)} کالا ساخته شد</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/accounting/inventory/labels/print?items=${done.map((i) => `${i.id}:1`).join(",")}`} target="_blank" className={btn.soft}>
            چاپ برچسب همه
          </Link>
          <Link href="/admin/accounting/inventory?filter=noproduct" className={btn.soft}>
            دیدن کالاها
          </Link>
          <button
            onClick={() => {
              setDone(null);
              setRows(Array.from({ length: 8 }, empty));
            }}
            className={btn.primary}
          >
            ورود بعدی
          </button>
        </div>
      </Card>
    );

  const bad = Object.keys(errors).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 leading-6">
        ستون‌های اکسل را به همین ترتیب بچینید، انتخاب کنید و در خانه‌ی اول بچسبانید. Enter یا ↓ به ردیف بعد می‌رود.
      </p>
      <Card className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid gap-1 px-2 py-2 bg-gray-50 dark:bg-white/5 text-[11px] font-bold text-gray-500" style={{ gridTemplateColumns: `28px ${grid}` }}>
            <span />
            {COLS.map((c) => (
              <span key={c.key}>{c.label}</span>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={i}>
              <div className="grid gap-1 px-2 py-1 items-center" style={{ gridTemplateColumns: `28px ${grid}` }}>
                <span className={`text-[10px] tabular-nums ${errors[i] ? "text-red-600 font-black" : "text-gray-400"}`}>{faNum(i + 1)}</span>
                {COLS.map((c, ci) => (
                  <input
                    key={c.key}
                    ref={(el) => {
                      if (el) cells.current.set(`${i}:${ci}`, el);
                      else cells.current.delete(`${i}:${ci}`);
                    }}
                    value={r[c.key]}
                    onChange={(e) => set(i, c.key, e.target.value)}
                    onPaste={(e) => paste(i, ci, e)}
                    onKeyDown={(e) => move(i, ci, e)}
                    dir={"ltr" in c && c.ltr ? "ltr" : undefined}
                    className={`acc-input w-full px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border text-xs outline-none focus:border-blue-400 ${errors[i] ? "border-red-300" : "border-gray-200 dark:border-white/10"}`}
                  />
                ))}
              </div>
              {errors[i] && <p className="px-10 pb-1 text-[11px] text-red-600">{errors[i]}</p>}
            </div>
          ))}
        </div>
      </Card>
      <ErrorText>{error}</ErrorText>
      <button onClick={commit} disabled={busy || !used.length || bad > 0} className={`${btn.primary} w-full`}>
        {busy ? "…" : bad ? `${faNum(bad)} ردیف ایراد دارد` : used.length ? `ساخت ${faNum(used.length)} کالا` : "ردیفی وارد نشده"}
      </button>
    </div>
  );
}
