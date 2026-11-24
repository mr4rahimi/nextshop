"use client";

/**
 * قیمت فروشگاه ← «تغییر سریع»: کد (یا بارکد/نام) زده می‌شود و همان لحظه همه‌ی رنگ و
 * سایزهای مدل با قیمت و موجودی می‌آیند؛ افزایش/کاهش (درصد، مبلغ یا قیمت ثابت) همان‌جا
 * روی قیمت تازه‌ی هر ردیف دیده می‌شود؛ «اعمال» و اختیاری چاپ برچسب به تعداد موجودی.
 * سرور: lib/accounting/inventory/price-families.ts و action `pick` در store-prices.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { applyRule, type RoundMode } from "@/lib/accounting/inventory/online-price-calc";
import { api, btn, Card, ErrorText, inputCls, Segmented } from "../ui";

type Dir = "UP" | "DOWN";
type OpKind = "PERCENT" | "AMOUNT" | "SET";
type LabelQty = "stock" | "one";

interface FItem {
  id: string;
  code: string;
  title: string;
  attrs: string;
  price: string;
  stock: number;
  source: boolean;
}
interface Family {
  key: string;
  title: string;
  code: string | null;
  exact: boolean;
  items: FItem[];
}

const PREFS_KEY = "acc.quickPrice.v1";
interface Prefs {
  dir: Dir;
  kind: OpKind;
  roundTo: number;
  mode: RoundMode;
  print: boolean;
  labelQty: LabelQty;
}
const DEFAULT_PREFS: Prefs = { dir: "UP", kind: "PERCENT", roundTo: 1000, mode: "up", print: false, labelQty: "stock" };
const LABEL_LIMIT = 500;

function num(raw: string): number | null {
  const t = raw.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٫]/g, ".").replace(/[,٬\s٪%+−–-]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** همان `nextPrice` سرور (store-price.ts) — null یعنی رد می‌شود */
function calc(from: bigint, kind: OpKind, dir: Dir, n: number, roundTo: number, mode: RoundMode): bigint | null {
  if (kind === "SET") return BigInt(Math.round(n));
  if (from <= 0n) return null;
  const sign = dir === "UP" ? 1 : -1;
  const raw = kind === "PERCENT" ? applyRule(from, sign * Math.round(n * 100), roundTo, mode) : applyRule(from + BigInt(sign * Math.round(n)), 0, roundTo, mode);
  return raw > 0n ? raw : null;
}

