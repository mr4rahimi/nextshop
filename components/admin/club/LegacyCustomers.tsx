"use client";

/**
 * انتقال مشتریان از نرم‌افزار قبلی — docs/plans/webhesab-parity.md بخش ۲۴.
 * فایل CSV خروجی `scripts/webhesab/export-customers.py` در مرورگر خوانده و دسته‌دسته
 * فرستاده می‌شود (سقف درخواست nginx). اجرای دوباره فقط تازه‌ها را می‌افزاید و تغییرها را به‌روز می‌کند.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Button, ErrorBox, Skeleton, Table, Badge, useApi, PageHeader, Pager, fa, type ApiError } from "@/components/admin/sms/ui";
import HelpButton from "@/components/admin/worklist/HelpButton";

const PREVIEW_CHUNK = 2500;
const COMMIT_CHUNK = 500;

type Filter = "all" | "buyers" | "noMobile" | "inactive" | "unlinked";

interface Row {
  code: string; name: string; mobile: string | null; rawMobile: string | null; groupName: string | null; store: string | null; region: string | null;
  registeredAt: string | null; invoiceCount: number; spent: string; lastPurchaseAt: string | null; isActive: boolean; partyId: string | null; userId: string | null; profileId: string | null; cardNumber: string | null;
}
interface ListData {
  total: number; page: number; pages: number; rows: Row[];
  totals: { all: number; spent: string; invoices: number; lastImport: string | null; members: number; noMobile: number; inactive: number };
}
interface Summary {
  rows: number; active: number; inactive: number; withMobile: number; noMobile: number; members: number; sharedMobiles: number; existingUsers: number; newUsers: number;
  alreadyImported: number; existingParties: number; birthKept: number; birthDropped: number; buyers: number; invoices: number; spent: string; groups: Record<string, number>; cards: number;
}
interface Msg { line: number; text: string }

const toman = (v: string | number | bigint) => `${BigInt(v).toLocaleString("fa-IR")} تومان`;
const dateFa = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fa-IR") : "—");

/** CSV/TSV ساده با نقل‌قول دوتایی؛ BOM حذف می‌شود */
function parseTable(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const firstLine = t.slice(0, t.indexOf("\n") >>> 0);
  const sep = firstLine.includes("\t") ? "\t" : ",";
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"' && cell === "") q = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim()));
}

const digits = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");
const mobileKey = (v: string) => {
  const d = digits(v).replace(/^0098|^98|^0/, "");
  return /^9\d{9}$/.test(d) ? d : null;
};

function mergeSummary(a: Summary, b: Summary): Summary {
  const out = { ...a } as Summary;
  for (const k of Object.keys(b) as (keyof Summary)[]) {
    if (typeof b[k] === "number") (out as unknown as Record<string, number>)[k] = (a[k] as number) + (b[k] as number);
  }
  out.spent = (BigInt(a.spent) + BigInt(b.spent)).toString();
  out.groups = { ...a.groups };
  for (const [g, n] of Object.entries(b.groups)) out.groups[g] = (out.groups[g] ?? 0) + n;
  return out;
}

