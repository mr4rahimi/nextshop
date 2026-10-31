"use client";

/**
 * مکان قرارگیری کالا — docs/plans/webhesab-parity.md بخش ۱۱.
 * یک انبار: فهرست با ویرایش در جا و تعیین گروهی، اسکن بارکد به یک قفسه، ورود از اکسل.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { faNum } from "@/lib/accounting/money";
import { PLACE_FIELDS, PLACE_LABELS, placeText, type PlaceParts } from "@/lib/accounting/inventory/place-text";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, PageHeader, Segmented, Stat } from "../ui";

type Mode = "list" | "scan" | "sheet";
type Field4 = (typeof PLACE_FIELDS)[number];
interface Row extends PlaceParts {
  itemId: string;
  code: string;
  title: string;
  qty: number;
  updatedByName: string | null;
}
interface Data {
  warehouses: { id: string; name: string }[];
  warehouseId: string;
  groups: { id: string; path: string }[];
  rows: Row[];
  capped: boolean;
  zones: { zone: string; items: number }[];
  summary: { stocked: number; stockedPlaced: number; stockedUnplaced: number; placed: number };
  can: { edit: boolean };
}

const EMPTY: PlaceParts = { zone: null, aisle: null, shelf: null, level: null };
const ls = {
  get: (k: string, d: string) => {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

/** چهار کادر مکان؛ منطقه با پیشنهاد منطقه‌های همین انبار */
function PlaceInputs({ value, onChange, zones, small, autoFocusLast }: { value: Partial<PlaceParts>; onChange: (v: Partial<PlaceParts>) => void; zones: string[]; small?: boolean; autoFocusLast?: boolean }) {
  const cls = `${inputCls} ${small ? "!py-1.5 !px-2 text-xs" : ""}`;
  return (
    <>
      {PLACE_FIELDS.map((f, k) => (
        <input
          key={f}
          value={value[f] ?? ""}
          onChange={(e) => onChange({ ...value, [f]: e.target.value || null })}
          placeholder={PLACE_LABELS[f]}
          list={f === "zone" ? "place-zones" : undefined}
          autoFocus={autoFocusLast && k === 0}
          className={`${cls} ${f === "zone" ? "" : "text-center"}`}
          dir={f === "zone" ? undefined : "ltr"}
        />
      ))}
      <datalist id="place-zones">
        {zones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
    </>
  );
}

// ── فهرست ─────────────────────────────────────────────────────────────

function ListPanel({ d, reload, query }: { d: Data; reload: () => void; query: string }) {
  const [edits, setEdits] = useState<Record<string, Partial<PlaceParts>>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<Partial<PlaceParts>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => (setEdits({}), setPicked(new Set())), [d]);

  const dirty = Object.keys(edits);
  const val = (r: Row) => ({ ...r, ...edits[r.itemId] });
  const zones = d.zones.map((z) => z.zone);

  async function post(json: Record<string, unknown>, done: (r: { saved: number; cleared: number }) => string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await api<{ saved: number; cleared: number }>("/api/admin/accounting/inventory/places", { method: "POST", json: { warehouseId: d.warehouseId, ...json } });
      setMsg(done(r));
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    post({ action: "save", rows: dirty.map((id) => ({ ...val(d.rows.find((r) => r.itemId === id)!), itemId: id })) }, (r) => `ذخیره شد — ${faNum(r.saved)} مکان${r.cleared ? `، ${faNum(r.cleared)} پاک` : ""}`);
  const assign = () => post({ action: "assign", itemIds: [...picked], place: bulk }, (r) => `مکان ${faNum(r.saved)} کالا تعیین شد`);
  const toggle = (id: string) => setPicked((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));

  return (
    <div className="space-y-3">
      {d.can.edit && picked.size > 0 && (
        <Card className="p-3 space-y-2">
          <p className="text-xs font-bold">{faNum(picked.size)} کالا انتخاب شده — فقط کادرهای پرشده عوض می‌شوند:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <PlaceInputs value={bulk} onChange={setBulk} zones={zones} small />
            <button onClick={assign} disabled={busy || !PLACE_FIELDS.some((f) => bulk[f])} className={`${btn.primary} !py-1.5`}>
              اعمال
            </button>
          </div>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {d.can.edit && dirty.length > 0 && (
          <>
            <button onClick={save} disabled={busy} className={btn.primary}>
              {busy ? "…" : `ذخیره‌ی ${faNum(dirty.length)} تغییر`}
            </button>
            <button onClick={() => setEdits({})} className="text-xs font-bold text-gray-500">
              لغو
            </button>
          </>
        )}
        <a href={`/api/admin/accounting/inventory/places/export?w=${d.warehouseId}&${query}`} className={btn.small}>
          خروجی اکسل (CSV)
        </a>
        <button onClick={() => window.print()} className={btn.small}>
          چاپ
        </button>
        {msg && <span className="text-xs font-bold text-emerald-600">{msg}</span>}
      </div>
      <ErrorText>{error}</ErrorText>

      <Card className="overflow-hidden">
        {!d.rows.length ? (
          <Empty title="کالایی با این فیلتر نیست" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                <tr>
                  {d.can.edit && (
                    <th className="w-8 px-3 py-2 print:hidden">
                      <input
                        type="checkbox"
                        checked={picked.size === d.rows.length}
                        onChange={(e) => setPicked(e.target.checked ? new Set(d.rows.map((r) => r.itemId)) : new Set())}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </th>
                  )}
                  <th className="px-3 py-2 text-right">کالا</th>
                  <th className="px-3 py-2 text-left">موجودی</th>
                  {PLACE_FIELDS.map((f) => (
                    <th key={f} className="px-2 py-2 text-center">
                      {PLACE_LABELS[f]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)]">
                {d.rows.map((r) => {
                  const v = val(r);
                  const changed = !!edits[r.itemId];
                  return (
                    <tr key={r.itemId} className={changed ? "bg-amber-50/60 dark:bg-amber-500/5" : ""}>
                      {d.can.edit && (
                        <td className="px-3 py-1.5 print:hidden">
                          <input type="checkbox" checked={picked.has(r.itemId)} onChange={() => toggle(r.itemId)} className="h-4 w-4 accent-blue-600" />
                        </td>
                      )}
                      <td className="px-3 py-1.5">
                        <Link href={`/admin/accounting/inventory/${r.itemId}`} className="block max-w-[16rem] truncate font-bold hover:text-blue-600">
                          {r.title}
                        </Link>
                        <span className="text-[11px] text-gray-400">{r.code}</span>
                      </td>
                      <td className={`px-3 py-1.5 text-left tabular-nums ${r.qty > 0 ? "" : "text-gray-400"}`}>{faNum(r.qty)}</td>
                      {PLACE_FIELDS.map((f) => (
                        <td key={f} className="px-1 py-1.5">
                          {d.can.edit ? (
                            <input
                              value={v[f] ?? ""}
                              onChange={(e) => setEdits((x) => ({ ...x, [r.itemId]: { ...x[r.itemId], [f]: e.target.value || null } }))}
                              list={f === "zone" ? "place-zones" : undefined}
                              className={`${inputCls} !py-1 !px-2 text-xs ${f === "zone" ? "min-w-[6rem]" : "w-16 text-center"} print:border-0`}
                              dir={f === "zone" ? undefined : "ltr"}
                            />
                          ) : (
                            <span className="block text-center text-xs">{v[f] ?? ""}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* با نوار تعیین گروهی همان PlaceInputs فهرست منطقه‌ها را دارد */}
            {picked.size === 0 && (
              <datalist id="place-zones">
                {zones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            )}
            {d.capped && <p className="px-4 py-2 text-[11px] text-amber-600">فقط ۳٬۰۰۰ کالای اول آمده — فیلتر را تنگ‌تر کنید.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── اسکن به قفسه ──────────────────────────────────────────────────────

interface ScanLog {
  key: string;
  ok: boolean;
  text: string;
  sub?: string;
  itemId?: string;
}

function ScanPanel({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [place, setPlace] = useState<Partial<PlaceParts>>(() => {
    try {
      return JSON.parse(ls.get(`places:scan:${d.warehouseId}`, "{}"));
    } catch {
      return {};
    }
  });
  const [code, setCode] = useState("");
  const [log, setLog] = useState<ScanLog[]>([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ls.set(`places:scan:${d.warehouseId}`, JSON.stringify(place)), [d.warehouseId, place]);

  async function scan() {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setCode("");
    try {
      const r = await api<{ item: { id: string; code: string; title: string }; qty: number; before: PlaceParts | null; place: PlaceParts }>("/api/admin/accounting/inventory/places", {
        method: "POST",
        json: { action: "scan", warehouseId: d.warehouseId, code: c, place },
      });
      const before = placeText(r.before);
      const now = placeText(r.place);
      setLog((l) => [
        { key: `${Date.now()}`, ok: true, itemId: r.item.id, text: r.item.title, sub: `${r.item.code} · موجودی ${faNum(r.qty)} · ${before && before !== now ? `از ${before} ← ` : ""}${now}` },
        ...l.slice(0, 29),
      ]);
      onChanged();
    } catch (e) {
      setLog((l) => [{ key: `${Date.now()}`, ok: false, text: e instanceof Error ? e.message : "انجام نشد", sub: c }, ...l.slice(0, 29)]);
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  }

  const ready = PLACE_FIELDS.some((f) => place[f]);
  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <p className="text-xs text-gray-500">اول مکان را بنویسید، بعد بارکد کالاهای همان قفسه را پشت سر هم بزنید. مکان روی همین دستگاه می‌ماند.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PlaceInputs value={place} onChange={setPlace} zones={d.zones.map((z) => z.zone)} />
        </div>
        <Field label={ready ? `اسکن به «${placeText(place)}»` : "اسکن"}>
          <input
            ref={ref}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), scan())}
            disabled={!ready}
            autoFocus
            placeholder={ready ? "بارکد یا کد کالا + Enter" : "اول مکان را بنویسید"}
            className={`${inputCls} text-lg`}
            dir="ltr"
          />
        </Field>
      </Card>
      {log.length > 0 && (
        <Card className="divide-y divide-[var(--adm-border)] overflow-hidden">
          {log.map((l) => (
            <div key={l.key} className="px-4 py-2 text-sm">
              {l.itemId ? (
                <Link href={`/admin/accounting/inventory/${l.itemId}`} className="font-bold text-emerald-700 hover:underline dark:text-emerald-400">
                  ✓ {l.text}
                </Link>
              ) : (
                <span className="font-bold text-red-600">✕ {l.text}</span>
              )}
              {l.sub && <span className="block text-[11px] text-gray-500">{l.sub}</span>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── اکسل ──────────────────────────────────────────────────────────────

type Col = "code" | Field4;
const COLS: Col[] = ["code", ...PLACE_FIELDS];
const COL_LABEL: Record<Col, string> = { code: "کد کالا", ...PLACE_LABELS };
const COL_RE: Record<Col, RegExp> = { code: /^(کد|کد کالا|code|sku|بارکد|barcode)$/i, zone: /منطقه|zone/i, aisle: /ردیف|aisle|row/i, shelf: /قفسه|shelf/i, level: /طبقه|level/i };

function SheetPanel({ d, onDone }: { d: Data; onDone: () => void }) {
  const [file, setFile] = useState<{ name: string; sheets: { name: string; rows: string[][] }[] } | null>(null);
  const [cols, setCols] = useState<Record<Col, number>>({ code: 0, zone: -1, aisle: 1, shelf: 2, level: 3 });
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState<{ total: number; rows: { itemId: string; code: string; title: string; line: number; place: PlaceParts }[]; unknown: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const head = file?.sheets[0]?.rows[0] ?? [];
  useEffect(() => setPreview(null), [cols, paste, file]);

  async function upload(f: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/admin/accounting/import/parse", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "فایل خوانده نشد");
      setFile(j);
      setPaste("");
      const h: string[] = j.sheets[0]?.rows[0] ?? [];
      setCols(Object.fromEntries(COLS.map((c) => [c, h.findIndex((x) => COL_RE[c].test(x.trim()))])) as Record<Col, number>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فایل خوانده نشد");
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => {
    if (paste.trim())
      return paste
        .split(/\r?\n/)
        .map((l, k) => {
          const c = l.split("\t").map((x) => x.trim());
          return { code: c[0] ?? "", zone: c[1] ?? "", aisle: c[2] ?? "", shelf: c[3] ?? "", level: c[4] ?? "", line: k + 1 };
        })
        .filter((r) => r.code);
    if (!file) return [];
    const at = (r: string[], c: Col) => (cols[c] >= 0 ? (r[cols[c]] ?? "") : "");
    return file.sheets[0].rows.slice(1).map((r, k) => ({ code: at(r, "code"), zone: at(r, "zone"), aisle: at(r, "aisle"), shelf: at(r, "shelf"), level: at(r, "level"), line: k + 2 }));
  }, [paste, file, cols]);

  async function send(commit: boolean) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await api<{ preview?: typeof preview; saved?: number; cleared?: number }>("/api/admin/accounting/inventory/places", {
        method: "POST",
        json: { action: "sheet", warehouseId: d.warehouseId, rows, commit },
      });
      if (r.preview) setPreview(r.preview);
      else {
        setMsg(`مکان ${faNum(r.saved ?? 0)} کالا ذخیره شد${r.cleared ? `، ${faNum(r.cleared)} پاک شد` : ""}`);
        setFile(null);
        setPaste("");
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <p className="text-xs leading-6 text-gray-500">
          ستون‌ها: کد کالا، منطقه، ردیف، قفسه، طبقه — برای انبار «{d.warehouses.find((w) => w.id === d.warehouseId)?.name}». خروجی همین صفحه («فهرست» ← خروجی اکسل) را
          می‌شود پر کرد و برگرداند. خانه‌های خالی مکان قبلی را پاک می‌کنند.
        </p>
        <label className={`${btn.soft} cursor-pointer`}>
          {busy && !file ? "در حال خواندن…" : "انتخاب فایل (xlsx یا csv)"}
          <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {file && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {COLS.map((c) => (
              <Field key={c} label={COL_LABEL[c]}>
                <select value={cols[c]} onChange={(e) => setCols((x) => ({ ...x, [c]: Number(e.target.value) }))} className={inputCls}>
                  <option value={-1}>—</option>
                  {head.map((h, k) => (
                    <option key={k} value={k}>
                      {h || `ستون ${faNum(k + 1)}`}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        )}
        <Field label="یا چسباندن از اکسل" hint="هر خط: کد، منطقه، ردیف، قفسه، طبقه (با Tab)">
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} dir="ltr" className={`${inputCls} font-mono text-xs`} placeholder={"110023-01\tویترین\tA\t03\t2"} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => send(false)} disabled={busy || !rows.length} className={btn.soft}>
            پیش‌نمایش {rows.length ? `(${faNum(rows.length)} ردیف)` : ""}
          </button>
          {preview && preview.total > 0 && (
            <button onClick={() => send(true)} disabled={busy} className={btn.primary}>
              {busy ? "…" : `ذخیره‌ی مکان ${faNum(preview.total)} کالا`}
            </button>
          )}
          {msg && <span className="text-xs font-bold text-emerald-600">{msg}</span>}
        </div>
        <ErrorText>{error}</ErrorText>
      </Card>
      {preview && (
        <Card className="overflow-hidden">
          <div className="px-4 pt-3 pb-2 text-xs text-gray-500">
            {faNum(preview.total)} کالا
            {preview.unknown.length > 0 && <span className="text-red-600"> · {faNum(preview.unknown.length)} کد پیدا نشد: {preview.unknown.slice(0, 20).join("، ")}</span>}
          </div>
          <div className="divide-y divide-[var(--adm-border)]">
            {preview.rows.map((r) => (
              <div key={r.itemId} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-bold">
                  {r.title} <span className="text-[11px] font-normal text-gray-400">{r.code}</span>
                </span>
                {placeText(r.place) ? <Badge tone="blue">{placeText(r.place)}</Badge> : <Badge tone="red">پاک</Badge>}
              </div>
            ))}
            {preview.total > preview.rows.length && <p className="px-4 py-2 text-[11px] text-gray-400">{faNum(preview.total - preview.rows.length)} ردیف دیگر</p>}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function PlacesClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("list");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [groupId, setGroupId] = useState("");
  const [zone, setZone] = useState("");
  const [spot, setSpot] = useState("");
  const [only, setOnly] = useState<"all" | "placed" | "unplaced">((sp.get("only") as "placed" | "unplaced") ?? "all");
  const [all, setAll] = useState(false);
  const w = sp.get("w") ?? "";

  const query = useMemo(
    () => new URLSearchParams({ ...(w ? { w } : {}), ...(q ? { q } : {}), ...(groupId ? { groupId } : {}), ...(zone ? { zone } : {}), ...(spot ? { spot } : {}), only, ...(all ? { all: "1" } : {}) }).toString(),
    [w, q, groupId, zone, spot, only, all],
  );
  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/inventory/places?${query}`)
      .then((x) => {
        setD(x);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [query]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  // انبار انتخاب‌شده روی همین دستگاه
  useEffect(() => {
    if (!w) {
      const saved = ls.get("places:w", "");
      if (saved) router.replace(`${pathname}?w=${saved}`);
    } else ls.set("places:w", w);
  }, [w, pathname, router]);

  return (
    <div>
      <PageHeader
        title="کالا و انبار"
        help="accountingPlaces"
        desc="هر کالا در هر انبار کجاست: منطقه، ردیف، قفسه و طبقه. برای پیدا کردن سریع کالا، چیدن قفسه و انبارگردانی قفسه به قفسه."
      />
      <InventoryTabs />
      {!d ? (
        error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>
      ) : !d.warehouses.length ? (
        <Empty title="هنوز انباری تعریف نشده" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            {d.warehouses.length > 1 && (
              <select value={d.warehouseId} onChange={(e) => router.replace(`${pathname}?w=${e.target.value}`)} className={`${inputCls} !w-auto font-bold`}>
                {d.warehouses.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            )}
            {d.can.edit && (
              <div className="min-w-[16rem] flex-1 sm:max-w-md">
                <Segmented
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "list", label: "فهرست" },
                    { value: "scan", label: "اسکن به قفسه" },
                    { value: "sheet", label: "ورود از اکسل" },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 print:hidden">
            <Stat label="کالای موجود در انبار" value={faNum(d.summary.stocked)} />
            <button type="button" className="text-right" onClick={() => (setMode("list"), setAll(false), setOnly("placed"))}>
              <Stat label="با مکان" value={faNum(d.summary.stockedPlaced)} tone="green" />
            </button>
            <button type="button" className="text-right" onClick={() => (setMode("list"), setAll(false), setOnly("unplaced"))}>
              <Stat label="بی‌مکان" value={faNum(d.summary.stockedUnplaced)} tone={d.summary.stockedUnplaced ? "amber" : "gray"} />
            </button>
          </div>

          {mode === "list" && (
            <>
              <Card className="p-3 space-y-3 print:hidden">
                <div className="grid gap-2 sm:grid-cols-4">
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام، کد یا بارکد" className={inputCls} />
                  <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
                    <option value="">همه‌ی گروه‌ها</option>
                    {d.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.path}
                      </option>
                    ))}
                  </select>
                  <select value={zone} onChange={(e) => setZone(e.target.value)} className={inputCls}>
                    <option value="">همه‌ی منطقه‌ها</option>
                    {d.zones.map((z) => (
                      <option key={z.zone} value={z.zone}>
                        {z.zone} ({faNum(z.items)})
                      </option>
                    ))}
                  </select>
                  <input value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="ردیف/قفسه/طبقه، مثلاً A یا 03" className={inputCls} dir="ltr" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Chips
                    value={only}
                    onChange={setOnly}
                    options={[
                      { value: "all", label: "همه" },
                      { value: "placed", label: "با مکان" },
                      { value: "unplaced", label: "بی‌مکان" },
                    ]}
                  />
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                    کالاهای ناموجود در این انبار هم
                  </label>
                </div>
              </Card>
              <ListPanel d={d} reload={load} query={query} />
            </>
          )}
          {mode === "scan" && <ScanPanel key={d.warehouseId} d={d} onChanged={load} />}
          {mode === "sheet" && <SheetPanel d={d} onDone={load} />}
        </div>
      )}
    </div>
  );
}
