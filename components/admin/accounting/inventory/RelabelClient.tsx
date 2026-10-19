"use client";

/**
 * برچسب‌گذاری دوباره و تفکیک کد قبلی — docs/plans/inventory-items.md بخش ۱۲.
 *
 * فروشنده کد قبلی (یا کد تازه) را اسکن می‌کند، رنگ و سایزهای جنس‌های همان کد
 * را می‌زند و تعداد هر خانه را می‌نویسد؛ «ساخت کد و چاپ» تنوع‌های نبود را با
 * کد خودکار می‌سازد و برچسب همان تعداد را در زبانه‌ی تازه آماده‌ی چاپ می‌کند.
 * میانبرها: Enter در کادر اسکن = جستجو، F9 = ساخت و چاپ، Esc = کد بعدی.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Printer, ScanLine, X } from "lucide-react";
import { faNum, formatAmount } from "@/lib/accounting/money";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, PageHeader, SectionTitle, Stat, inputCls } from "../ui";

interface Axis {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}
interface View {
  legacy: { code: string; source: string; title: string; legacyQty: number; labeled: number; salePrice: string | null; attrs: Record<string, string> } | null;
  model: { id: string; title: string; base: string; code: string | null; specs: Record<string, string>; unit: string; groupName: string | null };
  axes: Axis[];
  items: { id: string; code: string; title: string; salePrice: string | null; attrs: Record<string, string>; labeled: number }[];
  hitItemId: string | null;
}
type Status = "todo" | "partial" | "done";
interface Progress {
  stats: { codes: number; mixed: number; legacyQty: number; labeled: number; todo: number; partial: number; done: number };
  list: { code: string; title: string; group: string | null; legacyQty: number; labeled: number; status: Status; mixed: boolean }[];
  can: { manage: boolean };
}

/** دو محوری که جدول خانه‌ای می‌سازند — بقیه «ثابت» همان کدند */
const GRID_AXES = ["رنگ", "سایز"];
const STATUS_LABEL: Record<Status, string> = { todo: "مانده", partial: "نیمه‌کاره", done: "انجام‌شده" };
const STATUS_TONE: Record<Status, "gray" | "amber" | "green"> = { todo: "gray", partial: "amber", done: "green" };