async function post<T>(body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; errors?: Msg[] }> {
  try {
    const r = await fetch("/api/admin/club/legacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: d.error ?? `خطای ${r.status}`, errors: d.errors };
    return { ok: true, data: d as T };
  } catch {
    return { ok: false, error: "ارتباط با سرور برقرار نشد" };
  }
}

export default function LegacyCustomers() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = useApi<ListData>(`/api/admin/club/legacy?filter=${filter}&q=${encodeURIComponent(search)}&page=${page}`, [filter, search, page]);
  const t = list.data?.totals;

  const pick = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };
  const stat = (label: string, value: string, f: Filter, hint?: string) => (
    <button onClick={() => pick(f)} className={`rounded-2xl border p-3 text-right transition hover:border-primary-400 ${filter === f ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10" : "border-gray-200 dark:border-gray-700"}`}>
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className="text-lg font-black tabular-nums">{value}</p>
      {hint && <p className="text-[10px] font-bold text-gray-400">{hint}</p>}
    </button>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="انتقال مشتریان از نرم‌افزار قبلی"
        hint="همه‌ی مشتریان وب حساب با موبایل، گروه، تاریخ ثبت و خلاصه‌ی خرید. هر مشتری با موبایل درست عضو باشگاه می‌شود و در صندوق با نام یا موبایل پیدا می‌شود. اجرای دوباره فقط مشتری‌های تازه را می‌افزاید."
        action={<HelpButton topic="clubLegacy" />}
      />

      {t && t.all > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stat("پرونده‌ها", fa(t.all), "all", t.lastImport ? `آخرین ورود ${dateFa(t.lastImport)}` : undefined)}
          {stat("عضو باشگاه", fa(t.members), "all", "با موبایل درست")}
          {stat("فاکتورها", fa(t.invoices), "buyers", "در نرم‌افزار قبلی")}
          {stat("جمع خرید", toman(t.spent), "buyers")}
          {stat("بی موبایل", fa(t.noMobile), "noMobile", "فقط شخص حسابداری")}
          {stat("غیرفعال", fa(t.inactive), "inactive")}
        </div>
      )}

      <ImportCard onDone={list.reload} />

      <Card
        title="پرونده‌ها"
        action={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q);
              setPage(1);
            }}
            className="flex gap-2"
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام، موبایل یا کد" className="h-9 w-48 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold dark:border-gray-700 dark:bg-gray-800" />
            <Button>جستجو</Button>
          </form>
        }
      >
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "همه"],
              ["buyers", "خریدارها"],
              ["noMobile", "بی موبایل"],
              ["inactive", "غیرفعال"],
              ["unlinked", "بی شخص حسابداری"],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button key={k} onClick={() => pick(k)} className={`rounded-xl px-3 py-1.5 text-xs font-black ${filter === k ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300"}`}>
              {l}
            </button>
          ))}
        </div>
        <ErrorBox err={list.err} onRetry={list.reload} />
        {!list.data ? (
          <Skeleton rows={5} />
        ) : !list.data.rows.length ? (
          <p className="py-6 text-center text-xs font-bold text-gray-400">{t?.all ? "چیزی پیدا نشد" : "هنوز مشتری‌ای وارد نشده — فایل خروجی را بالا انتخاب کنید"}</p>
        ) : (
          <>
            <Table head={["کد", "نام", "موبایل", "گروه", "فروشگاه", "ثبت", "فاکتور", "جمع خرید", "آخرین خرید", ""]}>
              {list.data.rows.map((r) => (
                <tr key={r.code} className="text-xs font-bold">
                  <td className="py-2.5 tabular-nums text-gray-500">{r.code}</td>
                  <td className="py-2.5">
                    {r.name}
                    {!r.isActive && <Badge text="غیرفعال" tone="muted" />}
                  </td>
                  <td className="py-2.5 tabular-nums" dir="ltr">{r.mobile ?? <span className="text-red-500">{r.rawMobile || "—"}</span>}</td>
                  <td className="py-2.5">{r.groupName ?? "—"}{r.cardNumber ? " · کارت" : ""}</td>
                  <td className="py-2.5 text-gray-500">{r.store ?? "—"}</td>
                  <td className="py-2.5 tabular-nums text-gray-500">{dateFa(r.registeredAt)}</td>
                  <td className="py-2.5 tabular-nums">{fa(r.invoiceCount)}</td>
                  <td className="py-2.5 tabular-nums">{toman(r.spent)}</td>
                  <td className="py-2.5 tabular-nums text-gray-500">{dateFa(r.lastPurchaseAt)}</td>
                  <td className="py-2.5 whitespace-nowrap">
                    {r.profileId && r.mobile && (
                      <Link href={`/admin/club/members?q=${r.mobile}`} className="text-primary-600 hover:underline">
                        عضو
                      </Link>
                    )}
                    {r.partyId && (
                      <Link href={`/admin/accounting/parties/${r.partyId}`} className="mr-2 text-primary-600 hover:underline">
                        حساب
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
            <Pager page={list.data.page} lastPage={list.data.pages} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

function ImportCard({ onDone }: { onDone: () => void }) {
  const [table, setTable] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [unit, setUnit] = useState<"rial" | "toman">("rial");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<ApiError | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errors, setErrors] = useState<Msg[]>([]);
  const [warnings, setWarnings] = useState<{ list: Msg[]; count: number }>({ list: [], count: 0 });
  const [result, setResult] = useState<{ rows: number; newUsers: number; newMembers: number; newParties: number; linkedParties: number; consented: number } | null>(null);

  // شمارش‌های سراسری که دسته‌ها جدا نمی‌دانند
  const local = useMemo(() => {
    if (!table) return null;
    const head = table[0].map((h) => h.replace(/[‌\s]/g, ""));
    const mi = head.findIndex((h) => ["موبایل", "تلفنهمراه", "شمارهموبایل", "mobile"].includes(h));
    const si = head.findIndex((h) => h === "وضعیت");
    const count = new Map<string, number>();
    let active = 0;
    for (const r of table.slice(1)) {
      const k = mi >= 0 ? mobileKey(r[mi] ?? "") : null;
      if (k) count.set(k, (count.get(k) ?? 0) + 1);
      if (k && !(si >= 0 && /غیر\s*فعال/.test(r[si] ?? ""))) active++;
    }
    return { unique: count.size, shared: [...count.values()].filter((n) => n > 1).length, active };
  }, [table]);

  async function load(f: File | undefined) {
    setSummary(null);
    setResult(null);
    setErrors([]);
    setErr(null);
    if (!f) return setTable(null);
    setFileName(f.name);
    if (!/\.(csv|tsv|txt)$/i.test(f.name)) {
      setTable(null);
      return setErr({ error: "فایل CSV خروجی ابزار انتقال را انتخاب کنید (اکسل را با «ذخیره به‌صورت CSV UTF-8» بسازید)" });
    }
    const rows = parseTable(await f.text());
    if (rows.length < 2) return setErr({ error: "فایل سطری ندارد" });
    setTable(rows);
  }

  async function preview() {
    if (!table) return;
    setBusy("بررسی");
    setErr(null);
    setErrors([]);
    setResult(null);
    const [header, ...body] = table;
    let acc: Summary | null = null;
    const errs: Msg[] = [];
    const warns: Msg[] = [];
    let warnCount = 0;
    for (let i = 0; i < body.length; i += PREVIEW_CHUNK) {
      setProgress(Math.round((i / body.length) * 100));
      const r = await post<{ summary: Summary; errors: Msg[]; warnings: Msg[]; warningCount: number }>({ mode: "preview", header, rows: body.slice(i, i + PREVIEW_CHUNK), offset: i, unit });
      if (!r.ok) {
        setBusy(null);
        return setErr({ error: r.error });
      }
      const s = r.data.summary;
      errs.push(...r.data.errors);
      if (warns.length < 200) warns.push(...r.data.warnings.slice(0, 200 - warns.length));
      warnCount += r.data.warningCount;
      acc = acc ? mergeSummary(acc, s) : s;
    }
    // کد تکراری میان دسته‌ها
    const head = header.map((h) => h.replace(/[‌\s]/g, ""));
    const ci = head.findIndex((h) => ["کد", "کدتفصیل", "کدمشتری", "کدشخص", "code"].includes(h));
    if (ci >= 0) {
      const seen = new Map<string, number>();
      body.forEach((r, i) => {
        const c = digits(r[ci] ?? "") || (r[ci] ?? "").trim();
        if (!c) return;
        const prev = seen.get(c);
        if (prev && Math.floor((prev - 2) / PREVIEW_CHUNK) !== Math.floor(i / PREVIEW_CHUNK)) errs.push({ line: i + 2, text: `کد ${c} تکراری است (سطر ${prev})` });
        if (!prev) seen.set(c, i + 2);
      });
    }
    if (acc && local) acc = { ...acc, members: local.active, sharedMobiles: local.shared, newUsers: Math.max(0, local.active - acc.existingUsers) };
    setSummary(acc);
    setErrors(errs.sort((a, b) => a.line - b.line));
    setWarnings({ list: warns, count: warnCount });
    setProgress(100);
    setBusy(null);
  }

  async function commit() {
    if (!table || !summary || errors.length) return;
    if (!window.confirm(`${fa(summary.rows)} مشتری ثبت شود؟ اجرای دوباره چیزی تکراری نمی‌سازد.`)) return;
    setBusy("ثبت");
    setErr(null);
    const [header, ...body] = table;
    const sum = { rows: 0, newUsers: 0, newMembers: 0, newParties: 0, linkedParties: 0, consented: 0 };
    for (let i = 0; i < body.length; i += COMMIT_CHUNK) {
      setProgress(Math.round((i / body.length) * 100));
      const r = await post<{ result: typeof sum }>({ mode: "commit", header, rows: body.slice(i, i + COMMIT_CHUNK), offset: i, unit, consent });
      if (!r.ok) {
        setBusy(null);
        setResult(sum);
        if (r.errors) setErrors(r.errors);
        onDone();
        return setErr({ error: `${r.error} — ${fa(i)} سطر اول ثبت شد؛ پس از رفع، همین فایل را دوباره ثبت کنید (تکراری ساخته نمی‌شود).` });
      }
      for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += r.data.result[k];
    }
    setProgress(100);
    setResult(sum);
    setBusy(null);
    onDone();
  }

  const s = summary;
  return (
    <Card title="ورود فایل" hint="خروجی ابزار scripts/webhesab/export-customers.py (CSV). اول «بررسی»، بعد «ثبت». مبلغ خرید در فایل ابزار به ریال است.">
      <ErrorBox err={err} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-xs font-black text-gray-600 hover:border-primary-400 dark:border-gray-600 dark:text-gray-300">
          {fileName || "انتخاب فایل CSV"}
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => void load(e.target.files?.[0])} />
        </label>
        {table && <span className="text-xs font-bold text-gray-500">{fa(table.length - 1)} سطر</span>}
        <select value={unit} onChange={(e) => setUnit(e.target.value as "rial" | "toman")} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold dark:border-gray-700 dark:bg-gray-800">
          <option value="rial">ستون «مبلغ خرید» به ریال</option>
          <option value="toman">ستون «مبلغ خرید» به تومان</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          رضایت پیامک برای عضوهای تازه
        </label>
        <Button onClick={preview} disabled={!table || !!busy}>بررسی</Button>
        <Button onClick={commit} disabled={!s || errors.length > 0 || !!busy}>ثبت</Button>
      </div>
      <p className="text-[11px] font-bold leading-6 text-gray-500">
        «رضایت پیامک» فقط برای مشتری‌هایی است که همین ورود عضوشان می‌کند (و شماره‌شان در فهرست لغو نیست)؛ اگر مشتریان در نرم‌افزار قبلی پیامک فروشگاه را می‌گرفتند تیک بزنید. امتیاز عضویت و امتیاز رضایت به این مشتری‌ها داده نمی‌شود.
      </p>
      {busy && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] font-bold text-gray-500">{busy}… {fa(progress)}٪ — صفحه را نبندید</p>
        </div>
      )}
      {s && (
        <div className="grid gap-2 text-xs font-bold text-gray-700 sm:grid-cols-2 lg:grid-cols-3 dark:text-gray-200">
          <p>سطرها: {fa(s.rows)} (فعال {fa(s.active)}، غیرفعال {fa(s.inactive)})</p>
          <p>عضو باشگاه: {fa(s.members)} موبایل — تازه {fa(s.newUsers)}، موجود {fa(s.existingUsers)}</p>
          <p>بی موبایل درست: {fa(s.noMobile)} (فقط شخص حسابداری)</p>
          <p>موبایل مشترک میان چند کد: {fa(s.sharedMobiles)} (یک عضو و یک شخص)</p>
          <p>از قبل واردشده: {fa(s.alreadyImported)} (به‌روز می‌شوند)</p>
          <p>خریدار: {fa(s.buyers)} — {fa(s.invoices)} فاکتور، {toman(s.spent)}</p>
          <p>تاریخ تولد: {fa(s.birthKept)} پذیرفته، {fa(s.birthDropped)} مشکوک کنار گذاشته شد</p>
          <p>گروه‌ها: {Object.entries(s.groups).map(([g, n]) => `${g} ${fa(n)}`).join("، ") || "—"} (برچسب عضو، نه سطح)</p>
          <p>کارت اشتراک: {fa(s.cards)} — با «کارت اشتراک ← ورود از نرم‌افزار قبلی» جدا وارد می‌شود</p>
        </div>
      )}
      {errors.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-xl bg-red-50 p-3 text-[11px] font-bold leading-6 text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <p>{fa(errors.length)} خطا — ثبت ممکن نیست:</p>
          {errors.slice(0, 100).map((e, i) => (
            <p key={i}>سطر {fa(e.line)}: {e.text}</p>
          ))}
        </div>
      )}
      {warnings.count > 0 && (
        <details className="rounded-xl bg-amber-50 p-3 text-[11px] font-bold leading-6 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <summary className="cursor-pointer">{fa(warnings.count)} هشدار (ثبت می‌شوند)</summary>
          {warnings.list.map((e, i) => (
            <p key={i}>سطر {fa(e.line)}: {e.text}</p>
          ))}
        </details>
      )}
      {result && (
        <p className="rounded-xl bg-emerald-50 p-3 text-xs font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {fa(result.rows)} سطر ثبت شد: {fa(result.newUsers)} مشتری تازه، {fa(result.newMembers)} عضو باشگاه تازه، {fa(result.newParties)} شخص حسابداری تازه، {fa(result.linkedParties)} شخص موجود وصل شد
          {result.consented ? `، ${fa(result.consented)} رضایت پیامک` : ""}.
        </p>
      )}
    </Card>
  );
}
