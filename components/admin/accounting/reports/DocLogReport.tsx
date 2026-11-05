"use client";

/** اسناد باطل‌شده و ویرایش‌شده — webhesab-parity.md بخش ۱۵ */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { rangeText } from "./ProfitLossReport";
import { api, Chips, inputCls, Segmented, Sheet } from "../ui";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum } from "./kit";

interface Change {
  label: string;
  before: string;
  after: string;
}
interface Row {
  id: string;
  docType: string;
  docId: string;
  label: string;
  href: string;
  docDate: string;
  partyName: string | null;
  reason: string | null;
  totalBefore: string | null;
  totalAfter: string | null;
  changes: Change[];
  actorName: string;
  approx: boolean;
  at: string;
}
interface Doc extends Row {
  key: string;
  edits: number;
  actors: string[];
  items: Row[];
}
interface Data {
  rows: Row[] | null;
  docs: Doc[] | null;
  counts: { byType: Record<string, number>; actors: { name: string; count: number }[] };
}

const TYPES: { value: string; label: string }[] = [
  { value: "", label: "همه" },
  { value: "AccInvoice", label: "فاکتور" },
  { value: "AccMoneyDoc", label: "دریافت و پرداخت" },
  { value: "AccVoucher", label: "سند دستی" },
  { value: "AccStockAdjust", label: "ورود و خروج کالا" },
  { value: "AccTransfer", label: "حواله" },
  { value: "AccStockCount", label: "انبارگردانی" },
  { value: "AccInstallmentPlan", label: "اقساط" },
  { value: "AccParty", label: "ادغام اشخاص" },
];

const when = (iso: string) => {
  const d = new Date(iso);
  return `${formatJalali(d)} ${d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" })}`;
};