export default function RelabelClient() {
  const [scan, setScan] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [status, setStatus] = useState<Status | "">("todo");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const loadProgress = useCallback(() => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    api<Progress>(`/api/admin/accounting/items/relabel?${sp}`)
      .then(setProgress)
      .catch((e) => setError(e.message));
  }, [status, q]);
  useEffect(() => {
    const t = setTimeout(loadProgress, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadProgress, q]);

  const open = useCallback(async (code: string) => {
    const c = code.trim();
    if (!c) return;
    setError(null);
    setNote(null);
    try {
      const d = await api<{ view: View }>(`/api/admin/accounting/items/relabel?code=${encodeURIComponent(c)}`);
      setView(d.view);
      setScan("");
    } catch (e) {
      setView(null);
      setError(e instanceof Error ? e.message : "پیدا نشد");
      scanRef.current?.select();
    }
  }, []);

  async function reprint(code: string) {
    setError(null);
    const win = window.open("", "_blank");
    try {
      const d = await api<{ view: View }>(`/api/admin/accounting/items/relabel?code=${encodeURIComponent(code)}`);
      const url = reprintUrl(d.view);
      if (!url) throw new Error("برای این کد هنوز برچسبی ساخته نشده");
      if (win) win.location.href = url;
      else window.open(url, "_blank");
    } catch (e) {
      win?.close();
      setError(e instanceof Error ? e.message : "پیدا نشد");
    }
  }

  const next = useCallback(() => {
    setView(null);
    setScan("");
    setTimeout(() => scanRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && view) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, next]);

  const s = progress?.stats;
  const manage = !!progress?.can.manage;

  return (
    <div className="space-y-4">
      <PageHeader title="کالا و انبار" help="accountingRelabel" />
      <InventoryTabs />
      {s && s.codes > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="کدهای قبلی" value={faNum(s.codes)} sub={`${faNum(s.mixed)} کد چند رنگ/سایزی`} />
          <Stat label="برچسب زده‌شده" value={faNum(s.labeled)} sub={`از ${faNum(s.legacyQty)} عدد موجودی قبلی`} tone="blue" />
          <Stat label="انجام‌شده" value={faNum(s.done)} sub={`${faNum(s.partial)} نیمه‌کاره`} tone="green" />
          <Stat label="مانده" value={faNum(s.todo)} tone="amber" />
        </div>
      )}

      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            open(scan);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" aria-hidden />
            <input
              ref={scanRef}
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              autoFocus
              className={`${inputCls} pr-11 text-base font-mono`}
              dir="ltr"
              placeholder="کد قبلی یا کد تازه را اسکن کنید"
            />
          </div>
          <button className={btn.dark}>باز کن</button>
        </form>
        <ErrorText>{error}</ErrorText>
        {note && <p className="mt-2 text-sm font-bold text-emerald-600">{note}</p>}
      </Card>

      {view && (
        <Worksheet
          key={`${view.model.id}:${view.legacy?.code ?? ""}`}
          view={view}
          manage={manage}
          busy={busy}
          setBusy={setBusy}
          onDone={(v, msg) => {
            setNote(msg);
            if (v) setView(v);
            loadProgress();
          }}
          onError={setError}
          onClose={next}
        />
      )}

      {progress && progress.stats.codes > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 space-y-3">
            <SectionTitle title="کدهای نرم‌افزار قبلی" />
            <Chips
              value={status}
              onChange={setStatus}
              options={[
                { value: "todo", label: STATUS_LABEL.todo, count: progress.stats.todo },
                { value: "partial", label: STATUS_LABEL.partial, count: progress.stats.partial },
                { value: "done", label: STATUS_LABEL.done, count: progress.stats.done },
                { value: "", label: "همه", count: progress.stats.codes },
              ]}
            />
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} placeholder="جستجو در نام، کد یا گروه" />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {progress.list.map((r) => (
              <button key={r.code} onClick={() => open(r.code)} className="w-full flex items-center gap-3 px-4 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-white/5">
                <span dir="ltr" className="font-mono text-xs text-gray-500 w-24 shrink-0 text-left">
                  {r.code}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{r.title}</span>
                  <span className="text-[11px] text-gray-400">
                    {r.group ?? "بی‌گروه"}
                    {r.mixed ? " · چند رنگ/سایز زیر یک کد" : ""}
                  </span>
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {faNum(r.labeled)} / {faNum(r.legacyQty)}
                </span>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                {r.labeled > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      reprint(r.code);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        reprint(r.code);
                      }
                    }}
                    className={btn.small}
                    title="چاپ دوباره‌ی برچسب‌های این کد"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden />
                    چاپ مجدد
                  </span>
                )}
              </button>
            ))}
            {!progress.list.length && <p className="p-6 text-center text-sm text-gray-400">موردی نیست</p>}
          </div>
        </Card>
      )}
      {progress && progress.stats.codes === 0 && !view && (
        <Empty
          title="کد قبلی وارد نشده"
          desc="وقتی کالاهای نرم‌افزار قبلی منتقل شوند، اینجا فهرست می‌شوند. همین حالا هم می‌توانید کد تازه‌ی هر کالای مدل‌دار را اسکن کنید و تنوع تازه بسازید یا برچسب بزنید."
        />
      )}
    </div>
  );
}

