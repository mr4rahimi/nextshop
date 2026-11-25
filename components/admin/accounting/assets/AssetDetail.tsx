"use client";

/** یک دارایی: بها، انباشته، ارزش دفتری، سند هر ماه، جدول باقی عمر، فروش/اسقاط (بخش ۳۴.۵) */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dayValue, todayKey } from "@/lib/accounting/dates";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { formatJalali } from "@/lib/club/jalali";
import { CATEGORY_LABELS, depSchedule, yearlySchedule, type AssetCategory, type DepMethod } from "@/lib/accounting/assets/calc";
import JalaliDatePicker from "@/components/admin/JalaliDatePicker";
import AmountInput from "../AmountInput";
import PartyPicker, { type PartyOption } from "../PartyPicker";
import { api, Badge, btn, Card, ErrorText, Field, PageHeader, Segmented, Sheet, Stat } from "../ui";
import AssetForm, { type AssetEdit } from "./AssetForm";
import { act, ASSETS_API, TreasurySelect, useTreasuries, VoucherLink, type AccountOpt } from "./shared";

interface V {
  id: string;
  number: number;
  status: string;
}
interface Detail {
  asset: AssetEdit & {
    number: number;
    status: "ACTIVE" | "DISPOSED" | "VOID";
    disposedOn: string | null;
    disposalAmount: string | null;
    disposalDep: string | null;
    voidReason: string | null;
    createdByName: string;
  };
  account: AccountOpt | null;
  treasury: { id: string; name: string } | null;
  party: { id: string; name: string } | null;
  invoiceLine: { title: string; invoice: { id: string; number: number; date: string } } | null;
  disposal: { treasury: { id: string; name: string } | null; party: { id: string; name: string } | null };
  voucher: V | null;
  disposalVoucher: V | null;
  entries: { id: string; month: string; amount: string; voucher: V | null }[];
  accum: string;
  book: string;
  catchUpToday: string;
  can: { manage: boolean };
}

const FUNDING: Record<string, string> = { INVOICE: "فاکتور خرید", TREASURY: "نقد / بانک", CREDIT: "نسیه", EXISTING: "از قبل در دفاتر" };

