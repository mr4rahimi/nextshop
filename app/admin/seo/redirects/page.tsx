"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ALLOWED_STATUS,
  STATUS_LABEL,
  MATCH_LABEL,
  normalizePath,
  normalizeDestination,
  validateRule,
  type RedirectMatch,
} from "@/lib/redirects";

type Row = {
  id: string;
  source: string;
  destination: string;
  statusCode: number;
  matchType: RedirectMatch;
  isActive: boolean;
  hits: number;
  lastHitAt: string | null;
  note: string | null;
};

const EMPTY = {
  source: "",
  destination: "",
  statusCode: 301,
  matchType: "EXACT" as RedirectMatch,
  isActive: true,
  note: "",
};

export default function RedirectsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [csv, setCsv] = useState("");
  const [importMode, setImportMode] = useState<"skip" | "overwrite">("skip");
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<null | {
    created: number; updated: number; skipped: number; failed: number; errors: string[];
  }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/redirects?q=${encodeURIComponent(q)}&page=${page}`);
    const data = await res.json();
    setRows(data.items || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function openNew() {
    setForm({ ...EMPTY });
    setEditing(null);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(r: Row) {
    setForm({
      source: r.source,
      destination: r.destination,
      statusCode: r.statusCode,
      matchType: r.matchType,
      isActive: r.isActive,
      note: r.note || "",
    });
    setEditing(r);
    setErrors({});
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const local = validateRule(form);
    if (local.length) {
      setErrors(Object.fromEntries(local.map((x) => [x.field, x.message])));
      return;
    }
    setSaving(true);
    setErrors({});
    const res = await fetch("/api/admin/redirects", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.errors) {
        setErrors(Object.fromEntries(data.errors.map((x: { field: string; message: string }) => [x.field, x.message])));
      } else {
        setErrors({ source: "ذخیره نشد" });
      }
      return;
    }
    setShowForm(false);
    setToast("ذخیره شد — تا حداکثر ۶۰ ثانیه دیگر روی سایت اعمال می‌شود");
    load();
  }

  async function toggleActive(r: Row) {
    await fetch("/api/admin/redirects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...r, isActive: !r.isActive }),
    });
    load();
  }

  async function remove(r: Row) {
    if (!confirm(`ریدایرکت «${r.source}» حذف شود؟`)) return;
    await fetch(`/api/admin/redirects?id=${r.id}`, { method: "DELETE" });
    setToast("حذف شد");
    load();
  }

  async function runImport() {
    const items = parseCsv(csv);
    if (!items.length) {
      setReport({ created: 0, updated: 0, skipped: 0, failed: 0, errors: ["هیچ ردیف معتبری پیدا نشد"] });
      return;
    }
    setImporting(true);
    const res = await fetch("/api/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, mode: importMode }),
    });
    setReport(await res.json());
    setImporting(false);
    load();
  }

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ریدایرکت‌ها</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            آدرس‌های قدیمی را به آدرس جدید هدایت کنید تا رتبه‌ی گوگل حفظ شود.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport((v) => !v); setReport(null); }}
            className="px-4 py-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-300"
          >
            ورود دسته‌ای
          </button>
          <button
            onClick={openNew}
            className="px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-bold hover:bg-primary-600"
          >
            ریدایرکت جدید
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-sm text-green-800 dark:text-green-300">
          {toast}
        </div>
      )}

      {showImport && (
        <div className="mb-6 p-5 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10">
          <h2 className="font-bold text-gray-900 dark:text-white mb-2">ورود دسته‌ای از CSV</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
            هر خط: <code className="font-mono">مبدأ,مقصد,کد,نوع</code> — کد و نوع اختیاری‌اند
            (پیش‌فرض ۳۰۱ و دقیق). خط اول اگر عنوان ستون باشد نادیده گرفته می‌شود.
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            dir="ltr"
            rows={8}
            placeholder={"/product/147/old-name,/products/new-name,301,EXACT\n/old-blog,/mag,301"}
            className="w-full font-mono text-xs p-3 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-100"
          />
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="radio" checked={importMode === "skip"} onChange={() => setImportMode("skip")} />
              مبدأهای تکراری رد شوند
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="radio" checked={importMode === "overwrite"} onChange={() => setImportMode("overwrite")} />
              مبدأهای تکراری بازنویسی شوند
            </label>
            <button
              onClick={runImport}
              disabled={importing}
              className="px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-bold disabled:opacity-50"
            >
              {importing ? "در حال ورود…" : "شروع ورود"}
            </button>
          </div>

          {report && (
            <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-black/30 text-sm">
              <div className="flex gap-4 flex-wrap text-gray-700 dark:text-gray-300">
                <span>ساخته‌شده: <b className="text-green-600 dark:text-green-400">{report.created}</b></span>
                <span>به‌روزشده: <b>{report.updated}</b></span>
                <span>ردشده: <b>{report.skipped}</b></span>
                <span>ناموفق: <b className="text-red-600 dark:text-red-400">{report.failed}</b></span>
              </div>
              {report.errors?.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-400 font-mono" dir="ltr">
                  {report.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="mb-6 p-5 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 space-y-4">
          <h2 className="font-bold text-gray-900 dark:text-white">
            {editing ? "ویرایش ریدایرکت" : "ریدایرکت جدید"}
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="آدرس مبدأ (قدیمی)" error={errors.source}>
              <input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                onBlur={(e) => form.matchType !== "REGEX" && setForm({ ...form, source: normalizePath(e.target.value) })}
                dir="ltr"
                placeholder="/product/147/old-name"
                className={inputCls(errors.source)}
              />
            </Field>

            <Field label="آدرس مقصد (جدید)" error={errors.destination} hint={form.statusCode === 410 ? "برای کد ۴۱۰ لازم نیست" : undefined}>
              <input
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                onBlur={(e) => setForm({ ...form, destination: normalizeDestination(e.target.value) })}
                dir="ltr"
                disabled={form.statusCode === 410}
                placeholder="/products/new-name"
                className={inputCls(errors.destination)}
              />
            </Field>

            <Field label="نوع ریدایرکت" error={errors.statusCode}>
              <select
                value={form.statusCode}
                onChange={(e) => setForm({ ...form, statusCode: Number(e.target.value) })}
                className={inputCls()}
              >
                {ALLOWED_STATUS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Field>

            <Field label="نحوه‌ی تطبیق">
              <select
                value={form.matchType}
                onChange={(e) => setForm({ ...form, matchType: e.target.value as RedirectMatch })}
                className={inputCls()}
              >
                {(Object.keys(MATCH_LABEL) as RedirectMatch[]).map((m) => (
                  <option key={m} value={m}>{MATCH_LABEL[m]}</option>
                ))}
              </select>
            </Field>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {form.matchType === "EXACT" && "فقط همین آدرس دقیق هدایت می‌شود."}
            {form.matchType === "PREFIX" && "هر آدرسی که با این مسیر شروع شود هدایت می‌شود و دنباله‌اش به مقصد اضافه می‌شود."}
            {form.matchType === "REGEX" && "الگوی regex؛ در مقصد می‌توانید از $1، $2 … استفاده کنید."}
          </p>

          <Field label="یادداشت (اختیاری)">
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="مثلاً: مهاجرت اسفند"
              className={inputCls()}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            فعال باشد
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-bold disabled:opacity-50">
              {saving ? "ذخیره…" : "ذخیره"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-sm font-bold">
              انصراف
            </button>
          </div>
        </form>
      )}

      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1); }}
        placeholder="جستجو در مبدأ، مقصد یا یادداشت…"
        className="w-full mb-4 px-4 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-gray-100"
      />

      <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr className="text-xs text-gray-500 dark:text-gray-400">
                <Th>مبدأ</Th><Th>مقصد</Th><Th>کد</Th><Th>نوع</Th><Th>بازدید</Th><Th>وضعیت</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">در حال بارگذاری…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">
                  هنوز ریدایرکتی ثبت نشده. از «گزارش ۴۰۴» می‌توانید ببینید کاربران به چه آدرس‌هایی می‌خورند.
                </td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-white/5">
                  <Td><span dir="ltr" className="font-mono text-xs break-all">{r.source}</span></Td>
                  <Td><span dir="ltr" className="font-mono text-xs break-all text-gray-500 dark:text-gray-400">{r.statusCode === 410 ? "—" : r.destination}</span></Td>
                  <Td><span className="tabular-nums">{r.statusCode}</span></Td>
                  <Td><span className="text-xs">{MATCH_LABEL[r.matchType]}</span></Td>
                  <Td><span className="tabular-nums">{r.hits.toLocaleString("fa-IR")}</span></Td>
                  <Td>
                    <button
                      onClick={() => toggleActive(r)}
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.isActive
                          ? "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400"
                          : "bg-gray-100 dark:bg-white/10 text-gray-500"
                      }`}
                    >
                      {r.isActive ? "فعال" : "غیرفعال"}
                    </button>
                  </Td>
                  <Td>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(r)} className="text-xs text-primary-600 dark:text-primary-400 font-bold">ویرایش</button>
                      <button onClick={() => remove(r)} className="text-xs text-red-600 dark:text-red-400 font-bold">حذف</button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm disabled:opacity-40">قبلی</button>
          <span className="text-sm text-gray-500 tabular-nums">{page} از {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm disabled:opacity-40">بعدی</button>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-right font-bold px-4 py-3">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-gray-900 dark:text-gray-200 align-middle">{children}</td>;
}
function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
      {!error && hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
function inputCls(error?: string) {
  return `w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border text-sm text-gray-900 dark:text-gray-100 disabled:opacity-40 ${
    error ? "border-red-400 dark:border-red-500/50" : "border-gray-200 dark:border-white/10"
  }`;
}

/**
 * CSV ساده — بدون کتابخانه، چون فرمت ورودی ما فیلد نقل‌قول‌دار ندارد.
 * ستون‌ها: مبدأ، مقصد، کد (اختیاری)، نوع (اختیاری)، یادداشت (اختیاری)
 */
function parseCsv(text: string) {
  const out: Array<{ source: string; destination: string; statusCode: number; matchType: string; note?: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const cells = t.split(",").map((c) => c.trim());
    if (cells.length < 2) continue;
    // خط عنوان
    if (/^(source|old|old_url|مبدأ)$/i.test(cells[0])) continue;
    const statusCode = Number(cells[2]) || 301;
    const matchType = (cells[3] || "EXACT").toUpperCase();
    out.push({
      source: cells[0],
      destination: cells[1],
      statusCode,
      matchType: ["EXACT", "PREFIX", "REGEX"].includes(matchType) ? matchType : "EXACT",
      note: cells[4] || undefined,
    });
  }
  return out;
}
