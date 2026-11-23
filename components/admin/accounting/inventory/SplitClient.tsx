"use client";

/**
 * تفکیک خرید به رنگ و سایز — docs/plans/inventory-items.md بخش ۱۶.
 *
 * فاکتور خرید با یک ردیف تجمیعی ثبت شده («بافت یقه‌دار» × ۵۱). اینجا ردیف را باز
 * می‌کنید، رنگ‌ها و سایزها را می‌زنید، تعداد هر خانه را می‌نویسید و «ثبت و چاپ»
 * (F9): ردیف فاکتور به تنوع‌ها شکسته می‌شود (جمع فاکتور ثابت)، موجودی روی هر
 * رنگ/سایز می‌نشیند و برچسب‌ها در زبانه‌ی تازه آماده‌ی چاپ است.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, Scissors, X } from "lucide-react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import InventoryTabs from "./InventoryTabs";
import { cellKey, ValuePicker } from "./RelabelClient";
import { api, btn, Card, Empty, ErrorText, PageHeader, SectionTitle, inputCls } from "../ui";

interface Axis {
  id: string;
  name: string;
  values: { id: string; value: string }[];
  popular: string[];
}
interface Line {
  lineId: string;
  invoiceId: string;
  invoiceNumber: number | null;
  date: string;
  partyName: string;
  seq: number;
  itemId: string;
  itemCode: string;
  title: string;
  qty: number;
  unitPrice: string;
}
interface View {
  line: Line & { warehouseId: string | null; stock: number; salePrice: string | null };
  model: { id: string | null; base: string; code: string | null };
  axes: Axis[];
  items: { id: string; code: string; title: string; attrs: Record<string, string> }[];
}

const GRID_AXES = ["رنگ", "سایز"];

export default function SplitClient() {
  const sp = useSearchParams();
  const invoiceId = sp?.get("invoice") ?? "";
  const [list, setList] = useState<Line[] | null>(null);
  const [manage, setManage] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = useCallback(async (lineId: string) => {
    setError(null);
    setNote(null);
    try {
      const d = await api<{ view: View }>(`/api/admin/accounting/items/split?line=${encodeURIComponent(lineId)}`);
      setView(d.view);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "باز نشد");
    }
  }, []);

  // از صفحه‌ی فاکتور: اگر فقط یک ردیف تفکیک‌شدنی دارد، همان باز می‌شود
  const autoOpened = useRef(false);
  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (invoiceId) p.set("invoice", invoiceId);
    if (q.trim()) p.set("q", q.trim());
    api<{ list: Line[]; can: { manage: boolean } }>(`/api/admin/accounting/items/split?${p}`)
      .then((d) => {
        setList(d.list);
        setManage(d.can.manage);
        if (invoiceId && d.list.length === 1 && !autoOpened.current) {
          autoOpened.current = true;
          open(d.list[0].lineId);
        }
      })
      .catch((e) => setError(e.message));
  }, [invoiceId, q, open]);
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div className="space-y-4">
      <PageHeader title="کالا و انبار" help="accountingSplit" />
      <InventoryTabs />

      {view && (
        <Worksheet
          key={view.line.lineId + view.line.qty}
          view={view}
          manage={manage}
          busy={busy}
          setBusy={setBusy}
          onError={setError}
          onDone={(v, msg) => {
            setNote(msg);
            setView(v);
            load();
          }}
          onClose={() => setView(null)}
        />
      )}
      <ErrorText>{error}</ErrorText>
      {note && <p className="text-sm font-bold text-emerald-600">{note}</p>}

      <Card className="overflow-hidden">
        <div className="p-4 space-y-3">
          <SectionTitle title={invoiceId ? "ردیف‌های این فاکتور" : "ردیف‌های خرید بی رنگ/سایز"} />
          <p className="text-xs text-gray-500 leading-6">
            فاکتور خرید را با یک ردیف برای هر جنس ثبت کنید (مثلاً «بافت یقه‌دار» × ۵۱). بعد اینجا ردیف را باز کنید و تعداد هر رنگ و سایز را بنویسید. جمع فاکتور عوض نمی‌شود.
          </p>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} placeholder="جستجو در نام کالا یا تأمین‌کننده" />
            {invoiceId && (
              <Link href="/admin/accounting/inventory/split" className={btn.soft}>
                همه‌ی فاکتورها
              </Link>
            )}
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {list?.map((l) => (
            <button
              key={l.lineId}
              onClick={() => open(l.lineId)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-white/5 ${view?.line.lineId === l.lineId ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold truncate">{l.title}</span>
                <span className="text-[11px] text-gray-400">
                  خرید {l.invoiceNumber ? faNum(l.invoiceNumber) : "—"} · {formatJalali(new Date(l.date))} · {l.partyName}
                </span>
              </span>
              <span className="text-xs text-gray-500 shrink-0">{formatAmount(l.unitPrice)}</span>
              <span className="text-sm font-black shrink-0 w-14 text-center">{faNum(l.qty)}</span>
              <Scissors className="h-4 w-4 text-blue-600 shrink-0" aria-hidden />
            </button>
          ))}
          {list && !list.length && (
            <Empty
              title="ردیفی برای تفکیک نیست"
              desc="ردیف‌های فاکتور خرید صادرشده که کالایشان هنوز رنگ/سایز ندارد اینجا می‌آیند."
              action={
                <Link href="/admin/accounting/invoices/new?type=PURCHASE" className={btn.primary}>
                  فاکتور خرید تازه
                </Link>
              }
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function Worksheet({
  view,
  manage,
  busy,
  setBusy,
  onError,
  onDone,
  onClose,
}: {
  view: View;
  manage: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onError: (m: string | null) => void;
  onDone: (v: View | null, msg: string) => void;
  onClose: () => void;
}) {
  const L = view.line;
  const valueName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of view.axes) for (const v of a.values) m.set(v.id, v.value);
    return m;
  }, [view.axes]);
  const gridAxes = view.axes.filter((a) => GRID_AXES.includes(a.name));
  const fixedAxes = view.axes.filter((a) => !GRID_AXES.includes(a.name));
  const [fixed, setFixed] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState<Record<string, string>>({});

  // پیشنهاد: رنگ/سایزهای همین مدل اول، بعد پرکاربردهای فروشگاه
  const suggestions = (a: Axis) => {
    const used = new Set(view.items.map((i) => i.attrs[a.id]).filter(Boolean).map((id) => valueName.get(id)!));
    return [...used, ...a.popular.filter((v) => !used.has(v))];
  };

  const [rowAxis, colAxis] = gridAxes.length === 2 ? gridAxes : [gridAxes[0], undefined];
  const rowVals = rowAxis ? (picked[rowAxis.id]?.length ? picked[rowAxis.id] : [""]) : [""];
  const colVals = colAxis ? (picked[colAxis.id]?.length ? picked[colAxis.id] : [""]) : [""];
  const total = Object.entries(qty)
    .filter(([k]) => {
      const [r, c = ""] = k.split("\u0001");
      return rowVals.includes(r) && (colAxis ? colVals.includes(c) : true);
    })
    .reduce((s, [, v]) => s + (Number(v) || 0), 0);
  const left = L.qty - total;

  const existingFor = (vals: string[]) => {
    const want: Record<string, string> = {};
    gridAxes.forEach((a, i) => vals[i] && (want[a.id] = vals[i]));
    for (const a of fixedAxes) if (fixed[a.id]?.trim()) want[a.id] = fixed[a.id].trim();
    return view.items.find((it) => {
      const names = Object.fromEntries(Object.entries(it.attrs).map(([k, v]) => [k, valueName.get(v) ?? ""]));
      return Object.keys(names).length === Object.keys(want).length && Object.entries(want).every(([k, v]) => names[k] === v);
    });
  };

  /** باقی‌مانده را در خانه‌ی خالی بعدی بگذار — برای آخرین خانه */
  const fillRest = (k: string) => {
    const cur = Number(qty[k]) || 0;
    if (left > 0) setQty({ ...qty, [k]: String(cur + left) });
  };

  async function commit() {
    if (!manage || busy) return;
    const rows: { values: Record<string, string>; qty: number }[] = [];
    for (const r of rowVals)
      for (const c of colVals) {
        const vals = colAxis ? [r, c] : [r];
        const n = Number(qty[cellKey(vals)] ?? 0) || 0;
        if (n <= 0) continue;
        const values: Record<string, string> = {};
        gridAxes.forEach((a, i) => vals[i] && (values[a.id] = vals[i]));
        for (const a of fixedAxes) if (fixed[a.id]?.trim()) values[a.id] = fixed[a.id].trim();
        rows.push({ values, qty: n });
      }
    if (!rows.length) return onError("رنگ/سایز را بزنید و تعداد دست‌کم یک خانه را بنویسید");
    if (total > L.qty) return onError(`جمع خانه‌ها ${faNum(total)} است؛ این ردیف ${faNum(L.qty)} عدد دارد`);
    if (left > 0 && !window.confirm(`${faNum(left)} عدد از «${L.title}» تفکیک نمی‌شود و روی همان ردیف می‌ماند (بعداً هم می‌شود تفکیکش کرد). ادامه؟`)) return;
    onError(null);
    setBusy(true);
    const win = window.open("", "_blank");
    try {
      const d = await api<{ items: { itemId: string; qty: number }[]; remainder: number; view: View | null }>("/api/admin/accounting/items/split", {
        method: "POST",
        json: { lineId: L.lineId, rows },
      });
      const url = `/admin/accounting/inventory/labels/print?items=${d.items.map((i) => `${i.itemId}:${i.qty}`).join(",")}`;
      if (win) win.location.href = url;
      else window.open(url, "_blank");
      onDone(
        d.view,
        `«${L.title}» به ${faNum(d.items.length)} رنگ/سایز تفکیک شد و ${faNum(d.items.reduce((s, i) => s + i.qty, 0))} برچسب آماده‌ی چاپ است${d.remainder ? ` — ${faNum(d.remainder)} عدد مانده` : ""}`,
      );
    } catch (e) {
      win?.close();
      onError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Card className="p-4 space-y-4 ring-2 ring-blue-500/30">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-black">{L.title}</p>
          <p className="text-xs text-gray-500 mt-1 leading-6">
            <Link href={`/admin/accounting/invoices/${L.invoiceId}`} className="text-blue-600 hover:underline">
              خرید {L.invoiceNumber ? faNum(L.invoiceNumber) : "—"}
            </Link>{" "}
            · {L.partyName} · فی {formatAmount(L.unitPrice)}
            {L.salePrice && <> · قیمت فروش {formatAmount(L.salePrice)}</>}
            {view.model.code && (
              <>
                {" "}· پیشوند کد <b dir="ltr" className="font-mono">{view.model.code}</b>
              </>
            )}
          </p>
        </div>
        <button onClick={onClose} className={btn.small} aria-label="بستن">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Mini label="تعداد در فاکتور" value={faNum(L.qty)} />
        <Mini label="نوشته‌شده" value={faNum(total)} tone={total > L.qty ? "text-red-600" : ""} />
        <Mini label="مانده" value={faNum(Math.max(0, left))} tone={left === 0 ? "text-emerald-600" : left < 0 ? "text-red-600" : "text-amber-600"} />
      </div>

      {fixedAxes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {fixedAxes.map((a) => (
            <label key={a.id} className="block">
              <span className="block text-[11px] font-bold text-gray-500 mb-1">{a.name}</span>
              <input list={`sx-${a.id}`} value={fixed[a.id] ?? ""} onChange={(e) => setFixed({ ...fixed, [a.id]: e.target.value })} className={inputCls} placeholder="—" />
              <datalist id={`sx-${a.id}`}>
                {a.values.map((v) => (
                  <option key={v.id} value={v.value} />
                ))}
              </datalist>
            </label>
          ))}
        </div>
      )}

      {gridAxes.map((a) => (
        <ValuePicker key={a.id} axis={a} picked={picked[a.id] ?? []} suggestions={suggestions(a)} onChange={(vals) => setPicked({ ...picked, [a.id]: vals })} />
      ))}

      <div className="overflow-x-auto">
        <table className="text-sm border-separate border-spacing-1">
          {colAxis && (
            <thead>
              <tr>
                <th />
                {colVals.map((c) => (
                  <th key={c} className="px-1 text-xs font-black">
                    {c || "—"}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rowVals.map((r) => (
              <tr key={r}>
                <th className="pl-2 text-xs font-black text-right whitespace-nowrap">{r || (rowAxis ? "—" : "تعداد")}</th>
                {colVals.map((c) => {
                  const vals = colAxis ? [r, c] : [r];
                  const k = cellKey(vals);
                  const ex = existingFor(vals);
                  return (
                    <td key={k} className="align-top">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={qty[k] ?? ""}
                        onChange={(e) => setQty({ ...qty, [k]: e.target.value })}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          // «=» یا «*» = همه‌ی مانده در همین خانه
                          if (e.key === "=" || e.key === "*") {
                            e.preventDefault();
                            fillRest(k);
                          }
                        }}
                        className="w-16 px-2 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-center font-bold"
                        placeholder="۰"
                      />
                      {ex && (
                        <span dir="ltr" className="block text-center font-mono text-[9px] text-gray-400 mt-0.5" title={ex.title}>
                          {ex.code}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">
        Tab = خانه‌ی بعدی · در یک خانه «=» بزنید تا همه‌ی مانده آنجا نوشته شود · F9 = ثبت و چاپ · Esc = بستن
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={commit} disabled={!manage || busy || total <= 0 || total > L.qty} className={btn.primary}>
          <Printer className="h-4 w-4" aria-hidden />
          {busy ? "…" : `ثبت و چاپ ${faNum(total)} برچسب`}
          <kbd className="text-[10px] opacity-70 font-mono">F9</kbd>
        </button>
        {!manage && <span className="text-xs text-amber-600">ثبت تفکیک مجوز «خرید» و «کالا و انبار» می‌خواهد</span>}
        {L.stock < L.qty && (
          <span className="text-xs text-amber-600">موجودی فعلی این کالا در انبار فاکتور {faNum(L.stock)} عدد است؛ بیش از آن تفکیک نمی‌شود.</span>
        )}
      </div>
    </Card>
  );
}

function Mini({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 py-2">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={`text-lg font-black ${tone}`}>{value}</p>
    </div>
  );
}