export default function AssetDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);

  const load = useCallback(() => {
    api<Detail>(`${ASSETS_API}/${id}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ accounts: AccountOpt[] }>(ASSETS_API)
      .then((x) => setAccounts(x.accounts))
      .catch(() => {});
  }, []);

  const rows = useMemo(() => {
    if (!d) return [];
    const a = d.asset;
    return depSchedule(
      { cost: BigInt(a.cost), salvage: BigInt(a.salvage), method: a.method as DepMethod, lifeMonths: a.lifeMonths, rateBp: a.rateBp, openingAccum: BigInt(a.openingAccum) },
      new Date(a.inServiceOn),
    );
  }, [d]);

  async function run(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      await act(action, { id, ...body });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  if (!d) return <ErrorText>{error}</ErrorText>;
  const a = d.asset;
  const today = Date.now();
  const future = yearlySchedule(rows.filter((r) => r.end.getTime() >= today));

  return (
    <div className="space-y-4">
      <PageHeader
        title={a.name}
        help="accountingAssets"
        desc={`دارایی ${faNum(a.number)} · ${CATEGORY_LABELS[a.category as AssetCategory]}`}
        back={{ href: "/admin/accounting/assets", label: "دارایی ثابت" }}
        actions={
          d.can.manage && (
            <div className="flex flex-wrap gap-2">
              {a.status === "ACTIVE" && (
                <>
                  <button onClick={() => setEditing(true)} className={btn.soft}>
                    ویرایش
                  </button>
                  <button onClick={() => setDisposing(true)} className={btn.primary}>
                    فروش یا اسقاط
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt("دلیل ابطال؟ سند خرید باطل و استهلاک ثبت‌شده برگردانده می‌شود.");
                      if (reason) run("asset.void", { reason });
                    }}
                    className={btn.danger}
                  >
                    ابطال
                  </button>
                </>
              )}
              {a.status === "DISPOSED" && (
                <button disabled={busy} onClick={() => window.confirm("فروش یا اسقاط برگردد؟ سندش باطل می‌شود.") && run("asset.undispose")} className={btn.soft}>
                  برگرداندن فروش
                </button>
              )}
            </div>
          )
        }
      />
      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap gap-2">
        {a.status === "DISPOSED" && <Badge tone="gray">{a.disposalAmount && a.disposalAmount !== "0" ? "فروخته شد" : "اسقاط شد"} {a.disposedOn ? formatJalali(new Date(a.disposedOn)) : ""}</Badge>}
        {a.status === "VOID" && <Badge tone="red">باطل — {a.voidReason}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="بهای خرید" value={formatAmount(a.cost)} href={d.account ? `/admin/accounting/accounts/${d.account.id}` : undefined} sub={d.account?.name} />
        <Stat label="استهلاک انباشته" value={formatAmount(d.accum)} sub={a.openingAccum !== "0" ? `${formatAmount(a.openingAccum)} پیش از برنامه` : undefined} />
        <Stat label="ارزش دفتری" value={formatAmount(d.book)} tone="blue" />
        <Stat label="ارزش اسقاط" value={formatAmount(a.salvage)} />
      </div>

      <Card className="p-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Info label="تاریخ خرید" value={formatJalali(new Date(a.acquiredOn))} />
        <Info label="شروع استهلاک" value={formatJalali(new Date(a.inServiceOn))} />
        <Info label="روش" value={a.method === "STRAIGHT" ? `خط مستقیم — ${faNum(+((a.lifeMonths ?? 0) / 12).toFixed(2))} سال` : `نزولی — ${faNum((a.rateBp ?? 0) / 100)}٪ سالانه`} />
        <Info
          label="خرید"
          value={
            <>
              {FUNDING[a.funding]}
              {d.treasury && <> از {d.treasury.name}</>}
              {d.party && (
                <>
                  {" "}
                  — <Link href={`/admin/accounting/parties/${d.party.id}`} className="text-blue-600">{d.party.name}</Link>
                </>
              )}
              {d.invoiceLine && (
                <>
                  {" "}
                  — <Link href={`/admin/accounting/invoices/${d.invoiceLine.invoice.id}`} className="text-blue-600">خرید {faNum(d.invoiceLine.invoice.number)}</Link> ({d.invoiceLine.title})
                </>
              )}{" "}
              <VoucherLink id={d.voucher?.id} number={d.voucher?.number} />
            </>
          }
        />
        {a.status === "DISPOSED" && (
          <Info
            label={a.disposalAmount && a.disposalAmount !== "0" ? "فروش" : "اسقاط"}
            value={
              <>
                {formatAmount(a.disposalAmount ?? "0")}
                {d.disposal.treasury && <> به {d.disposal.treasury.name}</>}
                {d.disposal.party && <> — {d.disposal.party.name}</>} <VoucherLink id={d.disposalVoucher?.id} number={d.disposalVoucher?.number} />
              </>
            }
          />
        )}
        {a.note && <Info label="یادداشت" value={a.note} />}
        <Info label="ثبت" value={a.createdByName} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card className="overflow-hidden">
          <p className="px-4 py-3 text-sm font-black border-b border-gray-100 dark:border-white/5">استهلاک ثبت‌شده</p>
          {d.entries.length === 0 && <p className="px-4 py-4 text-xs text-gray-400">هنوز سندی نخورده؛ آخر اولین ماه کامل ثبت می‌شود.</p>}
          <div className="divide-y divide-gray-50 dark:divide-white/5 text-xs max-h-96 overflow-y-auto">
            {d.entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-1.5">
                <span className="tabular-nums">{formatJalali(new Date(e.month))}</span>
                <VoucherLink id={e.voucher?.id} number={e.voucher?.number} />
                {e.voucher?.status === "VOID" && <Badge tone="red">باطل</Badge>}
                <span className="mr-auto font-bold tabular-nums">{formatAmount(e.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
        {a.status === "ACTIVE" && future.length > 0 && (
          <Card className="overflow-hidden">
            <p className="px-4 py-3 text-sm font-black border-b border-gray-100 dark:border-white/5">باقی عمر (پیش‌بینی)</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="px-4 py-1.5 text-right">سال</th>
                  <th className="px-2 py-1.5 text-right">استهلاک</th>
                  <th className="px-4 py-1.5 text-left">ارزش دفتری پایان سال</th>
                </tr>
              </thead>
              <tbody>
                {future.map((y) => (
                  <tr key={y.year} className="border-t border-gray-50 dark:border-white/5">
                    <td className="px-4 py-1 tabular-nums">{faNum(y.year)}</td>
                    <td className="px-2 py-1 tabular-nums">{formatAmount(y.amount)}</td>
                    <td className="px-4 py-1 text-left tabular-nums">{formatAmount(y.book)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <AssetForm
        open={editing}
        onClose={() => setEditing(false)}
        accounts={accounts}
        edit={a}
        onSaved={() => {
          setEditing(false);
          load();
        }}
      />
      <DisposeSheet
        open={disposing}
        detail={d}
        onClose={() => setDisposing(false)}
        onSaved={() => {
          setDisposing(false);
          load();
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function DisposeSheet({ open, detail, onClose, onSaved }: { open: boolean; detail: Detail; onClose: () => void; onSaved: () => void }) {
  const treasuries = useTreasuries();
  const [date, setDate] = useState(dayValue(todayKey()));
  const [mode, setMode] = useState<"sell" | "credit" | "scrap">("sell");
  const [amount, setAmount] = useState("");
  const [treasuryId, setTreasuryId] = useState("");
  const [party, setParty] = useState<PartyOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // پیش‌نمایش با تاریخ امروز — سند نهایی با تاریخ انتخابی دوباره حساب می‌شود
  const accum = BigInt(detail.accum) + BigInt(detail.catchUpToday);
  const book = BigInt(detail.asset.cost) - accum;
  const amt = mode === "scrap" ? 0n : BigInt(amount || "0");
  const gain = amt - book;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await act("asset.dispose", { id: detail.asset.id, date, amount: String(amt), treasuryId: mode === "sell" ? treasuryId : null, partyId: mode === "credit" ? party?.id : null });
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
      title={`فروش یا اسقاط — ${detail.asset.name}`}
      help="accountingAssets"
      footer={
        <button onClick={save} disabled={busy} className={`${btn.primary} w-full`}>
          {busy ? "در حال ثبت…" : "ثبت"}
        </button>
      }
    >
      <div className="space-y-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "sell", label: "فروش نقدی" },
            { value: "credit", label: "فروش نسیه" },
            { value: "scrap", label: "اسقاط / دور ریختن" },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="تاریخ">
            <JalaliDatePicker value={date} onChange={setDate} />
          </Field>
          {mode !== "scrap" && (
            <Field label="مبلغ فروش">
              <AmountInput value={amount} onChange={setAmount} />
            </Field>
          )}
          {mode === "sell" && (
            <Field label="واریز به">
              <TreasurySelect value={treasuryId} onChange={setTreasuryId} items={treasuries} />
            </Field>
          )}
          {mode === "credit" && (
            <Field label="خریدار">
              <PartyPicker value={party} onChange={setParty} canCreate />
            </Field>
          )}
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-xs space-y-1">
          {BigInt(detail.catchUpToday) !== 0n && (
            <p>
              استهلاک تا آخر ماه قبل: <b className="tabular-nums">{formatAmount(detail.catchUpToday)}</b>
            </p>
          )}
          <p>
            ارزش دفتری: <b className="tabular-nums">{formatAmount(book)}</b>
          </p>
          <p className={gain < 0n ? "text-red-600" : "text-emerald-600"}>
            {gain < 0n ? "زیان" : "سود"} {mode === "scrap" ? "اسقاط" : "فروش"}: <b className="tabular-nums">{formatAmount(gain < 0n ? -gain : gain)}</b>
          </p>
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
