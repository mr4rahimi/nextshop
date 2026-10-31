"use client";

/**
 * قیمت فروشگاه — docs/plans/webhesab-parity.md بخش ۱۰.
 * سه زبانه: تغییر گروهی (درصد/مبلغ/قیمت ثابت با فیلتر)، ورود با اکسل، کالاهای با تغییر قیمت
 * (از تاریخ و ساعت ← چاپ برچسب). پایین دو زبانه‌ی اول: تغییرهای اخیر با «برگرداندن».
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { faNum, formatAmount } from "@/lib/accounting/money";
import type { RoundMode } from "@/lib/accounting/inventory/online-price-calc";
import InventoryTabs from "./InventoryTabs";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, PageHeader, SectionTitle, Segmented } from "../ui";

type Tab = "bulk" | "sheet" | "history";
type OpKind = "PERCENT" | "AMOUNT" | "SET";

interface Meta {
  groups: { id: string; path: string; items: number }[];
  axes: { id: string; name: string; values: { id: string; value: string }[] }[];
  suppliers: { id: string; name: string }[];
  batches: { id: string; kind: string; summary: string; count: number; undoneAt: string | null; createdByName: string; createdAt: string }[];
  can: { manage: boolean };
}
interface Row {
  itemId: string;
  code: string;
  title: string;
  from: string;
  to: string;
  line?: number;
}
interface Preview {
  total: number;
  rows: Row[];
  noPrice?: number;
  same: number;
  invalid: number | string[];
  capped?: boolean;
  unknown?: string[];
  expanded?: { code: string; items: number }[];
}
interface HistoryRow {
  itemId: string;
  code: string;
  title: string;
  from: string;
  to: string | null;
  now: string;
  back: boolean;
  times: number;
  last: string;
  by: string;
  source: string;
  stock: number;
}

const SOURCE: Record<string, string> = { FORM: "فرم کالا", BULK: "گروهی", EXCEL: "اکسل", UNDO: "برگرداندن" };
const when = (v: string) => new Date(v).toLocaleString("fa-IR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
const today = () => new Date(Date.now() + 3.5 * 3_600_000).toISOString().slice(0, 10);
/** «۱۵»، «−۱۰»، «10-» → عدد؛ نامعتبر ← null */
function num(raw: string): number | null {
  const t = raw.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٫]/g, ".").replace(/[,٬\s٪%]/g, "").replace(/[−–]/g, "-");
  if (!t || t === "-") return null;
  const neg = t.includes("-");
  const n = Number(t.replace(/-/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

function DiffTable({ rows, total, onExclude }: { rows: Row[]; total: number; onExclude?: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
          <tr>
            <th className="px-3 py-2 text-right">کالا</th>
            <th className="px-3 py-2 text-left">الان</th>
            <th className="px-3 py-2 text-left">تازه</th>
            <th className="px-3 py-2 text-left">تغییر</th>
            {onExclude && <th className="w-8" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--adm-border)]">
          {rows.map((r) => {
            const from = BigInt(r.from);
            const to = BigInt(r.to);
            const pct = from > 0n ? Number(((to - from) * 10000n) / from) / 100 : null;
            return (
              <tr key={r.itemId}>
                <td className="px-3 py-2">
                  <Link href={`/admin/accounting/inventory/${r.itemId}`} className="block max-w-[18rem] truncate font-bold hover:text-blue-600">
                    {r.title}
                  </Link>
                  <span className="text-[11px] text-gray-400">
                    {r.code}
                    {r.line ? ` · ردیف ${faNum(r.line)}` : ""}
                  </span>
                </td>
                <td className="px-3 py-2 text-left tabular-nums text-gray-400">{from > 0n ? formatAmount(from) : "—"}</td>
                <td className={`px-3 py-2 text-left font-black tabular-nums ${to > from ? "text-amber-600" : "text-emerald-600"}`}>{formatAmount(to)}</td>
                <td className="px-3 py-2 text-left text-[11px] tabular-nums text-gray-500">{pct === null ? "تازه" : `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${faNum(Math.abs(pct))}٪`}</td>
                {onExclude && (
                  <td className="px-2">
                    <button type="button" onClick={() => onExclude(r.itemId)} title="کنار گذاشتن" className="text-gray-400 hover:text-red-600">
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {total > rows.length && <p className="px-4 py-2 text-[11px] text-gray-400">{faNum(total - rows.length)} ردیف دیگر هم هست (همه اعمال می‌شوند).</p>}
    </div>
  );
}

// ── تغییر گروهی ───────────────────────────────────────────────────────

function BulkPanel({ meta, onDone }: { meta: Meta; onDone: (batchId: string) => void }) {
  const [q, setQ] = useState("");
  const [groupId, setGroupId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [valueId, setValueId] = useState("");
  const [inactive, setInactive] = useState(false);
  const [kind, setKind] = useState<OpKind>("PERCENT");
  const [val, setVal] = useState("");
  const [roundTo, setRoundTo] = useState(1000);
  const [mode, setMode] = useState<RoundMode>("up");
  const [exclude, setExclude] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // هر تغییر فرم پیش‌نمایش را کهنه می‌کند
  useEffect(() => setPreview(null), [q, groupId, supplierId, valueId, inactive, kind, val, roundTo, mode]);

  const n = num(val);
  const body = (commit: boolean) => ({
    action: "bulk",
    commit,
    filter: { q, groupId, supplierId, valueId, includeInactive: inactive },
    op: kind === "PERCENT" ? { kind, pctBp: Math.round((n ?? 0) * 100) } : kind === "AMOUNT" ? { kind, amount: String(Math.round(n ?? 0)) } : { kind, price: String(Math.round(n ?? 0)) },
    round: { roundTo: kind === "SET" ? 0 : roundTo, mode },
    exclude,
  });

  async function send(commit: boolean, ex = exclude) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ preview?: Preview; applied?: { batchId: string; count: number } }>("/api/admin/accounting/items/store-prices", {
        method: "POST",
        json: { ...body(commit), exclude: ex },
      });
      if (r.preview) setPreview(r.preview);
      if (r.applied) {
        setPreview(null);
        setExclude([]);
        onDone(r.applied.batchId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  const drop = (id: string) => {
    const ex = [...exclude, id];
    setExclude(ex);
    void send(false, ex);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <SectionTitle title="کدام کالاها" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="نام، کد یا بارکد">
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} placeholder="همه" />
          </Field>
          <Field label="گروه" hint="با زیرگروه‌ها">
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
              <option value="">همه‌ی گروه‌ها</option>
              {meta.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.path}
                </option>
              ))}
            </select>
          </Field>
          <Field label="عرضه‌کننده">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">همه</option>
              {meta.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ویژگی (رنگ، سایز…)">
            <select value={valueId} onChange={(e) => setValueId(e.target.value)} className={inputCls}>
              <option value="">همه</option>
              {meta.axes.map((a) => (
                <optgroup key={a.id} label={a.name}>
                  {a.values.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.value}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} className="h-4 w-4 accent-blue-600" />
          کالاهای غیرفعال هم
        </label>
      </Card>

      <Card className="p-4 space-y-4">
        <SectionTitle title="چه تغییری" />
        <Segmented
          value={kind}
          onChange={(k) => (setKind(k), setVal(""))}
          options={[
            { value: "PERCENT", label: "درصد" },
            { value: "AMOUNT", label: "مبلغ" },
            { value: "SET", label: "قیمت ثابت" },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={kind === "PERCENT" ? "درصد" : kind === "AMOUNT" ? "مبلغ (تومان)" : "قیمت تازه (تومان)"} hint={kind === "SET" ? "همه‌ی کالاهای فیلتر همین قیمت را می‌گیرند" : "منفی = ارزان‌تر"}>
            <input value={val} onChange={(e) => setVal(e.target.value)} className={`${inputCls} text-left`} dir="ltr" inputMode="decimal" placeholder={kind === "PERCENT" ? "10" : "50000"} />
            {kind === "PERCENT" && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[5, 10, 15, 20, 30, -10].map((p) => (
                  <button key={p} type="button" onClick={() => setVal(String(p))} className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-bold dark:bg-white/5">
                    {p > 0 ? "+" : "−"}
                    {faNum(Math.abs(p))}٪
                  </button>
                ))}
              </div>
            )}
          </Field>
          {kind !== "SET" && (
            <>
              <Field label="گرد کردن">
                <select value={roundTo} onChange={(e) => setRoundTo(Number(e.target.value))} className={inputCls}>
                  {[0, 100, 500, 1000, 5000, 10000, 50000].map((r) => (
                    <option key={r} value={r}>
                      {r ? `به ${formatAmount(r)} تومان` : "گرد نشود"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="جهت گرد کردن">
                <select value={mode} disabled={!roundTo} onChange={(e) => setMode(e.target.value as RoundMode)} className={inputCls}>
                  <option value="up">رو به بالا</option>
                  <option value="nearest">نزدیک‌ترین</option>
                  <option value="down">رو به پایین</option>
                </select>
              </Field>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => send(false)} disabled={busy || n === null || n === 0} className={btn.soft}>
            پیش‌نمایش
          </button>
          {meta.can.manage && preview && preview.total > 0 && (
            <button
              onClick={() => confirm(`قیمت ${faNum(preview.total)} کالا عوض شود؟`) && send(true)}
              disabled={busy}
              className={btn.primary}
            >
              {busy ? "…" : `اعمال روی ${faNum(preview.total)} کالا`}
            </button>
          )}
          {exclude.length > 0 && (
            <button type="button" onClick={() => (setExclude([]), void send(false, []))} className="text-xs font-bold text-blue-600">
              {faNum(exclude.length)} کالای کنارگذاشته را برگردان
            </button>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
      </Card>

      {preview && (
        <Card className="overflow-hidden">
          <div className="px-4 pt-4">
            <SectionTitle title={preview.total ? `${faNum(preview.total)} کالا قیمت تازه می‌گیرد` : "قیمتی عوض نمی‌شود"} />
            <p className="-mt-1 mb-3 flex flex-wrap gap-x-3 text-[11px] text-gray-500">
              {!!preview.noPrice && <span>{faNum(preview.noPrice)} کالا قیمت ندارد (رد شد)</span>}
              {!!preview.same && <span>{faNum(preview.same)} کالا همین قیمت را دارد</span>}
              {!!preview.invalid && <span className="text-red-600">{faNum(Number(preview.invalid))} کالا به صفر یا کمتر می‌رسید (رد شد)</span>}
              {preview.capped && <span className="text-amber-600">فقط ۲۰٬۰۰۰ کالای اول — فیلتر را تنگ‌تر کنید</span>}
            </p>
          </div>
          {preview.total > 0 && <DiffTable rows={preview.rows} total={preview.total} onExclude={meta.can.manage ? drop : undefined} />}
        </Card>
      )}
    </div>
  );
}

// ── اکسل ──────────────────────────────────────────────────────────────

interface ParsedFile {
  name: string;
  sheets: { name: string; rows: string[][] }[];
}

function guessCols(head: string[]): { code: number; price: number } {
  const find = (re: RegExp) => head.findIndex((h) => re.test(h.trim()));
  const code = find(/^(کد|کد کالا|code|sku|بارکد|barcode)$/i);
  const fresh = find(/قیمت تازه|قیمت جدید|new/i);
  const any = find(/قیمت|price/i);
  const c = code >= 0 ? code : 0;
  return { code: c, price: fresh >= 0 ? fresh : any >= 0 ? any : c === 0 ? 1 : 0 };
}

function SheetPanel({ meta, onDone }: { meta: Meta; onDone: (batchId: string) => void }) {
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [cols, setCols] = useState({ code: 0, price: 1 });
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheet = file?.sheets[sheetIdx];
  const head = sheet?.rows[0] ?? [];

  useEffect(() => {
    if (sheet) setCols(guessCols(sheet.rows[0] ?? []));
    setPreview(null);
  }, [sheet]);
  useEffect(() => setPreview(null), [cols, paste]);

  async function upload(f: File) {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/admin/accounting/import/parse", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "فایل خوانده نشد");
      setFile(d);
      setSheetIdx(0);
      setPaste("");
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
          // کپی از اکسل با Tab جدا می‌شود؛ وگرنه ; یا فاصله (کاما جداکننده‌ی هزارگان است)
          const c = (l.includes("\t") ? l.split("\t") : l.split(/;|\s+/)).map((x) => x.trim()).filter(Boolean);
          return { code: c[0] ?? "", price: c[c.length - 1] ?? "", line: k + 1 };
        })
        .filter((r) => r.code && r.price && r.code !== r.price);
    if (!sheet) return [];
    return sheet.rows.slice(1).map((r, k) => ({ code: r[cols.code] ?? "", price: r[cols.price] ?? "", line: k + 2 }));
  }, [paste, sheet, cols]);

  async function send(commit: boolean) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ preview?: Preview; applied?: { batchId: string } }>("/api/admin/accounting/items/store-prices", {
        method: "POST",
        json: { action: "sheet", rows, commit },
      });
      if (r.preview) setPreview(r.preview);
      if (r.applied) {
        setPreview(null);
        setFile(null);
        setPaste("");
        onDone(r.applied.batchId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  const invalid = Array.isArray(preview?.invalid) ? preview.invalid : [];

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <SectionTitle title="فایل قیمت" />
        <ol className="list-decimal space-y-1 pr-5 text-xs leading-6 text-gray-600 dark:text-gray-300">
          <li>
            <a href="/api/admin/accounting/items/store-prices/export" className="font-bold text-blue-600">
              دریافت فهرست قیمت فعلی (CSV)
            </a>{" "}
            — در اکسل باز کنید و ستون «قیمت تازه» را فقط برای کالاهایی که عوض می‌شوند پر کنید.
          </li>
          <li>همان فایل (یا فایل xlsx/csv خودتان با ستون کد و قیمت) را اینجا بدهید، یا ردیف‌ها را از اکسل کپی کنید و پایین بچسبانید.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${btn.soft} cursor-pointer`}>
            {busy && !file ? "در حال خواندن…" : "انتخاب فایل"}
            <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {file && (
            <span className="text-xs text-gray-500">
              {file.name} · {faNum(Math.max(0, (sheet?.rows.length ?? 1) - 1))} ردیف
            </span>
          )}
        </div>
        {file && sheet && (
          <div className="grid gap-3 sm:grid-cols-3">
            {file.sheets.length > 1 && (
              <Field label="برگه">
                <select value={sheetIdx} onChange={(e) => setSheetIdx(Number(e.target.value))} className={inputCls}>
                  {file.sheets.map((s, k) => (
                    <option key={k} value={k}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="ستون کد" hint="کد کالا، بارکد یا کد نرم‌افزار قبلی">
              <select value={cols.code} onChange={(e) => setCols((c) => ({ ...c, code: Number(e.target.value) }))} className={inputCls}>
                {head.map((h, k) => (
                  <option key={k} value={k}>
                    {h || `ستون ${faNum(k + 1)}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ستون قیمت تازه" hint="تومان؛ خانه‌ی خالی = بی‌تغییر">
              <select value={cols.price} onChange={(e) => setCols((c) => ({ ...c, price: Number(e.target.value) }))} className={inputCls}>
                {head.map((h, k) => (
                  <option key={k} value={k}>
                    {h || `ستون ${faNum(k + 1)}`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="یا چسباندن از اکسل" hint="هر خط: کد، بعد قیمت (دو ستون کپی‌شده از اکسل)">
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} dir="ltr" className={`${inputCls} font-mono text-xs`} placeholder={"110023-01\t450000\n110023-02\t460000"} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => send(false)} disabled={busy || !rows.length} className={btn.soft}>
            پیش‌نمایش {rows.length ? `(${faNum(rows.length)} ردیف)` : ""}
          </button>
          {meta.can.manage && preview && preview.total > 0 && (
            <button onClick={() => confirm(`قیمت ${faNum(preview.total)} کالا عوض شود؟`) && send(true)} disabled={busy} className={btn.primary}>
              {busy ? "…" : `اعمال روی ${faNum(preview.total)} کالا`}
            </button>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
      </Card>

      {preview && (
        <Card className="overflow-hidden">
          <div className="px-4 pt-4 space-y-2">
            <SectionTitle title={preview.total ? `${faNum(preview.total)} کالا قیمت تازه می‌گیرد` : "قیمتی عوض نمی‌شود"} />
            <div className="-mt-1 mb-3 space-y-1 text-[11px] text-gray-500">
              {!!preview.same && <p>{faNum(preview.same)} کالا همین قیمت را دارد.</p>}
              {!!preview.expanded?.length && (
                <p>
                  کد مدل: {preview.expanded.slice(0, 8).map((x) => `${x.code} ← ${faNum(x.items)} کالا`).join("، ")}
                  {preview.expanded.length > 8 ? " …" : ""}
                </p>
              )}
              {!!preview.unknown?.length && (
                <p className="text-red-600">
                  {faNum(preview.unknown.length)} کد پیدا نشد: {preview.unknown.slice(0, 20).join("، ")}
                  {preview.unknown.length > 20 ? " …" : ""}
                </p>
              )}
              {invalid.length > 0 && (
                <p className="text-red-600">
                  قیمت نامعتبر برای {faNum(invalid.length)} کد: {invalid.slice(0, 20).join("، ")}
                </p>
              )}
            </div>
          </div>
          {preview.total > 0 && <DiffTable rows={preview.rows} total={preview.total} />}
        </Card>
      )}
    </div>
  );
}

// ── کالاهای با تغییر قیمت ─────────────────────────────────────────────

function HistoryPanel({ batch, clearBatch }: { batch: string | null; clearBatch: () => void }) {
  const [since, setSince] = useState(today());
  const [time, setTime] = useState("00:00");
  const [source, setSource] = useState<string>("");
  const [data, setData] = useState<{ total: number; items: HistoryRow[]; truncated: boolean } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [labelQty, setLabelQty] = useState<"one" | "stock">("one");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    const p = new URLSearchParams(batch ? { batch } : { since, sinceTime: time, ...(source ? { source } : {}) });
    api<{ total: number; items: HistoryRow[]; truncated: boolean }>(`/api/admin/accounting/items/store-prices/history?${p}`)
      .then((d) => {
        setData(d);
        setPicked(new Set(d.items.filter((i) => !i.back).map((i) => i.itemId)));
      })
      .catch((e) => setError(e.message));
  }, [batch, since, time, source]);
  useEffect(load, [load]);

  const chosen = (data?.items ?? []).filter((i) => picked.has(i.itemId));
  const labelHref = `/admin/accounting/inventory/labels/print?items=${chosen
    .slice(0, 500)
    .map((i) => `${i.itemId}:${labelQty === "stock" ? Math.max(1, i.stock) : 1}`)
    .join(",")}`;
  const toggle = (id: string) => setPicked((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        {batch ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="blue">فقط کالاهای یک تغییر گروهی</Badge>
            <button onClick={clearBatch} className="text-xs font-bold text-blue-600">
              همه‌ی تغییرها از یک تاریخ
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="از تاریخ">
                <JalaliDatePicker value={since} onChange={(v) => setSince(v || today())} clearable={false} />
              </Field>
              <Field label="از ساعت">
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} dir="ltr" />
              </Field>
            </div>
            <Chips
              value={source}
              onChange={setSource}
              options={[{ value: "", label: "همه" }, ...Object.entries(SOURCE).map(([value, label]) => ({ value, label }))]}
            />
          </>
        )}
      </Card>
      <ErrorText>{error}</ErrorText>

      {data && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-3">
            <SectionTitle title={data.items.length ? `${faNum(data.items.length)} کالا با تغییر قیمت` : "از این زمان قیمتی عوض نشده"} />
            {data.items.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <select value={labelQty} onChange={(e) => setLabelQty(e.target.value as "one" | "stock")} className={`${inputCls} !w-auto !py-1.5 text-xs`}>
                  <option value="one">یک برچسب برای هر کالا</option>
                  <option value="stock">به تعداد موجودی</option>
                </select>
                <a href={chosen.length ? labelHref : undefined} target="_blank" rel="noreferrer" className={`${btn.primary} !py-1.5 ${chosen.length ? "" : "pointer-events-none opacity-50"}`}>
                  چاپ برچسب {faNum(Math.min(chosen.length, 500))} کالا
                </a>
              </div>
            )}
          </div>
          {data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                  <tr>
                    <th className="w-8 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={picked.size === data.items.length}
                        onChange={(e) => setPicked(e.target.checked ? new Set(data.items.map((i) => i.itemId)) : new Set())}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </th>
                    <th className="px-3 py-2 text-right">کالا</th>
                    <th className="px-3 py-2 text-left">قبل</th>
                    <th className="px-3 py-2 text-left">الان</th>
                    <th className="px-3 py-2 text-right">آخرین تغییر</th>
                    <th className="px-3 py-2 text-left">موجودی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--adm-border)]">
                  {data.items.map((r) => (
                    <tr key={r.itemId} className={r.back ? "opacity-60" : ""}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={picked.has(r.itemId)} onChange={() => toggle(r.itemId)} className="h-4 w-4 accent-blue-600" />
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/accounting/inventory/${r.itemId}`} className="block max-w-[18rem] truncate font-bold hover:text-blue-600">
                          {r.title}
                        </Link>
                        <span className="text-[11px] text-gray-400">{r.code}</span>
                      </td>
                      <td className="px-3 py-2 text-left tabular-nums text-gray-400 line-through">{BigInt(r.from) > 0n ? formatAmount(r.from) : "—"}</td>
                      <td className="px-3 py-2 text-left font-black tabular-nums">
                        {formatAmount(r.now)}
                        {r.back && (
                          <span className="mr-1">
                            <Badge>بی‌تغییر</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-gray-500">
                        {when(r.last)} · {SOURCE[r.source] ?? r.source} · {r.by}
                        {r.times > 1 && <span className="text-amber-600"> · {faNum(r.times)} بار</span>}
                      </td>
                      <td className="px-3 py-2 text-left tabular-nums text-gray-500">{faNum(r.stock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.truncated && <p className="px-4 py-2 text-[11px] text-amber-600">فهرست بلند است؛ فقط تازه‌ترین‌ها آمده — بازه را کوتاه‌تر کنید.</p>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── تغییرهای اخیر ─────────────────────────────────────────────────────

function Batches({ meta, showBatch, reload }: { meta: Meta; showBatch: (id: string) => void; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function undo(id: string, summary: string) {
    if (!confirm(`«${summary}» برگردانده شود؟`)) return;
    setBusy(id);
    setMsg(null);
    try {
      const r = await api<{ undone: { count: number; moved: number } }>("/api/admin/accounting/items/store-prices", { method: "POST", json: { action: "undo", batchId: id } });
      setMsg(`قیمت ${faNum(r.undone.count)} کالا برگشت${r.undone.moved ? ` — ${faNum(r.undone.moved)} کالا بعداً دوباره عوض شده بود و دست نخورد` : ""}`);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4">
        <SectionTitle title="تغییرهای اخیر" />
        {msg && <p className="-mt-1 mb-2 text-xs font-bold text-gray-600 dark:text-gray-300">{msg}</p>}
      </div>
      {!meta.batches.length ? (
        <Empty title="هنوز تغییر گروهی یا اکسلی ثبت نشده" />
      ) : (
        <div className="divide-y divide-[var(--adm-border)]">
          {meta.batches.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className={`min-w-0 flex-1 font-bold ${b.undoneAt ? "text-gray-400 line-through" : ""}`}>{b.summary}</span>
              <button onClick={() => showBatch(b.id)} className="text-xs font-bold text-blue-600 tabular-nums">
                {faNum(b.count)} کالا
              </button>
              <span className="text-[11px] text-gray-400">
                {when(b.createdAt)} · {b.createdByName}
              </span>
              {b.undoneAt ? (
                <Badge>برگردانده شد</Badge>
              ) : (
                meta.can.manage &&
                b.kind !== "UNDO" && (
                  <button onClick={() => undo(b.id, b.summary)} disabled={busy === b.id} className="text-xs font-bold text-red-600">
                    {busy === b.id ? "…" : "برگرداندن"}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function StorePricesClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (["bulk", "sheet", "history"].includes(sp.get("tab") ?? "") ? sp.get("tab") : "bulk") as Tab;
  const batch = sp.get("batch");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const go = (t: Tab, extra: Record<string, string> = {}) => router.replace(`${pathname}?${new URLSearchParams({ tab: t, ...extra })}`);
  const load = useCallback(() => {
    api<Meta>("/api/admin/accounting/items/store-prices")
      .then(setMeta)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const done = (batchId: string) => {
    setNote("قیمت‌ها عوض شد — برای چاپ برچسب تازه، فهرست همین کالاها باز شد.");
    load();
    go("history", { batch: batchId });
  };

  return (
    <div>
      <PageHeader
        title="کالا و انبار"
        help="accountingStorePrices"
        desc="قیمت فروشگاه همان قیمت صندوق، فاکتور و برچسب است. اینجا قیمت خیلی از کالاها را با هم یا از اکسل عوض کنید و ببینید از کی چه قیمت‌هایی عوض شده."
      />
      <InventoryTabs />
      {!meta ? (
        error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>
      ) : (
        <div className="space-y-4">
          <Segmented
            value={tab}
            onChange={(t) => (setNote(null), go(t))}
            options={[
              { value: "bulk", label: "تغییر گروهی" },
              { value: "sheet", label: "ورود با اکسل" },
              { value: "history", label: "کالاهای با تغییر قیمت" },
            ]}
          />
          {note && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10">{note}</p>}
          {tab === "bulk" && <BulkPanel meta={meta} onDone={done} />}
          {tab === "sheet" && <SheetPanel meta={meta} onDone={done} />}
          {tab === "history" && <HistoryPanel batch={batch} clearBatch={() => go("history")} />}
          {tab !== "history" && <Batches meta={meta} showBatch={(id) => go("history", { batch: id })} reload={load} />}
        </div>
      )}
    </div>
  );
}
