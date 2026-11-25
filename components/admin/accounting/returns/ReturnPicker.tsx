"use client";

/**
 * انتخاب کالای مرجوعی — مشترک صندوق (`ReturnSheet`)، صفحه‌ی «فروش ← مرجوعی» و «برگشت از
 * فروش» دستی. docs/plans/webhesab-parity.md بخش ۳۳ و ۳۴.۱.
 *
 * یک کادر برای همه: بارکد رسید (`POS12`) یا شماره‌ی رسید/فاکتور ← همان فاکتور؛ موبایل، نام،
 * کد شخص یا کارت اشتراک ← مشتری ← **همه‌ی خریدهایش** با عکس، رنگ/سایز و تعداد قابل برگشت.
 * اسکن بارکد کالا در خریدهای مشتری همان قلم را انتخاب می‌کند. هر مرجوعی از یک فاکتور است.
 * انتخاب با `onSelection` به والد می‌رسد؛ دکمه‌ی ثبت مال والد است.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Minus, Plus, ReceiptText, ScanLine, Search, UserRound } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { api } from "../ui";

export interface ReturnLine {
  refLineId: string;
  productId: string;
  title: string;
  qty: number;
  left: number;
  each: string;
  /** سریال‌های ردیف که هنوز برنگشته‌اند */
  serials: string[];
  code?: string | null;
  attrs?: string;
  barcodes?: string[];
  image?: string | null;
}
export interface Returnable {
  invoiceId: string;
  invoiceNumber: number | null;
  ticketNumber: number | null;
  date: string;
  partyId: string;
  partyName: string;
  walkIn: boolean;
  lines: ReturnLine[];
  at?: string;
  source?: string;
  seller?: string | null;
  total?: string;
  windowDays?: number;
}
export interface ReturnPick {
  refLineId: string;
  qty: number;
}
interface Customer {
  id: string;
  code: number;
  name: string;
  mobile: string | null;
  purchases: number;
  lastAt: string | null;
}
interface History {
  party: { id: string; code: number; name: string; mobile: string | null };
  purchases: Returnable[];
  truncated: boolean;
  windowDays: number;
  summary: { count: number; total: string; items: number; returnable: number };
}

const fa2en = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
/** «POS12» یا عدد کوتاه = رسید/فاکتور؛ بقیه = مشتری */
const receiptCode = (raw: string) => {
  const t = fa2en(raw).trim().toUpperCase();
  if (/^POS\d+$/.test(t)) return t;
  return /^\d{1,7}$/.test(t) ? t : null;
};
const ageDays = (iso?: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : 0);
function ago(iso: string | null | undefined) {
  if (!iso) return "";
  const d = ageDays(iso);
  if (d <= 0) return "امروز";
  if (d === 1) return "دیروز";
  if (d < 31) return `${faNum(d)} روز پیش`;
  if (d < 365) return `${faNum(Math.floor(d / 30))} ماه پیش`;
  return `${faNum(Math.floor(d / 365))} سال پیش`;
}
const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "");

