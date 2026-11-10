"use client";

/**
 * بودجه در برابر عملکرد — docs/plans/webhesab-parity.md بخش ۲۲.
 * نام حساب ← ریز ماه‌به‌ماه؛ عدد عملکرد ← دفتر همان حساب در همان بازه.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { Badge, btn, Card, Empty, Field, inputCls, Segmented, Sheet, Stat } from "../ui";
import { Amt, downloadCsv, ReportFrame, Table, td, tdNum, th, thNum, useReport } from "./kit";

interface MonthCell {
  seq: number;
  label: string;
  from: string;
  to: string;
  budget: string;
  actual: string;
}
type Status = "ok" | "off" | "unbudgeted";
interface Row {
  accountId: string;
  code: string;
  name: string;
  contra: boolean;
  goodWhenUp: boolean;
  budget: string;
  actual: string;
  usedPct: number | null;
  status: Status;
  months: MonthCell[];
}
interface Section {
  key: string;
  title: string;
  rows: Row[];
  budget: string;
  actual: string;
}
interface Figures {
  netSales: string;
  gross: string;
  otherIncome: string;
  expenses: string;
  net: string;
}
interface Data {
  year: { id: string; title: string };
  years: { id: string; title: string; status: string }[];
  months: { seq: number; label: string }[];
  fromSeq: number;
  toSeq: number;
  from: string;
  to: string;
  hasBudget: boolean;
  sections: Section[];
  totals: { budget: Figures; actual: Figures };
  counts: { off: number; unbudgeted: number };
  canManage: boolean;
}
type Show = "all" | "off" | "unbudgeted";

const EDIT = "/admin/accounting/budget";
const day = (iso: string) => iso.slice(0, 10);
const ledgerHref = (id: string, from: string, to: string) => `/admin/accounting/accounts/${id}?from=${day(from)}&to=${day(to)}`;

function Diff({ budget, actual, goodWhenUp, neutral }: { budget: string; actual: string; goodWhenUp: boolean; neutral?: boolean }) {
  const d = BigInt(actual) - BigInt(budget);
  if (d === 0n) return <span className="text-gray-400">—</span>;
  const good = goodWhenUp ? d > 0n : d < 0n;
  const tone = neutral ? "text-gray-500" : good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return (
    <span dir="ltr" className={`tabular-nums font-bold ${tone}`}>
      {d > 0n ? "+" : "−"}
      {formatAmount(d < 0n ? -d : d)}
    </span>
  );
}

function UsedBar({ row }: { row: Row }) {
  if (row.usedPct === null) return <span className="text-gray-400">—</span>;
  const width = Math.min(Math.max(row.usedPct, 0), 100);
  const bar = row.status === "off" ? "bg-red-500" : "bg-emerald-500";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums text-xs">{faNum(row.usedPct)}٪</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" aria-hidden>
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${width}%` }} />
      </span>
    </span>
  );
}

function StatusBadge({ row }: { row: Row }) {
  if (row.status === "unbudgeted") return <Badge tone="amber">بی‌بودجه</Badge>;
  if (row.status === "off") return <Badge tone="red">{row.goodWhenUp ? "عقب از برنامه" : "فراتر از برنامه"}</Badge>;
  return <Badge tone="green">مطابق برنامه</Badge>;
}

export default function BudgetReport() {
  const [yearId, setYearId] = useState("");
  const [fromSeq, setFromSeq] = useState("");
  const [toSeq, setToSeq] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const { data, error, loading } = useReport<Data>("budget", { yearId, fromSeq, toSeq });

  const sections = useMemo(() => {
    if (!data) return [];
    const text = q.trim();
    return data.sections
      .map((s) => ({
        ...s,
        rows: s.rows.filter((r) => (show === "all" || r.status === show) && (!text || r.name.includes(text) || r.code.includes(text))),
      }))
      .filter((s) => s.rows.length);
  }, [data, show, q]);

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      "budget",
      ["بخش", "کد", "حساب", "بودجه", "عملکرد", "اختلاف", "درصد مصرف"],
      data.sections.flatMap((s) =>
        s.rows.map((r) => [s.title, r.code, r.name, r.budget, r.actual, (BigInt(r.actual) - BigInt(r.budget)).toString(), r.usedPct ?? ""]),
      ),
    );
  }

  const figures = data
    ? ([
        ["فروش خالص", "netSales", true],
        ["سود ناخالص", "gross", true],
        ["سایر درآمدها", "otherIncome", true],
        ["هزینه‌ها", "expenses", false],
        ["سود خالص", "net", true],
      ] as const)
    : [];

  return (
    <ReportFrame
      title="بودجه در برابر عملکرد"
      help="accountingBudget"
      desc="برنامه‌ی هر حساب کنار عملکرد واقعی؛ عددها با سود و زیان همان بازه یکی است."
      printSub={data ? `${data.year.title} — ${formatJalali(new Date(data.from))} تا ${formatJalali(new Date(data.to))}` : undefined}
      onExport={data ? exportCsv : undefined}
      error={error}
      loading={loading}
      filters={
        data && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Field label="سال مالی">
                <select
                  className={inputCls}
                  value={data.year.id}
                  onChange={(e) => {
                    setYearId(e.target.value);
                    setFromSeq("");
                    setToSeq("");
                  }}
                >
                  {data.years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="از ماه">
                <select className={inputCls} value={data.fromSeq} onChange={(e) => setFromSeq(e.target.value)}>
                  {data.months.map((m) => (
                    <option key={m.seq} value={m.seq}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="تا ماه">
                <select className={inputCls} value={data.toSeq} onChange={(e) => setToSeq(e.target.value)}>
                  {data.months.map((m) => (
                    <option key={m.seq} value={m.seq}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="جستجوی حساب">
                <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام یا کد حساب" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<Show>
                value={show}
                onChange={setShow}
                options={[
                  { value: "all", label: "همه" },
                  { value: "off", label: `خارج از برنامه (${faNum(data.counts.off)})` },
                  { value: "unbudgeted", label: `بی‌بودجه (${faNum(data.counts.unbudgeted)})` },
                ]}
              />
              {data.canManage && (
                <Link href={`${EDIT}?yearId=${data.year.id}`} className={`${btn.soft} mr-auto`}>
                  ✏️ تنظیم بودجه
                </Link>
              )}
            </div>
          </>
        )
      }
    >
      {data && !data.hasBudget && (
        <Empty
          title={`برای ${data.year.title} بودجه‌ای ثبت نشده`}
          desc={data.canManage ? "برای هر حساب برنامه‌ی ماهانه بگذارید یا از عملکرد سال قبل بسازید." : "کسی که مجوز تنظیمات حسابداری دارد باید بودجه را ثبت کند."}
          action={
            data.canManage ? (
              <Link href={`${EDIT}?yearId=${data.year.id}`} className={btn.primary}>
                تنظیم بودجه
              </Link>
            ) : undefined
          }
        />
      )}

      {data?.hasBudget && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="فروش خالص" value={formatAmount(data.totals.actual.netSales)} sub={`برنامه ${formatAmount(data.totals.budget.netSales)}`} />
            <Stat label="هزینه‌ها" value={formatAmount(data.totals.actual.expenses)} sub={`برنامه ${formatAmount(data.totals.budget.expenses)}`} />
            <Stat label="سود خالص" value={formatAmount(data.totals.actual.net)} sub={`برنامه ${formatAmount(data.totals.budget.net)}`} />
          </div>

          <Table
            head={
              <tr>
                <th className={th}>حساب</th>
                <th className={thNum}>بودجه</th>
                <th className={thNum}>عملکرد</th>
                <th className={thNum}>اختلاف</th>
                <th className={thNum}>مصرف</th>
                <th className={th}>وضعیت</th>
              </tr>
            }
          >
            {sections.map((s) => (
              <SectionRows key={s.key} section={s} from={data.from} to={data.to} onDetail={setDetail} />
            ))}
            {!sections.length && (
              <tr>
                <td className={`${td} text-center text-gray-400`} colSpan={6}>
                  حسابی با این فیلتر پیدا نشد
                </td>
              </tr>
            )}
          </Table>

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className={th}>خلاصه</th>
                  <th className={thNum}>بودجه</th>
                  <th className={thNum}>عملکرد</th>
                  <th className={thNum}>اختلاف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {figures.map(([label, key, up]) => (
                  <tr key={key} className={key === "net" ? "font-black" : undefined}>
                    <td className={td}>{label}</td>
                    <td className={tdNum}>
                      <Amt v={data.totals.budget[key]} />
                    </td>
                    <td className={tdNum}>
                      <Amt v={data.totals.actual[key]} />
                    </td>
                    <td className={tdNum}>
                      <Diff budget={data.totals.budget[key]} actual={data.totals.actual[key]} goodWhenUp={up} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? `${faNum(detail.code)} — ${detail.name}` : ""} wide>
        {detail && <MonthDetail row={detail} />}
      </Sheet>
    </ReportFrame>
  );
}

function SectionRows({ section, from, to, onDetail }: { section: Section; from: string; to: string; onDetail: (r: Row) => void }) {
  return (
    <>
      <tr className="bg-gray-50 font-black dark:bg-white/[0.04]">
        <td className={td}>{section.title}</td>
        <td className={tdNum}>
          <Amt v={section.budget} />
        </td>
        <td className={tdNum}>
          <Amt v={section.actual} />
        </td>
        <td colSpan={3} />
      </tr>
      {section.rows.map((r) => (
        <tr key={r.accountId}>
          <td className={td}>
            <button type="button" onClick={() => onDetail(r)} className="text-right hover:text-blue-600">
              <span className="font-bold">{r.name}</span>
              <span className="mr-2 text-[11px] tabular-nums text-gray-400">{faNum(r.code)}</span>
              {r.contra && <span className="mr-2 text-[11px] text-gray-400">کاهنده</span>}
            </button>
          </td>
          <td className={tdNum}>
            <Amt v={r.budget} />
          </td>
          <td className={tdNum}>
            <Link href={ledgerHref(r.accountId, from, to)} className="hover:text-blue-600" title="دفتر این حساب در همین بازه">
              <Amt v={r.actual} />
            </Link>
          </td>
          <td className={tdNum}>
            <Diff budget={r.budget} actual={r.actual} goodWhenUp={r.goodWhenUp} neutral={r.status === "unbudgeted"} />
          </td>
          <td className={tdNum}>
            <UsedBar row={r} />
          </td>
          <td className={td}>
            <StatusBadge row={r} />
          </td>
        </tr>
      ))}
    </>
  );
}

function MonthDetail({ row }: { row: Row }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500">
            <th className={th}>ماه</th>
            <th className={thNum}>بودجه</th>
            <th className={thNum}>عملکرد</th>
            <th className={thNum}>اختلاف</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {row.months.map((m) => (
            <tr key={m.seq}>
              <td className={td}>{m.label}</td>
              <td className={tdNum}>
                <Amt v={m.budget} />
              </td>
              <td className={tdNum}>
                <Link href={ledgerHref(row.accountId, m.from, m.to)} className="hover:text-blue-600" title="دفتر این حساب در همین ماه">
                  <Amt v={m.actual} />
                </Link>
              </td>
              <td className={tdNum}>
                <Diff budget={m.budget} actual={m.actual} goodWhenUp={row.goodWhenUp} neutral={BigInt(m.budget) === 0n} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-black">
            <td className={td}>جمع</td>
            <td className={tdNum}>
              <Amt v={row.budget} />
            </td>
            <td className={tdNum}>
              <Amt v={row.actual} />
            </td>
            <td className={tdNum}>
              <Diff budget={row.budget} actual={row.actual} goodWhenUp={row.goodWhenUp} neutral={row.status === "unbudgeted"} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
