"use client";

/**
 * اقساط سازمانی — صفحه‌ی یک سازمان: شاخص‌ها، ماه‌به‌ماه، مشتری‌ها، قراردادها، دریافت‌ها،
 * و «ثبت دریافت» ماهانه با تطبیق فایل اکسل سازمان. docs/plans/org-installments.md
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Pencil, Phone, Search, Upload, Wallet } from "lucide-react";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import { formatJalali } from "@/lib/club/jalali";
import { faNum, formatAmount, parseAmountInput } from "@/lib/accounting/money";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, PageHeader, Sheet, Stat } from "../ui";
import { B, ContractSheet, Mini, OrgForm, Progress, STATUS_LABEL, Terms, orgColor, pct, periodFa, type Org } from "./shared";

interface MonthRow {
  period: string;
  label: string;
  expected: string;
  paid: string;
  remaining: string;
  customers: number;
  state: "PAID" | "PARTIAL_LATE" | "LATE" | "CURRENT" | "UPCOMING";
}
interface CustomerRow {
  partyId: string;
  name: string;
  mobile: string | null;
  nationalId: string | null;
  employeeCode: string | null;
  contracts: number;
  total: string;
  net: string;
  paid: string;
  remaining: string;
  monthly: string;
  overdue: string;
  nextDue: string | null;
  lastBuy: string;
}
interface ContractRow {
  id: string;
  number: number;
  partyId: string;
  customerName: string;
  employeeCode: string | null;
  letterNo: string | null;
  total: string;
  commission: string;
  net: string;
  months: number;
  status: "ACTIVE" | "DONE" | "VOID";
  createdAt: string;
  paid: string;
  voidReason: string | null;
  legacyRef: string | null;
}
interface SettlementRow {
  id: string;
  number: number;
  period: string;
  amount: string;
  fileName: string | null;
  note: string | null;
  createdByName: string;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}
interface Data {
  org: Org;
  kpi: { debt: string; overdue: string; sales: string; commission: string; thisMonth: string; thisMonthPaid: string; customers: number; allCustomers: number; ledgerBalance: string; period: string };
  months: MonthRow[];
  customers: CustomerRow[];
  contracts: ContractRow[];
  settlements: SettlementRow[];
  treasuries: { id: string; name: string; kind: string }[];
  can: { manage: boolean; settle: boolean };
}
type Tab = "months" | "customers" | "contracts" | "settlements";

const MONTH_STATE: Record<MonthRow["state"], { label: string; tone: "green" | "red" | "amber" | "blue" | "gray" }> = {
  PAID: { label: "رسید", tone: "green" },
  PARTIAL_LATE: { label: "ناقص — معوق", tone: "red" },
  LATE: { label: "معوق", tone: "red" },
  CURRENT: { label: "این ماه", tone: "amber" },
  UPCOMING: { label: "آینده", tone: "gray" },
};

export default function OrgDetail({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("months");
  const [edit, setEdit] = useState(false);
  const [period, setPeriod] = useState<string | null>(null);
  const [settle, setSettle] = useState<string | null>(null);
  const [contract, setContract] = useState<string | null>(null);
  const [customer, setCustomer] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(
    () =>
      api<Data>(`/api/admin/accounting/installment-orgs/${id}`)
        .then(setD)
        .catch((e) => setError(e.message)),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);

  const customers = useMemo(() => {
    const t = q.trim().replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x)));
    if (!d || !t) return d?.customers ?? [];
    return d.customers.filter((c) => [c.name, c.mobile, c.nationalId, c.employeeCode].some((v) => v && v.includes(t)));
  }, [d, q]);

  if (!d) return error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">در حال بارگذاری…</p>;
  const o = d.org;
  const c = orgColor(o.color);
  const k = d.kpi;
  const firstOpen = d.months.find((m) => B(m.remaining) > 0n && m.period <= k.period)?.period ?? k.period;

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: c }} />
            {o.name}
          </span>
        }
        help="accountingOrgInstallments"
        back={{ href: "/admin/accounting/installment-orgs", label: "اقساط سازمانی" }}
        desc={
          <span className="flex flex-wrap items-center gap-2">
            <Terms o={o} />
            {o.contactName && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Phone className="h-3 w-3" aria-hidden /> {o.contactName}
                {o.contactPhone && <span dir="ltr">{faNum(o.contactPhone)}</span>}
              </span>
            )}
            {o.contractNo && <span className="text-xs text-gray-500">قرارداد {o.contractNo}</span>}
          </span>
        }
        actions={
          <>
            {d.can.settle && (
              <button onClick={() => setSettle(firstOpen)} className={btn.primary}>
                <Wallet className="h-4 w-4" aria-hidden /> {o.selfPay ? "دریافت قسط از مشتری" : "ثبت دریافت از سازمان"}
              </button>
            )}
            {d.can.manage && !o.selfPay && (
              <button onClick={() => setEdit(true)} className={btn.soft}>
                <Pencil className="h-4 w-4" aria-hidden /> شرایط
              </button>
            )}
          </>
        }
      />
      {o.selfPay && (
        <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold leading-6 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
          اقساط شخصی منتقل‌شده از وب حساب: سازمانی در کار نیست و هر مشتری قسطش را خودش می‌پردازد (طلب روی حساب خود مشتری است). دریافت هر نفر را جدا ثبت کنید. این گروه در صندوق انتخاب نمی‌شود؛ فروش قسطی شخصی تازه با «اقساط» صفحه‌ی فاکتور فروش است.
        </p>
      )}
      {!o.isActive && <p className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 dark:bg-white/5">این سازمان غیرفعال است و در صندوق دیده نمی‌شود؛ اقساط قبلی سر جایشان هستند.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="بدهی کل سازمان" value={formatAmount(B(k.debt))} tone="blue" />
        <Stat label={`قسط ${periodFa(k.period)}`} value={formatAmount(B(k.thisMonth))} sub={B(k.thisMonth) > 0n ? `رسیده ${formatAmount(B(k.thisMonthPaid))}` : undefined} />
        <Stat label="معوق ماه‌های قبل" value={formatAmount(B(k.overdue))} tone={B(k.overdue) > 0n ? "red" : "gray"} />
        <Stat label="فروش اقساطی" value={formatAmount(B(k.sales))} sub={`پورسانت ${formatAmount(B(k.commission))}`} />
        <Stat label="مشتری با قسط باز" value={faNum(k.customers)} sub={`از ${faNum(k.allCustomers)} مشتری`} />
      </div>
      {B(k.ledgerBalance) !== B(k.debt) && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" aria-hidden /> مانده‌ی حساب سازمان در دفتر ({formatAmount(B(k.ledgerBalance))}) با بدهی اقساط فرق دارد — احتمالاً دریافت یا سندی دستی به نام سازمان ثبت شده.
        </p>
      )}

      <Chips
        value={tab}
        onChange={setTab}
        options={[
          { value: "months", label: "ماه‌به‌ماه", count: d.months.length },
          { value: "customers", label: "مشتری‌ها", count: d.customers.length },
          { value: "contracts", label: "خریدها", count: d.contracts.length },
          { value: "settlements", label: "دریافت‌ها", count: d.settlements.filter((s) => !s.voidedAt).length },
        ]}
      />

      {tab === "months" &&
        (d.months.length ? (
          <Card className="overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {d.months.map((m) => {
                const st = MONTH_STATE[m.state];
                return (
                  <div key={m.period} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${m.period === k.period ? "bg-amber-50/50 dark:bg-amber-500/5" : ""}`}>
                    <div className="w-28 shrink-0">
                      <p className="text-sm font-black">{m.label}</p>
                      <p className="text-[11px] text-gray-500">{faNum(m.customers)} نفر</p>
                    </div>
                    <div className="min-w-[10rem] flex-1 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">
                          {formatAmount(B(m.paid))} از {formatAmount(B(m.expected))}
                        </span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <Progress value={B(m.paid)} total={B(m.expected)} color={m.state === "LATE" || m.state === "PARTIAL_LATE" ? "#dc2626" : c} />
                    </div>
                    <div className="w-28 text-left">
                      <p className="text-[11px] text-gray-500">مانده</p>
                      <p className={`text-sm font-black tabular-nums ${B(m.remaining) > 0n && m.period < k.period ? "text-red-600" : ""}`}>{formatAmount(B(m.remaining))}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setPeriod(m.period)} className={btn.small}>
                        فهرست
                      </button>
                      {d.can.settle && B(m.remaining) > 0n && (
                        <button onClick={() => setSettle(m.period)} className={`${btn.small} !bg-emerald-50 !text-emerald-700 dark:!bg-emerald-500/10`}>
                          ثبت دریافت
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <Empty title="هنوز خرید اقساطی ثبت نشده" desc="در صندوق یا فاکتور فروش روش پرداخت «اقساط» را بزنید و همین سازمان را انتخاب کنید." />
        ))}

      {tab === "customers" && (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام، موبایل، کد ملی یا پرسنلی" className={`${inputCls} pr-9`} />
          </div>
          {customers.length ? (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                  <tr>
                    <th className="px-3 py-2 text-right">مشتری</th>
                    <th className="px-3 py-2 text-left">خرید</th>
                    <th className="px-3 py-2 text-left">قسط این ماه</th>
                    <th className="px-3 py-2 text-right">پیشرفت</th>
                    <th className="px-3 py-2 text-left">مانده</th>
                    <th className="px-3 py-2 text-right">قسط بعدی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {customers.map((x) => (
                    <tr key={x.partyId} onClick={() => setCustomer(x.partyId)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-3 py-2.5">
                        <p className="font-black">{x.name}</p>
                        <p className="text-[11px] text-gray-500">
                          {x.employeeCode && `پرسنلی ${faNum(x.employeeCode)} · `}
                          {x.mobile ? <span dir="ltr">{faNum(x.mobile)}</span> : "بی موبایل"}
                          {x.contracts > 1 && ` · ${faNum(x.contracts)} خرید`}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-left tabular-nums">{formatAmount(B(x.total))}</td>
                      <td className="px-3 py-2.5 text-left font-bold tabular-nums">{B(x.monthly) > 0n ? formatAmount(B(x.monthly)) : "—"}</td>
                      <td className="w-40 px-3 py-2.5">
                        <Progress value={B(x.paid)} total={B(x.net)} color={c} />
                        <p className="mt-0.5 text-[10px] text-gray-400">{formatAmount(B(x.paid))} از {formatAmount(B(x.net))}</p>
                      </td>
                      <td className="px-3 py-2.5 text-left">
                        <p className="font-black tabular-nums">{B(x.remaining) > 0n ? formatAmount(B(x.remaining)) : <span className="text-emerald-600">تسویه</span>}</p>
                        {B(x.overdue) > 0n && <p className="text-[10px] font-bold text-red-600">معوق {formatAmount(B(x.overdue))}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{x.nextDue ? formatJalali(new Date(x.nextDue)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <Empty title={q ? "کسی پیدا نشد" : "هنوز مشتری‌ای نیست"} />
          )}
        </div>
      )}

      {tab === "contracts" &&
        (d.contracts.length ? (
          <Card className="divide-y divide-gray-100 dark:divide-white/5">
            {d.contracts.map((x) => (
              <button key={x.id} onClick={() => setContract(x.id)} className={`flex w-full flex-wrap items-center gap-3 px-4 py-3 text-right hover:bg-gray-50 dark:hover:bg-white/5 ${x.status === "VOID" ? "opacity-50" : ""}`}>
                <span className="w-14 text-sm font-black tabular-nums text-gray-400">{faNum(x.number)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black">{x.customerName}</span>
                  <span className="block text-[11px] text-gray-500">
                    {formatJalali(new Date(x.createdAt))} · {faNum(x.months)} قسط
                    {x.employeeCode && ` · پرسنلی ${faNum(x.employeeCode)}`}
                    {x.letterNo && ` · معرفی‌نامه ${x.letterNo}`}
                    {x.legacyRef && ` · وب حساب ${faNum(Number(x.legacyRef.split(":")[1] ?? 0))}`}
                  </span>
                </span>
                <span className="text-left">
                  <span className="block font-black tabular-nums">{formatAmount(B(x.total))}</span>
                  <span className="block text-[10px] text-gray-400">دریافت {formatAmount(B(x.paid))} از {formatAmount(B(x.net))}</span>
                </span>
                <Badge tone={x.status === "DONE" ? "green" : x.status === "VOID" ? "red" : "blue"}>{STATUS_LABEL[x.status]}</Badge>
              </button>
            ))}
          </Card>
        ) : (
          <Empty title="هنوز خریدی نیست" />
        ))}

      {tab === "settlements" &&
        (d.settlements.length ? (
          <Card className="divide-y divide-gray-100 dark:divide-white/5">
            {d.settlements.map((s) => (
              <SettlementLine key={s.id} s={s} orgId={id} canVoid={d.can.settle} onChanged={load} />
            ))}
          </Card>
        ) : (
          <Empty title="هنوز دریافتی از سازمان ثبت نشده" desc="هر ماه که سازمان واریز کرد، «ثبت دریافت از سازمان» را بزنید." />
        ))}

      {edit && (
        <OrgForm
          org={o}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false);
            load();
          }}
        />
      )}
      {period && <PeriodSheet orgId={id} period={period} canSettle={d.can.settle} onSettle={() => (setSettle(period), setPeriod(null))} onClose={() => setPeriod(null)} />}
      {settle && (
        <SettleSheet
          orgId={id}
          org={o}
          months={d.months}
          initialPeriod={settle}
          treasuries={d.treasuries}
          onClose={() => setSettle(null)}
          onDone={() => {
            setSettle(null);
            setTab("settlements");
            load();
          }}
        />
      )}
      {customer && (
        <Sheet open onClose={() => setCustomer(null)} title={d.customers.find((x) => x.partyId === customer)?.name ?? "مشتری"}>
          <div className="space-y-2">
            {d.contracts
              .filter((x) => x.partyId === customer)
              .map((x) => (
                <button key={x.id} onClick={() => setContract(x.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5 text-right hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5">
                  <span>
                    <span className="block text-sm font-black">قرارداد {faNum(x.number)}</span>
                    <span className="block text-[11px] text-gray-500">{formatJalali(new Date(x.createdAt))}</span>
                  </span>
                  <span className="text-left">
                    <span className="block font-black tabular-nums">{formatAmount(B(x.total))}</span>
                    <span className="block text-[10px] text-gray-400">دریافت {formatAmount(B(x.paid))} از {formatAmount(B(x.net))}</span>
                  </span>
                  <Badge tone={x.status === "DONE" ? "green" : x.status === "VOID" ? "red" : "blue"}>{STATUS_LABEL[x.status]}</Badge>
                </button>
              ))}
          </div>
        </Sheet>
      )}
      {contract && <ContractSheet id={contract} onClose={() => setContract(null)} onChanged={load} />}
    </div>
  );
}

function SettlementLine({ s, orgId, canVoid, onChanged }: { s: SettlementRow; orgId: string; canVoid: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function voidIt() {
    const reason = window.prompt(`دریافت ${faNum(s.number)} (${periodFa(s.period)}، ${formatAmount(B(s.amount))} تومان) باطل شود؟ قسط‌ها دوباره باز می‌شوند. دلیل؟`);
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/api/admin/accounting/installment-orgs/${orgId}/settlements/${s.id}`, { method: "POST", json: { reason } });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
      setBusy(false);
    }
  }
  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${s.voidedAt ? "opacity-50" : ""}`}>
      <span className="w-14 text-sm font-black tabular-nums text-gray-400">{faNum(s.number)}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-black">اقساط {periodFa(s.period)}</span>
        <span className="block text-[11px] text-gray-500">
          {formatJalali(new Date(s.createdAt))} · {s.createdByName}
          {s.fileName && ` · ${s.fileName}`}
          {s.note && ` · ${s.note}`}
        </span>
        {s.voidedAt && <span className="block text-[11px] font-bold text-red-600">باطل شد: {s.voidReason}</span>}
        <ErrorText>{error}</ErrorText>
      </span>
      <span className={`font-black tabular-nums ${s.voidedAt ? "line-through" : "text-emerald-600"}`}>{formatAmount(B(s.amount))}</span>
      {canVoid && !s.voidedAt && (
        <button onClick={voidIt} disabled={busy} className={`${btn.small} !text-red-600`}>
          ابطال
        </button>
      )}
    </div>
  );
}

// ── فهرست یک ماه ─────────────────────────────────────────────────────────

interface PeriodData {
  period: string;
  label: string;
  rows: { partyId: string; name: string; mobile: string | null; nationalId: string | null; employeeCode: string | null; due: string; dueGross: string; duePaid: string; overdue: string; remaining: string; toPay: string; contracts: number[] }[];
  total: string;
  totalGross: string;
  toPay: string;
}

function PeriodSheet({ orgId, period, canSettle, onSettle, onClose }: { orgId: string; period: string; canSettle: boolean; onSettle: () => void; onClose: () => void }) {
  const [d, setD] = useState<PeriodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<PeriodData>(`/api/admin/accounting/installment-orgs/${orgId}/period?period=${period}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [orgId, period]);
  return (
    <Sheet
      open
      onClose={onClose}
      title={`اقساط ${periodFa(period)}`}
      wide
      footer={
        <div className="flex flex-wrap gap-2">
          <a href={`/api/admin/accounting/installment-orgs/${orgId}/period?period=${period}&format=xlsx`} className={btn.soft}>
            <Download className="h-4 w-4" aria-hidden /> اکسل برای سازمان
          </a>
          {canSettle && d && B(d.toPay) > 0n && (
            <button onClick={onSettle} className={btn.primary}>
              <Wallet className="h-4 w-4" aria-hidden /> ثبت دریافت این ماه
            </button>
          )}
        </div>
      }
    >
      {!d ? (
        error ? <ErrorText>{error}</ErrorText> : <p className="text-xs text-gray-400">…</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Mini label="کسر از حقوق کارمندان" value={formatAmount(B(d.totalGross))} />
            <Mini label="قسط این ماه (سهم فروشگاه)" value={formatAmount(B(d.total))} />
            <Mini label="قابل دریافت (با معوق)" value={formatAmount(B(d.toPay))} tone={B(d.toPay) > 0n ? "amber" : "green"} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/5">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-right">مشتری</th>
                  <th className="px-3 py-2 text-left">کسر از حقوق</th>
                  <th className="px-3 py-2 text-left">قسط ما</th>
                  <th className="px-3 py-2 text-left">رسیده</th>
                  <th className="px-3 py-2 text-left">معوق قبلی</th>
                  <th className="px-3 py-2 text-left">قابل دریافت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {d.rows.map((r) => (
                  <tr key={r.partyId}>
                    <td className="px-3 py-2">
                      <p className="font-bold">{r.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {r.employeeCode && `پرسنلی ${faNum(r.employeeCode)} · `}
                        {r.nationalId && `ملی ${faNum(r.nationalId)}`}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-left tabular-nums text-gray-500">{formatAmount(B(r.dueGross))}</td>
                    <td className="px-3 py-2 text-left tabular-nums">{formatAmount(B(r.due))}</td>
                    <td className="px-3 py-2 text-left tabular-nums text-emerald-600">{B(r.duePaid) > 0n ? formatAmount(B(r.duePaid)) : "—"}</td>
                    <td className="px-3 py-2 text-left tabular-nums text-red-600">{B(r.overdue) > 0n ? formatAmount(B(r.overdue)) : "—"}</td>
                    <td className="px-3 py-2 text-left font-black tabular-nums">{B(r.toPay) > 0n ? formatAmount(B(r.toPay)) : <span className="text-emerald-600">✓</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ── ثبت دریافت ماهانه ─────────────────────────────────────────────────────

interface MatchData {
  fileName: string;
  rows: { line: number; text: string; amount: string; partyId: string | null; name: string | null; by: string | null }[];
  total: string;
  unmatched: number;
  perParty: { partyId: string; amount: string; expected: string }[];
  missing: { partyId: string; name: string; toPay: string }[];
}

function SettleSheet({
  orgId,
  org,
  months,
  initialPeriod,
  treasuries,
  onClose,
  onDone,
}: {
  orgId: string;
  org: Org;
  months: MonthRow[];
  initialPeriod: string;
  treasuries: { id: string; name: string; kind: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [list, setList] = useState<PeriodData | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [match, setMatch] = useState<MatchData | null>(null);
  const [gross, setGross] = useState(false);
  const [treasuryId, setTreasuryId] = useState(treasuries.find((t) => t.kind === "BANK")?.id ?? treasuries[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api<PeriodData>(`/api/admin/accounting/installment-orgs/${orgId}/period?period=${period}`)
      .then((d) => {
        if (!live) return;
        setList(d);
        setAmounts(Object.fromEntries(d.rows.map((r) => [r.partyId, B(r.toPay) > 0n ? r.toPay : ""])));
        setMatch(null);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [orgId, period]);

  const net = (v: bigint) => (gross ? v - (v * BigInt(org.commissionBp) + 5_000n) / 10_000n : v);
  function applyMatch(m: MatchData, g: boolean) {
    const conv = (v: bigint) => (g ? v - (v * BigInt(org.commissionBp) + 5_000n) / 10_000n : v);
    const next: Record<string, string> = Object.fromEntries((list?.rows ?? []).map((r) => [r.partyId, ""]));
    for (const p of m.perParty) next[p.partyId] = conv(B(p.amount)).toString();
    setAmounts(next);
  }
  async function upload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("period", period);
    try {
      const r = await fetch(`/api/admin/accounting/installment-orgs/${orgId}/match`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "فایل خوانده نشد");
      setMatch(j);
      applyMatch(j, gross);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فایل خوانده نشد");
    }
  }

  // ردیف‌ها: مشتری‌های این ماه + کسانی که در فایل آمده‌اند ولی قسط این ماه ندارند (پیش‌پرداخت)
  const extra = (match?.perParty ?? []).filter((p) => !list?.rows.some((r) => r.partyId === p.partyId));
  const total = Object.values(amounts).reduce((s, v) => s + B(v || "0"), 0n);
  const expected = B(list?.toPay ?? "0");
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounting/installment-orgs/${orgId}/settlements`, {
        method: "POST",
        json: {
          period,
          treasuryId,
          date: date || null,
          trackingCode: tracking || null,
          note: note || null,
          fileName: match?.fileName ?? null,
          rows: Object.entries(amounts)
            .filter(([, v]) => B(v || "0") > 0n)
            .map(([partyId, amount]) => ({ partyId, amount })),
        },
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
      setBusy(false);
    }
  }
  const periods = [...new Set([...months.map((m) => m.period), initialPeriod])].sort();

  return (
    <Sheet
      open
      onClose={onClose}
      title={`ثبت دریافت از ${org.name}`}
      help="accountingOrgInstallments"
      wide
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy || total <= 0n || !treasuryId} className={btn.primary}>
            {busy ? "در حال ثبت…" : `ثبت دریافت ${formatAmount(total)} تومان`}
          </button>
          {total !== expected && list && (
            <span className={`text-xs font-bold ${total > expected ? "text-blue-600" : "text-amber-600"}`}>
              {total > expected ? `${formatAmount(total - expected)} بیشتر از قابل دریافت (روی قسط‌های بعدی می‌نشیند)` : `${formatAmount(expected - total)} کمتر از قابل دریافت`}
            </span>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="ماه">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls}>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {periodFa(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="واریز به">
            <select value={treasuryId} onChange={(e) => setTreasuryId(e.target.value)} className={inputCls}>
              {treasuries.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="تاریخ واریز">
            <JalaliDatePicker value={date} onChange={(v: string) => setDate(v)} placeholder="امروز" />
          </Field>
          <Field label="شماره‌ی پیگیری">
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} className={inputCls} dir="ltr" />
          </Field>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-4 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-emerald-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">فایل اکسل سازمان (اختیاری)</p>
              <p className="text-[11px] text-gray-500">هر سطر با کد پرسنلی، کد ملی، موبایل یا نام به مشتری وصل می‌شود و مبلغش در ستون «دریافت» می‌نشیند.</p>
            </div>
            <label className={`${btn.soft} cursor-pointer`}>
              <Upload className="h-4 w-4" aria-hidden /> {match ? "فایل دیگر" : "انتخاب فایل"}
              <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
          {match && (
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex flex-wrap gap-2">
                <Badge tone="green">{faNum(match.rows.length - match.unmatched)} سطر وصل شد</Badge>
                {match.unmatched > 0 && <Badge tone="red">{faNum(match.unmatched)} سطر ناشناس</Badge>}
                {match.missing.length > 0 && <Badge tone="amber">{faNum(match.missing.length)} نفر در فایل نیستند</Badge>}
                <Badge>جمع فایل {formatAmount(B(match.total))}</Badge>
              </div>
              {org.commissionBp > 0 && (
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={gross}
                    onChange={(e) => {
                      setGross(e.target.checked);
                      applyMatch(match, e.target.checked);
                    }}
                    className="h-4 w-4"
                  />
                  مبلغ‌های فایل «کسر از حقوق» است (ناخالص) — پورسانت {pct(org.commissionBp)} کم شود
                </label>
              )}
              {match.unmatched > 0 && (
                <div className="rounded-xl bg-red-50 p-2 text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  <p className="font-black">سطرهای ناشناس (ثبت نمی‌شوند):</p>
                  {match.rows
                    .filter((r) => !r.partyId)
                    .map((r) => (
                      <p key={r.line}>
                        سطر {faNum(r.line)}: {r.text || "—"} — {formatAmount(net(B(r.amount)))}
                      </p>
                    ))}
                </div>
              )}
              {match.missing.length > 0 && (
                <p className="rounded-xl bg-amber-50 p-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  در فایل نیستند: {match.missing.map((m) => `${m.name} (${formatAmount(B(m.toPay))})`).join("، ")}
                </p>
              )}
            </div>
          )}
        </div>

        {!list ? (
          <p className="text-xs text-gray-400">…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/5">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-gray-50 text-[11px] text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-right">مشتری</th>
                  <th className="px-3 py-2 text-left">قابل دریافت</th>
                  {match && <th className="px-3 py-2 text-left">در فایل</th>}
                  <th className="px-3 py-2 text-left">دریافت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {[...list.rows.map((r) => ({ partyId: r.partyId, name: r.name, sub: r.employeeCode ? `پرسنلی ${faNum(r.employeeCode)}` : "", toPay: B(r.toPay) })), ...extra.map((p) => ({ partyId: p.partyId, name: match?.rows.find((r) => r.partyId === p.partyId)?.name ?? "", sub: "قسط این ماه ندارد", toPay: 0n }))].map((r) => {
                  const inFile = match?.perParty.find((p) => p.partyId === r.partyId);
                  const v = B(amounts[r.partyId] || "0");
                  const diff = v !== r.toPay;
                  return (
                    <tr key={r.partyId}>
                      <td className="px-3 py-2">
                        <p className="font-bold">{r.name}</p>
                        {r.sub && <p className="text-[10px] text-gray-500">{r.sub}</p>}
                      </td>
                      <td className="px-3 py-2 text-left tabular-nums text-gray-500">{formatAmount(r.toPay)}</td>
                      {match && <td className="px-3 py-2 text-left tabular-nums text-gray-500">{inFile ? formatAmount(net(B(inFile.amount))) : "—"}</td>}
                      <td className="px-3 py-1.5 text-left">
                        <input
                          value={amounts[r.partyId] ? formatAmount(B(amounts[r.partyId])) : ""}
                          onChange={(e) => setAmounts((a) => ({ ...a, [r.partyId]: parseAmountInput(e.target.value) }))}
                          inputMode="numeric"
                          placeholder="۰"
                          className={`w-36 rounded-lg border px-2 py-1.5 text-left text-sm font-bold tabular-nums outline-none focus:border-blue-400 dark:bg-white/5 ${diff ? "border-amber-300 bg-amber-50 dark:border-amber-500/30" : "border-gray-200 dark:border-white/10"}`}
                          dir="ltr"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-black dark:bg-white/5">
                <tr>
                  <td className="px-3 py-2">جمع</td>
                  <td className="px-3 py-2 text-left tabular-nums">{formatAmount(expected)}</td>
                  {match && <td className="px-3 py-2 text-left tabular-nums">{formatAmount(net(B(match.total)))}</td>}
                  <td className="px-3 py-2 text-left tabular-nums text-emerald-600">{formatAmount(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <Field label="یادداشت">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="مثلاً واریز حقوق آذر، نامه‌ی شماره‌ی …" />
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
