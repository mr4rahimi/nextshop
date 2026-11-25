"use client";

/**
 * صورت جریان وجوه نقد — روش مستقیم (استاندارد ۲)، webhesab-parity.md بخش ۳۴.۶.
 * هر عدد ← فهرست سندهایی که آن را ساخته‌اند (پاپ‌آپ) و دفتر همان حساب.
 */

import Link from "next/link";
import { useState } from "react";
import { formatJalali } from "@/lib/club/jalali";
import { faNum } from "@/lib/accounting/money";
import { RangeBar, rangeFor, type Range } from "../Statement";
import { api, Badge, Card, ErrorText, Sheet, Stat } from "../ui";
import { rangeText } from "./ProfitLossReport";
import { Amt, downloadCsv, ReportFrame, useReport, type Cell } from "./kit";
import { formatAmount } from "@/lib/accounting/money";

interface Line {
  accountId: string;
  code: string;
  name: string;
  in: string;
  out: string;
  net: string;
  prev: string | null;
}
interface Group {
  key: string;
  title: string;
  lines: Line[];
  in: string;
  out: string;
  net: string;
  prev: string | null;
}
interface Section {
  key: "operating" | "investing" | "financing";
  title: string;
  groups: Group[];
  in: string;
  out: string;
  net: string;
  prev: string | null;
}
interface Data {
  sections: Section[];
  opening: string;
  openingDocs: string;
  net: string;
  prevNet: string | null;
  closing: string;
  reconciled: boolean;
  vouchers: number;
}
interface Detail {
  total: string;
  count: number;
  rows: { id: string; number: number; date: string; description: string; amount: string }[];
}

const SECTION_HINT: Record<Section["key"], string> = {
  operating: "پولی که از کار روزانه‌ی فروشگاه آمد و رفت: فروش، خرید کالا، هزینه‌ها و مالیات.",
  investing: "خرید و فروش دارایی ثابت، ودیعه و سپرده.",
  financing: "وام و قسط‌هایش، آورده و برداشت صاحبان.",
};