function Worksheet({
  view,
  manage,
  busy,
  setBusy,
  onDone,
  onError,
  onClose,
}: {
  view: View;
  manage: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: (v: View | null, msg: string) => void;
  onError: (m: string | null) => void;
  onClose: () => void;
}) {
  const valueName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of view.axes) for (const v of a.values) m.set(v.id, v.value);
    return m;
  }, [view.axes]);
  const gridAxes = view.axes.filter((a) => GRID_AXES.includes(a.name));
  const fixedAxes = view.axes.filter((a) => !GRID_AXES.includes(a.name));
  const preset = view.legacy?.attrs ?? (view.hitItemId ? (view.items.find((i) => i.id === view.hitItemId)?.attrs ?? {}) : {});

  // ثابت‌ها: مقدار کد قبلی، وگرنه اگر همه‌ی تنوع‌های مدل یک مقدار دارند همان
  const [fixed, setFixed] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fixedAxes.map((a) => {
        if (preset[a.id]) return [a.id, valueName.get(preset[a.id]) ?? ""];
        const used = [...new Set(view.items.map((i) => i.attrs[a.id]).filter(Boolean))];
        return [a.id, used.length === 1 ? (valueName.get(used[0]) ?? "") : ""];
      }),
    ),
  );
  // مقدارهای انتخاب‌شده‌ی هر محور جدول — پیش‌فرض: مقدار معلوم کد قبلی
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(gridAxes.map((a) => [a.id, preset[a.id] ? [valueName.get(preset[a.id]) ?? ""] : []])),
  );
  const [qty, setQty] = useState<Record<string, string>>(() => {
    // کد قبلیِ یک‌به‌یک: همان یک خانه با موجودی قبلی منهای برچسب‌های زده‌شده
    if (view.legacy && gridAxes.every((a) => preset[a.id])) {
      const left = Math.max(0, view.legacy.legacyQty - view.legacy.labeled);
      return left ? { [cellKey(gridAxes.map((a) => valueName.get(preset[a.id]) ?? ""))]: String(left) } : {};
    }
    return {};
  });

  const suggestions = (a: Axis) => {
    const used = new Set(view.items.map((i) => i.attrs[a.id]).filter(Boolean));
    return a.values.filter((v) => used.has(v.id)).map((v) => v.value);
  };

  const [rowAxis, colAxis] = gridAxes.length === 2 ? gridAxes : [gridAxes[0], undefined];
  const rowVals = rowAxis ? (picked[rowAxis.id]?.length ? picked[rowAxis.id] : [""]) : [""];
  const colVals = colAxis ? (picked[colAxis.id]?.length ? picked[colAxis.id] : [""]) : [""];

  const existingFor = (vals: string[]) => {
    const want: Record<string, string> = {};
    gridAxes.forEach((a, i) => vals[i] && (want[a.id] = vals[i]));
    for (const a of fixedAxes) if (fixed[a.id]?.trim()) want[a.id] = fixed[a.id].trim();
    return view.items.find((it) => {
      const names = Object.fromEntries(Object.entries(it.attrs).map(([k, v]) => [k, valueName.get(v) ?? ""]));
      return Object.keys(names).length === Object.keys(want).length && Object.entries(want).every(([k, v]) => names[k] === v);
    });
  };

  const total = Object.values(qty).reduce((s, v) => s + (Number(v) || 0), 0);

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
    if (!rows.length) return onError("تعداد دست‌کم یک خانه را بنویسید");
    onError(null);
    setBusy(true);
    // پنجره‌ی چاپ همین حالا باز می‌شود تا مرورگر جلویش را نگیرد
    const win = window.open("", "_blank");
    try {
      const d = await api<{ items: { itemId: string; qty: number }[]; view: View | null }>("/api/admin/accounting/items/relabel", {
        method: "POST",
        json: { modelId: view.model.id, legacyCode: view.legacy?.code ?? null, rows },
      });
      const url = `/admin/accounting/inventory/labels/print?items=${d.items.filter((i) => i.qty > 0).map((i) => `${i.itemId}:${i.qty}`).join(",")}`;
      if (win) win.location.href = url;
      else window.open(url, "_blank");
      setQty({});
      onDone(d.view, `${faNum(d.items.reduce((s, i) => s + i.qty, 0))} برچسب برای ${faNum(d.items.length)} کالا آماده‌ی چاپ شد`);
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const L = view.legacy;
  const left = L ? L.legacyQty - L.labeled : null;

  return (
    <Card className="p-4 space-y-4 ring-2 ring-blue-500/30">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-black">{L?.title ?? view.model.base}</p>
          <p className="text-xs text-gray-500 mt-1 leading-6">
            {L && (
              <>
                کد قبلی <b dir="ltr" className="font-mono">{L.code}</b> ·{" "}
              </>
            )}
            {view.model.groupName ?? "بی‌گروه"}
            {view.model.code && (
              <>
                {" "}· پیشوند کد تازه <b dir="ltr" className="font-mono">{view.model.code}</b>
              </>
            )}
            {Object.entries(view.model.specs).map(([k, v]) => (
              <span key={k}>
                {" "}· {k}: {v}
              </span>
            ))}
          </p>
        </div>
        <button onClick={onClose} className={btn.small} aria-label="بستن">
          <X className="h-4 w-4" />
        </button>
      </div>
      {L && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="موجودی قبلی" value={faNum(L.legacyQty)} />
          <Mini label="برچسب زده‌شده" value={faNum(L.labeled)} />
          <Mini label="مانده" value={faNum(Math.max(0, left ?? 0))} tone={left && left > 0 ? "text-amber-600" : "text-emerald-600"} />
        </div>
      )}
      {L?.salePrice && <p className="text-xs text-gray-500">قیمت فروش: {formatAmount(L.salePrice)} تومان</p>}

      {fixedAxes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {fixedAxes.map((a) => (
            <label key={a.id} className="block">
              <span className="block text-[11px] font-bold text-gray-500 mb-1">{a.name}</span>
              <input list={`ax-${a.id}`} value={fixed[a.id] ?? ""} onChange={(e) => setFixed({ ...fixed, [a.id]: e.target.value })} className={inputCls} placeholder="—" />
              <datalist id={`ax-${a.id}`}>
                {a.values.map((v) => (
                  <option key={v.id} value={v.value} />
                ))}
              </datalist>
            </label>
          ))}
        </div>
      )}

      {gridAxes.map((a) => (
        <ValuePicker
          key={a.id}
          axis={a}
          picked={picked[a.id] ?? []}
          suggestions={suggestions(a)}
          onChange={(vals) => setPicked({ ...picked, [a.id]: vals })}
        />
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
                        className="w-16 px-2 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-center font-bold"
                        placeholder="۰"
                      />
                      {ex && (
                        <span dir="ltr" className="block text-center font-mono text-[9px] text-gray-400 mt-0.5" title={ex.title}>
                          {ex.code}
                          {ex.labeled ? ` ✓${ex.labeled}` : ""}
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

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={commit} disabled={!manage || busy || total <= 0} className={btn.primary}>
          <Printer className="h-4 w-4" aria-hidden />
          {busy ? "…" : `ساخت کد و چاپ ${faNum(total)} برچسب`}
          <kbd className="text-[10px] opacity-70 font-mono">F9</kbd>
        </button>
        <button onClick={onClose} className={btn.soft}>
          کد بعدی <kbd className="text-[10px] opacity-70 font-mono">Esc</kbd>
        </button>
        {reprintUrl(view) && (
          <a href={reprintUrl(view)!} target="_blank" rel="noopener" className={btn.soft}>
            <Printer className="h-4 w-4" aria-hidden />
            چاپ مجدد {faNum(view.items.reduce((s, i) => s + i.labeled, 0))} برچسب قبلی
          </a>
        )}
        {L && left !== null && total > 0 && total !== left && left > 0 && (
          <span className="text-xs text-amber-600">جمع خانه‌ها {faNum(total)} است و مانده‌ی کد قبلی {faNum(left)}</span>
        )}
      </div>

      {view.items.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-gray-500 mb-1.5">کدهای تازه‌ی این مدل</p>
          <div className="flex flex-wrap gap-1.5">
            {view.items.map((i) => (
              <span key={i.id} className={`text-[11px] px-2 py-1 rounded-lg ${i.id === view.hitItemId ? "bg-blue-100 dark:bg-blue-500/20" : "bg-gray-100 dark:bg-white/5"}`}>
                <b dir="ltr" className="font-mono">
                  {i.code}
                </b>{" "}
                {Object.values(i.attrs)
                  .map((v) => valueName.get(v))
                  .filter(Boolean)
                  .join(" ")}
                {i.labeled > 0 && <span className="text-emerald-600"> · {faNum(i.labeled)} برچسب</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

const cellKey = (vals: string[]) => vals.join("\u0001");

/** چاپ دوباره‌ی برچسب‌های زده‌شده‌ی یک کد — همان تعداد هر کالا؛ تعداد در صفحه‌ی چاپ قابل تغییر است */
const reprintUrl = (v: View) => {
  const items = v.items.filter((i) => i.labeled > 0);
  return items.length ? `/admin/accounting/inventory/labels/print?items=${items.map((i) => `${i.id}:${i.labeled}`).join(",")}` : null;
};

function Mini({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 py-2">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={`text-lg font-black ${tone}`}>{value}</p>
    </div>
  );
}

/** انتخاب چند مقدار: چیپ‌های انتخاب‌شده، پیشنهاد مدل، و کادر با فهرست همه‌ی مقدارها (Enter = افزودن) */
function ValuePicker({ axis, picked, suggestions, onChange }: { axis: Axis; picked: string[]; suggestions: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = (v: string) => {
    const t = v.replace(/\s+/g, " ").trim();
    if (t && !picked.includes(t)) onChange([...picked, t]);
    setText("");
  };
  const extra = suggestions.filter((s) => !picked.includes(s));
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-500 mb-1.5">{axis.name}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {picked.map((v) => (
          <button key={v} type="button" onClick={() => onChange(picked.filter((x) => x !== v))} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-900 text-white dark:bg-white dark:text-gray-900">
            {v} ×
          </button>
        ))}
        {extra.map((v) => (
          <button key={v} type="button" onClick={() => add(v)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
            + {v}
          </button>
        ))}
        <input
          list={`pick-${axis.id}`}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            // کلیک روی پیشنهاد فهرست مرورگر (نه تایپ «آبی» در راهِ «آبی روشن») بی Enter اضافه می‌شود
            const picking = (e.nativeEvent as InputEvent).inputType === "insertReplacementText" || !(e.nativeEvent as InputEvent).inputType;
            if (picking && axis.values.some((x) => x.value === v)) add(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            }
          }}
          className="w-32 px-2.5 py-1.5 rounded-lg text-xs border border-dashed border-gray-300 dark:border-white/20 bg-transparent outline-none focus:border-blue-400"
          placeholder={`+ ${axis.name}`}
        />
        <datalist id={`pick-${axis.id}`}>
          {axis.values.map((v) => (
            <option key={v.id} value={v.value} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
