"use client";

/**
 * راهنمای سایز در ویرایش محصول — docs/features/size-guide.md.
 * فقط وقتی «راهنمای سایز» در تنظیمات فروشگاه (تب محصولات) روشن است دیده می‌شود.
 * جدول مثل اکسل (Enter = خانه‌ی بعد)، پر کردن سایزهای دیگر از روی یک سایز، کپی از محصول دیگر.
 */

import { useEffect, useState } from "react";
import SizeGuideDiagram from "@/components/store/product/SizeGuideDiagram";
import HelpButton from "@/components/admin/worklist/HelpButton";
import { renderSizeGuideImage } from "@/lib/size-guide-image";
import {
  FIT_LABEL,
  MAX_SIZE_COLUMNS,
  MAX_SIZE_ROWS,
  SIZE_GUIDE_KINDS,
  SIZE_PRESETS,
  SIZING_LABEL,
  defaultColumns,
  faNum,
  gradeRows,
  kindColumn,
  type SizeChart,
  type SizeColumn,
  type SizeFit,
  type SizeGuideKind,
  type SizeRun,
} from "@/lib/size-guide";

interface Data {
  enabled: boolean;
  chart: SizeChart | null;
  guessKind: SizeGuideKind;
  variantSizes: string[];
  suggest: { productId: string; title: string } | null;
  productTitle: string;
  storeName: string | null;
  imageUrl: string | null;
  removedImage?: string | null;
}
type Row = { size: string; values: Record<string, string> };

const inp =
  "w-full px-2.5 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-primary-500";
const chip = "px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-[11px] font-bold hover:border-primary-400 transition";

const toRows = (c: SizeChart): Row[] => c.rows.map((r) => ({ size: r.size, values: Object.fromEntries(c.columns.map((k) => [k.key, r.values[k.key] == null ? "" : String(r.values[k.key])])) }));
const parse = (v: string): number | null => {
  const n = Number(v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٫,]/g, "."));
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * `onGalleryChange` — عکس جدول در گالری عوض شد (فاز ۲)؛ فرم محصول فهرست عکس‌هایش را
 * هم‌سو می‌کند، وگرنه «بروزرسانی» فرم با فهرست کهنه عکس تازه را پاک می‌کرد.
 */