export default function CashFlowReport() {
  const [range, setRange] = useState<Range>(() => rangeFor("year"));
  const [compare, setCompare] = useState(false);
  const { data, error, loading } = useReport<Data>("cashflow", { from: range.from, to: range.to, compare: compare && range.from ? "1" : null });
  const [detail, setDetail] = useState<{ line: Line; data: Detail | null; error: string | null } | null>(null);
  const hasPrev = !!data && data.prevNet !== null;

  function open(line: Line) {
    setDetail({ line, data: null, error: null });
    const qs = new URLSearchParams({ account: line.accountId || "_none", ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) });
    api<{ data: Detail }>(`/api/admin/accounting/reports/cashflow?${qs}`)
      .then((d) => setDetail((x) => (x ? { ...x, data: d.data } : x)))
      .catch((e: Error) => setDetail((x) => (x ? { ...x, error: e.message } : x)));
  }

  function exportCsv() {
    if (!data) return;
    const rows: Cell[][] = [["موجودی نقد ابتدای دوره", "", "", BigInt(data.opening) + BigInt(data.openingDocs)]];
    for (const s of data.sections) {
      rows.push([s.title, s.in, s.out, s.net]);
      for (const g of s.groups) {
        rows.push([`  ${g.title}`, g.in, g.out, g.net]);
        for (const l of g.lines) rows.push([`    ${l.name}`, l.in, l.out, l.net]);
      }
    }
    rows.push(["خالص افزایش (کاهش) وجه نقد", "", "", data.net], ["موجودی نقد پایان دوره", "", "", data.closing]);
    downloadCsv("cash-flow", ["شرح", "ورود", "خروج", "خالص"], rows);
  }

  const ledgerHref = (id: string) => `/admin/accounting/accounts/${id}?${new URLSearchParams({ ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) })}`;
  const startCash = data ? BigInt(data.opening) + BigInt(data.openingDocs) : 0n;
  const totalIn = data ? data.sections.reduce((s, x) => s + BigInt(x.in), 0n) : 0n;
  const totalOut = data ? data.sections.reduce((s, x) => s + BigInt(x.out), 0n) : 0n;

  return (
    <ReportFrame
      title="صورت جریان وجوه نقد"
      help="accountingCashFlow"
      desc="پول نقد و بانک از کجا آمد و کجا رفت — به تفکیک کار روزانه، دارایی‌ها و وام و سرمایه. روی هر عدد بزنید تا سندهایش را ببینید."
      printSub={rangeText(range)}
      onExport={exportCsv}
      error={error}
      loading={loading}
      filters={
        <div className="flex flex-wrap items-center gap-3">
          <RangeBar value={range} onChange={setRange} />
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} disabled={!range.from} />
            مقایسه با دوره‌ی قبل
          </label>
        </div>
      }
    >
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="موجودی نقد ابتدا" value={formatAmount(startCash)} sub={BigInt(data.openingDocs) ? `با ${formatAmount(data.openingDocs)} سند افتتاحیه` : undefined} href="/admin/accounting/reports/treasury" />
            <Stat label="ورود" value={formatAmount(totalIn)} tone="green" />
            <Stat label="خروج" value={formatAmount(totalOut)} tone="red" />
            <Stat label="موجودی نقد پایان" value={formatAmount(data.closing)} sub={`${faNum(data.vouchers)} سند نقدی`} tone="blue" href="/admin/accounting/reports/treasury" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {data.reconciled ? <Badge tone="green">✓ با موجودی صندوق و بانک می‌خواند</Badge> : <Badge tone="red">✗ با موجودی صندوق و بانک نمی‌خواند — با پشتیبانی تماس بگیرید</Badge>}
            <span className="text-gray-500">جابه‌جایی میان صندوق و بانک‌ها جریان حساب نمی‌شود.</span>
          </div>

          {data.sections.map((s) => (
            <Card key={s.key} className="overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm font-black">{s.title}</span>
                <span className="text-[11px] text-gray-500">{SECTION_HINT[s.key]}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="px-4 py-2 text-right font-bold">شرح</th>
                      <th className="px-3 py-2 text-left font-bold">ورود</th>
                      <th className="px-3 py-2 text-left font-bold">خروج</th>
                      <th className="px-3 py-2 text-left font-bold">خالص</th>
                      {hasPrev && <th className="px-4 py-2 text-left font-bold">دوره‌ی قبل</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {s.groups.length === 0 && (
                      <tr>
                        <td colSpan={hasPrev ? 5 : 4} className="px-4 py-3 text-xs text-gray-400">
                          در این بازه جریانی نبود.
                        </td>
                      </tr>
                    )}
                    {s.groups.map((g) => [
                      <tr key={g.key} className="border-t border-gray-100 dark:border-white/5 font-bold">
                        <td className="px-4 py-2">{g.title}</td>
                        <td className="px-3 py-2 text-left"><Amt v={g.in} /></td>
                        <td className="px-3 py-2 text-left"><Amt v={g.out} /></td>
                        <td className="px-3 py-2 text-left"><Amt v={g.net} /></td>
                        {hasPrev && <td className="px-4 py-2 text-left"><Amt v={g.prev} muted /></td>}
                      </tr>,
                      ...g.lines.map((l) => (
                        <tr key={`${g.key}:${l.accountId}`} onClick={() => open(l)} className="cursor-pointer text-xs text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-white/5">
                          <td className="px-4 py-1.5 pr-8">{l.name}</td>
                          <td className="px-3 py-1.5 text-left"><Amt v={l.in} muted /></td>
                          <td className="px-3 py-1.5 text-left"><Amt v={l.out} muted /></td>
                          <td className="px-3 py-1.5 text-left text-blue-600"><Amt v={l.net} /></td>
                          {hasPrev && <td className="px-4 py-1.5 text-left"><Amt v={l.prev} muted /></td>}
                        </tr>
                      )),
                    ])}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-white/5 font-black">
                      <td className="px-4 py-2.5">جریان خالص {s.title}</td>
                      <td className="px-3 py-2.5 text-left"><Amt v={s.in} /></td>
                      <td className="px-3 py-2.5 text-left"><Amt v={s.out} /></td>
                      <td className="px-3 py-2.5 text-left"><Amt v={s.net} strong /></td>
                      {hasPrev && <td className="px-4 py-2.5 text-left"><Amt v={s.prev} /></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ))}

          <Card className="p-4 space-y-1.5 text-sm">
            <Row label="خالص افزایش (کاهش) وجه نقد" v={data.net} prev={data.prevNet} strong />
            <Row label="موجودی نقد ابتدای دوره" v={data.opening} />
            {BigInt(data.openingDocs) !== 0n && <Row label="مانده‌های اول دوره (سند افتتاحیه در این بازه)" v={data.openingDocs} />}
            <div className="border-t border-gray-100 dark:border-white/5 pt-1.5">
              <Row label="موجودی نقد پایان دوره" v={data.closing} strong />
            </div>
          </Card>
        </>
      )}

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.line.name ?? ""} help="accountingCashFlow" wide>
        {detail && (
          <div className="space-y-3">
            <ErrorText>{detail.error}</ErrorText>
            {!detail.data && !detail.error && <p className="text-xs text-gray-400">در حال خواندن…</p>}
            {detail.data && (
              <>
                <p className="text-xs text-gray-500">
                  سهم این حساب از پول نقد در {faNum(detail.data.count)} سند ({rangeText(range)}) — جمع <b className="tabular-nums text-gray-900 dark:text-white">{formatAmount(detail.data.total)}</b>
                  {detail.data.count > detail.data.rows.length && <> · {faNum(detail.data.rows.length)} سند بزرگ‌تر نشان داده شده</>}
                </p>
                <div className="divide-y divide-gray-50 dark:divide-white/5 text-xs">
                  {detail.data.rows.map((r) => (
                    <Link key={r.id} href={`/admin/accounting/vouchers/${r.id}`} className="flex items-center gap-3 py-1.5 hover:text-blue-600">
                      <span className="tabular-nums text-gray-500 shrink-0">{formatJalali(new Date(r.date))}</span>
                      <span className="tabular-nums text-gray-400 shrink-0">سند {faNum(r.number)}</span>
                      <span className="truncate">{r.description}</span>
                      <span className="mr-auto shrink-0"><Amt v={r.amount} /></span>
                    </Link>
                  ))}
                </div>
                {detail.line.accountId && (
                  <Link href={ledgerHref(detail.line.accountId)} className="inline-block text-xs font-bold text-blue-600">
                    دفتر کامل حساب «{detail.line.name}» ←
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </Sheet>
    </ReportFrame>
  );
}

function Row({ label, v, prev, strong }: { label: string; v: string; prev?: string | null; strong?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${strong ? "font-black" : ""}`}>
      <span>{label}</span>
      {prev != null && (
        <span className="text-xs text-gray-400">
          قبل: <Amt v={prev} muted />
        </span>
      )}
      <span className="mr-auto">
        <Amt v={v} strong={strong} />
      </span>
    </div>
  );
}