export default function StorePriceQuick({ canManage, onApplied }: { canManage: boolean; onApplied: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Family[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [list, setList] = useState<Family[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
      if (p && typeof p === "object") setPrefs({ ...DEFAULT_PREFS, ...p });
    } catch {}
  }, []);
  const setPref = (p: Partial<Prefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  // جست‌وجوی زنده
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits(null);
      return;
    }
    const my = ++seq.current;
    setSearching(true);
    const t = setTimeout(() => {
      api<{ families: Family[] }>(`/api/admin/accounting/items/store-prices/lookup?q=${encodeURIComponent(term)}`)
        .then((d) => my === seq.current && setHits(d.families))
        .catch((e) => my === seq.current && setError(e.message))
        .finally(() => my === seq.current && setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const inList = useMemo(() => new Set(list.map((f) => f.key)), [list]);
  const add = (f: Family) => {
    setList((l) => (l.some((x) => x.key === f.key) ? l : [f, ...l]));
    setQ("");
    setHits(null);
    setNote(null);
    input.current?.focus();
  };
  const remove = (key: string) => setList((l) => l.filter((f) => f.key !== key));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = hits?.find((f) => !inList.has(f.key));
    if (first) add(first);
  };

  const n = num(val);
  const preview = useCallback(
    (from: bigint) => (n === null ? null : calc(from, prefs.kind, prefs.dir, n, prefs.kind === "SET" ? 0 : prefs.roundTo, prefs.mode)),
    [n, prefs],
  );

  const all = list.flatMap((f) => f.items);
  const picked = all.filter((i) => !off.has(i.id));
  const changing = picked.filter((i) => {
    const to = preview(BigInt(i.price));
    return to !== null && to !== BigInt(i.price);
  });
  const labelRows = picked
    .map((i) => ({ id: i.id, qty: prefs.labelQty === "stock" ? Math.min(i.stock, LABEL_LIMIT) : 1 }))
    .filter((r) => r.qty > 0)
    .slice(0, LABEL_LIMIT);
  const labelCount = labelRows.reduce((s, r) => s + r.qty, 0);
  const labelHref = `/admin/accounting/inventory/labels/print?items=${labelRows.map((r) => `${r.id}:${r.qty}`).join(",")}`;

  const toggle = (id: string) => setOff((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));
  const toggleFamily = (f: Family, on: boolean) =>
    setOff((s) => {
      const next = new Set(s);
      for (const i of f.items) {
        if (on) next.delete(i.id);
        else next.add(i.id);
      }
      return next;
    });

  async function refresh(keys: string[]) {
    if (!keys.length) return;
    const d = await api<{ families: Family[] }>(`/api/admin/accounting/items/store-prices/lookup?keys=${keys.join(",")}`);
    const fresh = new Map(d.families.map((f) => [f.key, f]));
    setList((l) => l.map((f) => fresh.get(f.key) ?? f));
  }

  async function apply() {
    if (!changing.length || n === null) return;
    // پنجره‌ی چاپ همین حالا (در خود کلیک) باز می‌شود تا مرورگر جلویش را نگیرد
    const win = prefs.print && labelRows.length ? window.open("about:blank", "_blank") : null;
    setBusy(true);
    setError(null);
    setNote(null);
    const op =
      prefs.kind === "PERCENT"
        ? { kind: "PERCENT", pctBp: (prefs.dir === "UP" ? 1 : -1) * Math.round(n * 100) }
        : prefs.kind === "AMOUNT"
          ? { kind: "AMOUNT", amount: String((prefs.dir === "UP" ? 1 : -1) * Math.round(n)) }
          : { kind: "SET", price: String(Math.round(n)) };
    const titles = list.filter((f) => f.items.some((i) => !off.has(i.id))).map((f) => f.title);
    const scope = titles.slice(0, 3).join("، ") + (titles.length > 3 ? ` و ${faNum(titles.length - 3)} مدل دیگر` : "");
    try {
      const r = await api<{ applied?: { count: number } }>("/api/admin/accounting/items/store-prices", {
        method: "POST",
        json: { action: "pick", commit: true, ids: changing.map((i) => i.id), op, round: { roundTo: prefs.kind === "SET" ? 0 : prefs.roundTo, mode: prefs.mode }, scope },
      });
      if (win) win.location.href = labelHref;
      setNote(`قیمت ${faNum(r.applied?.count ?? changing.length)} کالا ${prefs.kind === "SET" ? "عوض" : prefs.dir === "UP" ? "بیشتر" : "کمتر"} شد${win ? ` — برچسب‌ها (${faNum(labelCount)} عدد) در زبانه‌ی تازه باز شد` : ""}.`);
      setVal("");
      onApplied();
      await refresh(list.map((f) => f.key));
    } catch (e) {
      win?.close();
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  const verb = prefs.kind === "SET" ? "قیمت تازه برای" : prefs.dir === "UP" ? "افزایش قیمت" : "کاهش قیمت";

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="relative">
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            className={`${inputCls} !py-3 text-base`}
            placeholder="کد، بارکد یا نام مدل — Enter برای افزودن"
          />
          {searching && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">…</span>}
        </div>
        {hits && (
          <div className="overflow-hidden rounded-xl border border-[var(--adm-border)]">
            {!hits.length ? (
              <p className="px-3 py-3 text-xs text-gray-500">{searching ? "در حال جست‌وجو…" : "کالایی با این کد یا نام پیدا نشد"}</p>
            ) : (
              <div className="divide-y divide-[var(--adm-border)]">
                {hits.map((f, k) => {
                  const there = inList.has(f.key);
                  const stock = f.items.reduce((s, i) => s + i.stock, 0);
                  const prices = [...new Set(f.items.map((i) => i.price))];
                  return (
                    <button
                      key={f.key}
                      type="button"
                      disabled={there}
                      onClick={() => add(f)}
                      className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-right text-sm transition hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-white/5 ${k === 0 && !there ? "bg-blue-50/50 dark:bg-white/[0.03]" : ""}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-bold">{f.title}</span>
                        {f.code && <span className="mr-2 text-[11px] text-gray-400">{f.code}</span>}
                        {f.exact && <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15">کد دقیق</span>}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {f.items.length > 1 ? `${faNum(f.items.length)} رنگ/سایز` : "تک کالا"} · موجودی {faNum(stock)}
                      </span>
                      <span className="text-xs font-black tabular-nums">{prices.length === 1 ? formatAmount(prices[0]) : `${faNum(prices.length)} قیمت`}</span>
                      <span className="text-xs font-bold text-blue-600">{there ? "در فهرست" : "+ افزودن"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {!list.length && !hits && (
          <p className="text-[11px] leading-5 text-gray-500">
            کد یک کالا را بزنید (یا بارکدش را بخوانید)؛ همه‌ی رنگ و سایزهای همان مدل با هم می‌آیند. چند مدل را پشت سر هم اضافه کنید و یک‌جا قیمتشان را عوض کنید.
          </p>
        )}
      </Card>

      {list.length > 0 && (
        <>
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                value={prefs.dir}
                onChange={(d) => setPref({ dir: d, mode: d === "UP" ? "up" : "down" })}
                options={[
                  { value: "UP", label: "▲ افزایش" },
                  { value: "DOWN", label: "▼ کاهش" },
                ]}
              />
              <Segmented
                value={prefs.kind}
                onChange={(k) => (setPref({ kind: k }), setVal(""))}
                options={[
                  { value: "PERCENT", label: "درصد" },
                  { value: "AMOUNT", label: "مبلغ" },
                  { value: "SET", label: "قیمت ثابت" },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canManage && !busy && changing.length > 0 && apply()}
                className={`${inputCls} !w-40 text-left text-base font-bold`}
                dir="ltr"
                inputMode="decimal"
                placeholder={prefs.kind === "PERCENT" ? "10 ٪" : "تومان"}
              />
              {(prefs.kind === "PERCENT" ? [5, 10, 15, 20, 25, 30] : prefs.kind === "AMOUNT" ? [10000, 20000, 50000, 100000] : []).map((p) => (
                <button key={p} type="button" onClick={() => setVal(String(p))} className={`${btn.small} ${String(p) === val ? "!bg-blue-600 !text-white" : ""}`}>
                  {prefs.kind === "PERCENT" ? `${faNum(p)}٪` : formatAmount(p)}
                </button>
              ))}
              {prefs.kind !== "SET" && (
                <select value={`${prefs.roundTo}:${prefs.mode}`} onChange={(e) => {
                  const [r, m] = e.target.value.split(":");
                  setPref({ roundTo: Number(r), mode: m as RoundMode });
                }} className={`${inputCls} !w-auto !py-1.5 text-xs`}>
                  {[0, 1000, 5000, 10000, 50000].flatMap((r) =>
                    r === 0
                      ? [<option key="0" value="0:nearest">گرد نشود</option>]
                      : (["up", "nearest", "down"] as RoundMode[]).map((m) => (
                          <option key={`${r}${m}`} value={`${r}:${m}`}>
                            گرد به {formatAmount(r)} {m === "up" ? "رو به بالا" : m === "down" ? "رو به پایین" : "نزدیک‌ترین"}
                          </option>
                        )),
                  )}
                </select>
              )}
            </div>
          </Card>

          {list.map((f) => {
            const on = f.items.filter((i) => !off.has(i.id)).length;
            return (
              <Card key={f.key} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <input type="checkbox" checked={on === f.items.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < f.items.length; }} onChange={(e) => toggleFamily(f, e.target.checked)} className="h-4 w-4 accent-blue-600" />
                  <span className="min-w-0 flex-1 font-bold">
                    {f.title}
                    {f.code && <span className="mr-2 text-[11px] font-normal text-gray-400">{f.code}</span>}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {faNum(on)} از {faNum(f.items.length)}
                  </span>
                  <button type="button" onClick={() => remove(f.key)} title="برداشتن از فهرست" className="px-1 text-gray-400 hover:text-red-600">
                    ✕
                  </button>
                </div>
                <div className="overflow-x-auto border-t border-[var(--adm-border)]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                      <tr>
                        <th className="w-8" />
                        <th className="px-3 py-1.5 text-right">رنگ / سایز</th>
                        <th className="px-3 py-1.5 text-left">موجودی</th>
                        <th className="px-3 py-1.5 text-left">الان</th>
                        <th className="px-3 py-1.5 text-left">تازه</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--adm-border)]">
                      {f.items.map((i) => {
                        const from = BigInt(i.price);
                        const to = preview(from);
                        const sel = !off.has(i.id);
                        return (
                          <tr key={i.id} onClick={() => toggle(i.id)} className={`cursor-pointer ${sel ? "" : "opacity-40"}`}>
                            <td className="px-3 py-1.5">
                              <input type="checkbox" checked={sel} onChange={() => toggle(i.id)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 accent-blue-600" />
                            </td>
                            <td className="px-3 py-1.5">
                              <Link href={`/admin/accounting/inventory/${i.id}`} onClick={(e) => e.stopPropagation()} className="font-bold hover:text-blue-600">
                                {i.source ? "بی‌تفکیک (کالای خرید)" : i.attrs || i.title}
                              </Link>
                              <span className="mr-2 text-[11px] text-gray-400">{i.code}</span>
                            </td>
                            <td className={`px-3 py-1.5 text-left tabular-nums ${i.stock ? "text-gray-600 dark:text-gray-300" : "text-gray-300"}`}>{faNum(i.stock)}</td>
                            <td className={`px-3 py-1.5 text-left tabular-nums ${to !== null && sel ? "text-gray-400 line-through" : "font-bold"}`}>{from > 0n ? formatAmount(from) : "—"}</td>
                            <td className={`px-3 py-1.5 text-left font-black tabular-nums ${to === null || !sel ? "text-gray-300" : to > from ? "text-amber-600" : to < from ? "text-emerald-600" : ""}`}>
                              {n === null ? "" : to === null ? (from > 0n ? "نامعتبر" : "بی‌قیمت") : formatAmount(to)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}

          <div className="sticky bottom-2 z-10">
            <Card className="p-3 space-y-2 shadow-lg">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <label className="flex items-center gap-2 font-bold">
                  <input type="checkbox" checked={prefs.print} onChange={(e) => setPref({ print: e.target.checked })} className="h-4 w-4 accent-blue-600" />
                  بعد از اعمال برچسب چاپ شود
                </label>
                <select value={prefs.labelQty} onChange={(e) => setPref({ labelQty: e.target.value as LabelQty })} className={`${inputCls} !w-auto !py-1 text-xs`}>
                  <option value="stock">به تعداد موجودی</option>
                  <option value="one">یکی برای هر کالا</option>
                </select>
                <span className="text-gray-500">{faNum(labelCount)} برچسب</span>
                <a
                  href={labelRows.length ? labelHref : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`font-bold text-blue-600 ${labelRows.length ? "" : "pointer-events-none opacity-40"}`}
                >
                  فقط چاپ برچسب (بی تغییر قیمت)
                </a>
                <button type="button" onClick={() => (setList([]), setOff(new Set()), setNote(null), input.current?.focus())} className="mr-auto font-bold text-gray-500 hover:text-red-600">
                  خالی کردن فهرست
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManage ? (
                  <button type="button" onClick={apply} disabled={busy || !changing.length} className={`${prefs.dir === "DOWN" && prefs.kind !== "SET" ? btn.dark : btn.primary} min-w-[12rem]`}>
                    {busy ? "…" : n === null ? "مقدار تغییر را بنویسید" : !changing.length ? "قیمتی عوض نمی‌شود" : `${verb} ${faNum(changing.length)} کالا`}
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">دسترسی تغییر قیمت ندارید</span>
                )}
                <span className="text-[11px] text-gray-500">
                  {faNum(picked.length)} انتخاب از {faNum(all.length)} کالا
                </span>
              </div>
              {note && <p className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10">{note}</p>}
              <ErrorText>{error}</ErrorText>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