export default function SizeChartSection({ productId, onGalleryChange }: { productId: string; onGalleryChange?: (oldUrl: string | null, newUrl: string | null) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [kind, setKind] = useState<SizeGuideKind>("shirt");
  const [columns, setColumns] = useState<SizeColumn[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [fit, setFit] = useState<SizeFit | "">("");
  const [sizing, setSizing] = useState<SizeRun | "">("");
  const [note, setNote] = useState("");
  const [newSize, setNewSize] = useState("");
  const [steps, setSteps] = useState<Record<string, string>>({});
  const [base, setBase] = useState(0);
  const [overwrite, setOverwrite] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [copyQ, setCopyQ] = useState("");
  const [copyList, setCopyList] = useState<{ productId: string; title: string; kind: string; sizes: string[] }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [withImage, setWithImage] = useState(true);

  function applyChart(c: SizeChart) {
    setKind(c.kind);
    setColumns(c.columns);
    setRows(toRows(c));
    setFit(c.fit ?? "");
    setSizing(c.sizing ?? "");
    setNote(c.note ?? "");
  }

  function apply(d: Data) {
    setData(d);
    setWithImage(!d.chart || !!d.imageUrl);
    if (d.chart) applyChart(d.chart);
    else {
      setKind(d.guessKind);
      setColumns(defaultColumns(d.guessKind));
      // محصولی که از انبار با تنوع سایز ساخته شده: ردیف‌ها همان سایزها
      setRows(d.variantSizes.slice(0, MAX_SIZE_ROWS).map((size) => ({ size, values: {} })));
    }
  }

  useEffect(() => {
    fetch(`/api/admin/products/${productId}/size-chart`)
      .then((r) => r.json())
      .then((d) => d && "enabled" in d && apply(d))
      .catch(() => {});
  }, [productId]);

  // فاصله‌ی پیشنهادی هر ستون از نوع لباس
  useEffect(() => {
    setSteps((s) => Object.fromEntries(columns.map((c) => [c.key, s[c.key] ?? String(kindColumn(kind, c.key)?.step ?? 1)])));
  }, [columns, kind]);

  useEffect(() => {
    if (copyList === null) return;
    const h = setTimeout(() => {
      fetch(`/api/admin/products/size-charts?exclude=${productId}&q=${encodeURIComponent(copyQ)}`)
        .then((r) => r.json())
        .then((d) => setCopyList(d.items ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyQ, copyList === null, productId]);

  if (!data?.enabled) return null;

  const kindCols = SIZE_GUIDE_KINDS[kind].columns;

  function changeKind(k: SizeGuideKind) {
    setKind(k);
    if (k !== "custom") setColumns(defaultColumns(k));
  }

  function setSizes(sizes: string[]) {
    const byName = new Map(rows.map((r) => [r.size, r]));
    setRows(sizes.slice(0, MAX_SIZE_ROWS).map((s) => byName.get(s) ?? { size: s, values: {} }));
    setBase(0);
  }

  function addSize() {
    const s = newSize.trim();
    if (!s || rows.some((r) => r.size === s) || rows.length >= MAX_SIZE_ROWS) return;
    setRows((rs) => [...rs, { size: s, values: {} }]);
    setNewSize("");
  }

  function moveRow(i: number, d: -1 | 1) {
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const n = [...rs];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  const setCell = (i: number, key: string, v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, values: { ...r.values, [key]: v.replace(/[^\d۰-۹.٫]/g, "") } } : r)));

  /** Enter ← خانه‌ی بعد در همین ردیف، آخر ردیف ← اول ردیف بعد */
  function nextCell(e: React.KeyboardEvent<HTMLInputElement>, i: number, ci: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const [ni, nci] = ci + 1 < columns.length ? [i, ci + 1] : [i + 1, 0];
    document.querySelector<HTMLInputElement>(`[data-sz="${productId}-${ni}-${nci}"]`)?.focus();
  }

  function grade() {
    const numRows = rows.map((r) => ({ size: r.size, values: Object.fromEntries(columns.map((c) => [c.key, parse(r.values[c.key] ?? "")])) }));
    if (!numRows[base] || !columns.some((c) => numRows[base].values[c.key] != null)) {
      setMsg({ ok: false, text: "اول اندازه‌های سایز مبنا را کامل کنید" });
      return;
    }
    const st = Object.fromEntries(columns.map((c) => [c.key, parse(steps[c.key] ?? "") ?? 0]));
    const graded = gradeRows(numRows, base, st, overwrite);
    setRows(graded.map((r) => ({ size: r.size, values: Object.fromEntries(columns.map((c) => [c.key, r.values[c.key] == null ? "" : String(r.values[c.key])])) })));
    setMsg({ ok: true, text: "سایزهای دیگر پر شد — بررسی و ذخیره کنید" });
  }

  async function copyFrom(pid: string) {
    const r = await fetch(`/api/admin/products/${pid}/size-chart`);
    const d = await r.json();
    if (!d.chart) return setMsg({ ok: false, text: "آن محصول جدول ندارد" });
    applyChart(d.chart);
    setCopyList(null);
    setMsg({ ok: true, text: "جدول کپی شد — بعد از بررسی ذخیره کنید" });
  }

  async function uploadImage(chart: SizeChart, d: Data): Promise<string> {
    const file = await renderSizeGuideImage(chart, { productTitle: d.productTitle, storeName: d.storeName });
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const u = await r.json().catch(() => ({}));
    if (!r.ok || !u.url) throw new Error(`جدول ذخیره شد ولی عکسش بالا نرفت: ${u.error ?? r.status}`);
    return u.url;
  }

  async function putImage(url: string | null): Promise<string | null> {
    const r = await fetch(`/api/admin/products/${productId}/size-chart/image`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error ?? "عکس در گالری ثبت نشد");
    return d.old ?? null;
  }

  async function save(clear = false) {
    if (clear && !confirm("جدول سایز این محصول حذف شود؟")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/products/${productId}/size-chart`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clear ? { kind, columns, rows: [] } : { kind, columns, rows, fit: fit || null, sizing: sizing || null, note }),
      });
      const d: Data = await r.json();
      if (!r.ok) throw new Error((d as unknown as { error?: string }).error ?? "ذخیره نشد");
      const keepImage = withImage;
      apply(d);
      if (clear || !d.chart) {
        if (d.removedImage) onGalleryChange?.(d.removedImage, null);
        setMsg({ ok: true, text: "جدول سایز حذف شد" });
        return;
      }
      let imageText = "";
      if (keepImage) {
        const url = await uploadImage(d.chart, d);
        const old = await putImage(url);
        onGalleryChange?.(old, url);
        setData((x) => x && { ...x, imageUrl: url });
        imageText = " و عکسش آخر گالری گذاشته شد";
      } else if (d.imageUrl) {
        const old = await putImage(null);
        onGalleryChange?.(old, null);
        setData((x) => x && { ...x, imageUrl: null });
        imageText = " و عکسش از گالری برداشته شد";
      }
      setWithImage(keepImage);
      setMsg({ ok: true, text: `جدول سایز ذخیره شد (${faNum(rows.length)} سایز)${imageText}` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ذخیره نشد" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-black text-gray-900 dark:text-white">📏 راهنمای سایز</p>
          <HelpButton topic="sizeGuide" />
        </div>
        <p className="text-[11px] text-gray-400 mt-1 leading-5">
          لباس را پهن کنید و با متر اندازه بگیرید (سانتی‌متر، عرض نه دور). یک سایز را کامل بنویسید و بقیه را با «پر کردن خودکار» بسازید. روی صفحه‌ی محصول دکمه‌ی «راهنمای سایز» با طرح لباس و همین جدول می‌آید.
        </p>
      </div>

      {/* نوع و کپی */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={kind} onChange={(e) => changeKind(e.target.value as SizeGuideKind)} className={inp + " w-auto"} aria-label="نوع لباس">
          {(Object.keys(SIZE_GUIDE_KINDS) as SizeGuideKind[]).map((k) => (
            <option key={k} value={k}>
              {SIZE_GUIDE_KINDS[k].label}
            </option>
          ))}
        </select>
        {data.suggest && !rows.length && (
          <button type="button" onClick={() => copyFrom(data.suggest!.productId)} className={chip + " text-primary-600 border-primary-200"}>
            کپی از «{data.suggest.title}»
          </button>
        )}
        <button type="button" onClick={() => setCopyList((x) => (x === null ? [] : null))} className={chip}>
          کپی از محصول دیگر…
        </button>
      </div>
      {copyList !== null && (
        <div className="rounded-xl border border-gray-100 dark:border-white/5 p-3 space-y-2">
          <input value={copyQ} onChange={(e) => setCopyQ(e.target.value)} placeholder="نام محصولی که جدول دارد" className={inp} autoFocus />
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
            {copyList.map((it) => (
              <button key={it.productId} type="button" onClick={() => copyFrom(it.productId)} className="block w-full text-right px-2 py-2 text-xs hover:bg-gray-50 dark:hover:bg-white/5">
                <span className="font-bold">{it.title}</span>
                <span className="text-gray-400 ms-2" dir="ltr">
                  {it.sizes.join(" · ")}
                </span>
              </button>
            ))}
            {!copyList.length && <p className="px-2 py-2 text-[11px] text-gray-400">محصولی با جدول سایز نیست</p>}
          </div>
        </div>
      )}

      {/* ستون‌ها */}
      {kind === "custom" ? (
        <div className="space-y-2">
          <p className="text-xs font-black">اندازه‌ها (ستون‌ها)</p>
          {columns.map((c, i) => (
            <div key={c.key} className="flex gap-1.5">
              <input value={c.label} onChange={(e) => setColumns((cs) => cs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={inp} placeholder="مثلاً قد دامن" />
              <button type="button" onClick={() => setColumns((cs) => cs.filter((_, j) => j !== i))} className="px-2 text-rose-500" aria-label="حذف ستون">
                ×
              </button>
            </div>
          ))}
          {columns.length < MAX_SIZE_COLUMNS && (
            <button type="button" onClick={() => setColumns((cs) => [...cs, { key: `c${Date.now().toString(36)}`, label: "" }])} className={chip}>
              + اندازه
            </button>
          )}
        </div>
      ) : (
        kindCols.some((c) => c.optional) && (
          <div className="flex flex-wrap gap-3">
            {kindCols
              .filter((c) => c.optional)
              .map((c) => (
                <label key={c.key} className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={columns.some((x) => x.key === c.key)}
                    onChange={(e) =>
                      setColumns((cs) => (e.target.checked ? kindCols.filter((k) => k.key === c.key || cs.some((x) => x.key === k.key)).map(({ key, label }) => ({ key, label })) : cs.filter((x) => x.key !== c.key)))
                    }
                  />
                  {c.label} هم باشد
                </label>
              ))}
          </div>
        )
      )}

      {/* سایزها */}
      <div className="space-y-2">
        <p className="text-xs font-black">سایزها</p>
        <div className="flex flex-wrap gap-1.5">
          {data.variantSizes.length > 0 && (
            <button type="button" onClick={() => setSizes(data.variantSizes)} className={chip + " text-primary-600 border-primary-200"}>
              سایزهای تنوع محصول ({data.variantSizes.join("، ")})
            </button>
          )}
          {SIZE_PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setSizes(p.sizes)} className={chip}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 max-w-xs">
          <input
            value={newSize}
            onChange={(e) => setNewSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSize();
              }
            }}
            placeholder="سایز تازه (مثلاً 4XL)"
            className={inp}
            dir="ltr"
          />
          <button type="button" onClick={addSize} className="px-3 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-bold shrink-0">
            افزودن
          </button>
        </div>
      </div>

      {/* جدول */}
      {rows.length > 0 && columns.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-4">
          {kind !== "custom" && <SizeGuideDiagram kind={kind} keys={columns.map((c) => c.key)} active={active} className="w-36 shrink-0 self-center lg:self-start" />}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-1">
              <thead>
                <tr className="text-[10px] text-gray-400">
                  <th className="text-right font-black">سایز</th>
                  {columns.map((c) => {
                    const kc = kindColumn(kind, c.key);
                    return (
                      <th key={c.key} title={kc?.how} className="font-black whitespace-nowrap min-w-[64px]">
                        {kc?.letter && <span className="text-rose-500 me-1" dir="ltr">{kc.letter}</span>}
                        {c.label || "—"}
                      </th>
                    );
                  })}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.size}>
                    <td className="font-black whitespace-nowrap" dir="ltr">
                      {r.size}
                      {i === base && <span className="text-[9px] text-primary-600 ms-1">مبنا</span>}
                    </td>
                    {columns.map((c, ci) => (
                      <td key={c.key}>
                        <input
                          data-sz={`${productId}-${i}-${ci}`}
                          value={r.values[c.key] ?? ""}
                          onChange={(e) => setCell(i, c.key, e.target.value)}
                          onKeyDown={(e) => nextCell(e, i, ci)}
                          onFocus={() => setActive(c.key)}
                          onBlur={() => setActive(null)}
                          className={inp + " text-center tabular-nums"}
                          dir="ltr"
                          inputMode="decimal"
                          aria-label={`${r.size} ${c.label}`}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap text-gray-400">
                      <button type="button" onClick={() => moveRow(i, -1)} className="px-1" aria-label="بالا">
                        ↑
                      </button>
                      <button type="button" onClick={() => moveRow(i, 1)} className="px-1" aria-label="پایین">
                        ↓
                      </button>
                      <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="px-1 text-rose-500" aria-label="حذف سایز">
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* پر کردن خودکار */}
      {rows.length > 1 && columns.length > 0 && (
        <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] p-3 space-y-2">
          <p className="text-xs font-black">پر کردن خودکار سایزهای دیگر</p>
          <p className="text-[11px] text-gray-400 leading-5">سایز مبنا را کامل کنید و بگویید هر سایز چند سانت با سایز بعدی فرق دارد. سایزهای بالاتر بزرگ‌تر و پایین‌تر کوچک‌تر حساب می‌شوند.</p>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-[11px] text-gray-500 space-y-1">
              <span className="block">سایز مبنا</span>
              <select value={base} onChange={(e) => setBase(Number(e.target.value))} className={inp + " w-auto"} dir="ltr">
                {rows.map((r, i) => (
                  <option key={r.size} value={i}>
                    {r.size}
                  </option>
                ))}
              </select>
            </label>
            {columns.map((c) => (
              <label key={c.key} className="text-[11px] text-gray-500 space-y-1">
                <span className="block whitespace-nowrap">{c.label || "—"} ±</span>
                <input value={steps[c.key] ?? ""} onChange={(e) => setSteps((s) => ({ ...s, [c.key]: e.target.value }))} className={inp + " w-16 text-center"} dir="ltr" inputMode="decimal" />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button type="button" onClick={grade} className="px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black">
              پر کردن
            </button>
            <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              خانه‌های پرشده هم بازنویسی شود
            </label>
          </div>
        </div>
      )}

      {/* فرم و توضیح */}
      {rows.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2">
          <select value={fit} onChange={(e) => setFit(e.target.value as SizeFit | "")} className={inp} aria-label="فرم لباس">
            <option value="">فرم لباس — نامشخص</option>
            {(Object.keys(FIT_LABEL) as SizeFit[]).map((k) => (
              <option key={k} value={k}>
                فرم: {FIT_LABEL[k]}
              </option>
            ))}
          </select>
          <select value={sizing} onChange={(e) => setSizing(e.target.value as SizeRun | "")} className={inp} aria-label="قالب سایز">
            <option value="">قالب سایز — نامشخص</option>
            {(Object.keys(SIZING_LABEL) as SizeRun[]).map((k) => (
              <option key={k} value={k}>
                {SIZING_LABEL[k]}
              </option>
            ))}
          </select>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inp + " sm:col-span-2 leading-5"} placeholder="یادداشت برای مشتری (اختیاری) — مثلاً «پارچه کمی کش دارد»" maxLength={300} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)} />
            عکس راهنمای سایز آخر گالری باشد (با هر ذخیره دوباره ساخته می‌شود)
          </label>
          {data.imageUrl && (
            <a href={data.imageUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-primary-600 hover:underline">
              دیدن عکس فعلی
            </a>
          )}
        </div>
      )}

      {msg && <p className={`text-xs font-bold ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => save()} disabled={busy || !rows.length} className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-black disabled:opacity-50">
          {busy ? "…" : "ذخیره‌ی جدول سایز"}
        </button>
        {data.chart && (
          <button type="button" onClick={() => save(true)} disabled={busy} className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 text-xs font-bold">
            حذف جدول
          </button>
        )}
      </div>
    </div>
  );
}
