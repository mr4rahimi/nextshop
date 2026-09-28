"use client";

/**
 * پرونده و صورت‌حساب یک شخص — «ریز حساب» (همه‌ی ردیف‌ها با مانده‌ی جاری) یا
 * «کل حساب» (جمع گردش به تفکیک نوع عملیات و حساب، فاز ۱۰). چاپ هر دو در
 * `/parties/[id]/print`.
 */

import { useCallback, useEffect, useState } from "react";
import { faNum } from "@/lib/accounting/money";
import PartyForm, { type PartyRecord } from "./PartyForm";
import StatementView, { RangeBar, rangeFor, rangeQuery, SOURCE_LABELS, type Range, type StatementData } from "./Statement";
import { api, Badge, BalanceLabel, btn, Card, ErrorText, Money, PageHeader, Segmented, SectionTitle } from "./ui";
import Link from "next/link";
import { formatJalali } from "@/lib/club/jalali";
import { invoiceTitle, StatusBadge, type InvoiceRow } from "./invoices/InvoicesList";

export interface PartySummary {
  opening: string;
  debit: string;
  credit: string;
  closing: string;
  bySource: { source: string; debit: string; credit: string; count: number }[];
  byAccount: { accountId: string; code: string; name: string; debit: string; credit: string; count: number }[];
}
interface Data {
  party: PartyRecord;
  balance: string;
  statement: StatementData;
  summary: PartySummary;
  links: { user: { id: string; phone: string } | null; supplier: { id: string; name: string } | null };
  can: { manage: boolean };
}

export default function PartyDetailClient({ id }: { id: string }) {
  const [range, setRange] = useState<Range>(() => rangeFor("year"));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [mode, setMode] = useState<"detail" | "summary">("detail");

  // فاکتورهای این شخص — هر سمتی که کاربر اجازه‌ی دیدنش را دارد
  useEffect(() => {
    Promise.all(
      (["sales", "purchases"] as const).map((side) =>
        api<{ items: InvoiceRow[] }>(`/api/admin/accounting/invoices?side=${side}&partyId=${id}&take=30`).then((d) => d.items).catch(() => [] as InvoiceRow[]),
      ),
    ).then(([a, b]) => setInvoices([...a, ...b].sort((x, y) => y.date.localeCompare(x.date))));
  }, [id]);

  const load = useCallback(() => {
    api<Data>(`/api/admin/accounting/parties/${id}?${rangeQuery(range)}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [id, range]);
  useEffect(load, [load]);

  if (!data) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const p = data.party;

  return (
    <div className="space-y-5">
      <PageHeader
        title={p.name}
        help="accountingParty"
        back={{ href: "/admin/accounting/parties", label: "اشخاص" }}
        actions={
          <>
            <Link href={`/admin/accounting/money/new?kind=RECEIPT&partyId=${id}`} className={btn.soft}>
              📥 دریافت
            </Link>
            <Link href={`/admin/accounting/money/new?kind=PAYMENT&partyId=${id}`} className={btn.soft}>
              📤 پرداخت
            </Link>
            {data.can.manage && (
              <button onClick={() => setEdit(true)} className={btn.soft}>
                ✏️ ویرایش
              </button>
            )}
          </>
        }
      />

      <Card className="p-4 grid gap-4 sm:grid-cols-[1fr_auto] items-center">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge>کد {faNum(p.code)}</Badge>
            <Badge>{p.personType === "LEGAL" ? "حقوقی" : "حقیقی"}</Badge>
            {p.isCustomer && <Badge tone="green">مشتری</Badge>}
            {p.isSupplier && <Badge tone="blue">تأمین‌کننده</Badge>}
            {p.isEmployee && <Badge tone="amber">کارمند</Badge>}
            {p.isMarketplace && <Badge tone="blue">بازارگاه</Badge>}
            {!p.isActive && <Badge tone="red">غیرفعال</Badge>}
            {data.links.user && <Badge tone="green">مشتری سایت</Badge>}
            {data.links.supplier && <Badge tone="blue">تأمین‌کننده‌ی کارتابل</Badge>}
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            {p.mobile && <Info k="موبایل" v={<span dir="ltr">{faNum(p.mobile)}</span>} />}
            {p.phone && <Info k="تلفن" v={<span dir="ltr">{faNum(p.phone)}</span>} />}
            {p.nationalId && <Info k={p.personType === "LEGAL" ? "شناسه ملی" : "کد ملی"} v={faNum(p.nationalId)} />}
            {p.economicCode && <Info k="کد اقتصادی" v={faNum(p.economicCode)} />}
            {p.city && <Info k="شهر" v={p.city} />}
            {p.postalCode && <Info k="کد پستی" v={faNum(p.postalCode)} />}
          </dl>
          {p.address && <p className="text-xs text-gray-500">{p.address}</p>}
          {p.note && <p className="text-xs text-gray-500 bg-gray-50 dark:bg-white/5 rounded-lg px-2 py-1.5">{p.note}</p>}
        </div>
        <div className="sm:text-left border-t sm:border-t-0 sm:border-r border-gray-100 dark:border-white/5 pt-3 sm:pt-0 sm:pr-5">
          <p className="text-[11px] text-gray-500 mb-1">مانده‌ی امروز</p>
          <div className="text-xl">
            <BalanceLabel balance={data.balance} />
          </div>
        </div>
      </Card>

      <section>
        <SectionTitle
          title="صورت‌حساب"
          help="accountingParty"
          actions={
            <Link href={`/admin/accounting/parties/${id}/print?mode=${mode}&${rangeQuery(range)}`} target="_blank" className={btn.small}>
              🖨️ چاپ {mode === "detail" ? "ریز حساب" : "کل حساب"}
            </Link>
          }
        />
        <div className="mb-3 space-y-2">
          <div className="max-w-xs">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "detail", label: "ریز حساب" },
                { value: "summary", label: "کل حساب" },
              ]}
            />
          </div>
          <RangeBar value={range} onChange={setRange} />
        </div>
        {mode === "detail" ? <StatementView data={data.statement} kind="party" /> : <SummaryView s={data.summary} />}
      </section>

      {invoices && invoices.length > 0 && (
        <section>
          <SectionTitle title="فاکتورها" help="accountingInvoice" />
          <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`/admin/accounting/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5">
                <span className={`flex-1 text-sm font-bold ${inv.status === "VOID" ? "line-through text-gray-400" : ""}`}>
                  {invoiceTitle(inv)}
                  <span className="text-[11px] font-normal text-gray-400 mr-2">{formatJalali(new Date(inv.date))}</span>
                </span>
                <StatusBadge inv={inv} />
                <Money value={inv.total} className="text-sm" />
              </Link>
            ))}
          </Card>
        </section>
      )}

      {edit && (
        <PartyForm
          open
          party={p}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-gray-400 inline">{k}: </dt>
      <dd className="inline font-bold text-gray-700 dark:text-gray-200">{v}</dd>
    </div>
  );
}

