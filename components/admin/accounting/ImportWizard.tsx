"use client";

/**
 * ورود از اکسل — انتقال از هر حسابداری دیگر (docs/plans/inventory-items.md بخش ۶).
 * فایل ← نگاشت ستون (حدس از سرستون، به خاطر سپرده برای همان سرستون‌ها) ← پیش‌نمایش
 * ردیف‌به‌ردیف ← ثبت همه یا هیچ ← گزارش تطبیق برای مقایسه با نرم‌افزار قبلی.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import { guessMapping, IMPORT_KINDS, type ImportField, type ImportKind } from "@/lib/accounting/import/kinds";
import { api, Badge, btn, Card, Chips, ErrorText, Field, inputCls, Money, PageHeader, Stat } from "./ui";

interface Summary {
  year: { title: string } | null;
  axes: { id: string; name: string }[];
  summary: {
    items: number;
    itemsWithoutProduct: number;
    stockLines: number;
    stockQty: number;
    stockValue: string | null;
    parties: number;
    receivable: string;
    payable: string;
    treasury: string;
    chequesReceived: { count: number; amount: string };
    chequesIssued: { count: number; amount: string };
  };
  can: Record<ImportKind, boolean>;
}
interface Sheet {
  name: string;
  rows: string[][];
}
interface Result {
  rows: { row: number; action: "create" | "update" | "skip" | "error"; label: string; message: string | null }[];
  counts: Record<"create" | "update" | "skip" | "error", number>;
  committed: boolean;
}

const ORDER: ImportKind[] = ["items", "stock", "parties", "cheques"];
const ACTION: Record<Result["rows"][number]["action"], { label: string; tone: "green" | "blue" | "gray" | "red" }> = {
  create: { label: "ساخته می‌شود", tone: "green" },
  update: { label: "به‌روز می‌شود", tone: "blue" },
  skip: { label: "رد — هست", tone: "gray" },
  error: { label: "ایراد", tone: "red" },
};
const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const memoKey = (kind: ImportKind, header: string[]) => `acc-import-map:${kind}:${header.join("|")}`;

export default function ImportWizard() {
  const [info, setInfo] = useState<Summary | null>(null);
  const [kind, setKind] = useState<ImportKind | null>(null);
  const [file, setFile] = useState<{ name: string; sheets: Sheet[] } | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [map, setMap] = useState<Record<string, number>>({});
  const [opts, setOpts] = useState({ update: true, rial: false });
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<"all" | "error" | "create" | "update" | "skip">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInfo = useCallback(() => {
    api<Summary>("/api/admin/accounting/import")
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(loadInfo, [loadInfo]);

  const fields: ImportField[] = useMemo(() => {
    if (!kind) return [];
    const base = IMPORT_KINDS[kind].fields;
    if (kind !== "items") return base;
    return [...base, ...(info?.axes ?? []).map((a) => ({ key: `axis:${a.id}`, label: a.name, hint: "با ستون مدل", aliases: [a.name] }))];
  }, [kind, info]);

  const sheet = file?.sheets[sheetIdx];
  const header = useMemo(() => sheet?.rows[headerRow - 1] ?? [], [sheet, headerRow]);
  // ردیف خالی کنار می‌رود؛ شماره‌ی ردیف فایل برای نمایش ایراد نگه داشته می‌شود
  const { dataRows, fileRowNo } = useMemo(() => {
    const out: string[][] = [];
    const no: number[] = [];
    (sheet?.rows ?? []).forEach((r, i) => {
      if (i >= headerRow && r.some((c) => c)) {
        out.push(r);
        no.push(i + 1);
      }
    });
    return { dataRows: out, fileRowNo: no };
  }, [sheet, headerRow]);

  // نگاشت: به خاطر سپرده برای همین سرستون‌ها، وگرنه حدس
  useEffect(() => {
    if (!kind || !header.length) return;
    let saved: Record<string, number> | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(memoKey(kind, header)) ?? "null");
    } catch {}
    setMap(saved ?? guessMapping(kind, header, fields.filter((f) => f.key.startsWith("axis:"))));
    setResult(null);
  }, [kind, header, fields]);

  const missing = fields.filter((f) => f.required && map[f.key] === undefined);
  const rows = useMemo(
    () => dataRows.map((r) => Object.fromEntries(Object.entries(map).filter(([, i]) => i >= 0).map(([k, i]) => [k, r[i] ?? ""]))),
    [dataRows, map],
  );

  async function upload(f: File) {
    setBusy("در حال خواندن فایل…");
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/admin/accounting/import/parse", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "فایل خوانده نشد");
      setFile(d);
      setSheetIdx(0);
      setHeaderRow(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فایل خوانده نشد");
    } finally {
      setBusy(null);
    }
  }

  async function run(commit: boolean) {
    if (!kind) return;
    setBusy(commit ? "در حال ثبت…" : "در حال بررسی ردیف‌ها…");
    setError(null);
    try {
      try {
        localStorage.setItem(memoKey(kind, header), JSON.stringify(map));
      } catch {}
      const r = await api<Result>("/api/admin/accounting/import", { method: "POST", json: { kind, rows, opts, commit } });
      setResult(r);
      setView(r.counts.error ? "error" : "all");
      if (commit) loadInfo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(null);
    }
  }

  function template() {
    if (!kind) return;
    const csv = "﻿" + fields.map((f) => `"${f.label}"`).join(",") + "\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `نمونه-${IMPORT_KINDS[kind].title}.csv`;
    a.click();
  }

  const s = info?.summary;
  const shown = result?.rows.filter((r) => view === "all" || r.action === view) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="ورود از اکسل" help="accountingImport" desc="انتقال کالا، موجودی، اشخاص و چک‌ها از هر نرم‌افزار حسابداری — همه خروجی اکسل دارند." />

      {s && (
        <Card className="p-4 space-y-3">
          <p className="text-sm font-black">گزارش تطبیق {info?.year && <span className="text-xs font-bold text-gray-400">— اول دوره‌ی سال {info.year.title}</span>}</p>
          <p className="text-[11px] text-gray-500 leading-5">این عددها را با همان گزارش‌ها در نرم‌افزار قبلی مقایسه کنید.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="کالای فعال" value={faNum(s.items)} sub={s.itemsWithoutProduct ? `${faNum(s.itemsWithoutProduct)} بی‌محصول در سایت` : undefined} />
            <Stat label="موجودی اول دوره" value={faNum(s.stockQty)} sub={s.stockValue !== null ? <Money value={s.stockValue} className="text-[11px]" /> : `${faNum(s.stockLines)} ردیف`} />
            <Stat label="طلب اول دوره" value={<Money value={s.receivable} />} sub={`${faNum(s.parties)} شخص با مانده`} />
            <Stat label="بدهی اول دوره" value={<Money value={s.payable} />} />
            <Stat label="چک دریافتی باز" value={<Money value={s.chequesReceived.amount} />} sub={`${faNum(s.chequesReceived.count)} چک`} />
            <Stat label="چک صادره‌ی باز" value={<Money value={s.chequesIssued.amount} />} sub={`${faNum(s.chequesIssued.count)} چک`} />
            <Stat label="صندوق و بانک اول دوره" value={<Money value={s.treasury} />} sub="از «مانده‌های اول دوره»" href="/admin/accounting/opening" />
          </div>
        </Card>
      )}

      <div className="grid gap-2 sm:grid-cols-4">
        {ORDER.map((k, i) => {
          const allowed = info?.can[k] ?? false;
          return (
            <button
              key={k}
              type="button"
              disabled={!allowed}
              onClick={() => {
                setKind(k);
                setResult(null);
              }}
              className={`acc-card text-right p-3 rounded-2xl border transition disabled:opacity-40 ${kind === k ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/5"}`}
            >
              <span className="text-[11px] font-bold text-gray-400">مرحله‌ی {faNum(i + 1)}</span>
              <span className="block text-sm font-black mt-0.5">{IMPORT_KINDS[k].title}</span>
              <span className="block text-[11px] text-gray-500 leading-5 mt-1">{allowed ? IMPORT_KINDS[k].desc : "اجازه‌ی این بخش را ندارید"}</span>
            </button>
          );
        })}
      </div>

      {kind && (
        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className={`${btn.primary} cursor-pointer`}>
              {file ? "فایل دیگر" : "انتخاب فایل اکسل یا CSV"}
              <input type="file" accept=".xlsx,.csv,.xls,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            <button type="button" onClick={template} className={btn.soft}>
              دانلود نمونه‌ی ستون‌ها
            </button>
            {file && (
              <span className={`text-xs ${dataRows.length > 5000 ? "text-red-600 font-bold" : "text-gray-500"}`}>
                {file.name} — {faNum(dataRows.length)} ردیف{dataRows.length > 5000 && " — بیشتر از ۵٬۰۰۰ ردیف را چند تکه کنید"}
              </span>
            )}
          </div>

          {file && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {file.sheets.length > 1 && (
                  <Field label="برگه">
                    <select value={sheetIdx} onChange={(e) => setSheetIdx(Number(e.target.value))} className={inputCls}>
                      {file.sheets.map((x, i) => (
                        <option key={i} value={i}>
                          {x.name} ({faNum(x.rows.length)} ردیف)
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="ردیف سرستون" hint="ردیفی که نام ستون‌ها در آن است">
                  <input type="number" min={1} max={20} value={headerRow} onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
                </Field>
              </div>

              <div>
                <p className="text-sm font-black mb-2">هر ستون فایل کدام است؟</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <span className="w-36 shrink-0 text-xs font-bold">
                        {f.label}
                        {f.required && <span className="text-red-600"> *</span>}
                        {f.hint && <span className="block text-[10px] font-normal text-gray-400">{f.hint}</span>}
                      </span>
                      <select
                        value={map[f.key] ?? -1}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setMap((m) => {
                            const next = { ...m };
                            if (n < 0) delete next[f.key];
                            else next[f.key] = n;
                            return next;
                          });
                          setResult(null);
                        }}
                        className={`${inputCls} !py-1.5 text-xs ${f.required && map[f.key] === undefined ? "!border-red-300" : ""}`}
                      >
                        <option value={-1}>— ندارد —</option>
                        {header.map((h, i) => (
                          <option key={i} value={i}>
                            {colName(i)}: {h || "(بی‌نام)"} {dataRows[0]?.[i] ? `— مثلاً ${dataRows[0][i].slice(0, 24)}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {(kind === "items" || kind === "parties") && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={opts.update} onChange={(e) => setOpts({ ...opts, update: e.target.checked })} />
                    {kind === "items" ? "کالای با همان کد به‌روز شود" : "شخص موجود به‌روز شود"}
                  </label>
                )}
                {kind !== "items" || map.salePrice !== undefined ? (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={opts.rial} onChange={(e) => setOpts({ ...opts, rial: e.target.checked })} />
                    مبلغ‌های فایل <b>ریال</b> است (÷۱۰ به تومان)
                  </label>
                ) : null}
              </div>

              {kind === "stock" && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-5">
                  موجودی اول دوره جای موجودی همان کالا در همان انبار را می‌گیرد؛ کالاهای دیگرِ اول دوره دست نمی‌خورند. موجودی سایت کالاهای محصول‌دار هم با این عدد یکی می‌شود.
                </p>
              )}

              <ErrorText>{missing.length ? `ستون این‌ها را انتخاب کنید: ${missing.map((f) => f.label).join("، ")}` : null}</ErrorText>
              <button onClick={() => run(false)} disabled={!!busy || !!missing.length || !rows.length} className={`${btn.dark} w-full`}>
                {busy && !result ? busy : `بررسی ${faNum(rows.length)} ردیف`}
              </button>
            </>
          )}
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      {result && (
        <Card className="overflow-hidden">
          <div className="p-4 space-y-3">
            {result.committed ? (
              <p className="text-base font-black text-emerald-600">✅ ثبت شد</p>
            ) : (
              <p className="text-sm font-black">پیش‌نمایش — هنوز چیزی ثبت نشده</p>
            )}
            <Chips
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: `همه ${faNum(result.rows.length)}` },
                { value: "create", label: `تازه ${faNum(result.counts.create)}` },
                { value: "update", label: `به‌روز ${faNum(result.counts.update)}` },
                { value: "skip", label: `هست ${faNum(result.counts.skip)}` },
                { value: "error", label: `ایراد ${faNum(result.counts.error)}` },
              ]}
            />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
            {shown.slice(0, 500).map((r) => (
              <div key={r.row} className="flex items-start gap-3 px-4 py-2 text-sm">
                <span className="w-10 shrink-0 text-[11px] text-gray-400 tabular-nums">{faNum(fileRowNo[r.row - 1] ?? r.row)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-bold">{r.label}</span>
                  {r.message && <span className={`block text-[11px] ${r.action === "error" ? "text-red-600" : "text-gray-500"}`}>{r.message}</span>}
                </span>
                <Badge tone={ACTION[r.action].tone}>{ACTION[r.action].label}</Badge>
              </div>
            ))}
            {shown.length > 500 && <p className="px-4 py-2 text-xs text-gray-400">… و {faNum(shown.length - 500)} ردیف دیگر</p>}
          </div>
          {!result.committed && (
            <div className="p-4 border-t border-gray-100 dark:border-white/5">
              <button onClick={() => run(true)} disabled={!!busy || result.counts.error > 0 || result.counts.create + result.counts.update === 0} className={`${btn.primary} w-full`}>
                {busy
                  ? busy
                  : result.counts.error
                    ? `${faNum(result.counts.error)} ردیف ایراد دارد — فایل را درست کنید و دوباره بررسی کنید`
                    : `ثبت — ${faNum(result.counts.create)} تازه، ${faNum(result.counts.update)} به‌روزرسانی`}
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