export default function ReturnPicker({
  endpoint,
  initialCode,
  party,
  onSelection,
}: {
  /** `/api/admin/accounting/pos/returnable` (صندوق) یا `/api/admin/accounting/returns` */
  endpoint: string;
  initialCode?: string;
  /** مشتری از پیش انتخاب‌شده — خریدهایش همان اول باز می‌شود */
  party?: { id: string; name: string } | null;
  onSelection: (src: Returnable | null, picks: ReturnPick[], sum: bigint) => void;
}) {
  const [q, setQ] = useState(initialCode ?? "");
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [hist, setHist] = useState<History | null>(null);
  const [single, setSingle] = useState<Returnable | null>(null);
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<{ invoiceId: string; qty: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const view: "search" | "history" | "single" = hist ? "history" : single ? "single" : "search";

  async function loadReceipt(code: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Returnable>(`${endpoint}?q=${encodeURIComponent(code)}`);
      setSingle(r);
      setHist(null);
      const open = r.lines.filter((l) => l.left > 0);
      // یک ردیف تک‌عددی ← همان پیش‌فرض
      setPicked(open.length === 1 && open[0].left === 1 ? { invoiceId: r.invoiceId, qty: { [open[0].refLineId]: 1 } } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "پیدا نشد");
    } finally {
      setBusy(false);
    }
  }

  async function loadCustomer(id: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<History>(`${endpoint}?partyId=${id}`);
      setHist(r);
      setSingle(null);
      setPicked(null);
      setFilter("");
      setTimeout(() => filterRef.current?.focus(), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "باز نشد");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialCode) loadReceipt(initialCode);
    else if (party) loadCustomer(party.id);
    else input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // جستجوی زنده‌ی مشتری
  useEffect(() => {
    const term = q.trim();
    if (view !== "search" || term.length < 2 || /^POS/i.test(fa2en(term))) {
      setCustomers(null);
      return;
    }
    const my = ++seq.current;
    const t = setTimeout(() => {
      api<{ customers: Customer[] }>(`${endpoint}?find=${encodeURIComponent(term)}`)
        .then((d) => my === seq.current && setCustomers(d.customers))
        .catch(() => my === seq.current && setCustomers([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q, view, endpoint]);

  const back = () => {
    setHist(null);
    setSingle(null);
    setPicked(null);
    setError(null);
    setNote(null);
    setTimeout(() => input.current?.focus(), 30);
  };

  function submitSearch() {
    const code = receiptCode(q);
    if (code && (code.startsWith("POS") || code.length <= 6 || !customers?.length)) return loadReceipt(code);
    if (customers?.length) return loadCustomer(customers[0].id);
    if (code) return loadReceipt(code);
  }

  const purchases = useMemo(() => (hist ? hist.purchases : single ? [single] : []), [hist, single]);
  const windowDays = hist?.windowDays ?? single?.windowDays ?? 0;

  // فیلتر خریدها: نام، کد، بارکد، رنگ/سایز
  const term = fa2en(filter).trim().toUpperCase();
  const match = (l: ReturnLine) =>
    !term ||
    l.title.toUpperCase().includes(term) ||
    (l.attrs ?? "").toUpperCase().includes(term) ||
    (l.code ?? "").toUpperCase().includes(term) ||
    (l.barcodes ?? []).some((b) => b.toUpperCase() === term);
  const shown = purchases.map((p) => ({ p, lines: p.lines.filter(match) })).filter((x) => x.lines.length);

  function setQty(p: Returnable, refLineId: string, n: number) {
    const other = picked && picked.invoiceId !== p.invoiceId && Object.values(picked.qty).some((x) => x > 0);
    setNote(other ? "هر مرجوعی از یک فاکتور است — انتخاب فاکتور قبلی برداشته شد" : null);
    setPicked(picked && picked.invoiceId === p.invoiceId ? { invoiceId: p.invoiceId, qty: { ...picked.qty, [refLineId]: n } } : { invoiceId: p.invoiceId, qty: { [refLineId]: n } });
  }
  const pickAll = (p: Returnable) => {
    setNote(null);
    setPicked({ invoiceId: p.invoiceId, qty: Object.fromEntries(p.lines.filter((l) => l.left > 0).map((l) => [l.refLineId, l.left])) });
  };

  // اسکن بارکد کالا در فیلتر ← اولین قلم باز همان کالا یک عدد انتخاب می‌شود
  function onFilterEnter() {
    if (!term) return;
    const hits = shown.flatMap((x) => x.lines.filter((l) => l.left > 0).map((l) => ({ p: x.p, l })));
    const exact = hits.filter(({ l }) => (l.code ?? "").toUpperCase() === term || (l.barcodes ?? []).some((b) => b.toUpperCase() === term));
    const one = exact[0] ?? (hits.length === 1 ? hits[0] : null);
    if (!one) return;
    const cur = picked?.invoiceId === one.p.invoiceId ? (picked.qty[one.l.refLineId] ?? 0) : 0;
    setQty(one.p, one.l.refLineId, Math.min(one.l.left, cur + 1));
    setFilter("");
  }

  const src = purchases.find((p) => p.invoiceId === picked?.invoiceId) ?? null;
  const picks = useMemo(() => (picked ? Object.entries(picked.qty).filter(([, n]) => n > 0).map(([refLineId, qty]) => ({ refLineId, qty })) : []), [picked]);
  const sum = src ? picks.reduce((s, p) => s + BigInt(src.lines.find((l) => l.refLineId === p.refLineId)!.each) * BigInt(p.qty), 0n) : 0n;

  useEffect(() => {
    onSelection(picks.length ? src : null, picks, sum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, src]);

  return (
    <div className="space-y-3">
      {view !== "search" && (
        <div className="flex items-center gap-2">
          <button onClick={back} className="flex items-center gap-1 rounded-xl bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300">
            <ChevronRight className="h-4 w-4" aria-hidden />
            جستجوی دیگر
          </button>
          {hist && (
            <p className="min-w-0 truncate text-sm font-black">
              {hist.party.name}
              {hist.party.mobile && (
                <span className="mr-2 text-xs font-bold text-gray-500 tabular-nums" dir="ltr">
                  {hist.party.mobile}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {view === "search" && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            className="relative"
          >
            <ScanLine className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بارکد رسید را اسکن کنید، یا موبایل / نام مشتری را بنویسید"
              className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 py-3.5 pl-4 pr-12 text-base font-bold outline-none focus:border-rose-400 dark:border-white/10 dark:bg-white/5"
            />
          </form>
          {!q.trim() && (
            <div className="grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
              <p className="flex items-center gap-2 rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
                <ReceiptText className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                رسید دارد؟ بارکدش را اسکن کنید یا شماره‌ی رسید/فاکتور را بزنید.
              </p>
              <p className="flex items-center gap-2 rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
                <UserRound className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                رسید ندارد؟ موبایل، نام یا کارت اشتراک ← همه‌ی خریدهایش.
              </p>
            </div>
          )}
          {(() => {
            const code = receiptCode(q);
            return (
              <div className="space-y-1.5">
                {code && (
                  <button onClick={() => loadReceipt(code)} className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 p-3 text-right hover:border-rose-300 hover:bg-rose-50 dark:border-white/10 dark:hover:bg-rose-500/10">
                    <ReceiptText className="h-5 w-5 text-rose-500" aria-hidden />
                    <span className="text-sm font-black">رسید یا فاکتور شماره‌ی {faNum(code.replace(/^POS/, ""))}</span>
                  </button>
                )}
                {customers?.map((c, k) => (
                  <button
                    key={c.id}
                    onClick={() => loadCustomer(c.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-right hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 ${k === 0 && !code ? "border-rose-200 bg-rose-50/40 dark:border-rose-500/20" : "border-gray-200 dark:border-white/10"}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5">
                      <UserRound className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-gray-900 dark:text-white">{c.name}</span>
                      <span className="text-[11px] text-gray-500 tabular-nums" dir="ltr">
                        {c.mobile ?? `کد ${c.code}`}
                      </span>
                    </span>
                    <span className="text-left text-[11px] text-gray-500">
                      {c.purchases ? `${faNum(c.purchases)} خرید` : "بی‌خرید"}
                      {c.lastAt && <span className="block">آخرین: {ago(c.lastAt)}</span>}
                    </span>
                  </button>
                ))}
                {customers && !customers.length && !code && <p className="px-1 text-xs text-gray-400">مشتری‌ای با این موبایل یا نام پیدا نشد.</p>}
              </div>
            );
          })()}
        </>
      )}

      {busy && <p className="text-xs text-gray-400">در حال جستجو…</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10">{error}</p>}

      {hist && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: "خرید", v: faNum(hist.summary.count) },
              { k: "جمع خرید", v: formatAmount(hist.summary.total) },
              { k: "قابل برگشت", v: `${faNum(hist.summary.returnable)} عدد` },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-gray-50 px-2 py-2 dark:bg-white/5">
                <p className="text-[10px] text-gray-500">{x.k}</p>
                <p className="text-sm font-black tabular-nums">{x.v}</p>
              </div>
            ))}
          </div>
          {hist.purchases.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onFilterEnter();
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                ref={filterRef}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="بارکد کالای برگشتی را اسکن کنید یا نام، کد، رنگ…"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm outline-none focus:border-rose-400 dark:border-white/10 dark:bg-white/5"
              />
            </form>
          )}
          {!hist.purchases.length && <p className="rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-500 dark:bg-white/5">برای این مشتری خریدی ثبت نشده.</p>}
          {hist.purchases.length > 0 && !shown.length && <p className="text-xs text-gray-400">در خریدهای این مشتری کالایی با «{filter}» نیست.</p>}
        </>
      )}

      {note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-500/10">{note}</p>}

      {shown.map(({ p, lines }) => {
        const open = p.lines.reduce((s, l) => s + l.left, 0);
        const active = picked?.invoiceId === p.invoiceId && Object.values(picked.qty).some((n) => n > 0);
        const late = windowDays > 0 && ageDays(p.at ?? p.date) > windowDays;
        return (
          <div
            key={p.invoiceId}
            className={`overflow-hidden rounded-2xl border ${active ? "border-rose-300 ring-2 ring-rose-100 dark:border-rose-500/40 dark:ring-rose-500/10" : "border-gray-200 dark:border-white/10"} ${open ? "" : "opacity-60"}`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gray-50 px-3 py-2.5 dark:bg-white/[0.03]">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-gray-900 dark:text-white">
                  {formatJalali(new Date(p.at ?? p.date))}
                  {p.at && <span className="mr-1.5 text-xs font-bold text-gray-500">{timeOf(p.at)}</span>}
                  <span className="mr-2 text-[11px] font-bold text-gray-400">{ago(p.at ?? p.date)}</span>
                  {late && open > 0 && (
                    <span className="mr-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">بیش از مهلت {faNum(windowDays)} روزه</span>
                  )}
                </p>
                <p className="text-[11px] text-gray-500">
                  {p.ticketNumber ? `رسید ${faNum(p.ticketNumber)} · ` : ""}فاکتور {faNum(p.invoiceNumber ?? 0)}
                  {p.source && ` · ${p.source}`}
                  {p.seller && ` · فروشنده ${p.seller}`}
                  {!hist && ` · ${p.partyName}`}
                </p>
              </div>
              {p.total && <span className="text-sm font-black tabular-nums">{formatAmount(p.total)}</span>}
              {open > 0 ? (
                <button onClick={() => pickAll(p)} className="rounded-lg bg-rose-100 px-2.5 py-1.5 text-[11px] font-black text-rose-700 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-300">
                  همه‌ی این فاکتور
                </button>
              ) : (
                <span className="text-[11px] font-bold text-gray-400">کامل برگشت شده</span>
              )}
            </div>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {lines.map((l) => {
                const n = picked?.invoiceId === p.invoiceId ? (picked.qty[l.refLineId] ?? 0) : 0;
                return (
                  <div key={l.refLineId} className={`flex items-center gap-3 px-3 py-2.5 ${n > 0 ? "bg-rose-50 dark:bg-rose-500/10" : ""}`}>
                    {l.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="h-12 w-12 shrink-0 rounded-xl bg-gray-100 dark:bg-white/5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-900 dark:text-white">{l.title}</p>
                      <p className="text-[11px] text-gray-500">
                        {l.attrs && <span className="font-bold text-gray-700 dark:text-gray-300">{l.attrs} · </span>}
                        {l.code && <span className="tabular-nums">{l.code} · </span>}
                        خرید {faNum(l.qty)}
                        {l.left < l.qty && <span className="text-rose-600"> · برگشته {faNum(l.qty - l.left)}</span>} · هر عدد {formatAmount(l.each)}
                      </p>
                    </div>
                    {l.left > 0 ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(p, l.refLineId, Math.max(0, n - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5" aria-label="کم">
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <span className="w-8 text-center text-lg font-black tabular-nums">{faNum(n)}</span>
                        <button onClick={() => setQty(p, l.refLineId, Math.min(l.left, n + 1))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5" aria-label="زیاد">
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
          </div>
        );
      })}
      {hist?.truncated && <p className="text-[11px] text-amber-600">فقط ۱۵۰ خرید آخر آمده است.</p>}
    </div>
  );
}

/** دلیل‌های پرکاربرد مرجوعی — در گزارش «مرجوعی‌ها» دسته‌بندی می‌شوند */
export const RETURN_REASONS = ["سایز", "رنگ یا مدل", "ایراد یا خرابی", "پشیمانی مشتری", "اشتباه در فروش"];

export function ReturnReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const preset = RETURN_REASONS.includes(value);
  const [other, setOther] = useState(!!value && !preset);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-gray-500">دلیل:</span>
      {RETURN_REASONS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => (setOther(false), onChange(value === r ? "" : r))}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${value === r ? "bg-rose-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300"}`}
        >
          {r}
        </button>
      ))}
      <button
        type="button"
        onClick={() => (setOther(true), preset && onChange(""))}
        className={`rounded-full px-3 py-1.5 text-xs font-bold ${other ? "bg-rose-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300"}`}
      >
        دیگر…
      </button>
      {other && (
        <input
          autoFocus
          value={preset ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="دلیل را بنویسید"
          maxLength={200}
          className="min-w-[10rem] flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-rose-400 dark:border-white/10 dark:bg-white/5"
        />
      )}
    </div>
  );
}
