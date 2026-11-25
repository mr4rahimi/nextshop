"use client";

/**
 * دارایی ثابت، پیش‌پرداخت هزینه و ودیعه (webhesab-parity.md بخش ۳۴.۵).
 * هر عدد به دفتر حساب یا سندش می‌رود؛ مانده‌ی حساب در برابر جمع دفتر نشان داده می‌شود.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { CATEGORY_LABELS, type AssetCategory } from "@/lib/accounting/assets/calc";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import { api, Badge, btn, Card, Chips, Empty, ErrorText, Field, inputCls, PageHeader, Segmented, Sheet, Stat } from "../ui";
import AssetForm from "./AssetForm";
import { act, AccountSelect, ASSETS_API, parseNum, TreasurySelect, useTreasuries, VoucherLink, type AccountOpt } from "./shared";

interface AssetRow {
  id: string;
  number: number;
  name: string;
  category: AssetCategory;
  account: string;
  acquiredOn: string;
  cost: string;
  accum: string;
  book: string;
  monthly: string;
  status: "ACTIVE" | "DISPOSED" | "VOID";
  disposedOn: string | null;
  fully: boolean;
}
interface Prepaid {
  id: string;
  number: number;
  title: string;
  expenseAccount: string;
  amount: string;
  recognized: string;
  remaining: string;
  startOn: string;
  months: number;
  status: "ACTIVE" | "DONE" | "VOID";
  voucherId: string | null;
  voucherNumber: number | null;
  funding: string;
}
interface Deposit {
  id: string;
  number: number;
  title: string;
  counterparty: string;
  amount: string;
  paidOn: string;
  status: "HELD" | "RETURNED" | "VOID";
  returnedOn: string | null;
  returnedAmount: string | null;
  voucherId: string | null;
  voucherNumber: number | null;
  returnVoucherId: string | null;
  returnVoucherNumber: number | null;
}
interface Acc {
  id: string;
  name: string;
}
interface Data {
  assets: AssetRow[];
  accounts: AccountOpt[];
  accumAccount: Acc | null;
  totals: { cost: string; accum: string; book: string; monthly: string; count: number };
  prepaidTotals: { prepaid: string; deposits: string };
  ledgerAccounts: { prepaid: Acc | null; deposits: Acc | null };
  accumBook: string | null;
  lastMonth: string;
  prepaids: Prepaid[];
  deposits: Deposit[];
  expenseAccounts: AccountOpt[];
  book: { prepaid: string | null; deposits: string | null };
  can: { manage: boolean; run: boolean };
}
type Tab = "assets" | "prepaid" | "deposits";

const BASE = "/admin/accounting/assets";
const accLink = (a: { id: string } | null | undefined) => (a ? `/admin/accounting/accounts/${a.id}` : undefined);

export default function AssetsClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "assets");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "asset" | "prepaid" | "deposit">(null);
  const [returning, setReturning] = useState<Deposit | null>(null);

  const load = useCallback(() => {
    api<Data>(ASSETS_API)
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function run(action: string, body: Record<string, unknown> = {}, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await act<{ result?: { message: string } }>(action, body);
      if (r.result?.message) setMsg(r.result.message);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }
  const askVoid = (action: string, id: string, what: string) => {
    const reason = window.prompt(`دلیل ابطال ${what}؟ سندش باطل می‌شود.`);
    if (reason) run(action, { id, reason });
  };

  const accumMismatch = data?.accumBook != null && data.accumBook !== data.totals.accum;
  const prepaidMismatch = data?.book.prepaid != null && data.book.prepaid !== data.prepaidTotals.prepaid;
  const depositMismatch = data?.book.deposits != null && data.book.deposits !== data.prepaidTotals.deposits;

  const add = data?.can.manage && (
    <button onClick={() => setSheet(tab === "assets" ? "asset" : tab === "prepaid" ? "prepaid" : "deposit")} className={btn.primary}>
      ➕ {tab === "assets" ? "دارایی تازه" : tab === "prepaid" ? "پیش‌پرداخت تازه" : "ودیعه‌ی تازه"}
    </button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="دارایی ثابت و پیش‌پرداخت"
        help="accountingAssets"
        desc="اثاثه، تجهیزات و وسیله‌ی نقلیه با استهلاک ماهانه‌ی خودکار؛ اجاره و بیمه‌ی پیش‌پرداخت که ماه‌به‌ماه هزینه می‌شود؛ رهن و ودیعه."
        actions={
          <div className="flex flex-wrap gap-2">
            {data?.can.run && (
              <button onClick={() => run("run")} disabled={busy} className={btn.soft} title="worker خودش آخر هر ماه می‌زند">
                ثبت ماه‌های تمام‌شده
              </button>
            )}
            {add}
          </div>
        }
      />
      <ErrorText>{error}</ErrorText>
      {msg && <p className="text-xs font-bold text-emerald-600">{msg}</p>}

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="ارزش دفتری دارایی‌ها" value={formatAmount(data.totals.book)} sub={`${faNum(data.totals.count)} دارایی · بها ${formatAmount(data.totals.cost)}`} href={`${BASE}?tab=assets`} />
          <Stat
            label="استهلاک انباشته"
            value={formatAmount(data.totals.accum)}
            sub={accumMismatch ? `حساب: ${formatAmount(data.accumBook!)}` : `ماهانه ${formatAmount(data.totals.monthly)}`}
            tone={accumMismatch ? "amber" : "gray"}
            href={accLink(data.accumAccount)}
          />
          <Stat
            label="پیش‌پرداخت هزینه‌ی مانده"
            value={formatAmount(data.prepaidTotals.prepaid)}
            sub={prepaidMismatch ? `حساب: ${formatAmount(data.book.prepaid!)}` : "هزینه‌ی ماه‌های آینده"}
            tone={prepaidMismatch ? "amber" : "gray"}
            href={accLink(data.ledgerAccounts.prepaid) ?? `${BASE}?tab=prepaid`}
          />
          <Stat
            label="ودیعه‌ها"
            value={formatAmount(data.prepaidTotals.deposits)}
            sub={depositMismatch ? `حساب: ${formatAmount(data.book.deposits!)}` : "نزد موجر و دیگران"}
            tone={depositMismatch ? "amber" : "gray"}
            href={accLink(data.ledgerAccounts.deposits) ?? `${BASE}?tab=deposits`}
          />
        </div>
      )}
      {(accumMismatch || prepaidMismatch || depositMismatch) && (
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-6">
          مانده‌ی حساب با جمع این دفتر یکی نیست. معمولاً یعنی دارایی یا ودیعه‌ی قدیمی در «مانده‌های اول دوره» نیامده، یا سند دستی روی همین حساب‌ها زده شده. روی عدد بزنید تا گردش حساب را ببینید.
        </p>
      )}

      <Chips<Tab>
        value={tab}
        onChange={(t) => {
          setTab(t);
          router.replace(`${BASE}?tab=${t}`);
        }}
        options={[
          { value: "assets", label: "دارایی‌های ثابت", count: data?.assets.length },
          { value: "prepaid", label: "پیش‌پرداخت هزینه", count: data?.prepaids.length },
          { value: "deposits", label: "ودیعه و سپرده", count: data?.deposits.length },
        ]}
      />

      {tab === "assets" && data?.assets.length === 0 && <Empty title="دارایی ثابتی ثبت نشده" desc="ویترین، قفسه، یخچال، رایانه، دکور مغازه و ماشین — هر چه بیش از یک سال به کار می‌آید. استهلاکش آخر هر ماه خودکار ثبت می‌شود." action={add} />}
      {tab === "assets" && !!data?.assets.length && (
        <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
          {data.assets.map((a) => (
            <Link key={a.id} href={`${BASE}/${a.id}`} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-white/5 ${a.status === "VOID" ? "opacity-50" : ""}`}>
              <span className="text-xs text-gray-400 tabular-nums">{faNum(a.number)}</span>
              <span className="font-bold">{a.name}</span>
              <span className="text-xs text-gray-500">{CATEGORY_LABELS[a.category]}</span>
              {a.status === "DISPOSED" && <Badge tone="gray">فروخته/اسقاط {a.disposedOn ? formatJalali(new Date(a.disposedOn)) : ""}</Badge>}
              {a.status === "VOID" && <Badge tone="red">باطل</Badge>}
              {a.fully && <Badge tone="green">کامل مستهلک</Badge>}
              <span className="mr-auto text-xs text-gray-500">
                بها {formatAmount(a.cost)} · انباشته {formatAmount(a.accum)} · ارزش دفتری <b className="tabular-nums text-gray-900 dark:text-white">{formatAmount(a.book)}</b>
                {a.status === "ACTIVE" && BigInt(a.monthly) > 0n && <> · ماهانه {formatAmount(a.monthly)}</>}
              </span>
            </Link>
          ))}
        </Card>
      )}

      {tab === "prepaid" && data?.prepaids.length === 0 && <Empty title="پیش‌پرداختی ثبت نشده" desc="اجاره‌ی یک‌ساله، بیمه، آبونمان سالانه — پولی که امروز می‌دهید ولی هزینه‌ی چند ماه است. سهم هر ماه آخر همان ماه هزینه می‌شود." action={add} />}
      {tab === "prepaid" && !!data?.prepaids.length && (
        <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
          {data.prepaids.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm ${p.status === "VOID" ? "opacity-50" : ""}`}>
              <span className="font-bold">{p.title}</span>
              <span className="text-xs text-gray-500">
                {p.expenseAccount} · {faNum(p.months)} ماه از {formatJalali(new Date(p.startOn))}
              </span>
              {p.status === "DONE" && <Badge tone="green">تمام شد</Badge>}
              {p.status === "VOID" && <Badge tone="red">باطل</Badge>}
              <VoucherLink id={p.voucherId} number={p.voucherNumber} />
              <span className="mr-auto text-xs text-gray-500">
                {formatAmount(p.amount)} · هزینه‌شده {formatAmount(p.recognized)} · مانده <b className="tabular-nums text-gray-900 dark:text-white">{formatAmount(p.remaining)}</b>
              </span>
              {data.can.manage && p.status === "ACTIVE" && (
                <span className="flex gap-1">
                  <button disabled={busy} onClick={() => run("prepaid.finish", { id: p.id }, `باقی‌مانده (${formatAmount(p.remaining)}) امروز یک‌جا هزینه شود؟`)} className={btn.small}>
                    پایان زودتر
                  </button>
                  {p.recognized === "0" && (
                    <button disabled={busy} onClick={() => askVoid("prepaid.void", p.id, "پیش‌پرداخت")} className={btn.small}>
                      ابطال
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </Card>
      )}

      {tab === "deposits" && data?.deposits.length === 0 && <Empty title="ودیعه‌ای ثبت نشده" desc="رهن مغازه یا سپرده‌ی ضمانت دارایی شماست و هزینه نیست؛ روز پس گرفتن به صندوق یا بانک برمی‌گردد." action={add} />}
      {tab === "deposits" && !!data?.deposits.length && (
        <Card className="divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
          {data.deposits.map((d) => (
            <div key={d.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm ${d.status === "VOID" ? "opacity-50" : ""}`}>
              <span className="font-bold">{d.title}</span>
              <span className="text-xs text-gray-500">
                نزد {d.counterparty} · {formatJalali(new Date(d.paidOn))}
              </span>
              {d.status === "RETURNED" && (
                <Badge tone="green">
                  برگشت {d.returnedOn ? formatJalali(new Date(d.returnedOn)) : ""}
                  {d.returnedAmount && d.returnedAmount !== d.amount ? ` (${formatAmount(d.returnedAmount)})` : ""}
                </Badge>
              )}
              {d.status === "VOID" && <Badge tone="red">باطل</Badge>}
              <VoucherLink id={d.voucherId} number={d.voucherNumber} />
              <VoucherLink id={d.returnVoucherId} number={d.returnVoucherNumber} />
              <span className="mr-auto font-bold tabular-nums">{formatAmount(d.amount)}</span>
              {data.can.manage && d.status === "HELD" && (
                <span className="flex gap-1">
                  <button disabled={busy} onClick={() => setReturning(d)} className={btn.small}>
                    پس گرفتم
                  </button>
                  <button disabled={busy} onClick={() => askVoid("deposit.void", d.id, "ودیعه")} className={btn.small}>
                    ابطال
                  </button>
                </span>
              )}
              {data.can.manage && d.status === "RETURNED" && (
                <button disabled={busy} onClick={() => run("deposit.unreturn", { id: d.id }, "ثبت بازگشت ودیعه باطل شود؟")} className={btn.small}>
                  برگرداندن بازگشت
                </button>
              )}
            </div>
          ))}
        </Card>
      )}

      {data && (
        <>
          <AssetForm open={sheet === "asset"} onClose={() => setSheet(null)} accounts={data.accounts} onSaved={(id) => router.push(`${BASE}/${id}`)} />
          <PrepaidForm
            open={sheet === "prepaid"}
            onClose={() => setSheet(null)}
            accounts={data.expenseAccounts}
            onSaved={() => {
              setSheet(null);
              load();
            }}
          />
          <DepositForm
            open={sheet === "deposit"}
            onClose={() => setSheet(null)}
            onSaved={() => {
              setSheet(null);
              load();
            }}
          />
          <ReturnDeposit
            deposit={returning}
            accounts={data.expenseAccounts}
            onClose={() => setReturning(null)}
            onSaved={() => {
              setReturning(null);
              load();
            }}
          />
        </>
      )}
    </div>
  );
}

type PFunding = "TREASURY" | "CREDIT" | "EXISTING";

function PrepaidForm({ open, onClose, onSaved, accounts }: { open: boolean; onClose: () => void; onSaved: () => void; accounts: AccountOpt[] }) {
  const treasuries = useTreasuries();
  const today = dayValue(todayKey());
  const [title, setTitle] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [startOn, setStartOn] = useState("");
  const [months, setMonths] = useState("12");
  const [funding, setFunding] = useState<PFunding>("TREASURY");
  const [treasuryId, setTreasuryId] = useState("");
  const [party, setParty] = useState<PartyOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Math.round(parseNum(months));
  const share = n > 0 && amount ? BigInt(amount) / BigInt(n) : 0n;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await act("prepaid.create", { title, expenseAccountId: accountId, amount: amount || "0", paidOn, startOn: startOn || null, months: n, funding, treasuryId: funding === "TREASURY" ? treasuryId : null, partyId: funding === "CREDIT" ? party?.id : null });
      setTitle("");
      setAmount("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="پیش‌پرداخت تازه"
      help="accountingAssets"
      footer={
        <div className="flex items-center gap-3">
          {share > 0n && (
            <span className="text-xs text-gray-500">
              هر ماه <b className="tabular-nums text-gray-900 dark:text-white">{formatAmount(share)}</b> هزینه می‌شود
            </span>
          )}
          <button onClick={save} disabled={busy} className={`${btn.primary} mr-auto`}>
            {busy ? "در حال ثبت…" : "ثبت"}
          </button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عنوان" className="sm:col-span-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="مثلاً: اجاره‌ی یک‌ساله‌ی مغازه" />
        </Field>
        <Field label="هزینه‌ی کدام حساب" hint="هر ماه سهمش به این حساب می‌رود">
          <AccountSelect value={accountId} onChange={setAccountId} items={accounts} />
        </Field>
        <Field label="مبلغ کل (تومان)">
          <AmountInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="تاریخ پرداخت">
          <JalaliDatePicker value={paidOn} onChange={setPaidOn} />
        </Field>
        <Field label="چند ماه؟">
          <input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" className={inputCls} />
        </Field>
        <Field label="ماه اول" hint="اگر از ماه پرداخت نیست">
          <JalaliDatePicker value={startOn || paidOn} onChange={setStartOn} />
        </Field>
        <Field label="پول از کجا رفت؟" className="sm:col-span-2">
          <Segmented<PFunding>
            value={funding}
            onChange={setFunding}
            options={[
              { value: "TREASURY", label: "صندوق / بانک" },
              { value: "CREDIT", label: "نسیه" },
              { value: "EXISTING", label: "قبلاً ثبت شده" },
            ]}
          />
        </Field>
        {funding === "TREASURY" && (
          <Field label="پرداخت از">
            <TreasurySelect value={treasuryId} onChange={setTreasuryId} items={treasuries} />
          </Field>
        )}
        {funding === "CREDIT" && (
          <Field label="طرف حساب">
            <PartyPicker value={party} onChange={setParty} canCreate />
          </Field>
        )}
        {funding === "EXISTING" && <p className="sm:col-span-2 text-xs text-gray-500 leading-6">سند پرداخت نمی‌خورد؛ مانده باید روی «پیش‌پرداخت هزینه‌ها» باشد (مانده‌های اول دوره یا سند دستی). سهم ماهانه از همین‌جا ثبت می‌شود.</p>}
      </div>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function DepositForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const treasuries = useTreasuries();
  const [title, setTitle] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(dayValue(todayKey()));
  const [funding, setFunding] = useState<"TREASURY" | "EXISTING">("TREASURY");
  const [treasuryId, setTreasuryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await act("deposit.create", { title, counterparty, amount: amount || "0", paidOn, funding, treasuryId: funding === "TREASURY" ? treasuryId : null });
      setTitle("");
      setAmount("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ودیعه‌ی تازه"
      help="accountingAssets"
      footer={
        <button onClick={save} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "در حال ثبت…" : "ثبت"}
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عنوان">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="مثلاً: رهن مغازه" />
        </Field>
        <Field label="نزد چه کسی">
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className={inputCls} placeholder="موجر، بانک، …" />
        </Field>
        <Field label="مبلغ (تومان)">
          <AmountInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="تاریخ پرداخت">
          <JalaliDatePicker value={paidOn} onChange={setPaidOn} />
        </Field>
        <Field label="پول از کجا رفت؟" className="sm:col-span-2">
          <Segmented
            value={funding}
            onChange={setFunding}
            options={[
              { value: "TREASURY", label: "صندوق / بانک" },
              { value: "EXISTING", label: "قبلاً ثبت شده" },
            ]}
          />
        </Field>
        {funding === "TREASURY" ? (
          <Field label="پرداخت از">
            <TreasurySelect value={treasuryId} onChange={setTreasuryId} items={treasuries} />
          </Field>
        ) : (
          <p className="sm:col-span-2 text-xs text-gray-500 leading-6">سندی نمی‌خورد؛ مبلغ باید در «مانده‌های اول دوره» روی «ودیعه‌ی اجاره (رهن)» باشد.</p>
        )}
      </div>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function ReturnDeposit({ deposit, accounts, onClose, onSaved }: { deposit: Deposit | null; accounts: AccountOpt[]; onClose: () => void; onSaved: () => void }) {
  const treasuries = useTreasuries();
  const [date, setDate] = useState(dayValue(todayKey()));
  const [amount, setAmount] = useState("");
  const [treasuryId, setTreasuryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (deposit) setAmount(deposit.amount);
    setError(null);
  }, [deposit]);
  if (!deposit) return null;
  const short = BigInt(deposit.amount) - BigInt(amount || "0");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await act("deposit.return", { id: deposit!.id, date, amount: amount || "0", treasuryId, shortfallAccountId: short > 0n ? accountId : null });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`بازگشت ودیعه — ${deposit.title}`}
      footer={
        <button onClick={save} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "در حال ثبت…" : "ثبت بازگشت"}
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="تاریخ">
          <JalaliDatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="مبلغ برگشتی" hint={`ودیعه ${formatAmount(deposit.amount)}`}>
          <AmountInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="واریز به">
          <TreasurySelect value={treasuryId} onChange={setTreasuryId} items={treasuries} />
        </Field>
        {short > 0n && (
          <Field label={`کسر ${formatAmount(short)} هزینه‌ی کدام حساب؟`} hint="خسارت، بدهی قبض، …">
            <AccountSelect value={accountId} onChange={setAccountId} items={accounts} />
          </Field>
        )}
      </div>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
