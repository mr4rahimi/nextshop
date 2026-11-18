"use client";

/**
 * سامانه‌ی مودیان — خروجی اکسل استاندارد، بارگذاری نتیجه‌ی واسط، ثبت دستی شماره‌ی مالیاتی.
 * docs/plans/webhesab-parity.md بخش ۳۰. همه‌ی عددها ریالی و همان عددهای فایل‌اند (`lib/accounting/moadian.ts`).
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { RangeBar, rangeFor, rangeQuery, type Range } from "./Statement";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, PageHeader, Sheet, Stat } from "./ui";

interface Body {
  sstid: string;
  sstt: string;
  am: string;
  fee: string;
  prdis: string;
  dis: string;
  adis: string;
  vra: string;
  vam: string;
  tsstam: string;
}
interface Row {
  invoiceId: string;
  type: "SALES" | "SALES_RETURN";
  number: number | null;
  date: string;
  partyName: string;
  partyId: string;
  ins: 1 | 3 | 4;
  inty: 1 | 2;
  intyNote: string | null;
  status: string | null;
  taxId: string | null;
  irtaxid: string | null;
  refId: string | null;
  inno: string | null;
  setm: number;
  header: { tob: number | null; bid: string | null; tinb: string | null; bpc: string | null; tprdis: string; tdis: string; tadis: string; tvam: string; tbill: string; cap: string | null; insp: string | null };
  body: Body[];
  diff: string;
  issues: string[];
  missing: { id: string; title: string }[];
}
interface Data {
  rows: Row[];
  blockers: string[];
  counts: Record<string, number>;
  can: { manage: boolean };
}

type Scope = "pending" | "exported" | "sent" | "all";

const STATUS: Record<string, { label: string; tone: "amber" | "green" | "red" | "gray" | "blue" }> = {
  EXPORTED: { label: "در فایل — منتظر نتیجه", tone: "amber" },
  CANCEL_EXPORTED: { label: "ابطال در فایل", tone: "amber" },
  SENT: { label: "ثبت شد", tone: "green" },
  CANCELED: { label: "ابطال شد", tone: "gray" },
  FAILED: { label: "رد شد", tone: "red" },
};
const INS = { 1: "اصلی", 3: "ابطالی", 4: "برگشت از فروش" } as const;
const rial = (v: string | bigint) => `${formatAmount(v)} ریال`;

export default function MoadianClient() {
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [scope, setScope] = useState<Scope>("pending");
  const [type2, setType2] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Row | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api<Data>(`/api/admin/accounting/moadian?${rangeQuery(range)}&scope=${scope}${type2 ? "&type2=1" : ""}`);
      setData(d);
      setPick(new Set(d.rows.filter((r) => !r.issues.length && (scope === "pending" || scope === "exported")).map((r) => r.invoiceId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "بارگذاری نشد");
    }
  }, [range, scope, type2]);
  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];
  const ready = rows.filter((r) => !r.issues.length);
  const picked = rows.filter((r) => pick.has(r.invoiceId));
  const sum = useMemo(() => picked.reduce((s, r) => s + BigInt(r.header.tbill), 0n), [picked]);
  const selectable = (r: Row) => !r.issues.length && r.status !== "SENT" && r.status !== "CANCELED";

  async function download() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/accounting/moadian", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "export", ...Object.fromEntries(new URLSearchParams(rangeQuery(range))), type2, ids: [...pick] }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "فایل ساخته نشد");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "moadian.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg(`${faNum(Number(res.headers.get("x-count") ?? 0))} صورتحساب در فایل آمد و به «در فایل — منتظر نتیجه» رفت.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فایل ساخته نشد");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm(`${faNum(pick.size)} صورتحساب به «آماده‌ی ارسال» برگردد؟ فقط وقتی فایل به واسط نرسیده.`)) return;
    setBusy(true);
    try {
      await api("/api/admin/accounting/moadian", { method: "POST", json: { action: "reset", ids: [...pick] } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/accounting/moadian", { method: "POST", body: fd });
      const r = (await res.json()) as { error?: string; sent: number; failed: number; unknown: number; notFound: string[] };
      if (!res.ok) throw new Error(r.error ?? "خوانده نشد");
      setMsg(`نتیجه: ${faNum(r.sent)} ثبت شد، ${faNum(r.failed)} رد شد${r.unknown ? `، ${faNum(r.unknown)} سریال ناشناس (${r.notFound.join("، ")})` : ""}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خوانده نشد");
    } finally {
      setBusy(false);
    }
  }

  const c = data?.counts ?? {};
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        title="سامانه‌ی مودیان"
        help="accountingMoadian"
        desc="فاکتورهای فروش در قالب اکسل استاندارد مودیان برای نرم‌افزار واسط؛ با بارگذاری نتیجه، شماره‌ی مالیاتی روی هر فاکتور می‌نشیند."
        actions={
          data?.can.manage && (
            <label className={`${btn.soft} cursor-pointer`}>
              بارگذاری نتیجه
              <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={busy} />
            </label>
          )
        }
      />

      {!!data?.blockers.length && (
        <Card className="p-4 mb-4 border border-red-200 dark:border-red-500/30">
          {data.blockers.map((b) => (
            <p key={b} className="text-sm font-bold text-red-600">
              {b}
            </p>
          ))}
          <Link href="/admin/accounting/settings?tab=seller" className="text-xs font-bold text-blue-600 hover:underline">
            رفتن به تنظیمات ←
          </Link>
        </Card>
      )}

      <Card className="p-4 mb-4 space-y-3">
        <RangeBar value={range} onChange={setRange} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Chips
            value={scope}
            onChange={setScope}
            options={[
              { value: "pending", label: "آماده‌ی ارسال" },
              { value: "exported", label: "در فایل", count: (c.EXPORTED ?? 0) + (c.CANCEL_EXPORTED ?? 0) },
              { value: "sent", label: "ثبت‌شده", count: (c.SENT ?? 0) + (c.CANCELED ?? 0) },
              { value: "all", label: "همه" },
            ]}
          />
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={type2} onChange={(e) => setType2(e.target.checked)} />
            همه بدون اطلاعات خریدار (نوع دوم)
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="صورتحساب‌ها" value={faNum(rows.length)} />
        <Stat label="بی‌ایراد" value={faNum(ready.length)} tone="green" />
        <Stat label="ایرادار" value={faNum(rows.length - ready.length)} tone={rows.length - ready.length ? "red" : "gray"} />
        <Stat label="انتخاب‌شده" value={faNum(picked.length)} sub={rial(sum)} />
      </div>

      <ErrorText>{error}</ErrorText>
      {msg && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{msg}</p>}

      {data?.can.manage && (scope === "pending" || scope === "exported" || scope === "all") && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={download} disabled={busy || !pick.size || !!data.blockers.length} className={btn.primary}>
            {busy ? "…" : `دانلود اکسل (${faNum(pick.size)})`}
          </button>
          {scope === "exported" && (
            <button onClick={reset} disabled={busy || !pick.size} className={btn.soft}>
              برگرداندن به آماده
            </button>
          )}
        </div>
      )}

      {!data ? (
        <p className="text-sm text-gray-400">…</p>
      ) : !rows.length ? (
        <Empty title="صورتحسابی در این بازه نیست" desc={scope === "pending" ? "همه‌ی فاکتورهای فروش این بازه ارسال شده‌اند یا فاکتوری نیست." : undefined} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] text-gray-500 bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="p-2 w-8">
                  <input
                    type="checkbox"
                    aria-label="انتخاب همه"
                    checked={rows.filter(selectable).every((r) => pick.has(r.invoiceId)) && rows.some(selectable)}
                    onChange={(e) => setPick(new Set(e.target.checked ? rows.filter(selectable).map((r) => r.invoiceId) : []))}
                  />
                </th>
                <th className="p-2 text-right">فاکتور</th>
                <th className="p-2 text-right">خریدار</th>
                <th className="p-2 text-right">صورتحساب</th>
                <th className="p-2 text-left">مجموع (ریال)</th>
                <th className="p-2 text-right">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((r) => (
                <tr key={`${r.invoiceId}-${r.ins}`} className={r.issues.length ? "bg-red-50/50 dark:bg-red-500/5" : ""}>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      disabled={!selectable(r)}
                      checked={pick.has(r.invoiceId)}
                      onChange={(e) => setPick((p) => { const n = new Set(p); if (e.target.checked) n.add(r.invoiceId); else n.delete(r.invoiceId); return n; })}
                    />
                  </td>
                  <td className="p-2">
                    <Link href={`/admin/accounting/invoices/${r.invoiceId}`} className="font-bold text-blue-600 hover:underline">
                      {r.type === "SALES_RETURN" ? "برگشت " : ""}
                      {faNum(r.number ?? 0)}
                    </Link>
                    <span className="block text-[11px] text-gray-400">{formatJalali(new Date(r.date))}</span>
                  </td>
                  <td className="p-2">
                    <Link href={`/admin/accounting/parties/${r.partyId}`} className="hover:text-blue-600">
                      {r.partyName}
                    </Link>
                  </td>
                  <td className="p-2 text-xs">
                    <span className="font-bold">{r.inty === 1 ? "نوع اول" : "نوع دوم"}</span> · {INS[r.ins]}
                    {r.intyNote && <span className="block text-[10px] text-gray-400">{r.intyNote}</span>}
                    {r.issues.map((i) => (
                      <span key={i} className="block text-[11px] font-bold text-red-600">
                        {i}
                      </span>
                    ))}
                    {!!r.missing.length && (
                      <span className="block text-[11px]">
                        {r.missing.slice(0, 4).map((m, k) => (
                          <Link key={m.id} href={`/admin/accounting/inventory/${m.id}`} className="text-blue-600 hover:underline">
                            {k ? "، " : ""}
                            {m.title}
                          </Link>
                        ))}
                        {r.missing.length > 4 && ` و ${faNum(r.missing.length - 4)} کالای دیگر`}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-left">
                    <button onClick={() => setOpen(r)} className="font-bold tabular-nums hover:text-blue-600 hover:underline">
                      {formatAmount(r.header.tbill)}
                    </button>
                    {r.diff !== "0" && <span className="block text-[10px] text-gray-400">خرده‌ی قطع اعشار {formatAmount(r.diff)}</span>}
                  </td>
                  <td className="p-2">
                    {r.status ? <Badge tone={STATUS[r.status]?.tone ?? "gray"}>{STATUS[r.status]?.label ?? r.status}</Badge> : <Badge>آماده</Badge>}
                    {r.taxId && <span className="block text-[10px] font-mono text-gray-500" dir="ltr">{r.taxId}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {open && <RowSheet row={open} canManage={!!data?.can.manage} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function RowSheet({ row: r, canManage, onClose, onSaved }: { row: Row; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [taxId, setTaxId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const h = r.header;
  async function save() {
    setError(null);
    try {
      await api("/api/admin/accounting/moadian", { method: "POST", json: { action: "taxid", id: r.invoiceId, taxId } });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    }
  }
  return (
    <Sheet open onClose={onClose} title={`${r.type === "SALES_RETURN" ? "برگشت" : "فاکتور"} ${faNum(r.number ?? 0)} — ${INS[r.ins]}`} help="accountingMoadian">
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span>نوع: {r.inty === 1 ? "اول (با خریدار)" : "دوم"}</span>
          <span>تسویه: {r.setm === 1 ? "نقدی" : r.setm === 2 ? "نسیه" : "نقدی/نسیه"}</span>
          {h.tinb && <span>شماره‌ی اقتصادی خریدار: <span dir="ltr">{h.tinb}</span></span>}
          {h.bid && <span>کد/شناسه‌ی ملی: <span dir="ltr">{h.bid}</span></span>}
          {h.bpc && <span>کد پستی: <span dir="ltr">{h.bpc}</span></span>}
          {r.irtaxid && <span className="col-span-2">مرجع: <span dir="ltr" className="font-mono">{r.irtaxid}</span></span>}
          {r.inno && <span>سریال داخلی: <span dir="ltr" className="font-mono">{r.inno}</span></span>}
        </div>
        {r.body.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="p-1 text-right">کالا / شناسه</th>
                  <th className="p-1">تعداد</th>
                  <th className="p-1 text-left">مبلغ واحد</th>
                  <th className="p-1 text-left">تخفیف</th>
                  <th className="p-1 text-left">مالیات</th>
                  <th className="p-1 text-left">جمع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {r.body.map((b, i) => (
                  <tr key={i}>
                    <td className="p-1">
                      {b.sstt}
                      <span className="block font-mono text-[10px] text-gray-400" dir="ltr">{b.sstid}</span>
                    </td>
                    <td className="p-1 text-center tabular-nums">{faNum(b.am)}</td>
                    <td className="p-1 text-left tabular-nums">{formatAmount(b.fee.split(".")[0])}{b.fee.includes(".") ? `.${b.fee.split(".")[1]}` : ""}</td>
                    <td className="p-1 text-left tabular-nums">{formatAmount(b.dis)}</td>
                    <td className="p-1 text-left tabular-nums">{b.vam !== "0" ? `${formatAmount(b.vam)} (${faNum(b.vra)}٪)` : "—"}</td>
                    <td className="p-1 text-left tabular-nums font-bold">{formatAmount(b.tsstam)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="space-y-1 rounded-xl bg-gray-50 p-3 text-xs dark:bg-white/5">
          <p className="flex justify-between"><span>پیش از تخفیف</span><span className="tabular-nums">{rial(h.tprdis)}</span></p>
          <p className="flex justify-between"><span>تخفیف</span><span className="tabular-nums">{rial(h.tdis)}</span></p>
          <p className="flex justify-between"><span>مالیات بر ارزش افزوده</span><span className="tabular-nums">{rial(h.tvam)}</span></p>
          <p className="flex justify-between font-bold"><span>مجموع صورتحساب</span><span className="tabular-nums">{rial(h.tbill)}</span></p>
          {h.cap && <p className="flex justify-between"><span>نقدی / نسیه (بی‌مالیات)</span><span className="tabular-nums">{formatAmount(h.cap)} / {formatAmount(h.insp ?? "0")}</span></p>}
        </div>
        {canManage && r.status !== "SENT" && r.status !== "CANCELED" && (
          <Field label={r.status === "CANCEL_EXPORTED" ? "شماره‌ی مالیاتی ابطالیه" : "ثبت دستی شماره‌ی منحصربه‌فرد مالیاتی"} hint="۲۲ نویسه، از کارپوشه یا پیام واسط">
            <div className="flex gap-2">
              <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={`${inputCls} font-mono`} dir="ltr" />
              <button onClick={save} disabled={!taxId.trim()} className={btn.primary}>
                ثبت
              </button>
            </div>
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
        <Link href={`/admin/accounting/invoices/${r.invoiceId}`} className="block text-xs font-bold text-blue-600 hover:underline">
          باز کردن فاکتور ←
        </Link>
      </div>
    </Sheet>
  );
}