export default function DocLogReport() {
  const sp = useSearchParams();
  const [action, setAction] = useState<"VOID" | "EDIT">(sp.get("action") === "EDIT" ? "EDIT" : "VOID");
  const [range, setRange] = useState<Range>(() => rangeFor("month"));
  const [docType, setDocType] = useState("");
  const [actor, setActor] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [state, setState] = useState<{ qs: string | null; data: Data | null; error: string | null }>({ qs: null, data: null, error: null });
  const [detail, setDetail] = useState<Doc | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const qs = new URLSearchParams(
    Object.entries({ action, from: range.from, to: range.to, docType, actor, q: term }).filter((e): e is [string, string] => !!e[1]),
  ).toString();
  useEffect(() => {
    let alive = true;
    api<Data>(`/api/admin/accounting/doc-log?${qs}`)
      .then((d) => alive && setState({ qs, data: d, error: null }))
      .catch((e: Error) => alive && setState((x) => ({ ...x, qs, error: e.message })));
    return () => {
      alive = false;
    };
  }, [qs]);
  const data = state.data;
  const total = data ? Object.values(data.counts.byType).reduce((s, n) => s + n, 0) : 0;

  function exportCsv() {
    if (!data) return;
    if (data.rows) {
      downloadCsv("voided-docs", ["زمان ابطال", "سند", "تاریخ سند", "طرف حساب", "مبلغ", "دلیل", "کاربر"], data.rows.map((r) => [when(r.at), r.label, formatJalali(new Date(r.docDate)), r.partyName, r.totalBefore, r.reason, r.actorName]));
    } else if (data.docs) {
      downloadCsv("edited-docs", ["سند", "تاریخ سند", "طرف حساب", "تعداد ویرایش", "آخرین ویرایش", "مبلغ قبل", "مبلغ بعد", "کاربران"], data.docs.map((d) => [d.label, formatJalali(new Date(d.docDate)), d.partyName, d.edits, when(d.at), d.items[d.items.length - 1].totalBefore, d.totalAfter, d.actors.join("، ")]));
    }
  }

  return (
    <ReportFrame
      title={action === "VOID" ? "اسناد باطل‌شده" : "اسناد ویرایش‌شده"}
      help="accountingDocLog"
      desc="هر ابطال و هر ویرایش سند ثبت‌شده، با زمان، کاربر و دلیل. بازه روی زمان ابطال/ویرایش است، نه تاریخ خود سند."
      printSub={rangeText(range)}
      onExport={exportCsv}
      error={state.error}
      loading={state.qs !== qs}
      filters={
        <>
          <Segmented<"VOID" | "EDIT">
            value={action}
            onChange={(v) => {
              setAction(v);
              setDetail(null);
            }}
            options={[
              { value: "VOID", label: "🗑 باطل‌شده‌ها" },
              { value: "EDIT", label: "✏️ ویرایش‌شده‌ها" },
            ]}
          />
          <RangeBar value={range} onChange={setRange} />
          <Chips
            value={docType}
            onChange={setDocType}
            options={TYPES.filter((t) => !t.value || data?.counts.byType[t.value] || docType === t.value).map((t) => ({
              ...t,
              count: t.value ? data?.counts.byType[t.value] ?? 0 : total,
            }))}
          />
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="شماره سند، طرف حساب یا دلیل" className={`${inputCls} max-w-xs`} />
            <select value={actor} onChange={(e) => setActor(e.target.value)} className={`${inputCls} max-w-[14rem]`}>
              <option value="">همه‌ی کاربران</option>
              {data?.counts.actors.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} ({faNum(a.count)})
                </option>
              ))}
            </select>
          </div>
        </>
      }
    >
      {data?.rows && (
        <Table
          head={
            <tr>
              <th className={th}>#</th>
              <th className={th}>زمان ابطال</th>
              <th className={th}>سند</th>
              <th className={th}>تاریخ سند</th>
              <th className={th}>طرف حساب</th>
              <th className={thNum}>مبلغ</th>
              <th className={th}>دلیل</th>
              <th className={th}>کاربر</th>
            </tr>
          }
        >
          {!data.rows.length && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-sm text-gray-400">
                در این بازه سندی باطل نشده است.
              </td>
            </tr>
          )}
          {data.rows.map((r, i) => (
            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
              <td className={`${td} text-gray-400`}>{faNum(i + 1)}</td>
              <td className={`${td} whitespace-nowrap`} title={r.approx ? "پیش از دفتر ابطال باطل شده؛ زمان = آخرین تغییر سند" : undefined}>
                {r.approx && "≈ "}
                {when(r.at)}
              </td>
              <td className={`${td} whitespace-nowrap`}>
                <Link href={r.href} className="font-bold text-blue-600 hover:underline">
                  {r.label}
                </Link>
              </td>
              <td className={`${td} whitespace-nowrap`}>{formatJalali(new Date(r.docDate))}</td>
              <td className={td}>{r.partyName ?? "—"}</td>
              <td className={tdNum}>{r.totalBefore ? <Amt v={r.totalBefore} /> : "—"}</td>
              <td className={`${td} text-xs text-gray-600 dark:text-gray-300`}>{r.reason || "—"}</td>
              <td className={`${td} whitespace-nowrap`}>
                <button type="button" onClick={() => setActor(r.actorName)} className="hover:text-blue-600" title="فقط ابطال‌های همین کاربر">
                  {r.actorName}
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {data?.docs && (
        <Table
          head={
            <tr>
              <th className={th}>سند</th>
              <th className={th}>تاریخ سند</th>
              <th className={th}>طرف حساب</th>
              <th className={thNum}>تعداد ویرایش</th>
              <th className={th}>آخرین ویرایش</th>
              <th className={thNum}>مبلغ پیش از ویرایش</th>
              <th className={thNum}>مبلغ فعلی</th>
              <th className={th}>کاربران</th>
            </tr>
          }
        >
          {!data.docs.length && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-sm text-gray-400">
                در این بازه سند ثبت‌شده‌ای ویرایش نشده است.
              </td>
            </tr>
          )}
          {data.docs.map((d) => (
            <tr key={d.key} className="hover:bg-gray-50 dark:hover:bg-white/5">
              <td className={`${td} whitespace-nowrap`}>
                <Link href={d.href} className="font-bold text-blue-600 hover:underline">
                  {d.label}
                </Link>
              </td>
              <td className={`${td} whitespace-nowrap`}>{formatJalali(new Date(d.docDate))}</td>
              <td className={td}>{d.partyName ?? "—"}</td>
              <td className={tdNum}>
                <button type="button" onClick={() => setDetail(d)} className="rounded-lg bg-blue-50 px-2 py-0.5 font-black text-blue-700 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300">
                  {faNum(d.edits)}
                </button>
              </td>
              <td className={`${td} whitespace-nowrap`}>{when(d.at)}</td>
              <td className={tdNum}>
                <button type="button" onClick={() => setDetail(d)} className="hover:text-blue-600">
                  <Amt v={d.items[d.items.length - 1].totalBefore} muted />
                </button>
              </td>
              <td className={tdNum}>
                <button type="button" onClick={() => setDetail(d)} className="hover:text-blue-600">
                  <Amt v={d.totalAfter} />
                </button>
              </td>
              <td className={`${td} text-xs`}>{d.actors.join("، ")}</td>
            </tr>
          ))}
        </Table>
      )}

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? `ویرایش‌های ${detail.label}` : ""} wide>
        {detail && (
          <div className="space-y-3">
            <Link href={detail.href} className="text-xs font-bold text-blue-600">
              باز کردن سند ←
            </Link>
            {detail.items.map((it) => (
              <div key={it.id} className="rounded-xl border border-gray-200 p-3 dark:border-white/10">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  {when(it.at)} · {it.actorName}
                </p>
                <table className="mt-2 w-full text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="py-1 text-right font-bold">چه چیزی</th>
                      <th className="py-1 text-right font-bold">قبل</th>
                      <th className="py-1 text-right font-bold">بعد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {it.changes.map((c, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-white/5">
                        <td className="py-1 font-bold">{c.label}</td>
                        <td className="py-1 text-red-600 line-through decoration-red-300">{c.before}</td>
                        <td className="py-1 text-emerald-700 dark:text-emerald-300">{c.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </ReportFrame>
  );
}