/** «کل حساب» — جمع گردش بازه به تفکیک نوع عملیات و حساب */
export function SummaryView({ s }: { s: PartySummary }) {
  const tag = (v: string) => {
    const b = BigInt(v);
    return b === 0n ? "تسویه" : b > 0n ? "بدهکار (طلب ما)" : "بستانکار (بدهی ما)";
  };
  const abs = (v: string) => (BigInt(v) < 0n ? String(-BigInt(v)) : v);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ["مانده‌ی ابتدای بازه", abs(s.opening), tag(s.opening)],
            ["جمع بدهکار", s.debit, "افزایش طلب ما"],
            ["جمع بستانکار", s.credit, "کاهش طلب ما"],
            ["مانده‌ی پایان", abs(s.closing), tag(s.closing)],
          ] as [string, string, string][]
        ).map(([k, v, sub]) => (
          <Card key={k} className="p-3">
            <p className="text-[11px] text-gray-500">{k}</p>
            <Money value={v} className="text-base" />
            <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5 text-[11px] text-gray-500">
            <tr>
              <th className="text-right font-bold px-4 py-2">نوع عملیات</th>
              <th className="text-center font-bold px-2 py-2">تعداد</th>
              <th className="text-left font-bold px-2 py-2">بدهکار</th>
              <th className="text-left font-bold px-4 py-2">بستانکار</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {s.bySource.map((r) => (
              <tr key={r.source}>
                <td className="px-4 py-2 font-bold">{SOURCE_LABELS[r.source] ?? r.source}</td>
                <td className="px-2 py-2 text-center text-xs text-gray-500">{faNum(r.count)}</td>
                <td className="px-2 py-2 text-left tabular-nums">{BigInt(r.debit) ? <Money value={r.debit} /> : ""}</td>
                <td className="px-4 py-2 text-left tabular-nums">{BigInt(r.credit) ? <Money value={r.credit} /> : ""}</td>
              </tr>
            ))}
            {!s.bySource.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-gray-400">
                  در این بازه گردشی نیست
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {s.byAccount.length > 1 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/5 text-[11px] text-gray-500">
              <tr>
                <th className="text-right font-bold px-4 py-2">حساب</th>
                <th className="text-left font-bold px-2 py-2">بدهکار</th>
                <th className="text-left font-bold px-2 py-2">بستانکار</th>
                <th className="text-left font-bold px-4 py-2">خالص</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {s.byAccount.map((a) => {
                const net = BigInt(a.debit) - BigInt(a.credit);
                return (
                  <tr key={a.accountId}>
                    <td className="px-4 py-2">{a.name}</td>
                    <td className="px-2 py-2 text-left tabular-nums">{BigInt(a.debit) ? <Money value={a.debit} /> : ""}</td>
                    <td className="px-2 py-2 text-left tabular-nums">{BigInt(a.credit) ? <Money value={a.credit} /> : ""}</td>
                    <td className="px-4 py-2 text-left">
                      <BalanceLabel balance={String(net)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
